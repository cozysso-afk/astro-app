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
from relationship_reliability_v1 import decorate_aspect, sensitivity_scan_spec

ENGINE_VERSION = "personal-love-western-v1.5-birth-time-safe-timing"
YEAR_DAYS = 365.2422
PersonalLoveMode = Literal["personal_love_forecast", "new_relationship"]

MAJOR_TRANSIT_PLANETS = {"Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"}
DAILY_TRANSIT_PLANETS = {"Sun", "Mercury", "Venus", "Mars"}

TRANSIT_PLANET_WEIGHTS = {
    "new_connection": {
        "Sun": 0.45, "Mercury": 0.45, "Venus": 1.00, "Mars": 0.70,
        "Jupiter": 0.95, "Saturn": 0.38, "Uranus": 0.90, "Neptune": 0.42, "Pluto": 0.55,
    },
    "partnership": {
        "Sun": 0.35, "Mercury": 0.35, "Venus": 0.90, "Mars": 0.52,
        "Jupiter": 1.00, "Saturn": 0.95, "Uranus": 0.65, "Neptune": 0.45, "Pluto": 0.68,
    },
}

TARGET_WEIGHTS = {
    "new_connection": {"Venus": 1.00, "Moon": 0.68, "5th_ruler": 0.98, "7th_ruler": 0.72, "DSC": 0.68},
    "partnership": {"Venus": 0.85, "Moon": 0.65, "5th_ruler": 0.50, "7th_ruler": 1.00, "DSC": 1.00},
}

PROGRESSED_PLANET_WEIGHTS = {
    "new_connection": {"Sun": 0.62, "Moon": 0.92, "Venus": 1.00},
    "partnership": {"Sun": 0.78, "Moon": 0.85, "Venus": 1.00},
}

ASPECT_WEIGHTS = {
    "conjunction": 1.00, "opposition": 0.95, "square": 0.90,
    "trine": 0.84, "sextile": 0.78, "quincunx": 0.66,
}


def _norm(value: float) -> float:
    return float(value) % 360.0


def _angle_distance(a: float, b: float) -> float:
    d = abs(_norm(a) - _norm(b)) % 360.0
    return min(d, 360.0 - d)


def _transit_orb(planet: str) -> float:
    return 1.4 if planet in MAJOR_TRANSIT_PLANETS else 1.0


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


def _target_physical_key(target_name: str, target_info: dict) -> str:
    explicit = target_info.get("physical_key")
    if explicit:
        return str(explicit)
    source = target_info.get("source")
    if target_name in {"Venus", "Moon"}:
        return f"planet:{target_name}"
    if target_name.endswith("_ruler") and source:
        return f"planet:{source}"
    return f"factor:{target_name}"


def _coalesce_targets(targets: dict) -> dict[str, dict]:
    """Score one physical natal factor once while preserving all semantic roles."""
    grouped: dict[str, dict] = {}
    for target_name, target_info in targets.items():
        physical_key = _target_physical_key(target_name, target_info)
        role_weights = {
            dimension: float(weights.get(target_name, 0.0))
            for dimension, weights in TARGET_WEIGHTS.items()
        }
        current = grouped.get(physical_key)
        if current is None:
            current = dict(target_info)
            current.update({
                "physical_key": physical_key,
                "target_roles": [target_name],
                "target_weights": role_weights,
                "role_birth_time_sensitive": {target_name: bool(target_info.get("birth_time_sensitive"))},
            })
            grouped[physical_key] = current
            continue
        current["target_roles"].append(target_name)
        current["birth_time_sensitive"] = bool(
            current.get("birth_time_sensitive") or target_info.get("birth_time_sensitive")
        )
        current["role_birth_time_sensitive"][target_name] = bool(target_info.get("birth_time_sensitive"))
        for dimension, role_weight in role_weights.items():
            current["target_weights"][dimension] = max(
                float(current["target_weights"].get(dimension, 0.0)), role_weight
            )
    return grouped


def _local_noon_utc(day: date, utc_offset_hours: float) -> datetime:
    local_tz = timezone(timedelta(hours=float(utc_offset_hours)))
    return datetime.combine(day, dt_time(12, 0), tzinfo=local_tz).astimezone(timezone.utc)


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
        profiles = {"5": _house_profile(5, house, positions), "7": _house_profile(7, house, positions)}

    targets: dict[str, dict] = {
        "Venus": {
            "longitude": positions["Venus"]["longitude"],
            "source": "natal_planet",
            "physical_key": "planet:Venus",
            "birth_time_sensitive": False,
        }
    }
    if "Moon" in positions:
        targets["Moon"] = {
            "longitude": positions["Moon"]["longitude"],
            "source": "natal_planet",
            "physical_key": "planet:Moon",
            "birth_time_sensitive": True,
        }
    if house and profiles:
        fifth_ruler = profiles["5"]["whole_ruler"]
        seventh_ruler = profiles["7"]["whole_ruler"]
        targets["5th_ruler"] = {
            "longitude": positions[fifth_ruler]["longitude"],
            "source": fifth_ruler,
            "physical_key": f"planet:{fifth_ruler}",
            "birth_time_sensitive": True,
        }
        targets["7th_ruler"] = {
            "longitude": positions[seventh_ruler]["longitude"],
            "source": seventh_ruler,
            "physical_key": f"planet:{seventh_ruler}",
            "birth_time_sensitive": True,
        }
        targets["DSC"] = {
            "longitude": house["dsc"],
            "source": "DSC",
            "physical_key": "angle:DSC",
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
        "moon_uncertainty": None if reliability["time_available"] else _moon_uncertainty(
            profile["birth_date"], float(profile.get("utc_offset_hours", 9.0))
        ),
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
    coalesced_targets = _coalesce_targets(targets)
    for source_name, source_info in source_positions.items():
        if source_name not in source_weights["new_connection"] and source_name not in source_weights["partnership"]:
            continue
        source_lon = float(source_info["longitude"])
        orb_limit = _progression_orb(source_name) if source_layer == "secondary" else _transit_orb(source_name)
        for target_info in coalesced_targets.values():
            target_roles = list(target_info.get("target_roles") or [])
            target_name = target_roles[0] if target_roles else str(target_info.get("physical_key") or "target")
            distance = _angle_distance(source_lon, float(target_info["longitude"]))
            for aspect, exact in ASPECTS.items():
                orb = abs(distance - exact)
                if orb > orb_limit:
                    continue
                factor = max(0.0, 1.0 - orb / max(0.000001, orb_limit))
                new_score = (
                    100.0
                    * source_weights["new_connection"].get(source_name, 0.0)
                    * float(target_info["target_weights"].get("new_connection", 0.0))
                    * ASPECT_WEIGHTS[aspect]
                    * factor
                )
                partnership_score = (
                    100.0
                    * source_weights["partnership"].get(source_name, 0.0)
                    * float(target_info["target_weights"].get("partnership", 0.0))
                    * ASPECT_WEIGHTS[aspect]
                    * factor
                )
                meta = decorate_aspect(
                    {"a": source_name, "aspect": aspect, "b": target_name, "orb": round(orb, 3), "tone": _tone(aspect)},
                    mode=source_layer,
                    chart_a_exact=source_exact,
                    chart_b_exact=target_exact,
                    orb_limit=orb_limit,
                )
                meta.update({
                    "layer": source_layer,
                    "source": source_name,
                    "target": target_name,
                    "target_roles": target_roles,
                    "target_physical_key": target_info.get("physical_key"),
                    "target_source": target_info.get("source"),
                    "target_weight_policy": "max_role_weight_no_duplicate_sum",
                    "target_weights": dict(target_info.get("target_weights") or {}),
                    "new_connection_score": round(new_score, 1),
                    "partnership_score": round(partnership_score, 1),
                    "birth_time_sensitive_basis": bool(target_info.get("birth_time_sensitive")),
                    "role_birth_time_sensitive": dict(target_info.get("role_birth_time_sensitive") or {}),
                })
                rows.append(meta)
                break
    rows.sort(key=lambda x: (
        -max(float(x.get("new_connection_score") or 0.0), float(x.get("partnership_score") or 0.0)),
        float(x.get("orb") or 99.0),
    ))
    return rows[:12]


def _layer_day_row(day: date, hits: list[dict]) -> dict:
    new_score = _dimension_score(hits, "new_connection_score")
    partnership_score = _dimension_score(hits, "partnership_score")
    return {
        "date": day.isoformat(),
        "new_connection_activation": new_score,
        "new_connection_band": _band(new_score),
        "partnership_activation": partnership_score,
        "partnership_band": _band(partnership_score),
        "hits": hits[:6],
        "event_probability": "not_calculated",
    }


def _excluded_sensitive_hits(all_hits: list[dict], production_hits: list[dict], reason: str) -> list[dict]:
    production_keys = {
        (
            str(hit.get("source") or ""),
            str(hit.get("aspect") or ""),
            str(hit.get("target_physical_key") or hit.get("target") or ""),
        )
        for hit in production_hits
    }
    out: list[dict] = []
    for hit in all_hits:
        key = (
            str(hit.get("source") or ""),
            str(hit.get("aspect") or ""),
            str(hit.get("target_physical_key") or hit.get("target") or ""),
        )
        if key in production_keys:
            continue
        if hit.get("source") == "Moon" or bool(hit.get("birth_time_sensitive_basis")):
            row = dict(hit)
            row["diagnostic_only"] = True
            row["production_excluded_reason"] = reason
            out.append(row)
    return out


def _transit_birth_time_policy(natal: dict) -> dict:
    reliability = natal["time_reliability"]
    if bool(reliability.get("time_exact")):
        return {
            "mode": "exact_all_natal_targets",
            "allow_birth_time_sensitive_targets": True,
            "date_precision": "exact_birth_time",
        }
    if bool(reliability.get("time_available")):
        return {
            "mode": "provisional_stable_natal_targets_only",
            "allow_birth_time_sensitive_targets": False,
            "date_precision": "provisional_clock_time_stable_targets_only",
        }
    return {
        "mode": "unknown_time_date_only_stable_targets",
        "allow_birth_time_sensitive_targets": False,
        "date_precision": "date_only_proxy",
    }


def _transit_production_targets(natal: dict) -> tuple[dict, dict]:
    policy = _transit_birth_time_policy(natal)
    if policy["allow_birth_time_sensitive_targets"]:
        return natal["targets"], policy
    return (
        {
            name: info for name, info in natal["targets"].items()
            if not bool(info.get("birth_time_sensitive"))
        },
        policy,
    )


def _transit_rows(start_date: date, end_date: date, utc_offset_hours: float, natal: dict) -> dict[str, list[dict]]:
    major_rows: list[dict] = []
    daily_rows: list[dict] = []
    production_targets, policy = _transit_production_targets(natal)
    diagnostic_enabled = bool(
        natal["time_reliability"].get("time_available")
        and not natal["time_reliability"].get("time_exact")
    )
    cursor = start_date
    while cursor <= end_date:
        positions = _positions(_jd(_local_noon_utc(cursor, utc_offset_hours)), include_moon=False)
        major_positions = {name: row for name, row in positions.items() if name in MAJOR_TRANSIT_PLANETS}
        daily_positions = {name: row for name, row in positions.items() if name in DAILY_TRANSIT_PLANETS}
        major_hits = _contact_rows(
            major_positions, production_targets, source_layer="major_transit",
            source_weights=TRANSIT_PLANET_WEIGHTS, source_exact=True,
            target_exact=bool(natal["time_reliability"]["time_exact"]),
        )
        daily_hits = _contact_rows(
            daily_positions, production_targets, source_layer="daily_transit",
            source_weights=TRANSIT_PLANET_WEIGHTS, source_exact=True,
            target_exact=bool(natal["time_reliability"]["time_exact"]),
        )
        major_diagnostic: list[dict] = []
        daily_diagnostic: list[dict] = []
        if diagnostic_enabled:
            major_all = _contact_rows(
                major_positions, natal["targets"], source_layer="major_transit",
                source_weights=TRANSIT_PLANET_WEIGHTS, source_exact=True, target_exact=False,
            )
            daily_all = _contact_rows(
                daily_positions, natal["targets"], source_layer="daily_transit",
                source_weights=TRANSIT_PLANET_WEIGHTS, source_exact=True, target_exact=False,
            )
            major_diagnostic = _excluded_sensitive_hits(
                major_all, major_hits, "birth_time_sensitive_natal_target_major_transit"
            )
            daily_diagnostic = _excluded_sensitive_hits(
                daily_all, daily_hits, "birth_time_sensitive_natal_target_daily_transit"
            )
        major_row = _layer_day_row(cursor, major_hits)
        major_row.update({
            "birth_time_policy": policy["mode"],
            "date_precision": policy["date_precision"],
            "diagnostic_time_sensitive_hits": major_diagnostic[:6],
        })
        daily_row = _layer_day_row(cursor, daily_hits)
        daily_row.update({
            "birth_time_policy": policy["mode"],
            "date_precision": policy["date_precision"],
            "diagnostic_time_sensitive_hits": daily_diagnostic[:6],
        })
        major_rows.append(major_row)
        daily_rows.append(daily_row)
        cursor += timedelta(days=1)
    return {"major": major_rows, "daily": daily_rows}


def _progression_birth_time_policy(natal: dict) -> dict:
    reliability = natal["time_reliability"]
    if bool(reliability.get("time_exact")):
        return {
            "mode": "exact_full_progression",
            "production_sources": ["Sun", "Moon", "Venus"],
            "allow_birth_time_sensitive_targets": True,
            "convergence_eligible": True,
            "date_precision": "exact_birth_time",
            "diagnostic_scan": None,
        }

    if bool(reliability.get("time_available")):
        source = str(reliability.get("time_source") or "unknown")
        confidence = str(reliability.get("time_confidence") or "unknown")
        credible_approximation = (
            source in {"official_record", "family_memory", "user_estimate", "rectified"}
            and confidence in {"high", "medium", "low"}
        )
        return {
            "mode": "provisional_stable_planets_only",
            "production_sources": ["Sun", "Venus"],
            "allow_birth_time_sensitive_targets": False,
            "convergence_eligible": credible_approximation,
            "date_precision": "provisional_clock_time_stable_planets_only",
            "diagnostic_scan": sensitivity_scan_spec(reliability),
        }

    return {
        "mode": "unknown_time_date_only_proxy",
        "production_sources": ["Sun", "Venus"],
        "allow_birth_time_sensitive_targets": False,
        "convergence_eligible": False,
        "date_precision": "date_only_proxy_not_convergence_eligible",
        "diagnostic_scan": {
            "window_minutes": 720,
            "step_minutes": None,
            "shifts_minutes": [-720, 0, 719],
            "policy": "unknown birth time uses local-midnight/noon/end-of-day anchors for diagnostic longitude spread only",
        },
    }


def _progression_production_inputs(natal: dict, progressed: dict) -> tuple[dict, dict, dict]:
    policy = _progression_birth_time_policy(natal)
    sources = {
        name: info for name, info in progressed.items()
        if name in policy["production_sources"]
    }
    if policy["allow_birth_time_sensitive_targets"]:
        targets = natal["targets"]
    else:
        targets = {
            name: info for name, info in natal["targets"].items()
            if not bool(info.get("birth_time_sensitive"))
        }
    return sources, targets, policy


def _progressed_positions_shifted(
    natal: dict,
    target_date: date,
    utc_offset_hours: float,
    shift_minutes: int = 0,
) -> dict:
    """Mean day-for-year positions after shifting the birth clock for sensitivity diagnostics."""
    shift_days = float(shift_minutes) / 1440.0
    shifted_natal_utc = natal["natal_utc"] + timedelta(minutes=int(shift_minutes))
    shifted_natal_jd = float(natal["natal_jd"]) + shift_days
    target_utc = _local_noon_utc(target_date, utc_offset_hours)
    age_years = max(0.0, (target_utc - shifted_natal_utc).total_seconds() / 86400.0 / YEAR_DAYS)
    progressed_jd = shifted_natal_jd + age_years
    positions = _positions(progressed_jd, include_moon=bool(natal["time_reliability"]["time_available"]))
    return {name: positions[name] for name in ("Sun", "Moon", "Venus") if name in positions}


def _progressed_positions(natal: dict, target_date: date, utc_offset_hours: float) -> dict:
    """Mean day-for-year secondary progression: one ephemeris day equals one tropical year."""
    return _progressed_positions_shifted(natal, target_date, utc_offset_hours, shift_minutes=0)


def _progression_time_uncertainty(natal: dict, target_date: date, utc_offset_hours: float) -> dict | None:
    policy = _progression_birth_time_policy(natal)
    scan = policy.get("diagnostic_scan")
    if not scan:
        return None
    shifts = list(scan.get("shifts_minutes") or [])
    if 0 not in shifts:
        shifts.append(0)
    shifts = sorted(set(int(value) for value in shifts))
    samples = {
        shift: _progressed_positions_shifted(natal, target_date, utc_offset_hours, shift_minutes=shift)
        for shift in shifts
    }
    center = samples.get(0) or {}
    variation = {}
    for planet, center_info in center.items():
        values = [sample[planet]["longitude"] for sample in samples.values() if planet in sample]
        if values:
            variation[planet] = round(
                max(_angle_distance(float(value), float(center_info["longitude"])) for value in values),
                3,
            )
    return {
        "date": target_date.isoformat(),
        "mode": policy["mode"],
        "date_precision": policy["date_precision"],
        "convergence_eligible": policy["convergence_eligible"],
        "shifts_minutes": shifts,
        "max_longitude_variation_deg": variation,
        "diagnostic_only": True,
        "policy": scan.get("policy"),
    }


def _progression_rows(start_date: date, end_date: date, utc_offset_hours: float, natal: dict) -> list[dict]:
    """Scan each requested calendar day so the monthly peak is not a midpoint proxy."""
    rows: list[dict] = []
    cursor = start_date
    while cursor <= end_date:
        progressed = _progressed_positions(natal, cursor, utc_offset_hours)
        production_sources, production_targets, policy = _progression_production_inputs(natal, progressed)
        hits = _contact_rows(
            production_sources,
            production_targets,
            source_layer="secondary",
            source_weights=PROGRESSED_PLANET_WEIGHTS,
            source_exact=bool(natal["time_reliability"]["time_exact"]),
            target_exact=bool(natal["time_reliability"]["time_exact"]),
        )
        diagnostic_hits: list[dict] = []
        if not bool(natal["time_reliability"]["time_exact"]) and bool(natal["time_reliability"]["time_available"]):
            all_hits = _contact_rows(
                progressed,
                natal["targets"],
                source_layer="secondary",
                source_weights=PROGRESSED_PLANET_WEIGHTS,
                source_exact=False,
                target_exact=False,
            )
            diagnostic_hits = _excluded_sensitive_hits(
                all_hits, hits, "birth_time_sensitive_secondary_progression"
            )
        row = _layer_day_row(cursor, hits)
        row["calendar_month"] = cursor.strftime("%Y-%m")
        row["progression_key"] = "mean_day_for_year"
        row["birth_time_policy"] = policy["mode"]
        row["date_precision"] = policy["date_precision"]
        row["convergence_eligible"] = bool(policy["convergence_eligible"])
        row["diagnostic_time_sensitive_hits"] = diagnostic_hits[:6]
        rows.append(row)
        cursor += timedelta(days=1)
    return rows


def _dimension_evidence(row: dict, dimension: str, limit: int = 3) -> list[dict]:
    score_key = f"{dimension}_score"
    return sorted(
        list(row.get("hits") or []),
        key=lambda hit: (-float(hit.get(score_key) or 0.0), float(hit.get("orb") or 99.0)),
    )[:limit]


def _merge_evidence(*groups: list[dict], limit: int = 8) -> list[dict]:
    out: list[dict] = []
    seen: set[tuple[str, str, str, str]] = set()
    for group in groups:
        for hit in group:
            key = (
                str(hit.get("source") or ""),
                str(hit.get("aspect") or ""),
                str(hit.get("target_physical_key") or hit.get("target") or ""),
                str(hit.get("layer") or ""),
            )
            if key in seen:
                continue
            seen.add(key)
            out.append(hit)
            if len(out) >= limit:
                return out
    return out


def _progression_months(rows: list[dict], natal: dict, utc_offset_hours: float) -> list[dict]:
    grouped: dict[str, list[dict]] = {}
    for row in rows:
        grouped.setdefault(row["calendar_month"], []).append(row)
    out: list[dict] = []
    for month, month_rows in sorted(grouped.items()):
        new_peak = max(month_rows, key=lambda x: (float(x["new_connection_activation"]), x["date"]))
        partner_peak = max(month_rows, key=lambda x: (float(x["partnership_activation"]), x["date"]))
        new_score = float(new_peak["new_connection_activation"])
        partnership_score = float(partner_peak["partnership_activation"])
        new_evidence = _dimension_evidence(new_peak, "new_connection") if new_score > 0 else []
        partner_evidence = _dimension_evidence(partner_peak, "partnership") if partnership_score > 0 else []
        new_sensitivity = (
            _progression_time_uncertainty(natal, date.fromisoformat(new_peak["date"]), utc_offset_hours)
            if new_score > 0 else None
        )
        partner_sensitivity = (
            new_sensitivity
            if partner_peak["date"] == new_peak["date"] and new_sensitivity is not None
            else (
                _progression_time_uncertainty(natal, date.fromisoformat(partner_peak["date"]), utc_offset_hours)
                if partnership_score > 0 else None
            )
        )
        convergence_eligible = bool(new_peak.get("convergence_eligible") and partner_peak.get("convergence_eligible"))
        date_precision = str(new_peak.get("date_precision") or partner_peak.get("date_precision") or "unknown")
        diagnostic_hits = _merge_evidence(
            list(new_peak.get("diagnostic_time_sensitive_hits") or []),
            list(partner_peak.get("diagnostic_time_sensitive_hits") or []),
        )
        out.append({
            "calendar_month": month,
            "new_connection_activation": round(new_score, 1),
            "new_connection_band": _band(new_score),
            "new_connection_peak_date": new_peak["date"] if new_score > 0 else None,
            "new_connection_peak_date_precision": date_precision,
            "new_connection_evidence": new_evidence,
            "new_connection_birth_time_sensitivity": new_sensitivity,
            "partnership_activation": round(partnership_score, 1),
            "partnership_band": _band(partnership_score),
            "partnership_peak_date": partner_peak["date"] if partnership_score > 0 else None,
            "partnership_peak_date_precision": str(partner_peak.get("date_precision") or date_precision),
            "partnership_evidence": partner_evidence,
            "partnership_birth_time_sensitivity": partner_sensitivity,
            "hits": _merge_evidence(new_evidence, partner_evidence),
            "diagnostic_time_sensitive_hits": diagnostic_hits,
            "sampling": "daily_peak_within_calendar_month",
            "birth_time_policy": new_peak.get("birth_time_policy"),
            "convergence_eligible": convergence_eligible,
            "event_probability": "not_calculated",
        })
    return out


def _summary(rows: list[dict], key: str) -> dict:
    if not rows:
        return {"average": 0.0, "band": "low", "top_dates": [], "event_probability": "not_calculated"}
    average = round(sum(float(x[key]) for x in rows) / len(rows), 1)
    ordered = sorted(rows, key=lambda x: (-float(x[key]), x["date"]))
    selected: list[dict] = []
    for row in ordered:
        day = date.fromisoformat(row["date"])
        if any(abs((day - date.fromisoformat(x["date"])).days) <= 2 for x in selected):
            continue
        selected.append({
            "date": row["date"],
            "score": row[key],
            "band": _band(float(row[key])),
            "evidence": row.get("hits", [])[:3],
        })
        if len(selected) >= 8:
            break
    return {"average": average, "band": _band(average), "top_dates": selected, "event_probability": "not_calculated"}


def _progression_summary(months: list[dict], dimension: str) -> dict:
    key = f"{dimension}_activation"
    peak_key = f"{dimension}_peak_date"
    precision_key = f"{dimension}_peak_date_precision"
    evidence_key = f"{dimension}_evidence"
    if not months:
        return {"average": 0.0, "band": "low", "top_dates": [], "event_probability": "not_calculated"}
    average = round(sum(float(row[key]) for row in months) / len(months), 1)
    ordered = sorted(months, key=lambda row: (-float(row[key]), row["calendar_month"]))
    selected: list[dict] = []
    for row in ordered:
        peak_date = row.get(peak_key)
        if not peak_date or float(row[key]) <= 0:
            continue
        day = date.fromisoformat(peak_date)
        if any(abs((day - date.fromisoformat(x["date"])).days) <= 7 for x in selected):
            continue
        selected.append({
            "date": peak_date,
            "date_precision": row.get(precision_key),
            "calendar_month": row["calendar_month"],
            "score": row[key],
            "band": _band(float(row[key])),
            "convergence_eligible": bool(row.get("convergence_eligible")),
            "evidence": row.get(evidence_key, [])[:3],
        })
        if len(selected) >= 8:
            break
    return {"average": average, "band": _band(average), "top_dates": selected, "event_probability": "not_calculated"}


def _monthly_summary(rows: list[dict]) -> list[dict]:
    grouped: dict[str, list[dict]] = {}
    for row in rows:
        grouped.setdefault(row["date"][:7], []).append(row)
    out = []
    for month, month_rows in sorted(grouped.items()):
        strongest_new = sorted(month_rows, key=lambda x: float(x["new_connection_activation"]), reverse=True)[:5]
        strongest_partner = sorted(month_rows, key=lambda x: float(x["partnership_activation"]), reverse=True)[:5]
        new_score = round(sum(float(x["new_connection_activation"]) for x in strongest_new) / max(1, len(strongest_new)), 1)
        partnership_score = round(sum(float(x["partnership_activation"]) for x in strongest_partner) / max(1, len(strongest_partner)), 1)
        out.append({
            "calendar_month": month,
            "new_connection_activation": new_score,
            "new_connection_band": _band(new_score),
            "partnership_activation": partnership_score,
            "partnership_band": _band(partnership_score),
            "event_probability": "not_calculated",
        })
    return out


def _convergence(major_months: list[dict], progression_months: list[dict], daily_months: list[dict]) -> list[dict]:
    progress_by_month = {row["calendar_month"]: row for row in progression_months}
    daily_by_month = {row["calendar_month"]: row for row in daily_months}
    out = []
    for major in major_months:
        progress = progress_by_month.get(major["calendar_month"])
        if not progress or not bool(progress.get("convergence_eligible")):
            continue
        dimensions = []
        for name, key in (("new_connection", "new_connection_activation"), ("partnership", "partnership_activation")):
            if float(major[key]) >= 40.0 and float(progress[key]) >= 40.0:
                dimensions.append(name)
        if not dimensions:
            continue
        daily = daily_by_month.get(major["calendar_month"])
        daily_support = [
            name
            for name, key in (("new_connection", "new_connection_activation"), ("partnership", "partnership_activation"))
            if daily and float(daily[key]) >= 40.0 and name in dimensions
        ]
        out.append({
            "calendar_month": major["calendar_month"],
            "dimensions": dimensions,
            "independent_layers": ["major_transit", "secondary_progression"],
            "layer_count": 2,
            "progression_birth_time_policy": progress.get("birth_time_policy"),
            "daily_transit_support": daily_support,
            "policy": "convergence requires independent higher-priority major-transit and birth-time-eligible secondary-progression layers; fast daily transits may support timing but never create convergence by themselves",
        })
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

    forbidden = {"counterpart", "partner", "relationship_status", "reunion"} & set(profile)
    if forbidden:
        raise ValueError(f"single-person love engine does not accept counterpart relationship fields: {sorted(forbidden)}")
    if profile.get("birth_time") is None and bool(profile.get("time_known")):
        raise ValueError("time_known=true requires birth_time")

    natal = _natal_context(profile)
    utc_offset_hours = float(profile.get("utc_offset_hours", 9.0))
    transit_layers = _transit_rows(start_date, end_date, utc_offset_hours, natal)
    major_rows = transit_layers["major"]
    daily_rows = transit_layers["daily"]
    progression_daily_rows = _progression_rows(start_date, end_date, utc_offset_hours, natal)
    progression_months = _progression_months(progression_daily_rows, natal, utc_offset_hours)
    major_months = _monthly_summary(major_rows)
    daily_months = _monthly_summary(daily_rows)
    progression_policy = _progression_birth_time_policy(natal)
    transit_policy = _transit_birth_time_policy(natal)

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
            "secondary_progression": {
                "new_connection": _progression_summary(progression_months, "new_connection"),
                "partnership": _progression_summary(progression_months, "partnership"),
                "months": progression_months,
                "daily_samples": progression_daily_rows,
                "progression_key": {"method": "mean_day_for_year", "year_days": YEAR_DAYS},
                "birth_time_policy": progression_policy,
                "policy": "secondary progression uses mean day-for-year mapping and scans every requested calendar day. Exact birth time uses Sun/Moon/Venus and all eligible natal targets. Provisional time scores only stable Sun/Venus to birth-time-stable natal targets while Moon-sensitive contacts remain diagnostic-only. Unknown or arbitrary birth-time basis cannot create convergence.",
            },
            "major_transits": {
                "new_connection": _summary(major_rows, "new_connection_activation"),
                "partnership": _summary(major_rows, "partnership_activation"),
                "months": major_months,
                "daily_samples": major_rows,
                "planets": sorted(MAJOR_TRANSIT_PLANETS),
                "birth_time_policy": transit_policy,
                "policy": "Jupiter/Saturn/Uranus/Neptune/Pluto major-transit activation of the user's own natal factors. Provisional birth times exclude birth-time-sensitive natal targets from production scores and retain them only as diagnostics; separate from fast daily timing.",
            },
            "daily_transits": {
                "new_connection": _summary(daily_rows, "new_connection_activation"),
                "partnership": _summary(daily_rows, "partnership_activation"),
                "months": daily_months,
                "daily": daily_rows,
                "planets": sorted(DAILY_TRANSIT_PLANETS),
                "birth_time_policy": transit_policy,
                "policy": "Sun/Mercury/Venus/Mars fast timing support only. Provisional birth times exclude birth-time-sensitive natal targets from production scores and retain them only as diagnostics; never overrides higher-priority secondary or major-transit structure.",
            },
            "convergence": _convergence(major_months, progression_months, daily_months),
        },
        "focus": "new_connection" if mode == "new_relationship" else "balanced_personal_love",
        "interpretation_policy": {
            "counterpart_data_allowed": False,
            "reunion_inference_allowed": False,
            "known_person_private_intent_claims": False,
            "static_synastry_used": False,
            "event_probability": "not_calculated",
            "score_semantics": "astrology activation index only",
            "physical_target_deduplication": "same natal body serving multiple semantic roles is scored once using the maximum applicable role weight; all roles remain in evidence",
            "secondary_progression_sampling": "mean day-for-year positions are scanned daily; monthly values use the strongest real daily peak so a mid-month sample is never presented as an exact progression date",
            "secondary_progression_birth_time_safety": "provisional birth times exclude progressed Moon and birth-time-sensitive natal targets from production progression scores; those contacts remain diagnostic-only. Unknown or arbitrary birth-time bases may show approximate stable-planet progression but are not convergence-eligible.",
            "transit_birth_time_safety": "provisional birth times exclude natal Moon and other birth-time-sensitive natal targets from production major/daily transit scores; excluded contacts remain diagnostic-only so uncertain Moon contacts cannot inflate the major layer used by convergence.",
            "layer_priority": ["natal_structure", "secondary_progression", "major_transit", "daily_transit"],
            "layer_mixing": "forbidden; convergence is categorical repetition across independent layers, not a summed score",
        },
    }
