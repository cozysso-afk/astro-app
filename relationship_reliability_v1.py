from __future__ import annotations

from typing import Any

ANGLE_POINTS = {"ASC", "DSC", "MC", "IC"}
SPECIAL_POINTS = {"True Node"}

LAYER_PRIORITY = {
    "natal": 1,
    "secondary": 2,
    "major_transit": 3,
    "daily_transit": 4,
    "tertiary": 5,
}


def aspect_signature(aspect: dict[str, Any]) -> tuple[str, str, str]:
    return (str(aspect.get("a") or ""), str(aspect.get("aspect") or ""), str(aspect.get("b") or ""))


def point_time_sensitivity(point: str) -> str:
    if point in ANGLE_POINTS:
        return "fragile"
    if point == "Moon":
        return "sensitive"
    if point in SPECIAL_POINTS:
        return "medium"
    return "robust"


def contact_time_sensitivity(a: str, b: str) -> str:
    levels = {"robust": 0, "medium": 1, "sensitive": 2, "fragile": 3}
    values = [point_time_sensitivity(str(a)), point_time_sensitivity(str(b))]
    return max(values, key=lambda value: levels[value])


def orb_grade(mode: str, orb: float, orb_limit: float | None = None) -> str:
    value = max(0.0, float(orb))
    if mode == "natal":
        if value <= 1.0:
            return "very_tight"
        if value <= 3.0:
            return "strong"
        return "background"
    if mode == "secondary":
        if value <= 0.25:
            return "very_tight"
        if value <= 0.75:
            return "strong"
        return "background"
    if mode == "tertiary":
        if value <= 0.15:
            return "very_tight"
        if value <= 0.50:
            return "strong"
        return "supplementary"
    if mode in {"daily_transit", "major_transit"}:
        limit = max(0.000001, float(orb_limit or 1.0))
        ratio = value / limit
        if ratio <= 0.25:
            return "very_tight"
        if ratio <= 0.60:
            return "strong"
        return "background"
    return "background"


def evidence_confidence(
    *,
    grade: str,
    sensitivity: str,
    chart_a_exact: bool,
    chart_b_exact: bool,
) -> str:
    if sensitivity == "fragile" and not (chart_a_exact and chart_b_exact):
        return "low"
    if sensitivity == "sensitive" and not (chart_a_exact and chart_b_exact):
        return "low-moderate"
    if grade == "very_tight" and sensitivity in {"robust", "medium"}:
        return "high"
    if grade in {"very_tight", "strong"}:
        return "moderate-high" if sensitivity != "fragile" else "moderate"
    if sensitivity == "fragile":
        return "low-moderate"
    return "moderate"


def decorate_aspect(
    aspect: dict[str, Any],
    *,
    mode: str,
    chart_a_exact: bool,
    chart_b_exact: bool,
    orb_limit: float | None = None,
) -> dict[str, Any]:
    row = dict(aspect)
    sensitivity = contact_time_sensitivity(str(row.get("a") or ""), str(row.get("b") or ""))
    grade = orb_grade(mode, float(row.get("orb") or 0.0), orb_limit=orb_limit)
    row.update({
        "orb_grade": grade,
        "time_sensitivity": sensitivity,
        "birth_time_dependency": sensitivity in {"sensitive", "fragile"},
        "evidence_confidence": evidence_confidence(
            grade=grade,
            sensitivity=sensitivity,
            chart_a_exact=bool(chart_a_exact),
            chart_b_exact=bool(chart_b_exact),
        ),
        "layer_priority": LAYER_PRIORITY.get(mode, 9),
        "event_probability": "not_calculated",
    })
    return row


def sensitivity_scan_spec(reliability: dict[str, Any]) -> dict[str, Any] | None:
    if not bool(reliability.get("time_available")) or bool(reliability.get("time_exact")):
        return None
    confidence = str(reliability.get("time_confidence") or "unknown")
    if confidence in {"high", "medium"}:
        window = 30
        step = 15
    else:
        window = 60
        step = 30
    shifts = list(range(-window, window + 1, step))
    return {
        "window_minutes": window,
        "step_minutes": step,
        "shifts_minutes": shifts,
        "policy": "diagnostic birth-time sensitivity only; scan candidates never become exact birth times and never unlock production angle/house scoring",
    }


def classify_scan_ratio(ratio: float) -> str:
    value = float(ratio)
    if value >= 0.80:
        return "robust"
    if value >= 0.40:
        return "sensitive"
    return "fragile"
