from __future__ import annotations

import os
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

APP_VERSION = "api-shell-v1"

app = FastAPI(
    title="별빛의 운명 API",
    version=APP_VERSION,
    description="Streamlit UI와 분리된 별빛의 운명 계산 API 레이어",
)

_allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "ASTRO_ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
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
        "calculation_engine_connected": False,
        "phase": "api-extraction",
        "planned_routes": [
            "daily",
            "weekly",
            "monthly",
            "annual",
            "integrated",
            "compatibility",
            "marriage",
        ],
        "relationship_modes": [
            "single",
            "dating",
            "long_term",
            "cohabiting",
            "engaged",
            "married",
        ],
        "note": "현재는 새 프론트와 Render 배포를 위한 API 껍데기 단계이며 기존 계산엔진은 다음 단계에서 순차 분리한다.",
    }
