from __future__ import annotations

"""Solar/Lunar return context for reunion analysis.

This layer is deliberately a *background cross-check* rather than an event predictor.
It computes exact solar/lunar return moments, derives relationship-themed activation
from the return chart, and annotates only dates that were already admitted by the
fast-transit gate in the main relationship engine.

Important policy:
- Solar Return = annual background context.
- Lunar Return = monthly/emotional background context.
- Neither return creates an exact contact/meeting/reunion date by itself.
- Return context never counts as an independent convergence vote against the same
  underlying transit phenomenon.
- Entered but unverified birth times may be used provisionally and are never promoted
  to exact provenance.
"""

from datetime import date, datetime, time as dt_time, timedelta, timezone
from typing import Any

import swisseph as swe

from birth_time_reliability_v1 import resolve_birth_time_reliability

ENGINE_VERSION = "relationship-return-v2-five-body-exact-crossings"
FAST_TRIGGER_WEIGHT = 0.85
RETURN_CONTEXT_WEIGHT = 0.15

BODY_IDS = {
    "Sun": swe.SUN,
    "Moon": swe.MOON,
    "Mercury": swe.MERCURY,
    "Venus": swe.VENUS,
    "Mars": swe.MARS,
    "Jupiter": swe.JUPITER,
    "Saturn": swe.SATURN,
}
RETURN_CHART_BODIES = tuple(BODY_IDS)
PERSONAL_TARGETS = ("Sun", "Moon", "Mercury", "Venus", "Mars")
ASPECTS = {
    "conjunction": 0.0,
    "sextile": 60.0,
    "square": 90.0,
    "trine": 120.0,
    "quincunx": 150.0,
    "opposition": 180.0,
}
SUPPORTIVE = {"sextile", "trine"}
CHALLENGING = {"square", "opposition", "quincunx"}
PLANET_WEIGHTS = {
    "Sun": 0.55,
    "Moon": 0.58,
    "Mercury": 0.95,
    "Venus": 1.00,
    "Mars": 0.92,
    "Jupiter": 0.78,
    "Saturn": 0.74,
}
TARGET_WEIGHTS = {
    "Sun": 0.82,
    "Moon": 0.90,
    "Mercury": 0.93,
    "Venus": 1.00,
    "Mars": 0.92,
}
ASPECT_WEIGHTS = {
    "conjunction": 1.00,
    "opposition": 0.90,
    "square": 0.86,
    "trine": 0.80,
    "sextile": 0.72,
    "quincunx": 0.62,
}


def _norm(value: float) -> float:
    return float(value) % 360.0


def _distance(a: float, b: float) -> float:
    d = abs(_norm(a) - _norm(b)) % 360.0
    return min(d, 360.0 - d)


def _jd(dt: datetime) -> float:
    utc = dt.astimezone(timezone.utc)
    hour = utc.hour + utc.minute / 60.0 + utc.second / 3600.0 + utc.microsecond / 3_600_000_000.0
    return float(swe.julday(utc.year, utc.month, utc.day, hour, swe.GREG_CAL))


def _datetime_from_jd(jd: float) -> datetime:
    year, month, day, hour = swe.revjul(float(jd), swe.GREG_CAL)
    whole_hour = int(hour)
    minute_float = (hour - whole_hour) * 60.0
    minute = int(minute_float)
    second_float = (minute_float - minute) * 60.0
    second = int(second_float)
    microsecond = int(round((second_float - second) * 1_000_000))
    if microsecond >= 1_000_000:
        second += 1
        microsecond = 0
    base = datetime(int(year), int(month), int(day), tzinfo=timezone.utc)
    return base + timedelta(hours=whole_hour, minutes=minute, seconds=second, microseconds=microsecond)


def _planet_lon(jd: float, name: str) -> float:
    values, _ = swe.calc_ut(float(jd), BODY_IDS[name], swe.FLG_SWIEPH | swe.FLG_SPEED)
    return _norm(float(values[0]))


def _positions(jd: float) -> dict[str, float]:
    return {name: _planet_lon(jd, name) for name in RETURN_CHART_BODIES}


def _birth_utc(profile: dict[str, Any], *, noon_proxy: bool = False) -> datetime:
    birth_time = profile.get("birth_time")
    if birth_time is None:
        if not noon_proxy:
            raise ValueError("birth_time unavailable")
        birth_time = dt_time(12, 0)
    local = datetime.combine(profile["birth_date"], birth_time)
    return (local - timedelta(hours=float(profile.get("utc_offset_hours", 9.0)))).replace(tzinfo=timezone.utc)


def _local_iso_date(dt: datetime, offset_hours: float) -> str:
    local = dt.astimezone(timezone(timedelta(hours=float(offset_hours))))
    return local.date().isoformat()


def _refine_return(body: str, target_lon: float, center_jd: float, half_width: float) -> tuple[float, float]:
    """Minimize angular distance around a sampled local minimum.

    Solar and lunar apparent longitudes are locally monotonic around a return.  A
    ternary minimization of circular distance is stable and avoids depending on a
    particular pyswisseph crossing helper signature.
    """
    left = center_jd - half_width
    right = center_jd + half_width
    for _ in range(64):
        m1 = left + (right - left) / 3.0
        m2 = right - (right - left) / 3.0
        d1 = _distance(_planet_lon(m1, body), target_lon)
        d2 = _distance(_planet_lon(m2, body), target_lon)
        if d1 <= d2:
            right = m2
        else:
            left = m1
    point = (left + right) / 2.0
    return point, _distance(_planet_lon(point, body), target_lon)


def _find_returns(body: str, target_lon: float, start_dt: datetime, end_dt: datetime) -> list[dict[str, Any]]:
    """Bracket signed crossings, including retrograde repeats and range endpoints.

    No 300-day deduplication for Mercury/Venus/Mars. Stationary near-misses
    are rejected by a longitude residual of 1e-6 degrees.
    """
    if end_dt <= start_dt:
        return []
    start, end = _jd(start_dt), _jd(end_dt)
    step = 0.25
    def signed(jd):
        return (_planet_lon(jd, body) - target_lon + 180.0) % 360.0 - 180.0
    found = []
    left, fl = start, signed(start)
    while left < end:
        right = min(end, left + step)
        fr = signed(right)
        root = None
        if abs(fl) <= 1e-7:
            root = left
        elif abs(fr) <= 1e-7:
            root = right
        elif fl * fr <= 0 and abs(fr - fl) < 180.0:
            lo, hi, flo = left, right, fl
            for _ in range(48):
                mid = (lo + hi) / 2
                fm = signed(mid)
                if flo * fm <= 0:
                    hi = mid
                else:
                    lo, flo = mid, fm
            root = (lo + hi) / 2
        if root is not None:
            residual = _distance(_planet_lon(root, body), target_lon)
            if residual <= 1e-6 and (not found or root - found[-1]['jd'] > 1e-5):
                found.append({'jd': root, 'orb': residual})
        left, fl = right, fr
    return found


def _aspect_hits(return_positions: dict[str, float], natal_positions: dict[str, float], anchor_body: str) -> list[dict[str, Any]]:
    hits: list[dict[str, Any]] = []
    for planet, lon in return_positions.items():
        if planet == anchor_body:
            continue
        orb_limit = 1.5 if planet in {"Sun", "Moon", "Mercury", "Venus", "Mars"} else 2.0
        for target in PERSONAL_TARGETS:
            target_lon = natal_positions.get(target)
            if target_lon is None:
                continue
            dist = _distance(lon, target_lon)
            for aspect, exact in ASPECTS.items():
                orb = abs(dist - exact)
                if orb > orb_limit:
                    continue
                strength = (
                    PLANET_WEIGHTS.get(planet, 0.5)
                    * TARGET_WEIGHTS.get(target, 0.5)
                    * ASPECT_WEIGHTS[aspect]
                    * max(0.0, 1.0 - orb / orb_limit)
                )
                tone = "supportive" if aspect in SUPPORTIVE else ("challenging" if aspect in CHALLENGING else "mixed")
                hits.append({
                    "a": planet,
                    "aspect": aspect,
                    "b": target,
                    "orb": round(orb, 3),
                    "tone": tone,
                    "activation_strength": round(strength, 4),
                    "source": "return_chart",
                    "event_probability": "not_calculated",
                })
    hits.sort(key=lambda x: (-float(x["activation_strength"]), float(x["orb"])))
    return hits[:10]


def _activation_summary(hits: list[dict[str, Any]]) -> dict[str, Any]:
    top = hits[:6]
    raw = sum(float(x.get("activation_strength") or 0.0) for x in top)
    score = round(min(100.0, raw * 28.0), 1)
    supportive = sum(1 for x in top if x.get("tone") == "supportive")
    challenging = sum(1 for x in top if x.get("tone") == "challenging")
    if supportive > challenging + 1:
        balance = "supportive"
    elif challenging > supportive + 1:
        balance = "challenging"
    else:
        balance = "mixed"
    return {
        "activation_score": score,
        "balance": balance,
        "supportive_count": supportive,
        "challenging_count": challenging,
        "top_aspects": top[:5],
        "event_probability": "not_calculated",
    }


def _person_return_context(profile: dict[str, Any], start_date: date, end_date: date, label: str) -> dict[str, Any]:
    reliability = resolve_birth_time_reliability(profile)
    offset = float(profile.get("utc_offset_hours", 9.0))
    solar_birth_utc = _birth_utc(profile, noon_proxy=True)
    solar_natal_positions = _positions(_jd(solar_birth_utc))

    solar_scan_start = datetime.combine(start_date - timedelta(days=380), dt_time(0, 0), tzinfo=timezone.utc)
    solar_scan_end = datetime.combine(end_date + timedelta(days=380), dt_time(23, 59), tzinfo=timezone.utc)
    solar_raw = _find_returns("Sun", solar_natal_positions["Sun"], solar_scan_start, solar_scan_end)
    solar_events: list[dict[str, Any]] = []
    for item in solar_raw:
        return_dt = _datetime_from_jd(float(item["jd"]))
        chart = _positions(float(item["jd"]))
        hits = _aspect_hits(chart, solar_natal_positions, "Sun")
        solar_events.append({
            "person": label,
            "return_type": "solar_return",
            "exact_utc": return_dt.isoformat(),
            "local_date": _local_iso_date(return_dt, offset),
            "orb": round(float(item["orb"]), 5),
            "precision": "exact" if reliability["time_exact"] else ("provisional" if reliability["time_available"] else "date_noon_proxy"),
            "birth_time_reliability": reliability,
            **_activation_summary(hits),
            "independence_group": "solar_return_context",
            "independent_bonus_eligible": False,
        })
    for idx, event in enumerate(solar_events):
        next_date = solar_events[idx + 1]["local_date"] if idx + 1 < len(solar_events) else None
        event["window_start"] = event["local_date"]
        event["window_end_exclusive"] = next_date

    lunar_events: list[dict[str, Any]] = []
    lunar_available = reliability["time_available"] and profile.get("birth_time") is not None
    if lunar_available:
        lunar_birth_utc = _birth_utc(profile)
        lunar_natal_positions = _positions(_jd(lunar_birth_utc))
        lunar_scan_start = datetime.combine(start_date - timedelta(days=35), dt_time(0, 0), tzinfo=timezone.utc)
        lunar_scan_end = datetime.combine(end_date + timedelta(days=35), dt_time(23, 59), tzinfo=timezone.utc)
        lunar_raw = _find_returns("Moon", lunar_natal_positions["Moon"], lunar_scan_start, lunar_scan_end)
        for item in lunar_raw:
            return_dt = _datetime_from_jd(float(item["jd"]))
            chart = _positions(float(item["jd"]))
            hits = _aspect_hits(chart, lunar_natal_positions, "Moon")
            lunar_events.append({
                "person": label,
                "return_type": "lunar_return",
                "exact_utc": return_dt.isoformat(),
                "local_date": _local_iso_date(return_dt, offset),
                "orb": round(float(item["orb"]), 5),
                "precision": "exact" if reliability["time_exact"] else "provisional",
                "birth_time_reliability": reliability,
                **_activation_summary(hits),
                "independence_group": "lunar_return_context",
                "independent_bonus_eligible": False,
            })
        for idx, event in enumerate(lunar_events):
            next_date = lunar_events[idx + 1]["local_date"] if idx + 1 < len(lunar_events) else None
            event["window_start"] = event["local_date"]
            event["window_end_exclusive"] = next_date

    planetary = {}
    for body, key, padding in (("Mercury", "mercury_return", 420), ("Venus", "venus_return", 650), ("Mars", "mars_return", 900)):
        events = []
        if reliability["time_available"]:
            scan_start = datetime.combine(start_date - timedelta(days=padding), dt_time(), tzinfo=timezone.utc)
            scan_end = datetime.combine(end_date + timedelta(days=padding), dt_time(), tzinfo=timezone.utc)
            for item in _find_returns(body, solar_natal_positions[body], scan_start, scan_end):
                instant = _datetime_from_jd(item["jd"])
                events.append({
                    "person": label, "return_type": key, "exact_utc": instant.isoformat(),
                    "local_date": _local_iso_date(instant, offset), "orb": item["orb"],
                    "precision": "exact" if reliability["time_exact"] else "provisional",
                    **_activation_summary(_aspect_hits(_positions(item["jd"]), solar_natal_positions, body)),
                    "independent_bonus_eligible": False,
                })
            for idx, event in enumerate(events):
                event["window_start"] = event["local_date"]
                event["window_end_exclusive"] = events[idx+1]["local_date"] if idx+1 < len(events) else None
        planetary[key] = {"available": bool(events), "events": events, "role": "medium_term_context"}

    # Keep exact UTC cycle boundaries and separated house systems. Birthplace is
    # the explicit return-location fallback; it is not a claimed current residence.
    from relationship_western_v1 import _chart_from_jd, _whole_sign_house, _house_of_longitude
    for event in solar_events + lunar_events + [e for v in planetary.values() for e in v["events"]]:
        jd = _jd(datetime.fromisoformat(event["exact_utc"]))
        chart = _chart_from_jd(jd, profile.get("latitude"), profile.get("longitude"))
        angles = chart["angles"]
        event["angles"] = angles if reliability["time_exact"] else {}
        event["location_basis"] = "entered_birthplace; current return location unavailable"
        event["positions"] = {k: v["lon"] for k, v in chart["positions"].items()}
        event["house_activations"] = [
            {"planet": k, "whole_sign": _whole_sign_house(angles["ASC"], v["lon"]),
             "quadrant": _house_of_longitude(angles["cusps"], v["lon"])}
            for k,v in chart["positions"].items()
            if angles and reliability["time_exact"] and k in {"Moon", "Mercury", "Venus", "Mars"}
        ]
    for events in [solar_events, lunar_events] + [v["events"] for v in planetary.values()]:
        for idx, event in enumerate(events):
            event["next_exact_utc"] = events[idx+1]["exact_utc"] if idx+1 < len(events) else None

    return {
        "person": label,
        **planetary,
        "solar_return": {
            "available": bool(solar_events),
            "events": solar_events,
            "policy": "annual background context only; does not create exact event dates",
        },
        "lunar_return": {
            "available": lunar_available and bool(lunar_events),
            "reason": None if lunar_available else "birth_time_unavailable_for_natal_moon_return",
            "events": lunar_events,
            "policy": "monthly/emotional background context only; does not create exact event dates",
        },
        "birth_time_reliability": reliability,
    }


def _active_event(events: list[dict[str, Any]], target: date) -> dict[str, Any] | None:
    iso = target.isoformat()
    candidates = [e for e in events if str(e.get("window_start") or "") <= iso]
    if not candidates:
        return None
    event = candidates[-1]
    end = event.get("window_end_exclusive")
    if end and iso >= str(end):
        return None
    return event


def _pair_context_for_date(user_ctx: dict[str, Any], cp_ctx: dict[str, Any], target: date) -> dict[str, Any]:
    def layer(name: str) -> dict[str, Any]:
        u = _active_event(list(user_ctx.get(name, {}).get("events") or []), target)
        c = _active_event(list(cp_ctx.get(name, {}).get("events") or []), target)
        values = [float(x["activation_score"]) for x in (u, c) if x and isinstance(x.get("activation_score"), (int, float))]
        pair = round(sum(values) / len(values), 1) if values else 0.0
        return {
            "pair_activation_score": pair,
            "user": None if not u else {"window_start": u.get("window_start"), "activation_score": u.get("activation_score"), "balance": u.get("balance"), "precision": u.get("precision")},
            "counterpart": None if not c else {"window_start": c.get("window_start"), "activation_score": c.get("activation_score"), "balance": c.get("balance"), "precision": c.get("precision")},
            "shared_activation": bool(u and c and float(u.get("activation_score") or 0) >= 45 and float(c.get("activation_score") or 0) >= 45),
        }

    solar = layer("solar_return")
    lunar = layer("lunar_return")
    combined = round(solar["pair_activation_score"] * 0.4 + lunar["pair_activation_score"] * 0.6, 1)
    return {
        "date": target.isoformat(),
        "solar_return": solar,
        "lunar_return": lunar,
        "background_score": combined,
        "independent_bonus_eligible": False,
        "event_probability": "not_calculated",
    }


def _month_iter(start_date: date, end_date: date):
    cursor = date(start_date.year, start_date.month, 1)
    while cursor <= end_date:
        next_month = date(cursor.year + (cursor.month == 12), 1 if cursor.month == 12 else cursor.month + 1, 1)
        month_end = min(end_date, next_month - timedelta(days=1))
        month_start = max(start_date, cursor)
        midpoint = month_start + (month_end - month_start) // 2
        yield cursor.strftime("%Y-%m"), month_start, month_end, midpoint
        cursor = next_month


def _collect_fast_candidates(result: dict[str, Any]) -> dict[str, dict[str, Any]]:
    dates: dict[str, dict[str, Any]] = {}
    dimensions = result.get("reunion_dimensions") or {}
    for stage in ("contact_recontact", "in_person_meeting", "relationship_rebuilding"):
        axis = dimensions.get(stage) or {}
        for row in list(axis.get("top_evidence") or []):
            value = str(row.get("date") or "")
            if not value:
                continue
            entry = dates.setdefault(value, {"date": value, "stages": [], "fast_trigger_score": 0.0})
            if stage not in entry["stages"]:
                entry["stages"].append(stage)
            entry["fast_trigger_score"] = max(float(entry["fast_trigger_score"]), float(row.get("score") or 0.0))
    for row in list((result.get("reunion_transits") or {}).get("top_days") or []):
        value = str(row.get("date") or "")
        if not value:
            continue
        entry = dates.setdefault(value, {"date": value, "stages": [], "fast_trigger_score": 0.0})
        entry["fast_trigger_score"] = max(float(entry["fast_trigger_score"]), float(row.get("score") or 0.0))
    return dates


def augment_relationship_with_returns(result: dict[str, Any], user_profile: dict[str, Any], counterpart_profile: dict[str, Any], start_date: date, end_date: date) -> dict[str, Any]:
    """Attach Solar/Lunar Return context to a completed relationship result.

    The function mutates and returns ``result`` for API integration convenience.
    Exact-date candidates are *never created here*: only existing fast-trigger dates
    from the main engine can enter ``candidate_dates``.
    """
    user_ctx = _person_return_context(user_profile, start_date, end_date, "user")
    cp_ctx = _person_return_context(counterpart_profile, start_date, end_date, "counterpart")

    monthly = []
    for month_key, month_start, month_end, midpoint in _month_iter(start_date, end_date):
        ctx = _pair_context_for_date(user_ctx, cp_ctx, midpoint)
        monthly.append({
            "calendar_month": month_key,
            "start": month_start.isoformat(),
            "end": month_end.isoformat(),
            "representative_date": midpoint.isoformat(),
            **ctx,
        })

    candidate_map = _collect_fast_candidates(result)
    candidates = []
    for value, base in candidate_map.items():
        try:
            target = date.fromisoformat(value)
        except ValueError:
            continue
        context = _pair_context_for_date(user_ctx, cp_ctx, target)
        fast_score = float(base.get("fast_trigger_score") or 0.0)
        background = float(context.get("background_score") or 0.0)
        candidates.append({
            **base,
            "return_context": context,
            "priority_index": round(fast_score * FAST_TRIGGER_WEIGHT + background * RETURN_CONTEXT_WEIGHT, 1),
            "exact_date_basis": "fast_transit_trigger",
            "return_role": "background_tiebreaker_only",
            "priority_components": {
                "fast_trigger_weight": FAST_TRIGGER_WEIGHT,
                "return_context_weight": RETURN_CONTEXT_WEIGHT,
                "return_weight_cap": RETURN_CONTEXT_WEIGHT,
            },
            "independent_bonus_eligible": False,
            "event_probability": "not_calculated",
        })
    candidates.sort(key=lambda x: (-float(x["priority_index"]), -float(x["fast_trigger_score"]), x["date"]))

    # Also annotate the already-admitted four-stage evidence in place.  Scores are untouched.
    for stage in ("emotional_reactivation", "contact_recontact", "in_person_meeting", "relationship_rebuilding"):
        axis = (result.get("reunion_dimensions") or {}).get(stage) or {}
        for row in list(axis.get("top_evidence") or []):
            value = row.get("date")
            if not value:
                continue
            try:
                row["return_context"] = _pair_context_for_date(user_ctx, cp_ctx, date.fromisoformat(str(value)))
            except ValueError:
                continue

    result["reunion_return_support"] = {
        "engine": ENGINE_VERSION,
        "period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
        "solar_return": {
            "role": "annual_background",
            "user": user_ctx["solar_return"],
            "counterpart": cp_ctx["solar_return"],
        },
        "lunar_return": {
            "role": "monthly_emotional_background",
            "user": user_ctx["lunar_return"],
            "counterpart": cp_ctx["lunar_return"],
        },
        **{key: {"role": "medium_term_context", "user": user_ctx[key], "counterpart": cp_ctx[key]} for key in ("mercury_return", "venus_return", "mars_return")},
        "monthly_context": monthly,
        "candidate_dates": candidates[:16],
        "weight_policy": {
            "fast_trigger_weight": FAST_TRIGGER_WEIGHT,
            "return_context_weight": RETURN_CONTEXT_WEIGHT,
            "return_weight_cap": RETURN_CONTEXT_WEIGHT,
            "meaning": "Return can only re-rank dates that already passed the fast-trigger gate; it never creates a date or event probability.",
        },
        "display_policy": {
            "main_labels": ["연간 배경", "월간 배경"],
            "technical_labels": ["Solar Return(태양회귀)", "Lunar Return(달회귀)"],
            "initiative_use": "forbidden",
        },
        "policy": (
            "Solar Return and Lunar Return are separate return-chart context layers. "
            "They may rank or contextualize dates that already passed the fast-transit gate, "
            "but they never create an exact date by themselves, never turn emotional activation "
            "into contact/meeting/reunion, and never count as an independent convergence vote "
            "against the same underlying transit phenomenon."
        ),
        "event_probability": "not_calculated",
    }
    return result
