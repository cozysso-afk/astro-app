from __future__ import annotations

import os
import threading
import time
import uuid
from datetime import date, datetime, time as dt_time, timedelta, timezone
from typing import Literal

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from integrated_fortune_v1 import ENGINE_VERSION as INTEGRATED_ENGINE_VERSION
from integrated_fortune_v1 import build_integrated_fortune
from ai_interpret_v1 import AI_DEFAULT_MODEL, ai_status, interpret_integrated_fortune
from relationship_western_v1 import ENGINE_VERSION as REL_ENGINE_VERSION
from relationship_western_v1 import build_relationship_western

APP_VERSION = "api-fortune-v4.2-async"

app = FastAPI(
    title="별빛의 운명 API",
    version=APP_VERSION,
    description="Streamlit UI와 분리된 별빛의 운명 계산 API 레이어",
)

_allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "ASTRO_ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,https://astro-app-web-ten.vercel.app",
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


class RelationshipProfile(BaseModel):
    name: str | None = None
    birth_date: date
    birth_time: dt_time | None = None
    time_known: bool = True
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    utc_offset_hours: float = Field(default=9.0, ge=-14, le=14)

    def engine_payload(self) -> dict:
        return {
            "name": self.name or "",
            "birth_date": self.birth_date,
            "birth_time": self.birth_time,
            "time_known": bool(self.time_known and self.birth_time is not None),
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


class FortuneProfile(BaseModel):
    name: str | None = None
    birth_date: date
    birth_time: dt_time
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    utc_offset_hours: float = Field(default=9.0, ge=-14, le=14)
    gender: Gender = "female"


class IntegratedFortuneRequest(BaseModel):
    profile: FortuneProfile
    start_date: date
    end_date: date


class IntegratedInterpretRequest(BaseModel):
    calculation: dict
    model: str = AI_DEFAULT_MODEL


_ai_jobs: dict[str, dict] = {}
_ai_jobs_lock = threading.Lock()
_calc_jobs: dict[str, dict] = {}
_calc_jobs_lock = threading.Lock()
_JOB_TTL_SECONDS = 1800

def _prune_jobs(store: dict, lock: threading.Lock):
    cutoff = time.time() - _JOB_TTL_SECONDS
    with lock:
        stale = [key for key, value in store.items() if float(value.get("created_ts", 0)) < cutoff]
        for key in stale:
            store.pop(key, None)

def _run_ai_job(job_id: str, calculation: dict, model: str):
    try:
        result = interpret_integrated_fortune(calculation, model)
        with _ai_jobs_lock:
            if job_id in _ai_jobs:
                _ai_jobs[job_id].update({"status": "done", "result": result, "completed_ts": time.time()})
    except Exception as exc:
        with _ai_jobs_lock:
            if job_id in _ai_jobs:
                _ai_jobs[job_id].update({"status": "failed", "error": f"{type(exc).__name__}: {exc}", "completed_ts": time.time()})

def _calculate_integrated_payload(request: IntegratedFortuneRequest) -> dict:
    if request.end_date < request.start_date:
        raise ValueError("end_date must be on or after start_date")
    if (request.end_date - request.start_date).days > 365:
        raise ValueError("integrated fortune range is limited to 366 days per request")
    profile = request.profile
    result = build_integrated_fortune(
        birth_date=profile.birth_date, birth_time=profile.birth_time, latitude=profile.latitude, longitude=profile.longitude,
        utc_offset_hours=profile.utc_offset_hours, gender=profile.gender, start_date=request.start_date, end_date=request.end_date,
    )
    return {**result, "api_version": APP_VERSION, "profile": {"name": profile.name or None, "gender": profile.gender, "birth_date": profile.birth_date.isoformat(), "birth_time": profile.birth_time.isoformat(), "location_supplied": True, "utc_offset_hours": profile.utc_offset_hours}}

def _run_calc_job(job_id: str, payload: dict):
    try:
        request = IntegratedFortuneRequest.model_validate(payload)
        result = _calculate_integrated_payload(request)
        with _calc_jobs_lock:
            if job_id in _calc_jobs:
                _calc_jobs[job_id].update({"status": "done", "result": result, "completed_ts": time.time()})
    except Exception as exc:
        with _calc_jobs_lock:
            if job_id in _calc_jobs:
                _calc_jobs[job_id].update({"status": "failed", "error": f"{type(exc).__name__}: {exc}", "completed_ts": time.time()})


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


@app.get("/")
def root() -> dict:
    return {
        "service": "astro-app-api",
        "version": APP_VERSION,
        "status": "ok",
    }


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "astro-app-api",
        "version": APP_VERSION,
        "time_utc": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/v1/meta")
def meta() -> dict:
    return {
        "version": APP_VERSION,
        "calculation_engine_connected": True,
        "ai_interpretation": ai_status(),
        "connected_engines": [INTEGRATED_ENGINE_VERSION, REL_ENGINE_VERSION],
        "phase": "integrated-fortune-and-relationship-live",
        "planned_routes": [
            "daily",
            "weekly",
            "monthly",
            "annual",
            "precision",
        ],
        "live_routes": [
            "fortune/integrated",
            "fortune/integrated/start+jobs",
            "fortune/interpret",
            "fortune/interpret/start+jobs",
            "relationship/western",
        ],
        "relationship_modes": [
            "single",
            "dating",
            "long_term",
            "cohabiting",
            "engaged",
            "married",
        ],
        "note": (
            "통합운세는 기존 서양 기간엔진 규칙 + 진태양시 사주 + Thai 출생요일 baseline을 "
            "한 요청으로 반환한다. Thai transit은 미구현이라 기간 합의에는 넣지 않는다."
        ),
    }


@app.post("/v1/fortune/integrated")
def integrated_fortune(request: IntegratedFortuneRequest) -> dict:
    try:
        return _calculate_integrated_payload(request)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"integrated fortune calculation failed: {exc}") from exc


@app.post("/v1/fortune/integrated/start", status_code=202)
def integrated_fortune_start(request: IntegratedFortuneRequest, background_tasks: BackgroundTasks) -> dict:
    _prune_jobs(_calc_jobs, _calc_jobs_lock)
    if request.end_date < request.start_date or (request.end_date - request.start_date).days > 365:
        raise HTTPException(status_code=422, detail="invalid integrated fortune range")
    job_id = uuid.uuid4().hex
    with _calc_jobs_lock:
        _calc_jobs[job_id] = {"status": "queued", "created_ts": time.time()}
    background_tasks.add_task(_run_calc_job, job_id, request.model_dump(mode="json"))
    return {"ok": True, "job_id": job_id, "status": "queued"}


@app.get("/v1/fortune/integrated/jobs/{job_id}")
def integrated_fortune_job(job_id: str) -> dict:
    _prune_jobs(_calc_jobs, _calc_jobs_lock)
    with _calc_jobs_lock:
        item = dict(_calc_jobs.get(job_id) or {})
    if not item:
        raise HTTPException(status_code=404, detail="calculation job not found")
    out = {"ok": item.get("status") != "failed", "job_id": job_id, "status": item.get("status")}
    if item.get("status") == "done": out["result"] = item.get("result")
    if item.get("status") == "failed": out["error"] = item.get("error")
    return out


@app.get("/v1/fortune/ai-meta")
def fortune_ai_meta() -> dict:
    return ai_status()


@app.post("/v1/fortune/interpret")
def fortune_interpret(request: IntegratedInterpretRequest) -> dict:
    if not isinstance(request.calculation, dict) or not request.calculation:
        raise HTTPException(status_code=422, detail="calculation result is required")
    return interpret_integrated_fortune(request.calculation, request.model)


@app.post("/v1/fortune/interpret/start", status_code=202)
def fortune_interpret_start(request: IntegratedInterpretRequest, background_tasks: BackgroundTasks) -> dict:
    if not isinstance(request.calculation, dict) or not request.calculation:
        raise HTTPException(status_code=422, detail="calculation result is required")
    _prune_jobs(_ai_jobs, _ai_jobs_lock)
    job_id = uuid.uuid4().hex
    with _ai_jobs_lock:
        _ai_jobs[job_id] = {"status": "queued", "created_ts": time.time()}
    background_tasks.add_task(_run_ai_job, job_id, request.calculation, request.model)
    return {"ok": True, "job_id": job_id, "status": "queued"}


@app.get("/v1/fortune/interpret/jobs/{job_id}")
def fortune_interpret_job(job_id: str) -> dict:
    _prune_jobs(_ai_jobs, _ai_jobs_lock)
    with _ai_jobs_lock:
        item = dict(_ai_jobs.get(job_id) or {})
    if not item:
        raise HTTPException(status_code=404, detail="AI interpretation job not found")
    out = {"ok": item.get("status") != "failed", "job_id": job_id, "status": item.get("status")}
    if item.get("status") == "done": out["result"] = item.get("result")
    if item.get("status") == "failed": out["error"] = item.get("error")
    return out


@app.post("/v1/relationship/western")
def relationship_western(request: RelationshipRequest) -> dict:
    user_payload = request.user.engine_payload()
    cp_payload = request.counterpart.engine_payload()

    if user_payload["birth_time"] is None:
        raise HTTPException(status_code=422, detail="user birth_time is required for the precision relationship engine")

    segments = _month_segments(request.start_date, request.end_date)
    try:
        result = build_relationship_western(user_payload, cp_payload, segments)
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
