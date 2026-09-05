from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, model_validator

from horary_prashna_router_v1 import CLASSIFIER_VERSION, ROUTER_VERSION, classify_question, get_policy


router = APIRouter(prefix="/v1/horary-prashna", tags=["horary-prashna"])


class HoraryPrashnaClassifyRequest(BaseModel):
    question: str = Field(min_length=2, max_length=2000)
    question_time_local: datetime | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    utc_offset_hours: float | None = Field(default=None, ge=-14, le=14)
    gender: Literal["female", "male"] | None = None
    location_source: Literal["browser_geolocation", "manual", "none"] = "none"
    accuracy_meters: float | None = Field(default=None, ge=0, le=100000)

    @model_validator(mode="after")
    def coordinates_are_a_pair(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be provided together")
        if self.location_source != "none" and self.latitude is None:
            raise ValueError("location_source requires latitude and longitude")
        return self


def _resolve_times(request: HoraryPrashnaClassifyRequest) -> tuple[datetime, datetime | None]:
    local = request.question_time_local
    offset = request.utc_offset_hours

    if local is None:
        if offset is None:
            local = datetime.now(timezone.utc).replace(tzinfo=None)
        else:
            local = datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=offset))).replace(tzinfo=None)

    # The browser sends datetime-local without an offset.  If an aware datetime arrives,
    # honor its own offset; otherwise use the explicit browser UTC offset.
    if local.tzinfo is not None:
        utc = local.astimezone(timezone.utc)
        local_out = local.replace(tzinfo=None)
    elif offset is not None:
        utc = local.replace(tzinfo=timezone(timedelta(hours=offset))).astimezone(timezone.utc)
        local_out = local
    else:
        utc = None
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
            "question_time_utc": utc_time.isoformat(timespec="seconds") if utc_time else None,
            "latitude": request.latitude,
            "longitude": request.longitude,
            "utc_offset_hours": request.utc_offset_hours,
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
