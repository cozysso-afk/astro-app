# -*- coding: utf-8 -*-
"""Single-person personal love and new-relationship timing engine.

This module is intentionally isolated from the two-person relationship engine.
It never accepts or imports counterpart data and never infers reunion/contact with
a known person. Static natal structure and timing activation are returned as
separate layers. Scores are astrology activation indices, not event probabilities.
"""
from __future__ import annotations

from datetime import date, datetime, time as dt_time, timedelta, timezone
from typing import Literal

from birth_time_reliability_v1 import resolve_birth_time_reliability
from personal_marriage_v1 import (
    ASPECTS,
    CHALLENGING,
    SUPPORTIVE,
    _house_data,
    _house_profile,
    _jd,
    _positions,
    _utc_datetime,
)
from relationship_reliability_v1 import decorate_aspect

ENGINE_VERSION = "personal-love-western-v1.0-purpose-separated"
YEAR_DAYS = 365.2422
PersonalLoveMode = Literal["personal_love_forecast", "new_relationship"]

TRANSIT_PLANET_WEIGHTS = {
    "new_connection": {
        "Sun": 0.45,
        "Mercury": 0.45,
        "Venus": 1.00,
        "Mars": 0.70,
        "Jupiter": 0.95,
        "Saturn": 0.38,
        "Uranus": 0.90,
        "Neptune": 0.42,
        "Pluto": 0.55,
    },
    "partnership": {
        "Sun": 0.35,
        "Mercury": 0.35,
        "Venus": 0.90,
        "Mars": 0.52,
        "Jupiter": 1.00,
        "Saturn": 0.95,
        "Uranus": 0.65,
        "Neptune": 0.45,
        "Pluto": 0.68,
    },
}

TARGET_WEIGHTS = {
    "new_connection": {
        "Venus": 1.00,
        "Moon": 0.68,
        "5th_ruler": 0.98,
        "7th_ruler": 0.72,
        "DSC": 0.68,
    },
    "partnership": {
        "Venus": 0.85,
        "Moon": 0.65,
        "5th_ruler": 0.50,
        "7th_ruler": 1.00,
        "DSC": 1.00,
    },
}

PROGRESSED_PLANET_WEIGHTS = {
    "new_connection": {"Sun": 0.62, "Moon": 0.92, "Venus": 1.00},
    "partnership": {"Sun": 0.78, "Moon": 0.85, "Venus": 1.00},
}

ASPECT_WEIGHTS = {
    "conjunction": 1.00,
    "opposition": 0.95,
    "square": 0.90,
    "trine": 0.84,
    "sextile": 0.78,
    "quincunx": 0.66,
}

HOUSE_DERIVED_TARGETS = {"5th_ruler", "7th_ruler", "DSC"}


def _norm(value: float) -> float:
    return float(value) % 360.0


def _angle_distance(a: float, b: float) -> float:
    d = abs(_norm(a) - _norm(b)) % 360.0
    return min(d, 360.0 - d)


def _transit_orb(planet: str) -> float:
    return 1.4 if planet in {"Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"} else 1.0


def _progression_orb(planet: str) -> float:
    return 1.0 if planet == "Moon" else 0.75


def _tone(aspect: str) -> str:
    if aspect in SUPPORTIVE:
        return "supportive"
    if aspect in CHALLENGING:
        return "challenging"
    return "mixed"


def _band(score: float) -> str:
    if score >= 70:
        return "very_strong"
    if score >= 55:
        return "strong"
    if score >= 40:
        return "elevated"
    if score >= 25:
        return "moderate"
    return "low"


def _dimension_score(hits: list[dict], key: str) -> float:
    values = sorted((float(x.get(key) or 0.0) for x in hits), reverse=True)[:4]
    if not values:
        return 0.0
    return round(min(100.0, sum(values) / 2.35), 1)


def _local_noon_utc(day: date, utc_offset_hours: float) -> datetime:
    local_tz = timezone(timedelta(hours=float(utc_offset_hours)))
    return datetime.combine(day, dt_time(12, 0), tzinfo=local_tz).astimezone(timezone.utc)


def _month_samples(start_date: date, end_date: date) -> list[date]:
    cursor = date(start_date.year, start_date.month, 1)
    out: list[date] = []
    while cursor <= end_date:
        if cursor.month == 12:
            next_month = date(cursor.year + 1, 1, 1)
        else:
            next_month = date(cursor.year, cursor.month + 1, 1)
        seg_start = max(start_date, cursor)
        seg_end = min(end_date, next_month - timedelta(days=1))
        midpoint = seg_start + timedelta(days=(seg_end - seg_start).days // 2)
        out.append(midpoint)
        cursor = next_month
    return out


def _moon_uncertainty(birth_date: date, utc_offset_hours: float) -> dict:
    tz = timezone(timedelta(hours=float(utc_offset_hours)))
    start = datetime.combine(birth_date, dt_time(0, 0), tzinfo=tz).astimezone(timezone.utc)
    end = datetime.combine(birth_date, dt_time(23, 59, 59), tzinfo=tz).astimezone(timezone.utc)
    start_lon = _positions(_jd(start), include_moon=True)["Moon"]["longitude"]
    end_lon = _positions(_jd(end), include_moon=True)["Moon"]["longitude"]
    span = (_norm(end_lon) - _norm(start_lon)) % 360.0
    return {
        "available": True,
        "start_longitude": round(start_lon, 4),
        "end_longitude": round(end_lon, 4),
        "daily_motion_span_deg": round(span, 3),
        "policy": "unknown birth time: Moon is represented as a same-date uncertainty range and is excluded from exact timing targets",
    }


def _natal_context(profile: dict) -> dict:
    reliability = resolve_birth_time_reliability(profile)
    birth_time = profile.get("birth_time") if reliability["time_available"] else dt_time(12, 0)
    natal_utc = _utc_datetime(profile["birth_date"], birth_time, float(profile.get("utc_offset_hours", 9.0)))
    natal_jd = _jd(natal_utc)
    positions = _positions(natal_jd, include_moon=bool(reliability["time_available"]))

    house = None
    profiles = None
    if reliability["time_exact"] and profile.get("latitude") is not None and profile.get("longitude") is not None:
        house = _house_data(natal_jd, float(profile["latitude"]), float(profile["longitude"]))
        profiles = {
            "5": _house_profile(5, house, positions),
            "7": _house_profile(7, house, positions),
        }

    targets: dict[str, dict] = {
        "Venus": {
            "longitude": positions["Venus"]["longitude"],
            "source": "natal_planet",
            "birth_time_sensitive": False,
        }
    }
    if "Moon" in positions:
        targets["Moon"] = {
            "longitude": positions["Moon"]["longitude"],
            "source": "natal_planet",
            "birth_time_sensitive": True,
        }

    if house and profiles:
        fifth_ruler = profiles["5"]["whole_ruler"]
        seventh_ruler = profiles["7"]["whole_ruler"]
        targets["5th_ruler"] = {
            "longitude": positions[fifth_ruler]["longitude"],
            "source": fifth_ruler,
            "birth_time_sensitive": True,
        }
        targets["7th_ruler"] = {
            "longitude": positions[seventh_ruler]["longitude"],
            "source": seventh_ruler,
            "birth_time_sensitive": True,
        }
        targets["DSC"] = {
            "longitude": house["dsc"],
            "source": "DSC",
            "birth_time_sensitive": True,
        }

    return {
        "natal_utc": natal_utc,
        "natal_jd": natal_jd,
        "positions": positions,
        "house": house,
        "house_profiles": profiles,
        "targets": targets,
        "time_reliability": reliability,
        "moon_uncertainty": None if reliability["time_available"] else _moon_uncertainty(profile["birth_date"], float(profile.get("utc_offset_hours", 9.0))),
    }


def _contact_rows(
    source_positions: dict,
    targets: dict,
    *,
    source_layer: str,
    source_weights: dict[str, dict[str, float]],
    source_exact: bool,
    target_exact: bool,
) -> list[dict]:
    rows: list[dict] = []
    for source_name, source_info in source_positions.items():
        if source_name not in source_weights["new_connection"] and source_name not in source_weights["partnership"]:
            continue
        source_lon = float(source_info["longitude"])
        orb_limit = _progression_orb(source_name) if source_layer == "secondary" else _transit_orb(source_name)
        for target_name, target_info in targets.items():
            distance = _angle_distance(source_lon, float(target_info["longitude"]))
            for aspect, exact in ASPECTS.items():
                orb = abs(distance - exact)
                if orb > orb_limit:
                    continue
                factor = max(0.0, 1.0 - orb / max(0.000001, orb_limit))
                new_score = (
                    100.0
                    * source_weights["new_connection"].get(source_name, 0.0)
                    * TARGET_WEIGHTS["new_connection"].get(target_name, 0.0)
                    * ASPECT_WEIGHTS[aspect]
                    * factor
                )
                partnership_score = (
                    100.0
                    * source_weights["partnership"].get(source_name, 0.0)
                    * TARGET_WEIGHTS["partnership"].get(target_name, 0.0)
                    * ASPECT_WEIGHTS[aspect]
                    * factor
                )
                meta = decorate_aspect(
                    {
                        "a": source_name,
                        "aspect": aspect,
                        "b": target_name,
                        "orb": round(orb, 3),
                        "tone": _tone(aspect),
                    },
                    mode=source_layer,
                    chart_a_exact=source_exact,
                    chart_b_exact=target_exact,
                    orb_limit=orb_limit,
                )
                meta.update(
                    {
                        "source": source_name,
                        "target": target_name,
                        "target_source": target_info.get("source"),
                        "new_connection_score": round(new_score, 1),
                        "partnership_score": round(partnership_score, 1),
                        "birth_time_sensitive_basis": bool(target_info.get("birth_time_sensitive")),
                    }
                )
                rows.append(meta)
                break
    rows.sort(
        key=lambda x: (
            -max(float(x.get("new_connection_score") or 0.0), float(x.get("partnership_score") or 0.0)),
            float(x.get("orb") or 99.0),
        )
    )
    return rows[:12]


def _transit_rows(start_date: date, end_date: date, utc_offset_hours: float, natal: dict) -> list[dict]:
    rows: list[dict] = []
    cursor = start_date
    transit_weights = TRANSIT_PLANET_WEIGHTS
    while cursor <= end_date:
        positions = _positions(_jd(_local_noon_utc(cursor, utc_offset_hours)), include_moon=False)
        hits = _contact_rows(
            positions,
            natal["targets"],
            source_layer="major_transit",
            source_weights=transit_weights,
            source_exact=True,
            target_exact=bool(natal["time_reliability"]["time_exact"]),
        )
        new_score = _dimension_score(hits, "new_connection_score")
        partnership_score = _dimension_score(hits, "partnership_score")
        rows.append(
            {
                "date": cursor.isoformat(),
                "new_connection_activation": new_score,
                "new_connection_band": _band(new_score),
                "partnership_activation": partnership_score,
                "partnership_band": _band(partnership_score),
                "hits": hits[:6],
                "event_probability": "not_calculated",
            }
        )
        cursor += timedelta(days=1)
    return rows


def _progressed_positions(natal: dict, target_date: date, utc_offset_hours: float) -> dict:
    target_utc = _local_noon_utc(target_date, utc_offset_hours)
    age_years = max(0.0, (target_utc - natal["natal_utc"]).total_seconds() / 86400.0 / YEAR_DAYS)
    progressed_jd = natal["natal_jd"] + age_years
    positions = _positions(progressed_jd, include_moon=bool(natal["time_reliability"]["time_available"]))
    return {name: positions[name] for name in ("Sun", "Moon", "Venus") if name in positions}


def _progression_rows(start_date: date, end_date: date, utc_offset_hours: float, natal: dict) -> list[dict]:
    rows: list[dict] = []
    for sample in _month_samples(start_date, end_date):
        progressed = _progressed_positions(natal, sample, utc_offset_hours)
        hits = _contact_rows(
            progressed,
            natal["targets"],
            source_layer="secondary",
            source_weights=PROGRESSED_PLANET_WEIGHTS,
            source_exact=bool(natal["time_reliability"]["time_exact"]),
            target_exact=bool(natal["time_reliability"]["time_exact"]),
        )
        new_score = _dimension_score(hits, "new_connection_score")
        partnership_score = _dimension_score(hits, "partnership_score")
        rows.append(
            {
                "date": sample.isoformat(),
                "calendar_month": sample.strftime("%Y-%m"),
                "new_connection_activation": new_score,
                "new_connection_band": _band(new_score),
                "partnership_activation": partnership_score,
                "partnership_band": _band(partnership_score),
                "hits": hits[:8],
                "event_probability": "not_calculated",
            }
        )
    return rows


def _summary(rows: list[dict], key: str) -> dict:
    if not rows:
        return {"average": 0.0, "band": "low", "top_dates": []}
    average = round(sum(float(x[key]) for x in rows) / len(rows), 1)
    ordered = sorted(rows, key=lambda x: (-float(x[key]), x["date"]))
    selected: list[dict] = []
    for row in ordered:
        day = date.fromisoformat(row["date"])
        if any(abs((day - date.fromisoformat(x["date"])).days) <= 2 for x in selected):
            continue
        selected.append(
            {
                "date": row["date"],
                "score": row[key],
                "band": _band(float(row[key])),
                "evidence": row.get("hits", [])[:3],
            }
        )
        if len(selected) >= 8:
            break
    return {
        "average": average,
        "band": _band(average),
        "top_dates": selected,
        "event_probability": "not_calculated",
    }


def _monthly_transit_summary(rows: list[dict]) -> list[dict]:
    grouped: dict[str, list[dict]] = {}
    for row in rows:
        grouped.setdefault(row["date"][:7], []).append(row)
    out = []
    for month, month_rows in sorted(grouped.items()):
        strongest_new = sorted(month_rows, key=lambda x: float(x["new_connection_activation"]), reverse=True)[:5]
        strongest_partner = sorted(month_rows, key=lambda x: float(x["partnership_activation"]), reverse=True)[:5]
        new_score = round(sum(float(x["new_connection_activation"]) for x in strongest_new) / max(1, len(strongest_new)), 1)
        partnership_score = round(sum(float(x["partnership_activation"]) for x in strongest_partner) / max(1, len(strongest_partner)), 1)
        out.append(
            {
                "calendar_month": month,
                "new_connection_activation": new_score,
                "new_connection_band": _band(new_score),
                "partnership_activation": partnership_score,
                "partnership_band": _band(partnership_score),
                "event_probability": "not_calculated",
            }
        )
    return out


def _convergence(monthly_transits: list[dict], progression_rows: list[dict]) -> list[dict]:
    progress_by_month = {row["calendar_month"]: row for row in progression_rows}
    out = []
    for transit in monthly_transits:
        progress = progress_by_month.get(transit["calendar_month"])
        if not progress:
            continue
        dimensions = []
        for name, key in (
            ("new_connection", "new_connection_activation"),
            ("partnership", "partnership_activation"),
        ):
            if float(transit[key]) >= 40.0 and float(progress[key]) >= 40.0:
                dimensions.append(name)
        if dimensions:
            out.append(
                {
                    "calendar_month": transit["calendar_month"],
                    "dimensions": dimensions,
                    "independent_layers": ["transit", "secondary_progression"],
                    "layer_count": 2,
                    "policy": "convergence means independent astrology layers repeat the same activation theme; it is not an event probability",
                }
            )
    return out


def build_personal_love_forecast(
    profile: dict,
    *,
    start_date: date,
    end_date: date,
    mode: PersonalLoveMode,
) -> dict:
    if mode not in {"personal_love_forecast", "new_relationship"}:
        raise ValueError("unsupported personal love mode")
    if end_date < start_date:
        raise ValueError("end_date must be on or after start_date")
    if (end_date - start_date).days > 365:
        raise ValueError("personal love forecast range is limited to 366 days per request")

    # Contract guard: this engine is single-person only by design.
    forbidden = {"counterpart", "partner", "relationship_status", "reunion"} & set(profile)
    if forbidden:
        raise ValueError(f"single-person love engine does not accept counterpart relationship fields: {sorted(forbidden)}")

    if profile.get("birth_time") is None and bool(profile.get("time_known")):
        raise ValueError("time_known=true requires birth_time")

    natal = _natal_context(profile)
    transit_rows = _transit_rows(start_date, end_date, float(profile.get("utc_offset_hours", 9.0)), natal)
    progression_rows = _progression_rows(start_date, end_date, float(profile.get("utc_offset_hours", 9.0)), natal)
    monthly = _monthly_transit_summary(transit_rows)

    static_structure = {
        "scope": "single_person_natal_only",
        "venus": natal["positions"]["Venus"],
        "moon": natal["positions"].get("Moon"),
        "fifth_house": natal["house_profiles"]["5"] if natal["house_profiles"] else None,
        "seventh_house": natal["house_profiles"]["7"] if natal["house_profiles"] else None,
        "dsc": natal["house"]["dsc"] if natal["house"] else None,
        "house_angle_layers_enabled": bool(natal["house"]),
        "time_reliability": natal["time_reliability"],
        "moon_uncertainty": natal["moon_uncertainty"],
        "policy": "static natal relationship structure is descriptive and is never added to timing activation scores",
    }

    return {
        "ok": True,
        "engine": ENGINE_VERSION,
        "analysis_mode": mode,
        "source_scope": "single_person_only",
        "counterpart_used": False,
        "relationship_engine_used": False,
        "period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
        "static_structure": static_structure,
        "timing": {
            "transits": {
                "new_connection": _summary(transit_rows, "new_connection_activation"),
                "partnership": _summary(transit_rows, "partnership_activation"),
                "months": monthly,
                "daily": transit_rows,
                "policy": "current activation of the user's own natal love/partnership factors; not a known person's contact or reunion signal",
            },
            "secondary_progression": {
                "new_connection": _summary(progression_rows, "new_connection_activation"),
                "partnership": _summary(progression_rows, "partnership_activation"),
                "months": progression_rows,
                "policy": "secondary progression is an independent higher-priority timing layer and is not numerically merged into daily transit scores",
            },
            "convergence": _convergence(monthly, progression_rows),
        },
        "focus": "new_connection" if mode == "new_relationship" else "balanced_personal_love",
        "interpretation_policy": {
            "counterpart_data_allowed": False,
            "reunion_inference_allowed": False,
            "known_person_private_intent_claims": False,
            "static_synastry_used": False,
            "event_probability": "not_calculated",
            "score_semantics": "astrology activation index only",
            "layer_priority": ["natal_structure", "secondary_progression", "major_transit", "daily_transit"],
        },
    }
