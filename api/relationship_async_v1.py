from __future__ import annotations

import hashlib
import json
import os
import threading
import time
import uuid

from fastapi import HTTPException

try:
    from .main import RelationshipRequest, app, relationship_western
except ImportError:  # Render runs with api/ as the working directory.
    from main import RelationshipRequest, app, relationship_western

_JOB_TTL_SECONDS = 1800
_jobs: dict[str, dict] = {}
_request_index: dict[str, str] = {}
_lock = threading.Lock()
try:
    _MAX_CONCURRENCY = max(1, min(2, int(os.getenv("ASTRO_MAX_RELATIONSHIP_CONCURRENCY", "1"))))
except ValueError:
    _MAX_CONCURRENCY = 1
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


def _run(job_id: str, request: RelationshipRequest) -> None:
    queued_at = time.time()
    _set_job(job_id, status="queued", queued_at=queued_at)
    with _semaphore:
        started_at = time.time()
        _set_job(job_id, status="running", started_at=started_at)
        try:
            result = relationship_western(request)
            _set_job(
                job_id,
                status="done",
                finished_at=time.time(),
                elapsed_seconds=round(time.time() - started_at, 3),
                result=result,
            )
        except HTTPException as exc:
            _set_job(
                job_id,
                status="failed",
                finished_at=time.time(),
                elapsed_seconds=round(time.time() - started_at, 3),
                status_code=exc.status_code,
                error=str(exc.detail),
            )
        except Exception as exc:  # noqa: BLE001
            _set_job(
                job_id,
                status="failed",
                finished_at=time.time(),
                elapsed_seconds=round(time.time() - started_at, 3),
                status_code=500,
                error=f"{type(exc).__name__}: {exc}",
            )


@app.post("/v1/relationship/western/start")
def relationship_western_start(request: RelationshipRequest) -> dict:
    _prune()
    request_key = _request_key(request)
    with _lock:
        existing_id = _request_index.get(request_key)
        existing = _jobs.get(existing_id or "") if existing_id else None
        if existing and existing.get("status") in {"queued", "running", "done"}:
            return {
                "ok": True,
                "job_id": existing_id,
                "status": existing.get("status"),
                "reused": True,
            }
        job_id = uuid.uuid4().hex
        _jobs[job_id] = {
            "created_ts": time.time(),
            "status": "queued",
            "request_key": request_key,
        }
        _request_index[request_key] = job_id

    threading.Thread(
        target=_run,
        args=(job_id, request),
        daemon=True,
        name=f"relationship-calc-{job_id[:8]}",
    ).start()
    return {"ok": True, "job_id": job_id, "status": "queued", "reused": False}


@app.get("/v1/relationship/western/jobs/{job_id}")
def relationship_western_job(job_id: str) -> dict:
    _prune()
    with _lock:
        job = dict(_jobs.get(job_id) or {})
    if not job:
        raise HTTPException(status_code=404, detail="relationship calculation job not found or expired")
    created_ts = float(job.pop("created_ts", 0) or 0)
    job.pop("request_key", None)
    if job.get("status") in {"queued", "running"} and created_ts:
        job["elapsed_seconds"] = round(time.time() - created_ts, 3)
    return {"job_id": job_id, **job}
