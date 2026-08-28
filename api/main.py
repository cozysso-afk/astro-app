from __future__ import annotations

import os
import threading
import time
import uuid
from datetime import date, datetime, time as dt_time, timedelta, timezone
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from integrated_fortune_v1 import ENGINE_VERSION as INTEGRATED_ENGINE_VERSION
from integrated_fortune_v1 import build_integrated_fortune
from ai_interpret_v1 import AI_DEFAULT_MODEL, ai_status, interpret_integrated_fortune
from relationship_western_v1 import ENGINE_VERSION as REL_ENGINE_VERSION
from relationship_western_v1 import build_relationship_western

APP_VERSION = "api-fortune-v4.3-detached"

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
    _set_job(_calc_jobs, _calc_jobs_lock, job_id, status="running")
    try:
        result = build_integrated_fortune(**payload)
        _set_job(_calc_jobs, _calc_jobs_lock, job_id, status="done", result=result)
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
        "calculation_engine_connected": True,
        "ai_interpretation": ai_status(),
        "routes": [
            "relationship/western",
            "fortune/integrated",
            "fortune/interpret",
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
    return {"job_id": job_id, **job}


@app.post("/v1/relationship/western")
def relationship_western(request: RelationshipRequest) -> dict:
    if request.user.birth_time is None or not request.user.time_known:
        raise HTTPException(status_code=422, detail="user exact birth_time is required for precision relationship engine")
    result = build_relationship_western(
        user=request.user.engine_payload(),
        counterpart=request.counterpart.engine_payload(),
        start_date=request.start_date,
        end_date=request.end_date,
        relationship_status=request.relationship_status,
    )
    return {
        "result": result,
        "engine": REL_ENGINE_VERSION,
        "period": {"start": request.start_date.isoformat(), "end": request.end_date.isoformat()},
        "policy": {
            "contact_counts_are_probabilities": False,
            "private_feelings_are_inferred": False,
            "missing_precision_is_guessed": False,
        },
    }


@app.post("/v1/fortune/integrated")
def fortune_integrated(request: IntegratedFortuneRequest) -> dict:
    return build_integrated_fortune(
        profile=request.profile.model_dump(),
        start_date=request.start_date,
        end_date=request.end_date,
    )


@app.post("/v1/fortune/integrated/start")
def fortune_integrated_start(request: IntegratedFortuneRequest) -> dict:
    _prune_jobs(_calc_jobs, _calc_jobs_lock)
    job_id = uuid.uuid4().hex
    payload = {
        "profile": request.profile.model_dump(),
        "start_date": request.start_date,
        "end_date": request.end_date,
    }
    _set_job(_calc_jobs, _calc_jobs_lock, job_id, status="queued")
    threading.Thread(
        target=_run_calc_job,
        args=(job_id, payload),
        daemon=True,
        name=f"fortune-calc-{job_id[:8]}",
    ).start()
    return {"ok": True, "job_id": job_id, "status": "queued"}


@app.get("/v1/fortune/integrated/jobs/{job_id}")
def fortune_integrated_job(job_id: str) -> dict:
    _prune_jobs(_calc_jobs, _calc_jobs_lock)
    with _calc_jobs_lock:
        job = dict(_calc_jobs.get(job_id) or {})
    if not job:
        raise HTTPException(status_code=404, detail="calculation job not found or expired")
    job.pop("created_ts", None)
    return {"job_id": job_id, **job}
