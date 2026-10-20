from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator

from horary_prashna_router_v1 import CLASSIFIER_VERSION, ROUTER_VERSION, classify_question, get_policy
from horary_prashna_chart_v1 import build_horary_chart_report


router = APIRouter(prefix="/v1/horary-prashna", tags=["horary-prashna"])


class HoraryPrashnaClassifyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str = Field(min_length=2, max_length=2000)
    question_time_local: datetime
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    utc_offset_hours: float = Field(ge=-14, le=14)
    timezone_id: str | None = Field(default=None, max_length=100)
    gender: Literal["female", "male"] | None = None
    location_source: Literal["browser_geolocation", "manual", "none"] = "none"
    accuracy_meters: float | None = Field(default=None, ge=0, le=100000)

    @model_validator(mode="after")
    def coordinates_are_a_pair(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be provided together")
        if self.location_source != "none" and self.latitude is None:
            raise ValueError("location_source requires latitude and longitude")
        if self.location_source == "none" and self.latitude is not None:
            raise ValueError("coordinates require an explicit location_source")
        if self.accuracy_meters is not None and self.location_source != "browser_geolocation":
            raise ValueError("accuracy_meters is only valid for browser geolocation")
        return self


def _resolve_times(request: HoraryPrashnaClassifyRequest) -> tuple[datetime, datetime]:
    local = request.question_time_local
    offset = request.utc_offset_hours

    # The browser sends datetime-local without an offset.  If an aware datetime arrives,
    # honor its own offset; otherwise use the explicit browser UTC offset.
    if local.tzinfo is not None:
        utc = local.astimezone(timezone.utc)
        local_out = local.replace(tzinfo=None)
    else:
        utc = local.replace(tzinfo=timezone(timedelta(hours=offset))).astimezone(timezone.utc)
        local_out = local
    return local_out, utc


@router.post("/classify")
def classify_horary_prashna_question(request: HoraryPrashnaClassifyRequest) -> dict:
    try:
        classification = classify_question(request.question)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    local_time, utc_time = _resolve_times(request)
    policy = get_policy(classification["policy_id"])
    return {
        "ok": True,
        **classification,
        "classifier_mode": "deterministic-seed-v1",
        "context": {
            "question_time_local": local_time.isoformat(timespec="seconds"),
            "question_time_utc": utc_time.isoformat(timespec="seconds"),
            "latitude": request.latitude,
            "longitude": request.longitude,
            "utc_offset_hours": request.utc_offset_hours,
            "timezone_id": request.timezone_id,
            "gender": request.gender,
            "location_source": request.location_source,
            "accuracy_meters": request.accuracy_meters,
            "location_ready": request.latitude is not None and request.longitude is not None,
        },
        "policy_preview": {
            "domain": policy.get("domain"),
            "western": policy.get("western"),
            "prashna": policy.get("prashna"),
            "default_outputs": policy.get("default_outputs"),
            "safety": policy.get("safety"),
        },
        "next_stage": "classification_only_no_chart_judgement",
        "contract": {
            "router_version": ROUTER_VERSION,
            "classifier_version": CLASSIFIER_VERSION,
            "western_prashna_kept_separate": True,
        },
    }

@router.post("/analyze")
def analyze_horary_prashna_question(request: HoraryPrashnaClassifyRequest) -> dict:
    """Only run chart evidence with a stated location and sufficiently clear question."""
    classified = classify_horary_prashna_question(request)
    if classified["needs_clarification"]:
        raise HTTPException(status_code=422, detail="질문 대상이 모호해. 누구/무엇에 관한 질문인지 한 가지로 구체화해줘.")
    if request.latitude is None or request.longitude is None:
        raise HTTPException(status_code=422, detail="차트 계산에는 질문 시각의 위도와 경도가 모두 필요해. 위치 사용 또는 수동 입력을 해줘.")
    _local, instant_utc = _resolve_times(request)
    try:
        chart = build_horary_chart_report(instant_utc, request.latitude, request.longitude, classified)
    except (ValueError, OverflowError) as exc:
        raise HTTPException(status_code=422, detail=f"질문 시각 또는 위치로 차트를 계산할 수 없어: {exc}") from exc
    return {
        **classified,
        "analysis": chart,
        "next_stage": "chart_evidence_v1_interpretation_limited",
    }
