from __future__ import annotations

import os
from datetime import date, datetime, time as dt_time, timedelta, timezone
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from relationship_western_v1 import ENGINE_VERSION as REL_ENGINE_VERSION
from relationship_western_v1 import build_relationship_western

APP_VERSION = "api-relationship-v1"

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


def _month_segments(start_date: date, end_date: date) -> list[tuple[date, date]]:
    if end_date < start_date:
        raise HTTPException(status_code=422, detail="end_date must be on or after start_date")
    if (end_date - start_date).days > 730:
        raise HTTPException(status_code=422, detail="relationship timing range is limited to 731 days per request")

    segments: list[tuple[date, date]] = []
    cursor = date(start_date.year, start_date.month, 1)
    while cursor <= end_date:
        next_month = date(cursor.year + (1 if cursor.month == 12 else 0), 1 if cursor.month == 12 else cursor.month + 1, 1)
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
        "connected_engines": [REL_ENGINE_VERSION],
        "phase": "relationship-engine-live",
        "planned_routes": [
            "daily",
            "weekly",
            "monthly",
            "annual",
            "integrated",
            "compatibility",
            "marriage",
        ],
        "live_routes": ["relationship/western"],
        "relationship_modes": [
            "single",
            "dating",
            "long_term",
            "cohabiting",
            "engaged",
            "married",
        ],
        "note": "정밀 관계 점성 엔진은 Render API에 연결되었고, 기간 운세 엔진은 순차 분리 중이다.",
    }


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
