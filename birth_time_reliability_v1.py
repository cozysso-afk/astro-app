from __future__ import annotations

from datetime import time as dt_time
from typing import Any

TIME_SOURCES = {
    "official_record",
    "family_memory",
    "user_estimate",
    "arbitrary_input",
    "rectified",
    "unknown",
}
TIME_CONFIDENCES = {"exact", "high", "medium", "low", "unknown"}
EXACT_SOURCES = {"official_record", "rectified"}


def _clean_enum(value: Any, allowed: set[str], default: str) -> str:
    text = str(value or "").strip().lower()
    return text if text in allowed else default


def _time_text(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, dt_time):
        return value.replace(microsecond=0).isoformat(timespec="minutes")
    text = str(value).strip()
    return text or None


def normalize_rectified_window(value: Any) -> dict[str, str | None] | None:
    if value is None:
        return None
    if hasattr(value, "model_dump"):
        value = value.model_dump()
    if not isinstance(value, dict):
        return None
    start = _time_text(value.get("start"))
    end = _time_text(value.get("end"))
    if not start and not end:
        return None
    return {"start": start, "end": end}


def resolve_birth_time_reliability(profile: dict[str, Any]) -> dict[str, Any]:
    """Normalize the distinction between an entered time and a verified exact time.

    `time_known` means a concrete clock time is available for provisional calculations.
    It does *not* mean the time is exact. Exact angle/house-sensitive calculations require
    both `time_confidence=exact` and a provenance source that can support exactness.

    Missing legacy provenance deliberately defaults to unknown so old saved clock values are
    preserved without being silently promoted to exact birth records.
    """
    birth_time = profile.get("birth_time")
    time_known = bool(profile.get("time_known", birth_time is not None))
    source = _clean_enum(profile.get("time_source"), TIME_SOURCES, "unknown")
    confidence = _clean_enum(profile.get("time_confidence"), TIME_CONFIDENCES, "unknown")
    window = normalize_rectified_window(profile.get("rectified_window"))

    time_available = bool(time_known and birth_time is not None)
    time_exact = bool(time_available and confidence == "exact" and source in EXACT_SOURCES)
    provisional = bool(time_available and not time_exact)

    if not time_available:
        status = "unknown"
    elif time_exact:
        status = "exact"
    else:
        status = "provisional"

    return {
        "time_available": time_available,
        "time_exact": time_exact,
        "status": status,
        "time_source": source,
        "time_confidence": confidence,
        "rectified_window": window,
        "provisional": provisional,
        "policy": (
            "entered/known clock time is distinct from verified exact birth time; "
            "only official_record or rectified with exact confidence unlocks exact angle/house layers"
        ),
    }


def reliability_payload(profile: dict[str, Any]) -> dict[str, Any]:
    """Alias kept small for API/engine serialization."""
    return resolve_birth_time_reliability(profile)
