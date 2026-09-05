from __future__ import annotations

import hashlib
import json
import os
import threading
import time
import uuid
from datetime import date, datetime, time as dt_time, timedelta, timezone
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

from integrated_fortune_v1 import ENGINE_VERSION as INTEGRATED_ENGINE_VERSION
from integrated_fortune_v1 import build_integrated_fortune
from ai_interpret_v1 import AI_DEFAULT_MODEL, ai_status, interpret_integrated_fortune
from relationship_western_v1 import ENGINE_VERSION as REL_ENGINE_VERSION
from relationship_western_v1 import build_relationship_western
from relationship_saju_v1 import ENGINE_VERSION as REL_SAJU_ENGINE_VERSION, build_relationship_saju
from astrocartography_v1 import ENGINE_VERSION as LOCATION_ENGINE_VERSION, build_location_fit
from personal_marriage_v1 import ENGINE_VERSION as PERSONAL_MARRIAGE_ENGINE_VERSION, build_personal_marriage
from personal_love_forecast_v1 import ENGINE_VERSION as PERSONAL_LOVE_ENGINE_VERSION, build_personal_love_forecast
from birth_time_reliability_v1 import resolve_birth_time_reliability

APP_VERSION = "api-fortune-v5.7-purpose-separated-love"

app = FastAPI(
    title="별빛의 운명 API",
    version=APP_VERSION,
    description="Streamlit UI와 분리된 별빛의 운명 계산 API 레이어",
)

_allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "ASTRO_ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,https://astro-app-web-ten.vercel.app,https://cozysso-afk.github.io",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


RelationshipStatus = Literal[
    "single",
    "dating",
    "long_term",
    "cohabiting",
    "engaged",
    "married",
]
Gender = Literal["female", "male"]


TimeSource = Literal["official_record", "family_memory", "user_estimate", "arbitrary_input", "rectified", "unknown"]
TimeConfidence = Literal["exact", "high", "medium", "low", "unknown"]


class RectifiedWindow(BaseModel):
    start: dt_time | None = None
    end: dt_time | None = None


class RelationshipProfile(BaseModel):
    name: str | None = None
    birth_date: date
    birth_time: dt_time | None = None
    time_known: bool | None = None
    time_source: TimeSource = "unknown"
    time_confidence: TimeConfidence = "unknown"
    rectified_window: RectifiedWindow | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    utc_offset_hours: float = Field(default=9.0, ge=-14, le=14)

    def engine_payload(self) -> dict:
        normalized_time_known = self.time_known if self.time_known is not None else self.birth_time is not None
        raw = {
            "birth_time": self.birth_time,
            "time_known": normalized_time_known,
            "time_source": self.time_source,
            "time_confidence": self.time_confidence,
            "rectified_window": self.rectified_window.model_dump() if self.rectified_window else None,
        }
        reliability = resolve_birth_time_reliability(raw)
        return {
            "name": self.name or "",
            "birth_date": self.birth_date,
            "birth_time": self.birth_time if reliability["time_available"] else None,
            "time_known": reliability["time_available"],
            "time_source": reliability["time_source"],
            "time_confidence": reliability["time_confidence"],
            "rectified_window": reliability["rectified_window"],
            "time_reliability": reliability,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "utc_offset_hours": self.utc_offset_hours,
        }


class RelationshipRequest(BaseModel):
    user: RelationshipProfile
    counterpart: RelationshipProfile
    start_date: date
    end_date: date
    relationship_status: RelationshipStatus = "dating"
    analysis_mode: Literal["compatibility", "reunion", "marriage_unmarried", "marriage_married"] = "compatibility"


class PersonalLoveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    profile: RelationshipProfile
    start_date: date
    end_date: date


class FortuneProfile(BaseModel):
    name: str | None = None
    birth_date: date
    birth_time: dt_time
    time_known: bool = True
    time_source: TimeSource = "unknown"
    time_confidence: TimeConfidence = "unknown"
    rectified_window: RectifiedWindow | None = None
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    utc_offset_hours: float = Field(default=9.0, ge=-14, le=14)
    gender: Gender = "female"


class IntegratedFortuneRequest(BaseModel):
    profile: FortuneProfile
    start_date: date
    end_date: date


class PersonalMarriageRequest(BaseModel):
    profile: FortuneProfile
    start_date: date
    end_date: date


class IntegratedInterpretRequest(BaseModel):
    calculation: dict
    model: str = AI_DEFAULT_MODEL


class LocationFitRequest(BaseModel):
    profile: FortuneProfile


_ai_jobs: dict[str, dict] = {}
_ai_jobs_lock = threading.Lock()
_calc_jobs: dict[str, dict] = {}
_calc_jobs_lock = threading.Lock()
_calc_request_index: dict[str, str] = {}
try:
    _MAX_CALC_CONCURRENCY = max(1, min(2, int(os.getenv("ASTRO_MAX_CALC_CONCURRENCY", "1"))))
except ValueError:
    _MAX_CALC_CONCURRENCY = 1
_calc_semaphore = threading.Semaphore(_MAX_CALC_CONCURRENCY)
_JOB_TTL_SECONDS = 1800


def _prune_jobs(store: dict, lock: threading.Lock):
    cutoff = time.time() - _JOB_TTL_SECONDS
    with lock:
        stale = [key for key, value in store.items() if float(value.get("created_ts", 0)) < cutoff]
        for key in stale:
            store.pop(key, None)
        if store is _calc_jobs:
            live = set(store)
            for request_key, job_id in list(_calc_request_index.items()):
                if job_id not in live:
                    _calc_request_index.pop(request_key, None)


def _calc_request_key(payload: dict) -> str:
    normalized = {
        key: value.isoformat() if hasattr(value, "isoformat") else value
        for key, value in payload.items()
    }
    raw = json.dumps(normalized, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _month_segments(start_date: date, end_date: date) -> list[tuple[date, date]]:
    if end_date < start_date:
        raise HTTPException(status_code=422, detail="end_date must be on or after start_date")
    if (end_date - start_date).days > 730:
        raise HTTPException(status_code=422, detail="relationship timing range is limited to 731 days per request")

    segments: list[tuple[date, date]] = []
    cursor = date(start_date.year, start_date.month, 1)
    while cursor <= end_date:
        next_month = date(
            cursor.year + (1 if cursor.month == 12 else 0),
            1 if cursor.month == 12 else cursor.month + 1,
            1,
        )
        month_end = next_month - timedelta(days=1)
        seg_start = max(start_date, cursor)
        seg_end = min(end_date, month_end)
        if seg_start <= seg_end:
            segments.append((seg_start, seg_end))
        cursor = next_month
    return segments


def _set_job(store: dict, lock: threading.Lock, job_id: str, **fields):
    with lock:
        record = store.setdefault(job_id, {"created_ts": time.time()})
        record.update(fields)


def _run_ai_job(job_id: str, calculation: dict, model: str):
    _set_job(_ai_jobs, _ai_jobs_lock, job_id, status="running")
    try:
        result = interpret_integrated_fortune(calculation, model)
        _set_job(_ai_jobs, _ai_jobs_lock, job_id, status="done", result=result)
    except Exception as exc:  # noqa: BLE001
        _set_job(_ai_jobs, _ai_jobs_lock, job_id, status="failed", error=f"{type(exc).__name__}: {exc}")


def _run_calc_job(job_id: str, payload: dict):
    total_days = int((payload["end_date"] - payload["start_date"]).days + 1)
    _set_job(_calc_jobs, _calc_jobs_lock, job_id, status="queued", progress={"completed": 0, "total": total_days, "percent": 0, "stage": "queued"})
    with _calc_semaphore:
        _set_job(_calc_jobs, _calc_jobs_lock, job_id, status="running", progress={"completed": 0, "total": total_days, "percent": 0, "stage": "starting"})
        def on_progress(completed: int, total: int, stage: str):
            percent = int(round((completed / max(1, total)) * 100))
            _set_job(_calc_jobs, _calc_jobs_lock, job_id, progress={"completed": completed, "total": total, "percent": percent, "stage": stage})
        try:
            result = build_integrated_fortune(**payload, progress_callback=on_progress)
            _set_job(_calc_jobs, _calc_jobs_lock, job_id, status="done", progress={"completed": total_days, "total": total_days, "percent": 100, "stage": "done"}, result=result)
        except Exception as exc:  # noqa: BLE001
            _set_job(_calc_jobs, _calc_jobs_lock, job_id, status="failed", error=f"{type(exc).__name__}: {exc}")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "version": APP_VERSION}


@app.get("/v1/meta")
def meta() -> dict:
    return {
        "api_version": APP_VERSION,
        "relationship_engine": REL_ENGINE_VERSION,
        "integrated_engine": INTEGRATED_ENGINE_VERSION,
        "location_engine": LOCATION_ENGINE_VERSION,
        "personal_marriage_engine": PERSONAL_MARRIAGE_ENGINE_VERSION,
        "personal_love_engine": PERSONAL_LOVE_ENGINE_VERSION,
        "calculation_engine_connected": True,
        "ai_interpretation": ai_status(),
        "routes": [
            "relationship/western",
            "love/personal",
            "love/new-relationship",
            "fortune/integrated",
            "fortune/interpret",
            "location/fit",
            "marriage/personal",
        ],
    }


@app.get("/v1/fortune/ai-meta")
def fortune_ai_meta() -> dict:
    return ai_status()


@app.post("/v1/fortune/interpret")
def fortune_interpret(request: IntegratedInterpretRequest) -> dict:
    if not isinstance(request.calculation, dict) or not request.calculation:
        raise HTTPException(status_code=422, detail="calculation result is required")
    return interpret_integrated_fortune(request.calculation, request.model)


@app.post("/v1/fortune/interpret/start")
def fortune_interpret_start(request: IntegratedInterpretRequest) -> dict:
    if not isinstance(request.calculation, dict) or not request.calculation:
        raise HTTPException(status_code=422, detail="calculation result is required")
    _prune_jobs(_ai_jobs, _ai_jobs_lock)
    job_id = uuid.uuid4().hex
    _set_job(_ai_jobs, _ai_jobs_lock, job_id, status="queued")
    threading.Thread(
        target=_run_ai_job,
        args=(job_id, request.calculation, request.model),
        daemon=True,
        name=f"fortune-ai-{job_id[:8]}",
    ).start()
    return {"ok": True, "job_id": job_id, "status": "queued"}


@app.get("/v1/fortune/interpret/jobs/{job_id}")
def fortune_interpret_job(job_id: str) -> dict:
    _prune_jobs(_ai_jobs, _ai_jobs_lock)
    with _ai_jobs_lock:
        job = dict(_ai_jobs.get(job_id) or {})
    if not job:
        raise HTTPException(status_code=404, detail="AI job not found or expired")
    job.pop("created_ts", None)
    job.pop("request_key", None)
    return {"job_id": job_id, **job}


@app.post("/v1/location/fit")
def location_fit(request: LocationFitRequest) -> dict:
    try:
        result = build_location_fit(
            birth_date=request.profile.birth_date,
            birth_time=request.profile.birth_time,
            utc_offset_hours=request.profile.utc_offset_hours,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"location fit calculation failed: {exc}") from exc
    return {
        "api_version": APP_VERSION,
        "engine": LOCATION_ENGINE_VERSION,
        **result,
    }


def _personal_love_response(request: PersonalLoveRequest, mode: Literal["personal_love_forecast", "new_relationship"]) -> dict:
    profile_payload = request.profile.engine_payload()
    try:
        result = build_personal_love_forecast(
            profile_payload,
            start_date=request.start_date,
            end_date=request.end_date,
            mode=mode,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"personal love calculation failed: {exc}") from exc
    return {
        "ok": bool(result.get("ok", True)),
        "api_version": APP_VERSION,
        "engine": result.get("engine", PERSONAL_LOVE_ENGINE_VERSION),
        "analysis_mode": mode,
        "period": result.get("period") or {"start": request.start_date.isoformat(), "end": request.end_date.isoformat()},
        "result": result,
        "interpretation_policy": {
            "counterpart_required": False,
            "counterpart_data_allowed": False,
            "reunion_inference_allowed": False,
            "known_person_private_intent_claims": False,
            "event_probability": "not_calculated",
            "score_semantics": "single-person astrology activation index only",
        },
    }


@app.post("/v1/love/personal")
def personal_love(request: PersonalLoveRequest) -> dict:
    return _personal_love_response(request, "personal_love_forecast")


@app.post("/v1/love/new-relationship")
def new_relationship(request: PersonalLoveRequest) -> dict:
    return _personal_love_response(request, "new_relationship")


@app.post("/v1/marriage/personal")
def personal_marriage(request: PersonalMarriageRequest) -> dict:
    profile = request.profile
    try:
        result = build_personal_marriage(
            birth_date=profile.birth_date,
            birth_time=profile.birth_time,
            latitude=profile.latitude,
            longitude=profile.longitude,
            utc_offset_hours=profile.utc_offset_hours,
            start_date=request.start_date,
            end_date=request.end_date,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"personal marriage calculation failed: {exc}") from exc
    return {
        "ok": True,
        "api_version": APP_VERSION,
        "engine": PERSONAL_MARRIAGE_ENGINE_VERSION,
        "period": result["period"],
        "result": result,
        "interpretation_policy": {
            "counterpart_required": False,
            "probability_style_forecast": True,
            "spouse_archetype": True,
            "specific_identity_claims": False,
            "mode": "상대가 없는 미혼 개인 결혼운 · 결혼 가능성 지수/시기/배우자상/직업군/만남 경로를 점성 엔터테인먼트 해석으로 제공",
        },
    }


@app.post("/v1/relationship/western")
def relationship_western(request: RelationshipRequest) -> dict:
    user_payload = request.user.engine_payload()
    cp_payload = request.counterpart.engine_payload()

    if not user_payload["time_known"] or user_payload["birth_time"] is None:
        raise HTTPException(status_code=422, detail="user birth_time is required for the relationship engine")
    if cp_payload["time_known"] and cp_payload["birth_time"] is None:
        raise HTTPException(status_code=422, detail="counterpart birth_time is required when time_known=true")

    if request.analysis_mode == "marriage_married" and request.relationship_status != "married":
        raise HTTPException(status_code=422, detail="analysis_mode=marriage_married requires relationship_status=married")
    if request.analysis_mode == "marriage_unmarried" and request.relationship_status == "married":
        raise HTTPException(status_code=422, detail="analysis_mode=marriage_unmarried cannot be used with relationship_status=married")

    segments = _month_segments(request.start_date, request.end_date)
    try:
        result = build_relationship_western(user_payload, cp_payload, segments, analysis_mode=request.analysis_mode)
        try:
            result["saju_relationship"] = build_relationship_saju(user_payload, cp_payload)
        except Exception as saju_exc:
            result["saju_relationship"] = {"available": False, "engine": REL_SAJU_ENGINE_VERSION, "error": str(saju_exc)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"relationship calculation failed: {exc}") from exc

    return {
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


@app.post("/v1/fortune/integrated")
def fortune_integrated(request: IntegratedFortuneRequest) -> dict:
    profile = request.profile
    with _calc_semaphore:
        return build_integrated_fortune(
            birth_date=profile.birth_date,
            birth_time=profile.birth_time,
            latitude=profile.latitude,
            longitude=profile.longitude,
            utc_offset_hours=profile.utc_offset_hours,
            gender=profile.gender,
            start_date=request.start_date,
            end_date=request.end_date,
        )


@app.post("/v1/fortune/integrated/start")
def fortune_integrated_start(request: IntegratedFortuneRequest) -> dict:
    _prune_jobs(_calc_jobs, _calc_jobs_lock)
    profile = request.profile
    payload = {
        "birth_date": profile.birth_date,
        "birth_time": profile.birth_time,
        "latitude": profile.latitude,
        "longitude": profile.longitude,
        "utc_offset_hours": profile.utc_offset_hours,
        "gender": profile.gender,
        "start_date": request.start_date,
        "end_date": request.end_date,
    }
    request_key = _calc_request_key(payload)
    with _calc_jobs_lock:
        existing_id = _calc_request_index.get(request_key)
        existing = _calc_jobs.get(existing_id or "") if existing_id else None
        if existing and existing.get("status") in {"queued", "running", "done"}:
            return {"ok": True, "job_id": existing_id, "status": existing.get("status"), "reused": True}
        job_id = uuid.uuid4().hex
        _calc_jobs[job_id] = {"created_ts": time.time(), "status": "queued", "request_key": request_key}
        _calc_request_index[request_key] = job_id
    threading.Thread(
        target=_run_calc_job,
        args=(job_id, payload),
        daemon=True,
        name=f"fortune-calc-{job_id[:8]}",
    ).start()
    return {"ok": True, "job_id": job_id, "status": "queued", "reused": False}


@app.get("/v1/fortune/integrated/jobs/{job_id}")
def fortune_integrated_job(job_id: str) -> dict:
    _prune_jobs(_calc_jobs, _calc_jobs_lock)
    with _calc_jobs_lock:
        job = dict(_calc_jobs.get(job_id) or {})
    if not job:
        raise HTTPException(status_code=404, detail="calculation job not found or expired")
    job.pop("created_ts", None)
    job.pop("request_key", None)
    return {"job_id": job_id, **job}
