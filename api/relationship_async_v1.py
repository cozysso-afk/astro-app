from __future__ import annotations

import hashlib
import json
import os
import threading
import time
import uuid
from datetime import datetime, time as dt_time

from fastapi import HTTPException

try:
    from .main import APP_VERSION, RelationshipRequest, _month_segments, app
except ImportError:  # Render runs with api/ as the working directory.
    from main import APP_VERSION, RelationshipRequest, _month_segments, app

from relationship_return_v1 import ENGINE_VERSION as REL_RETURN_ENGINE_VERSION, augment_relationship_with_returns
from relationship_saju_v1 import ENGINE_VERSION as REL_SAJU_ENGINE_VERSION, build_relationship_saju
from relationship_western_v1 import ENGINE_VERSION as REL_ENGINE_VERSION, build_relationship_western
from reunion_hierarchy_v2 import apply_reunion_hierarchy
from timezone_provenance_v1 import resolve_local_datetime

_JOB_TTL_SECONDS = 1800
try:
    _HARD_TIMEOUT_SECONDS = max(30, min(180, int(os.getenv("ASTRO_RELATIONSHIP_HARD_TIMEOUT_SECONDS", "75"))))
except ValueError:
    _HARD_TIMEOUT_SECONDS = 75
try:
    _MAX_CONCURRENCY = max(1, min(2, int(os.getenv("ASTRO_MAX_RELATIONSHIP_CONCURRENCY", "1"))))
except ValueError:
    _MAX_CONCURRENCY = 1

_jobs: dict[str, dict] = {}
_request_index: dict[str, str] = {}
_lock = threading.Lock()
_semaphore = threading.Semaphore(_MAX_CONCURRENCY)


def _prune() -> None:
    cutoff = time.time() - _JOB_TTL_SECONDS
    with _lock:
        stale = [job_id for job_id, job in _jobs.items() if float(job.get("created_ts", 0)) < cutoff]
        for job_id in stale:
            _jobs.pop(job_id, None)
        live = set(_jobs)
        for request_key, job_id in list(_request_index.items()):
            if job_id not in live:
                _request_index.pop(request_key, None)


def _set_job(job_id: str, **fields) -> None:
    with _lock:
        job = _jobs.setdefault(job_id, {"created_ts": time.time()})
        job.update(fields)


def _request_key(request: RelationshipRequest) -> str:
    payload = request.model_dump(mode="json")
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _progress(job_id: str, phase: str, percent: int, detail: str) -> None:
    _set_job(
        job_id,
        heartbeat_ts=time.time(),
        progress={
            "phase": phase,
            "percent": max(0, min(99, int(percent))),
            "detail": detail,
        },
    )


def _compact_public_response(response: dict) -> dict:
    """Remove engine-audit arrays that the mobile UI never consumes.

    The canonical engine still computes and tests these arrays. They are only
    removed from the public async response after all selection/evidence work is
    complete, preventing multi-megabyte 365-day payloads from freezing iOS.
    """
    result = response.get("result")
    if not isinstance(result, dict):
        return response

    hierarchy = result.get("reunion_hierarchy")
    if isinstance(hierarchy, dict):
        omitted_counts: dict[str, int] = {}
        for key in ("daily_trace", "long_term_daily", "saju_boundaries"):
            value = hierarchy.pop(key, None)
            if isinstance(value, list):
                omitted_counts[key] = len(value)
        hierarchy["mobile_payload_policy"] = {
            "audit_arrays_omitted": True,
            "omitted_counts": omitted_counts,
            "reason": "full daily audit arrays remain engine-internal; mobile UI consumes selected windows/evidence only",
        }
    return response


def _calculate_reunion(job_id: str, request: RelationshipRequest) -> dict:
    """Run the existing reunion semantics with stage heartbeats for production diagnostics."""
    if request.analysis_mode != "reunion":
        raise HTTPException(status_code=422, detail="async relationship jobs are reserved for analysis_mode=reunion")

    user_payload = request.user.engine_payload()
    cp_payload = request.counterpart.engine_payload()

    if not user_payload["time_known"] or user_payload["birth_time"] is None:
        raise HTTPException(status_code=422, detail="user birth_time is required for the relationship engine")
    if cp_payload["time_known"] and cp_payload["birth_time"] is None:
        raise HTTPException(status_code=422, detail="counterpart birth_time is required when time_known=true")

    segments = _month_segments(request.start_date, request.end_date)

    _progress(job_id, "base_relationship", 8, "기본 관계·트랜짓 계산")
    result = build_relationship_western(user_payload, cp_payload, segments, analysis_mode=request.analysis_mode)

    _progress(job_id, "saju_crosscheck", 30, "사주 관계 교차검증")
    try:
        result["saju_relationship"] = build_relationship_saju(user_payload, cp_payload)
    except Exception as saju_exc:  # optional background layer
        result["saju_relationship"] = {
            "available": False,
            "engine": REL_SAJU_ENGINE_VERSION,
            "error": str(saju_exc),
        }

    _progress(job_id, "returns", 42, "태양·달·개인행성 회귀 계산")
    try:
        result = augment_relationship_with_returns(
            result,
            user_payload,
            cp_payload,
            request.start_date,
            request.end_date,
        )
    except Exception as return_exc:  # same optional fallback as the synchronous endpoint
        result["reunion_return_support"] = {
            "available": False,
            "engine": REL_RETURN_ENGINE_VERSION,
            "error": str(return_exc),
            "policy": "Solar/Lunar Return is an optional background cross-check and does not block the core reunion calculation.",
            "event_probability": "not_calculated",
        }

    _progress(job_id, "reunion_hierarchy", 58, "365일 재회 계층·시기 선별")
    query_offset = (
        request.query_utc_offset_hours
        if request.query_utc_offset_hours is not None
        else request.user.utc_offset_hours
    )
    query_resolution = resolve_local_datetime(
        request.start_date,
        dt_time(12, 0),
        timezone_id=request.query_timezone_id,
        utc_offset_hours=query_offset,
    )
    as_of = request.as_of_date or datetime.now(query_resolution.tzinfo).date()
    result = apply_reunion_hierarchy(
        result,
        user_payload,
        cp_payload,
        request.start_date,
        request.end_date,
        as_of_date=as_of,
        query_utc_offset_hours=query_offset,
        query_timezone_id=request.query_timezone_id,
    )

    _progress(job_id, "finalizing", 96, "결과 정리")
    response = {
        "ok": bool(result.get("ok", True)),
        "api_version": APP_VERSION,
        "engine": result.get("engine", REL_ENGINE_VERSION),
        "relationship_status": request.relationship_status,
        "period": {
            "start": request.start_date.isoformat(),
            "end": request.end_date.isoformat(),
            "month_segments": len(segments),
        },
        "result": result,
        "interpretation_policy": {
            "probability": False,
            "private_feelings_claims": False,
            "marriage_mode": "결혼 여부 예언이 아니라 장기 결속·관계 주기·협력/긴장 활성도를 해석하는 모드",
        },
    }
    return _compact_public_response(response)


def _run(job_id: str, request: RelationshipRequest) -> None:
    queued_at = time.time()
    _set_job(
        job_id,
        status="queued",
        queued_at=queued_at,
        heartbeat_ts=queued_at,
        progress={"phase": "queued", "percent": 0, "detail": "계산 대기"},
    )

    with _semaphore:
        started_at = time.time()
        _set_job(
            job_id,
            status="running",
            started_at=started_at,
            heartbeat_ts=started_at,
            progress={"phase": "starting", "percent": 1, "detail": "계산 시작"},
        )

        box: dict[str, object] = {}

        def calculate() -> None:
            try:
                box["result"] = _calculate_reunion(job_id, request)
            except HTTPException as exc:
                box["http_error"] = exc
            except Exception as exc:  # noqa: BLE001
                box["error"] = exc

        worker = threading.Thread(
            target=calculate,
            daemon=True,
            name=f"relationship-core-{job_id[:8]}",
        )
        worker.start()
        worker.join(timeout=_HARD_TIMEOUT_SECONDS)

        if worker.is_alive():
            with _lock:
                current = dict(_jobs.get(job_id) or {})
            phase = str((current.get("progress") or {}).get("phase") or "unknown")
            _set_job(
                job_id,
                status="failed",
                finished_at=time.time(),
                elapsed_seconds=round(time.time() - started_at, 3),
                status_code=504,
                timed_out=True,
                error=(
                    f"재회운 계산이 {_HARD_TIMEOUT_SECONDS}초 제한을 넘겨 중단 처리됐어. "
                    f"마지막 단계: {phase}. 같은 멈춘 작업을 다시 재사용하지 않도록 차단했어."
                ),
            )
            return

        if "http_error" in box:
            exc = box["http_error"]
            assert isinstance(exc, HTTPException)
            _set_job(
                job_id,
                status="failed",
                finished_at=time.time(),
                elapsed_seconds=round(time.time() - started_at, 3),
                status_code=exc.status_code,
                error=str(exc.detail),
            )
            return

        if "error" in box:
            exc = box["error"]
            assert isinstance(exc, Exception)
            _set_job(
                job_id,
                status="failed",
                finished_at=time.time(),
                elapsed_seconds=round(time.time() - started_at, 3),
                status_code=500,
                error=f"{type(exc).__name__}: {exc}",
            )
            return

        if "result" not in box:
            _set_job(
                job_id,
                status="failed",
                finished_at=time.time(),
                elapsed_seconds=round(time.time() - started_at, 3),
                status_code=500,
                error="재회운 계산 작업이 결과 없이 종료됐어.",
            )
            return

        _set_job(
            job_id,
            status="done",
            finished_at=time.time(),
            elapsed_seconds=round(time.time() - started_at, 3),
            progress={"phase": "done", "percent": 100, "detail": "계산 완료"},
            result=box["result"],
        )


def _can_reuse(existing: dict, now: float) -> bool:
    status = existing.get("status")
    if status == "done":
        return True
    if status not in {"queued", "running"}:
        return False
    anchor = float(existing.get("started_at") or existing.get("queued_at") or existing.get("created_ts") or 0)
    if not anchor:
        return False
    return (now - anchor) <= (_HARD_TIMEOUT_SECONDS + 5)


@app.post("/v1/relationship/western/start")
def relationship_western_start(request: RelationshipRequest) -> dict:
    _prune()
    request_key = _request_key(request)
    now = time.time()
    with _lock:
        existing_id = _request_index.get(request_key)
        existing = _jobs.get(existing_id or "") if existing_id else None
        if existing and _can_reuse(existing, now):
            return {
                "ok": True,
                "job_id": existing_id,
                "status": existing.get("status"),
                "reused": True,
                "progress": existing.get("progress"),
            }
        if existing_id and existing and existing.get("status") in {"queued", "running"}:
            existing.update({
                "status": "failed",
                "finished_at": now,
                "status_code": 504,
                "timed_out": True,
                "error": "이전 재회운 작업이 응답 제한을 넘겨 폐기됐어. 새 작업으로 다시 시작해.",
            })

        job_id = uuid.uuid4().hex
        _jobs[job_id] = {
            "created_ts": now,
            "status": "queued",
            "queued_at": now,
            "heartbeat_ts": now,
            "request_key": request_key,
            "progress": {"phase": "queued", "percent": 0, "detail": "계산 대기"},
        }
        _request_index[request_key] = job_id

    threading.Thread(
        target=_run,
        args=(job_id, request),
        daemon=True,
        name=f"relationship-calc-{job_id[:8]}",
    ).start()
    return {
        "ok": True,
        "job_id": job_id,
        "status": "queued",
        "reused": False,
        "progress": {"phase": "queued", "percent": 0, "detail": "계산 대기"},
    }


@app.get("/v1/relationship/western/jobs/{job_id}")
def relationship_western_job(job_id: str) -> dict:
    _prune()
    with _lock:
        job = dict(_jobs.get(job_id) or {})
    if not job:
        raise HTTPException(status_code=404, detail="relationship calculation job not found or expired")

    created_ts = float(job.pop("created_ts", 0) or 0)
    job.pop("request_key", None)
    result_ready = job.get("status") == "done" and isinstance(job.get("result"), dict)
    job.pop("result", None)
    if job.get("status") in {"queued", "running"} and created_ts:
        job["elapsed_seconds"] = round(time.time() - created_ts, 3)
    return {"job_id": job_id, "result_ready": result_ready, **job}


@app.get("/v1/relationship/western/jobs/{job_id}/result")
def relationship_western_job_result(job_id: str) -> dict:
    _prune()
    with _lock:
        job = dict(_jobs.get(job_id) or {})
    if not job:
        raise HTTPException(status_code=404, detail="relationship calculation job not found or expired")
    if job.get("status") == "failed":
        raise HTTPException(
            status_code=int(job.get("status_code") or 500),
            detail=str(job.get("error") or "재회운 계산이 실패했어."),
        )
    if job.get("status") != "done":
        raise HTTPException(status_code=409, detail="relationship calculation is not finished yet")
    result = job.get("result")
    if not isinstance(result, dict):
        raise HTTPException(status_code=500, detail="relationship calculation completed without a result")
    return result
