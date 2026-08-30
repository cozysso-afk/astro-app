# -*- coding: utf-8 -*-
"""Pure calculation engine for the mobile integrated-fortune API.

This module extracts the deterministic Western period scoring, Saju true-solar
calculation, and Thai weekday baseline already used by the Streamlit app.
It intentionally contains no Streamlit/UI state and no AI interpretation.
"""

from __future__ import annotations

import calendar
import json
from pathlib import Path
from datetime import date, datetime, time as dt_time, timedelta, timezone
from functools import lru_cache
from typing import Any

import pytz
import swisseph as swe
from lunar_python import Solar
from skyfield.api import load
from skyfield.framelib import ecliptic_frame

ENGINE_VERSION = "integrated-fortune-v2.5-ephemeris-cache-audit"
WESTERN_ENGINE_VERSION = "western-period-engine-v8-ephemeris-cache-audit"
SAJU_ENGINE_VERSION = "lunar_python-1.4.8-true-solar"
THAI_ENGINE_VERSION = "thai-weekday-baseline-v1"

KST = pytz.timezone("Asia/Seoul")
UTC = pytz.UTC
WEEKDAY_KO = ["월", "화", "수", "목", "금", "토", "일"]

PLANET_KEYS = {
    "Sun": ("sun",),
    "Moon": ("moon",),
    "Mercury": ("mercury", "mercury barycenter"),
    "Venus": ("venus", "venus barycenter"),
    "Mars": ("mars", "mars barycenter"),
    "Jupiter": ("jupiter", "jupiter barycenter"),
    "Saturn": ("saturn", "saturn barycenter"),
    "Uranus": ("uranus", "uranus barycenter"),
    "Neptune": ("neptune", "neptune barycenter"),
    "Pluto": ("pluto", "pluto barycenter"),
}

TRADITIONAL_RULER_BY_SIGN = {
    0: "Mars", 1: "Venus", 2: "Mercury", 3: "Moon", 4: "Sun", 5: "Mercury",
    6: "Venus", 7: "Mars", 8: "Jupiter", 9: "Saturn", 10: "Saturn", 11: "Jupiter",
}

ASPECTS = {
    "합": {"angle": 0.0, "activation": 1.00, "polarity": 0.00},
    "육십분위": {"angle": 60.0, "activation": 0.72, "polarity": 0.55},
    "사분위": {"angle": 90.0, "activation": 0.90, "polarity": -0.55},
    "삼분위": {"angle": 120.0, "activation": 0.82, "polarity": 0.65},
    "충": {"angle": 180.0, "activation": 1.00, "polarity": -0.45},
}
EXACT_ORB = 0.02
LAYER_BY_TRANSIT = {
    "Moon": "일일", "Sun": "중기", "Mercury": "중기", "Venus": "중기", "Mars": "중기",
    "Jupiter": "장기", "Saturn": "장기", "Uranus": "장기", "Neptune": "장기", "Pluto": "장기",
}
PLANET_TONE = {
    "Sun": 0.15, "Moon": 0.05, "Mercury": 0.00, "Venus": 0.45, "Mars": -0.25,
    "Jupiter": 0.50, "Saturn": -0.45, "Uranus": -0.15, "Neptune": -0.10, "Pluto": -0.25,
    "ASC": 0.0, "MC": 0.0,
}

TOPIC_SPECS = {
    "금전": {
        "targets": {"Venus": 1.0, "Jupiter": .90, "Mercury": .65, "Saturn": .50, "Moon": .25, "MC": .30},
        "transits": {"Venus": 1.0, "Jupiter": .95, "Mercury": .70, "Saturn": .55, "Mars": .40, "Moon": .35, "Uranus": .35},
        "houses": {2: 1.0, 8: .70, 11: .80, 10: .30},
        "ruler_houses": [2, 8, 11],
    },
    "투자심리": {
        "targets": {"Mercury": .90, "Mars": .80, "Jupiter": .75, "Saturn": .70, "Uranus": .65, "Moon": .40},
        "transits": {"Mercury": .90, "Mars": .85, "Jupiter": .80, "Saturn": .75, "Uranus": .75, "Moon": .55, "Venus": .45},
        "houses": {2: .95, 5: .80, 8: .75, 11: .85},
        "ruler_houses": [2, 5, 8, 11],
    },
    "학업": {
        "targets": {"Mercury": 1.0, "Saturn": .80, "Sun": .55, "Mars": .45, "Moon": .35, "MC": .25},
        "transits": {"Mercury": 1.0, "Saturn": .75, "Mars": .55, "Sun": .50, "Moon": .45, "Jupiter": .35},
        "houses": {3: 1.0, 6: .80, 9: 1.0, 10: .30},
        "ruler_houses": [3, 6, 9],
    },
    "시험": {
        "targets": {"Mercury": 1.0, "Jupiter": .80, "Saturn": .85, "Mars": .55, "Moon": .45, "Sun": .45, "MC": .45},
        "transits": {"Mercury": 1.0, "Jupiter": .75, "Saturn": .85, "Mars": .60, "Moon": .55, "Sun": .40},
        "houses": {3: .85, 6: .65, 9: 1.0, 10: .75},
        "ruler_houses": [3, 9, 10],
    },
    "직장": {
        "targets": {"MC": 1.0, "Sun": .85, "Saturn": .90, "Mercury": .70, "Jupiter": .70, "Mars": .55, "Moon": .30},
        "transits": {"Saturn": .90, "Jupiter": .85, "Sun": .70, "Mercury": .70, "Mars": .65, "Uranus": .45, "Moon": .30},
        "houses": {6: .90, 10: 1.0, 2: .45, 11: .40},
        "ruler_houses": [6, 10],
    },
    "이직": {
        "targets": {"MC": 1.0, "Jupiter": .90, "Uranus": .90, "Mercury": .70, "Saturn": .65, "Venus": .55, "Sun": .45},
        "transits": {"Jupiter": .95, "Uranus": 1.0, "Mercury": .75, "Saturn": .70, "Venus": .60, "Sun": .45, "Mars": .40},
        "houses": {6: .55, 10: 1.0, 2: .55, 9: .65, 11: .75},
        "ruler_houses": [6, 10, 11],
    },
    "대인관계": {
        "targets": {"Mercury": .90, "Venus": .85, "Moon": .80, "Jupiter": .65, "Saturn": .55, "Sun": .45, "ASC": .45},
        "transits": {"Mercury": .95, "Venus": .80, "Moon": .80, "Jupiter": .65, "Saturn": .55, "Mars": .45, "Uranus": .35, "Sun": .35},
        "houses": {3: .75, 4: .90, 7: .85, 11: 1.0, 5: .35},
        "ruler_houses": [3, 4, 7, 11],
    },
    "연애": {
        "targets": {"Venus": 1.0, "Moon": .85, "Mars": .65, "Sun": .45, "Mercury": .35, "ASC": .45},
        "transits": {"Venus": 1.0, "Moon": .85, "Mars": .65, "Mercury": .50, "Jupiter": .55, "Saturn": .35, "Sun": .35},
        "houses": {5: 1.0, 7: 1.0, 1: .35, 8: .40},
        "ruler_houses": [5, 7],
    },
    "연락": {
        "targets": {"Mercury": 1.0, "Venus": .70, "Moon": .60, "Sun": .30, "ASC": .30},
        "transits": {"Mercury": 1.0, "Moon": .85, "Venus": .70, "Mars": .35, "Jupiter": .30, "Saturn": .25, "Uranus": .35},
        "houses": {3: 1.0, 7: .85, 1: .25, 11: .30},
        "ruler_houses": [3, 7],
    },
    "재회": {
        "targets": {"Mercury": .90, "Venus": 1.0, "Moon": .80, "Saturn": .65, "Pluto": .55, "ASC": .25},
        "transits": {"Mercury": .90, "Venus": 1.0, "Moon": .75, "Saturn": .65, "Jupiter": .45, "Uranus": .45, "Pluto": .55},
        "houses": {3: .65, 5: .80, 7: 1.0, 8: .45, 12: .40},
        "ruler_houses": [5, 7, 12],
    },
    "소식": {
        "targets": {"Mercury": 1.0, "Moon": .65, "Jupiter": .60, "Uranus": .60, "MC": .45, "Sun": .30},
        "transits": {"Mercury": 1.0, "Moon": .80, "Jupiter": .60, "Uranus": .65, "Saturn": .35, "Sun": .30},
        "houses": {3: 1.0, 9: .70, 10: .70, 11: .70},
        "ruler_houses": [3, 9, 10, 11],
    },
    "컨디션": {
        "targets": {"Moon": 1.0, "Sun": .85, "Mars": .55, "Saturn": .55, "ASC": .80},
        "transits": {"Moon": 1.0, "Sun": .60, "Mars": .65, "Saturn": .65, "Neptune": .35, "Jupiter": .25},
        "houses": {1: 1.0, 6: .90, 12: .80},
        "ruler_houses": [1, 6, 12],
    },
}

TOPIC_ORDER = ["금전", "투자심리", "수익실현", "신규진입", "투자주의", "학업", "시험", "직장", "이직", "대인관계", "연애", "연락", "재회", "소식", "컨디션"]
INVESTMENT_KEYS = {"투자심리", "수익실현", "신규진입", "투자주의"}

_STEM_INFO = {
    "甲": ("木", 1), "乙": ("木", 0), "丙": ("火", 1), "丁": ("火", 0), "戊": ("土", 1),
    "己": ("土", 0), "庚": ("金", 1), "辛": ("金", 0), "壬": ("水", 1), "癸": ("水", 0),
}
_GENERATES = {"木": "火", "火": "土", "土": "金", "金": "水", "水": "木"}
_CONTROLS = {"木": "土", "土": "水", "水": "火", "火": "金", "金": "木"}
_LIUHE = {frozenset(x) for x in [("子", "丑"), ("寅", "亥"), ("卯", "戌"), ("辰", "酉"), ("巳", "申"), ("午", "未")]}
_LIUCHONG = {frozenset(x) for x in [("子", "午"), ("丑", "未"), ("寅", "申"), ("卯", "酉"), ("辰", "戌"), ("巳", "亥")]}

_THAI_DAY = {
    6: ("일요일", "Sun(태양)", "일요일 출생층"),
    0: ("월요일", "Moon(달)", "월요일 출생층"),
    1: ("화요일", "Mars(화성)", "화요일 출생층"),
    2: ("수요일 낮", "Mercury(수성)", "수요일 06:00~17:59 출생층"),
    3: ("목요일", "Jupiter(목성)", "목요일 출생층"),
    4: ("금요일", "Venus(금성)", "금요일 출생층"),
    5: ("토요일", "Saturn(토성)", "토요일 출생층"),
}


@lru_cache(maxsize=1)
def _ephemeris_bundle():
    ts = load.timescale()
    fallback_reason = None
    try:
        eph = load("de440s.bsp")
        label = "DE440s"
    except Exception as exc:
        fallback_reason = str(exc)
        eph = load("de421.bsp")
        label = "DE421 (fallback)"
    earth = eph["earth"]
    targets = {}
    used = {}
    for body, candidates in PLANET_KEYS.items():
        last_error = None
        for candidate in candidates:
            try:
                targets[body] = eph[candidate]
                used[body] = candidate
                break
            except (KeyError, ValueError) as exc:
                last_error = exc
        else:
            raise KeyError(f"{label}에서 {body} target을 찾지 못했습니다: {last_error}")
    return ts, eph, earth, targets, used, label, fallback_reason


def _tz(offset_hours: float):
    return timezone(timedelta(hours=float(offset_hours)))


def _aware_local(day_value: date, time_value: dt_time, offset_hours: float):
    return datetime.combine(day_value, time_value).replace(tzinfo=_tz(offset_hours))


def _sf_time(dt_aware: datetime):
    ts, *_ = _ephemeris_bundle()
    return ts.from_datetime(dt_aware.astimezone(timezone.utc))


def _to_jd_ut(dt_utc: datetime):
    dt_utc = dt_utc.astimezone(timezone.utc)
    hour = dt_utc.hour + dt_utc.minute / 60 + dt_utc.second / 3600 + dt_utc.microsecond / 3_600_000_000
    return swe.julday(dt_utc.year, dt_utc.month, dt_utc.day, hour, swe.GREG_CAL)


@lru_cache(maxsize=60000)
def _planet_lon(body_name: str, dt_aware: datetime):
    # Deterministic astronomical lookup. Annual scans revisit many identical
    # timestamps across life/market scans and applying/separating windows.
    _, _, earth, targets, _, _, _ = _ephemeris_bundle()
    apparent = earth.at(_sf_time(dt_aware)).observe(targets[body_name]).apparent()
    _, lon, _ = apparent.frame_latlon(ecliptic_frame)
    return float(lon.degrees % 360.0)


def _circular_delta(a: float, b: float):
    return (a - b + 180.0) % 360.0 - 180.0


def _angular_separation(a: float, b: float):
    return abs(_circular_delta(a, b))


def _compute_houses(dt_utc: datetime, latitude: float, longitude: float):
    jd_ut = _to_jd_ut(dt_utc)
    placidus_cusps, ascmc = swe.houses_ex(jd_ut, float(latitude), float(longitude), b"P", 0)
    asc, mc, vertex = float(ascmc[0] % 360), float(ascmc[1] % 360), float(ascmc[3] % 360)
    asc_sign = int(asc // 30)
    whole_cusps = [float(((asc_sign + i) % 12) * 30.0) for i in range(12)]
    return {
        "jd_ut": jd_ut,
        "asc": asc,
        "mc": mc,
        "vertex": vertex,
        "whole_cusps": whole_cusps,
        "placidus_cusps": [float(x % 360) for x in placidus_cusps],
    }


def _whole_sign_house(lon: float, natal_asc_lon: float):
    return (int((lon % 360) // 30) - int((natal_asc_lon % 360) // 30)) % 12 + 1


def _cusp_house(lon: float, cusps: list[float]):
    lon %= 360.0
    for i in range(12):
        start, end = cusps[i] % 360.0, cusps[(i + 1) % 12] % 360.0
        span, pos = (end - start) % 360.0, (lon - start) % 360.0
        if span > 0 and pos < span:
            return i + 1
    return None


def _house_ruler(house_no: int, natal_asc_lon: float):
    asc_sign = int((natal_asc_lon % 360) // 30)
    return TRADITIONAL_RULER_BY_SIGN[(asc_sign + house_no - 1) % 12]


def _max_orb_for(body: str, aspect_name: str):
    if body == "Moon":
        base = 2.6
    elif body in {"Sun", "Mercury", "Venus", "Mars"}:
        base = 3.0
    else:
        base = 2.5
    if aspect_name in {"합", "충"}:
        base += 0.35
    return base


def _orb_weight(orb: float, max_orb: float):
    if orb <= .40:
        return 1.0
    if orb <= .90:
        return .86
    if orb <= 1.60:
        return .68
    if orb <= 2.30:
        return .50
    if orb <= max_orb:
        return .32
    return 0.0


def _motion_window_hours(body: str):
    if body == "Moon":
        return .25
    if body in {"Sun", "Mercury", "Venus", "Mars"}:
        return 1.0
    return 6.0


@lru_cache(maxsize=30000)
def _planet_snapshot(body: str, query_dt_utc: datetime):
    # Cached snapshots preserve the exact same lon/past/future math while
    # avoiding duplicate Skyfield observations at overlapping scan times.
    h = _motion_window_hours(body)
    past = query_dt_utc - timedelta(hours=h)
    future = query_dt_utc + timedelta(hours=h)
    lon_now = _planet_lon(body, query_dt_utc)
    lon_past = _planet_lon(body, past)
    lon_future = _planet_lon(body, future)
    speed = _circular_delta(lon_future, lon_past) / ((2 * h) / 24.0)
    direction = "순행" if speed > .002 else "역행" if speed < -.002 else "정지권"
    return {
        "lon": lon_now,
        "past_lon": lon_past,
        "future_lon": lon_future,
        "speed": speed,
        "direction": direction,
    }


def _analyze_aspect(body: str, snapshot: dict, natal_lon: float):
    candidates = []
    for name, spec in ASPECTS.items():
        orb = abs(_angular_separation(snapshot["lon"], natal_lon) - spec["angle"])
        max_orb = _max_orb_for(body, name)
        if orb > max_orb:
            continue
        orb_past = abs(_angular_separation(snapshot["past_lon"], natal_lon) - spec["angle"])
        orb_future = abs(_angular_separation(snapshot["future_lon"], natal_lon) - spec["angle"])
        if orb <= EXACT_ORB:
            motion, motion_mult = "정확(Exact)", 1.15
        else:
            slope = orb_future - orb_past
            if slope < -1e-5:
                motion, motion_mult = "적용(Applying)", 1.08
            elif slope > 1e-5:
                motion, motion_mult = "분리(Separating)", .92
            else:
                motion, motion_mult = "변화 미미", 1.0
        candidates.append({
            "name": name,
            "angle": spec["angle"],
            "orb": orb,
            "orb_weight": _orb_weight(orb, max_orb),
            "motion": motion,
            "motion_mult": motion_mult,
            "activation_mult": spec["activation"],
            "base_polarity": spec["polarity"],
        })
    return min(candidates, key=lambda x: x["orb"]) if candidates else None


def _build_transit_records_subset(query_dt_utc: datetime, natal_lons: dict, natal_houses: dict, bodies: list[str]):
    natal_core = dict(natal_lons)
    natal_core["ASC"], natal_core["MC"] = natal_houses["asc"], natal_houses["mc"]
    snapshots = {body: _planet_snapshot(body, query_dt_utc) for body in bodies}
    records = []
    for body, snap in snapshots.items():
        w_house = _whole_sign_house(snap["lon"], natal_houses["asc"])
        p_house = _cusp_house(snap["lon"], natal_houses["placidus_cusps"])
        for target, target_lon in natal_core.items():
            asp = _analyze_aspect(body, snap, target_lon)
            if asp:
                records.append({
                    "layer": LAYER_BY_TRANSIT[body],
                    "transit": body,
                    "target": target,
                    "whole_house": w_house,
                    "placidus_house": p_house,
                    "speed": snap["speed"],
                    "direction": snap["direction"],
                    **asp,
                })
    records.sort(key=lambda r: (r["orb"], -r["orb_weight"]))
    return snapshots, records


def _clamp(x: float, low: float = 0.0, high: float = 100.0):
    return max(low, min(high, x))


def _aspect_polarity(record: dict):
    base = record["base_polarity"]
    transit_tone = PLANET_TONE.get(record["transit"], 0.0)
    target_tone = PLANET_TONE.get(record["target"], 0.0)
    if record["name"] == "합":
        value = .70 * transit_tone + .30 * target_tone
    else:
        value = .75 * base + .30 * transit_tone + .10 * target_tone
    return max(-1.0, min(1.0, value))


def _target_weight_for_topic(spec: dict, target: str, natal_asc_lon: float):
    weight = spec["targets"].get(target, 0.0)
    if target in PLANET_KEYS:
        rulers = {_house_ruler(h, natal_asc_lon) for h in spec["ruler_houses"]}
        if target in rulers:
            weight += .18
    return weight


def _direction_modifier(topic: str, body: str, direction: str):
    if direction == "정지권":
        return 1.06, 0.0
    if direction != "역행":
        return 1.0, 0.0
    if topic == "재회" and body in {"Mercury", "Venus"}:
        return 1.10, -0.02
    if topic in {"연락", "소식"} and body == "Mercury":
        return 1.02, -0.07
    if topic in {"직장", "이직", "시험", "학업"} and body == "Mercury":
        return .98, -0.05
    return 1.0, -0.02


def _score_topic(topic_name: str, transit_records: list[dict], snapshots: dict, natal_houses: dict):
    spec = TOPIC_SPECS[topic_name]
    raw_activation = 0.0
    polarity_num = 0.0
    polarity_den = 0.0
    evidences = []
    layers = set()

    for rec in transit_records:
        transit_w = spec["transits"].get(rec["transit"], 0.0)
        target_w = _target_weight_for_topic(spec, rec["target"], natal_houses["asc"])
        if transit_w <= 0 or target_w <= 0:
            continue
        dir_mult, dir_pol = _direction_modifier(topic_name, rec["transit"], rec["direction"])
        contribution = rec["orb_weight"] * rec["motion_mult"] * rec["activation_mult"] * transit_w * target_w * dir_mult
        if contribution <= 0:
            continue
        pol = max(-1.0, min(1.0, _aspect_polarity(rec) + dir_pol))
        raw_activation += contribution
        polarity_num += contribution * pol
        polarity_den += contribution
        layers.add(rec["layer"])
        evidences.append({
            "kind": "aspect",
            "score": contribution,
            "polarity": pol,
            "transit": rec["transit"],
            "target": rec["target"],
            "aspect": rec["name"],
            "orb": rec["orb"],
            "motion": rec["motion"],
            "direction": rec["direction"],
        })

    for body, snap in snapshots.items():
        transit_w = spec["transits"].get(body, 0.0)
        if transit_w <= 0:
            continue
        w_house = _whole_sign_house(snap["lon"], natal_houses["asc"])
        p_house = _cusp_house(snap["lon"], natal_houses["placidus_cusps"])
        w_weight = spec["houses"].get(w_house, 0.0)
        p_weight = spec["houses"].get(p_house, 0.0) if p_house else 0.0
        house_contrib = .22 * transit_w * w_weight + .09 * transit_w * p_weight
        if house_contrib <= 0:
            continue
        raw_activation += house_contrib
        layers.add(LAYER_BY_TRANSIT[body])
        evidences.append({
            "kind": "house",
            "score": house_contrib,
            "polarity": 0.0,
            "transit": body,
            "whole_house": w_house,
            "placidus_house": p_house,
            "whole_relevant": bool(w_weight),
            "placidus_relevant": bool(p_weight),
        })

    strong_count = sum(1 for e in evidences if e["kind"] == "aspect" and e["score"] >= .50)
    stacking_bonus = min(7.0, max(0, len(layers) - 1) * 2.0 + min(3, strong_count) * .8)
    activation = _clamp(raw_activation * 18.0 + stacking_bonus)
    favorability = _clamp(50.0 + (polarity_num / polarity_den) * 40.0) if polarity_den else 50.0
    evidences.sort(key=lambda x: x["score"], reverse=True)
    # Scores already include every contribution. Retain only the strongest
    # evidence rows for interpretation/UI to keep Render memory bounded.
    evidences = evidences[:8]
    return {
        "topic": topic_name,
        "activation": int(round(activation)),
        "favorability": int(round(favorability)),
        "layers": sorted(layers),
        "evidence": evidences,
    }


def _blend_topic(result: dict, activation_weight: float = .46):
    return int(round(_clamp(activation_weight * result["activation"] + (1 - activation_weight) * result["favorability"])))


def _relationship_direction_scores(topic_results: dict):
    contact = topic_results.get("연락") or {"activation": 0, "favorability": 50}
    reunion = topic_results.get("재회") or {"activation": 0, "favorability": 50}
    news = topic_results.get("소식") or {"activation": 0, "favorability": 50}
    romance = topic_results.get("연애") or {"activation": 0, "favorability": 50}
    return {
        "수신신호": int(round(_clamp(
            .42 * contact["activation"] + .18 * contact["favorability"]
            + .18 * news["activation"] + .14 * reunion["activation"]
            + .08 * romance["activation"]
        ))),
        "발신적합": int(round(_clamp(
            .28 * contact["activation"] + .46 * contact["favorability"]
            + .12 * romance["favorability"] + .08 * reunion["favorability"]
            + .06 * news["favorability"]
        ))),
        "과거인연접점": int(round(_clamp(
            .40 * reunion["activation"] + .24 * reunion["favorability"]
            + .26 * contact["activation"] + .10 * contact["favorability"]
        ))),
    }


def _derived_scores(topic_results: dict):
    # Keep the original life-topic scores and restore the investment derivatives
    # that existed in the legacy Streamlit engine. They remain relative astrology
    # indices, never price-direction or profit probabilities.
    out = {k: _blend_topic(v) for k, v in topic_results.items()}
    money = topic_results.get("금전") or {"activation": 0.0, "favorability": 50.0}
    invest = topic_results.get("투자심리") or {"activation": 0.0, "favorability": 50.0}
    money_activation = float(money.get("activation", 0.0))
    money_favor = float(money.get("favorability", 50.0))
    invest_activation = float(invest.get("activation", 0.0))
    invest_favor = float(invest.get("favorability", 50.0))
    # A high activation with weak favorability is treated as heat/volatility, not opportunity.
    overheat = max(0.0, invest_activation - invest_favor)
    calm_bias = max(0.0, invest_favor - invest_activation)
    # Realization prefers already-developed money flow and clarity; it does not reward raw heat.
    realize = _clamp(
        .18 * money_activation + .48 * money_favor + .14 * invest_activation + .20 * invest_favor
        - .32 * overheat + .08 * calm_bias
    )
    # New entry needs cleaner investment favorability and is penalized most strongly by overheat.
    entry = _clamp(
        .12 * money_activation + .22 * money_favor + .18 * invest_activation + .48 * invest_favor
        - .48 * overheat + .05 * calm_bias
    )
    # Caution is intentionally a danger index: higher means more restraint is warranted.
    risk = _clamp(
        .30 * invest_activation + .38 * (100.0 - invest_favor)
        + .20 * (100.0 - money_favor) + .42 * overheat
    )
    out.update({
        "수익실현": int(round(realize)),
        "신규진입": int(round(entry)),
        "투자주의": int(round(risk)),
    })
    out.update(_relationship_direction_scores(topic_results))
    return out


@lru_cache(maxsize=1)
def _krx_calendar_data():
    path = Path(__file__).resolve().parent / "data" / "krx_sessions_2020_2027.json"
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        values = payload.get("sessions") if isinstance(payload, dict) else payload
        coverage = payload.get("range") if isinstance(payload, dict) else None
        if isinstance(values, list):
            start = str(coverage[0]) if isinstance(coverage, list) and len(coverage) >= 2 else "2020-01-01"
            end = str(coverage[1]) if isinstance(coverage, list) and len(coverage) >= 2 else "2027-08-27"
            return frozenset(str(x) for x in values), start, end
    except Exception:
        pass
    return frozenset(), None, None


def _krx_session_set() -> frozenset[str]:
    return _krx_calendar_data()[0]


def _krx_calendar_precision(start_date: date, end_date: date):
    sessions, exact_start, exact_end = _krx_calendar_data()
    if not sessions or not exact_start or not exact_end:
        return {
            "mode": "weekday_fallback",
            "exact_range": None,
            "warning": "XKRX 정확 거래일 캘린더를 읽지 못해 평일 기준으로 계산함",
        }
    start_iso, end_iso = start_date.isoformat(), end_date.isoformat()
    if exact_start <= start_iso and end_iso <= exact_end:
        mode = "exact_xkrx"
        warning = None
    elif end_iso < exact_start or start_iso > exact_end:
        mode = "weekday_fallback"
        warning = f"{exact_end} 이후(또는 {exact_start} 이전)는 확정 XKRX 휴장일 데이터 범위 밖이라 평일 기준을 사용함"
    else:
        mode = "mixed"
        warning = f"{exact_start}~{exact_end}는 XKRX 정확 거래일, 범위 밖 날짜는 평일 기준을 함께 사용함"
    return {"mode": mode, "exact_range": [exact_start, exact_end], "warning": warning}


def _is_market_day(day_value: date) -> bool:
    # Runtime stays lightweight: exact XKRX sessions are precomputed. Outside
    # their explicit coverage we retain the old weekday fallback, but now expose
    # that precision downgrade in the response instead of silently implying exactness.
    sessions, exact_start, exact_end = _krx_calendar_data()
    iso = day_value.isoformat()
    if sessions and exact_start and exact_end and exact_start <= iso <= exact_end:
        return iso in sessions
    return day_value.weekday() < 5


def _rolling_window(rows: list[dict], key: str, size: int = 3):
    usable = [row for row in rows if isinstance(row.get(key), (int, float)) and row.get("dt") is not None]
    if not usable:
        return None, None
    size = max(1, min(size, len(usable)))
    windows = []
    for i in range(0, len(usable) - size + 1):
        chunk = usable[i:i+size]
        avg = sum(float(r[key]) for r in chunk) / len(chunk)
        windows.append((avg, chunk[0]["dt"], chunk[-1]["dt"]))
    best = max(windows, key=lambda x: x[0])
    worst = min(windows, key=lambda x: x[0])
    def pack(item):
        avg, start_dt, end_dt = item
        return {
            "start": start_dt.strftime("%H:%M"),
            "end": end_dt.strftime("%H:%M"),
            "score": round(avg, 1),
        }
    return pack(best), pack(worst)


def _evidence_text(item: dict) -> str:
    if not isinstance(item, dict):
        return str(item)
    if item.get("kind") == "aspect":
        transit = item.get("transit", "")
        target = item.get("target", "")
        aspect = item.get("aspect", "")
        orb = item.get("orb")
        direction = item.get("direction", "")
        orb_text = f" · orb {float(orb):.2f}°" if isinstance(orb, (int, float)) else ""
        dir_text = f" · {direction}" if direction else ""
        return f"{transit}→{target} {aspect}{orb_text}{dir_text}".strip()
    if item.get("kind") == "house":
        transit = item.get("transit", "")
        whole = item.get("whole_house")
        placidus = item.get("placidus_house")
        return f"{transit} · Whole Sign {whole}H · Placidus {placidus}H"
    return str(item)


def _detail_from_rows(day_value: date, rows: list[dict]):
    details = {}
    keys = ["금전", "학업", "시험", "직장", "이직", "대인관계", "연애", "연락", "재회", "소식", "컨디션"]
    if _is_market_day(day_value):
        keys += ["투자심리", "수익실현", "신규진입", "투자주의"]
    for key in keys:
        # 90-minute samples + 2-point window preserve a 1h30m readable window
        # while avoiding a second expensive astronomy pass on Render.
        best, worst = _rolling_window(rows, key, 2)
        if not best:
            continue
        evidence = []
        scored = [r for r in rows if isinstance(r.get(key), (int, float))]
        if scored:
            peak = max(scored, key=lambda r: float(r.get(key, 0)))
            if key in TOPIC_SPECS:
                raw = ((peak.get("topics") or {}).get(key) or {}).get("evidence") or []
                evidence = [_evidence_text(x) for x in raw[:6]]
            elif key in {"수익실현", "신규진입", "투자주의"}:
                for base_key in ("금전", "투자심리"):
                    raw = ((peak.get("topics") or {}).get(base_key) or {}).get("evidence") or []
                    evidence.extend(_evidence_text(x) for x in raw[:3])
        details[key] = {"best_window": best, "caution_window": worst, "evidence": evidence[:6]}
    return {"date": day_value.isoformat(), "market_open": _is_market_day(day_value), "topics": details}


def _daily_detail(day_value: date, natal_lons: dict, natal_houses: dict, offset_hours: float):
    rows = _scan_intraday(day_value, dt_time(7, 30), dt_time(23, 0), 90, natal_lons, natal_houses, offset_hours)
    return _detail_from_rows(day_value, rows)


def _pack_natal_lons(natal_lons: dict):
    return tuple((body, float(natal_lons[body])) for body in PLANET_KEYS)


def _unpack_natal_lons(packed):
    return {body: float(v) for body, v in packed}


def _pack_houses(houses: dict):
    return (
        float(houses["asc"]),
        float(houses["mc"]),
        float(houses["vertex"]),
        tuple(float(x) for x in houses["whole_cusps"]),
        tuple(float(x) for x in houses["placidus_cusps"]),
    )


def _unpack_houses(packed):
    asc, mc, vertex, whole, placidus = packed
    return {
        "asc": asc,
        "mc": mc,
        "vertex": vertex,
        "whole_cusps": list(whole),
        "placidus_cusps": list(placidus),
    }


def _make_time_points(day_value: date, start_time: dt_time, end_time: dt_time, step_minutes: int, offset_hours: float):
    start_dt = _aware_local(day_value, start_time, offset_hours)
    end_dt = _aware_local(day_value, end_time, offset_hours)
    points = []
    cur = start_dt
    step = timedelta(minutes=int(step_minutes))
    while cur <= end_dt:
        points.append(cur)
        cur += step
    return points


def _scan_intraday(day_value: date, start_time: dt_time, end_time: dt_time, step_minutes: int, natal_lons: dict, natal_houses: dict, offset_hours: float, topic_names=None):
    points = _make_time_points(day_value, start_time, end_time, step_minutes, offset_hours)
    if not points:
        return []
    midpoint = points[len(points) // 2]
    static_bodies = ["Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]
    dynamic_bodies = ["Sun", "Moon", "Mercury", "Venus", "Mars"]
    static_snapshots, static_records = _build_transit_records_subset(
        midpoint.astimezone(timezone.utc), natal_lons, natal_houses, static_bodies
    )
    rows = []
    for point in points:
        dyn_snap, dyn_rec = _build_transit_records_subset(
            point.astimezone(timezone.utc), natal_lons, natal_houses, dynamic_bodies
        )
        snapshots = {**static_snapshots, **dyn_snap}
        records = static_records + dyn_rec
        selected_topics = tuple(topic_names) if topic_names is not None else tuple(TOPIC_SPECS)
        topics = {topic: _score_topic(topic, records, snapshots, natal_houses) for topic in selected_topics}
        rows.append({"dt": point, **_derived_scores(topics), "topics": topics})
    return rows


def _rows_avg(rows: list[dict], key: str):
    vals = [r.get(key) for r in rows if isinstance(r.get(key), (int, float))]
    return int(round(sum(vals) / len(vals))) if vals else None


@lru_cache(maxsize=5000)
def _daily_aggregate_cached(day_iso: str, natal_packed: tuple, houses_packed: tuple, offset_hours: float):
    """Legacy Streamlit period aggregation, unchanged in sampling policy.

    Life topics: 08:00~22:00, 120-minute samples.
    KRX investment derivatives: 09:00~15:30, 60-minute samples, open sessions only.
    """
    day_value = date.fromisoformat(day_iso)
    natal_lons = _unpack_natal_lons(natal_packed)
    natal_houses = _unpack_houses(houses_packed)
    life_topic_names = ("금전", "학업", "시험", "직장", "이직", "대인관계", "연애", "연락", "재회", "소식", "컨디션")
    life = _scan_intraday(day_value, dt_time(8, 0), dt_time(22, 0), 120, natal_lons, natal_houses, offset_hours, topic_names=life_topic_names)
    market = _scan_intraday(day_value, dt_time(9, 0), dt_time(15, 30), 60, natal_lons, natal_houses, offset_hours, topic_names=("금전", "투자심리")) if _is_market_day(day_value) else []
    row = {
        "date": day_value.isoformat(),
        "label": f"{day_value.month}/{day_value.day}({WEEKDAY_KO[day_value.weekday()]})",
        "market_open": bool(market),
    }
    for key in ["금전", "학업", "시험", "직장", "이직", "대인관계", "연애", "연락", "재회", "소식", "컨디션", "수신신호", "발신적합", "과거인연접점"]:
        row[key] = _rows_avg(life, key)
    row["투자심리"] = _rows_avg(market, "투자심리") if market else None
    for key in ["수익실현", "신규진입", "투자주의"]:
        row[key] = _rows_avg(market, key) if market else None
    return row


def _aggregate_topic_result(rows: list[dict], topic: str) -> dict:
    results = [((row.get("topics") or {}).get(topic)) for row in rows]
    results = [x for x in results if isinstance(x, dict)]
    if not results:
        return {"topic": topic, "activation": 0, "favorability": 50, "layers": [], "evidence": []}
    activation = int(round(sum(float(r.get("activation", 0)) for r in results) / len(results)))
    favorability = int(round(sum(float(r.get("favorability", 50)) for r in results) / len(results)))
    layers = sorted({layer for r in results for layer in (r.get("layers") or [])})
    evidence = []
    for r in results:
        evidence.extend(r.get("evidence") or [])
    evidence.sort(key=lambda x: float(x.get("score", 0)) if isinstance(x, dict) else 0.0, reverse=True)
    return {"topic": topic, "activation": activation, "favorability": favorability, "layers": layers, "evidence": evidence[:8]}


def _window_with_step(rows: list[dict], key: str, size: int = 3):
    usable = [row for row in rows if isinstance(row.get(key), (int, float)) and row.get("dt") is not None]
    if not usable:
        return None, None
    size = max(1, min(size, len(usable)))
    step = (usable[1]["dt"] - usable[0]["dt"]) if len(usable) > 1 else timedelta(minutes=30)
    windows = []
    for i in range(len(usable) - size + 1):
        chunk = usable[i:i + size]
        avg = sum(float(r[key]) for r in chunk) / len(chunk)
        windows.append((avg, chunk[0]["dt"], chunk[-1]["dt"] + step))
    def pack(item):
        avg, start_dt, end_dt = item
        return {"start": start_dt.strftime("%H:%M"), "end": end_dt.strftime("%H:%M"), "score": round(avg, 1)}
    return pack(max(windows, key=lambda x: x[0])), pack(min(windows, key=lambda x: x[0]))


def _legacy_detail(day_value: date, timing_rows: list[dict], market_rows: list[dict]):
    details = {}
    for key in ["금전", "학업", "시험", "직장", "이직", "대인관계", "연애", "연락", "재회", "소식", "컨디션"]:
        best, worst = _window_with_step(timing_rows, key, 3)
        if not best:
            continue
        evidence = []
        scored = [r for r in timing_rows if isinstance(r.get(key), (int, float))]
        if scored:
            peak = max(scored, key=lambda r: float(r.get(key, 0)))
            raw = ((peak.get("topics") or {}).get(key) or {}).get("evidence") or []
            evidence = [_evidence_text(x) for x in raw[:6]]
        details[key] = {"best_window": best, "caution_window": worst, "evidence": evidence}
    if market_rows:
        for key in ["투자심리", "수익실현", "신규진입", "투자주의"]:
            best, worst = _window_with_step(market_rows, key, 3)
            if not best:
                continue
            evidence = []
            scored = [r for r in market_rows if isinstance(r.get(key), (int, float))]
            if scored:
                peak = max(scored, key=lambda r: float(r.get(key, 0)))
                bases = [key] if key in TOPIC_SPECS else ["금전", "투자심리"]
                for base_key in bases:
                    raw = ((peak.get("topics") or {}).get(base_key) or {}).get("evidence") or []
                    evidence.extend(_evidence_text(x) for x in raw[:3])
            details[key] = {"best_window": best, "caution_window": worst, "evidence": evidence[:6]}
    return {"date": day_value.isoformat(), "market_open": bool(market_rows), "topics": details}


@lru_cache(maxsize=64)
def _daily_detailed_cached(day_iso: str, natal_packed: tuple, houses_packed: tuple, offset_hours: float):
    """Exact legacy daily policy used by the Streamlit report.

    Scores: 07:00~23:30 every 30 minutes.
    Timing search: 00:00~23:30 every 30 minutes.
    KRX investment: 09:00~15:30 every 15 minutes.
    """
    day_value = date.fromisoformat(day_iso)
    natal_lons = _unpack_natal_lons(natal_packed)
    natal_houses = _unpack_houses(houses_packed)
    life = _scan_intraday(day_value, dt_time(7, 0), dt_time(23, 30), 30, natal_lons, natal_houses, offset_hours)
    early = _scan_intraday(day_value, dt_time(0, 0), dt_time(6, 30), 30, natal_lons, natal_houses, offset_hours)
    timing = early + life
    market = _scan_intraday(day_value, dt_time(9, 0), dt_time(15, 30), 15, natal_lons, natal_houses, offset_hours) if _is_market_day(day_value) else []
    row = {
        "date": day_value.isoformat(),
        "label": f"{day_value.month}/{day_value.day}({WEEKDAY_KO[day_value.weekday()]})",
        "market_open": bool(market),
    }
    for key in ["금전", "학업", "시험", "직장", "이직", "대인관계", "연애", "연락", "재회", "소식", "컨디션"]:
        row[key] = _rows_avg(life, key)
    aggregated = {topic: _aggregate_topic_result(life, topic) for topic in TOPIC_SPECS}
    row.update(_relationship_direction_scores(aggregated))
    row["투자심리"] = _rows_avg(market, "투자심리") if market else None
    for key in ["수익실현", "신규진입", "투자주의"]:
        row[key] = _rows_avg(market, key) if market else None
    return {"row": row, "detail": _legacy_detail(day_value, timing, market)}


def _score_band(score: float | None):
    if score is None:
        return "해당 없음"
    if score >= 82:
        return "매우 강함"
    if score >= 70:
        return "강함"
    if score >= 60:
        return "보통 이상"
    if score >= 50:
        return "보통"
    if score >= 40:
        return "다소 약함"
    if score >= 30:
        return "약함"
    return "매우 약함"


def _period_stats(rows: list[dict], key: str):
    points = [
        {"date": r["date"], "label": r["label"], "score": float(r[key])}
        for r in rows
        if isinstance(r.get(key), (int, float))
    ]
    if not points:
        return None
    average = sum(x["score"] for x in points) / len(points)
    return {
        "average": round(average, 1),
        "band": _score_band(average),
        "spread": round(max(x["score"] for x in points) - min(x["score"] for x in points), 1),
        "best_days": sorted(points, key=lambda x: x["score"], reverse=True)[:3],
        "caution_days": sorted(points, key=lambda x: x["score"])[:3],
    }


def _month_segments(start_date: date, end_date: date):
    cur = date(start_date.year, start_date.month, 1)
    out = []
    while cur <= end_date:
        last = date(cur.year, cur.month, calendar.monthrange(cur.year, cur.month)[1])
        seg_start = max(start_date, cur)
        seg_end = min(end_date, last)
        if seg_start <= seg_end:
            out.append((seg_start, seg_end))
        cur = date(cur.year + 1, 1, 1) if cur.month == 12 else date(cur.year, cur.month + 1, 1)
    return out


def _western_payload(
    birth_date: date,
    birth_time: dt_time,
    latitude: float,
    longitude: float,
    utc_offset_hours: float,
    start_date: date,
    end_date: date,
    progress_callback=None,
):
    birth_local = _aware_local(birth_date, birth_time, utc_offset_hours)
    birth_utc = birth_local.astimezone(timezone.utc)
    natal_houses = _compute_houses(birth_utc, latitude, longitude)
    natal_lons = {body: _planet_lon(body, birth_utc) for body in PLANET_KEYS}
    natal_packed = _pack_natal_lons(natal_lons)
    houses_packed = _pack_houses(natal_houses)

    day_count = (end_date - start_date).days + 1
    detail_days = []
    if day_count == 1:
        packed_day = _daily_detailed_cached(start_date.isoformat(), natal_packed, houses_packed, float(utc_offset_hours))
        rows = [dict(packed_day["row"])]
        detail_days = [packed_day["detail"]]
    else:
        rows = []
        for i in range(day_count):
            rows.append(dict(_daily_aggregate_cached((start_date + timedelta(days=i)).isoformat(), natal_packed, houses_packed, float(utc_offset_hours))))
            completed = i + 1
            if progress_callback and (completed == day_count or completed == 1 or completed % 5 == 0):
                progress_callback(completed, day_count, "western_daily")

    market_rows = [r for r in rows if _is_market_day(date.fromisoformat(r["date"]))]
    overall = {
        key: _period_stats(market_rows if key in INVESTMENT_KEYS else rows, key)
        for key in TOPIC_ORDER
    }
    relationship_signals = {
        key: _period_stats(rows, key) for key in ["수신신호", "발신적합", "과거인연접점"]
    }
    market_precision = _krx_calendar_precision(start_date, end_date)
    market_info = {
        "has_open_session": bool(market_rows),
        "session_count": len(market_rows),
        "session_dates": [r["date"] for r in market_rows],
        "calendar_mode": market_precision["mode"],
        "calendar_exact_range": market_precision["exact_range"],
        "calendar_warning": market_precision["warning"],
    }
    # Intraday evidence is returned for a single selected day. Multi-day reports
    # keep best/caution dates but avoid multiplying expensive intraday scans.

    months = []
    for seg_start, seg_end in _month_segments(start_date, end_date):
        seg_rows = [r for r in rows if seg_start.isoformat() <= r["date"] <= seg_end.isoformat()]
        seg_market_rows = [r for r in seg_rows if _is_market_day(date.fromisoformat(r["date"]))]
        months.append({
            "calendar_month": f"{seg_start.year}-{seg_start.month:02d}",
            "start": seg_start.isoformat(),
            "end": seg_end.isoformat(),
            "topics": {key: _period_stats(seg_market_rows if key in INVESTMENT_KEYS else seg_rows, key) for key in TOPIC_ORDER},
            "relationship_signals": {
                key: _period_stats(seg_rows, key) for key in ["수신신호", "발신적합", "과거인연접점"]
            },
        })

    _, _, _, _, _, ephemeris_used, fallback_reason = _ephemeris_bundle()
    return {
        "ok": True,
        "engine": WESTERN_ENGINE_VERSION,
        "ephemeris": ephemeris_used,
        "ephemeris_fallback_reason": fallback_reason,
        "score_policy": "점수는 사건 발생 확률이 아니라 같은 분야 안의 상대 흐름",
        "method": ("이전 Streamlit 일일엔진과 동일: 생활점수 07:00~23:30/30분, 시간탐색 00:00~23:30/30분, KRX 09:00~15:30/15분" if day_count == 1 else "이전 Streamlit 기간엔진과 동일: 생활 08:00~22:00/120분, KRX 09:00~15:30/60분"),
        "natal": {
            "asc": round(natal_houses["asc"], 6),
            "mc": round(natal_houses["mc"], 6),
        },
        "overall": overall,
        "relationship_signals": relationship_signals,
        "market": market_info,
        "detail_days": detail_days,
        "months": months,
    }


def _true_solar_datetime(birth_date: date, birth_time: dt_time, longitude: float, utc_offset_hours: float):
    legal = datetime.combine(birth_date, birth_time)
    longitude = float(longitude)
    standard_meridian = 15.0 * float(utc_offset_hours)
    utc = legal - timedelta(hours=float(utc_offset_hours))
    ut_hour = utc.hour + utc.minute / 60 + utc.second / 3600 + utc.microsecond / 3_600_000_000
    jd_ut = swe.julday(utc.year, utc.month, utc.day, ut_hour, swe.GREG_CAL)
    eot_days = float(swe.time_equ(jd_ut))
    longitude_minutes = 4.0 * (longitude - standard_meridian)
    eot_minutes = eot_days * 1440.0
    total_minutes = longitude_minutes + eot_minutes
    apparent = legal + timedelta(minutes=total_minutes)
    return apparent, {
        "legal_local_time": legal.strftime("%Y-%m-%d %H:%M:%S"),
        "longitude_east": round(longitude, 6),
        "standard_meridian_east": round(standard_meridian, 6),
        "longitude_correction_minutes": round(longitude_minutes, 4),
        "equation_of_time_minutes": round(eot_minutes, 4),
        "total_correction_minutes": round(total_minutes, 4),
        "true_solar_time": apparent.strftime("%Y-%m-%d %H:%M:%S"),
        "formula": "legal time + 4*(longitude-standard meridian) minutes + Swiss Ephemeris equation_of_time(LAT-LMT)",
    }


def _ten_god(day_stem: str, target_stem: str):
    if day_stem not in _STEM_INFO or target_stem not in _STEM_INFO:
        return ""
    de, dy = _STEM_INFO[day_stem]
    te, ty = _STEM_INFO[target_stem]
    same = dy == ty
    if de == te:
        return "比肩(비견)" if same else "劫財(겁재)"
    if _GENERATES[de] == te:
        return "食神(식신)" if same else "傷官(상관)"
    if _CONTROLS[de] == te:
        return "偏財(편재)" if same else "正財(정재)"
    if _CONTROLS[te] == de:
        return "七殺(칠살·편관)" if same else "正官(정관)"
    if _GENERATES[te] == de:
        return "偏印(편인)" if same else "正印(정인)"
    return ""


def _branch_links(target_branch: str, natal_branches: dict):
    links = []
    for label, branch in natal_branches.items():
        pair = frozenset((target_branch, branch))
        if len(pair) < 2:
            continue
        if pair in _LIUHE:
            links.append(f"{label} {branch}와 六合(육합)")
        if pair in _LIUCHONG:
            links.append(f"{label} {branch}와 六沖(육충)")
    return links


def _saju_payload(
    birth_date: date,
    birth_time: dt_time,
    longitude: float,
    utc_offset_hours: float,
    gender: str,
    start_date: date,
    end_date: date,
):
    try:
        true_solar, true_solar_meta = _true_solar_datetime(
            birth_date, birth_time, longitude, utc_offset_hours
        )
        solar = Solar.fromYmdHms(
            true_solar.year, true_solar.month, true_solar.day,
            true_solar.hour, true_solar.minute, true_solar.second,
        )
        eight = solar.getLunar().getEightChar()
        try:
            eight.setSect(2)
        except Exception:
            pass

        pillars = {
            "year": eight.getYear(),
            "month": eight.getMonth(),
            "day": eight.getDay(),
            "hour": eight.getTime(),
        }
        day_master = eight.getDayGan() if hasattr(eight, "getDayGan") else pillars["day"][:1]
        branches = {
            "년지": pillars["year"][1:2],
            "월지": pillars["month"][1:2],
            "일지": pillars["day"][1:2],
            "시지": pillars["hour"][1:2],
        }
        elements = []
        for getter in ["getYearWuXing", "getMonthWuXing", "getDayWuXing", "getTimeWuXing"]:
            try:
                elements.extend(list(getattr(eight, getter)()))
            except Exception:
                pass
        element_count = {e: elements.count(e) for e in ["木", "火", "土", "金", "水"]}

        natal_ten_gods = {}
        for label, getter in [
            ("년간", "getYearShiShenGan"),
            ("월간", "getMonthShiShenGan"),
            ("시간", "getTimeShiShenGan"),
        ]:
            try:
                natal_ten_gods[label] = getattr(eight, getter)()
            except Exception:
                pass

        gender_code = 1 if gender in {"male", "남성", "남"} else 0
        yun = eight.getYun(gender_code, 1)
        dayuns = []
        for dy in yun.getDaYun(12):
            try:
                sy = int(dy.getStartYear())
                ey = int(dy.getEndYear())
                if ey < start_date.year or sy > end_date.year:
                    continue
                dayuns.append({
                    "start_year": sy,
                    "end_year": ey,
                    "start_age": int(dy.getStartAge()),
                    "end_age": int(dy.getEndAge()),
                    "ganzhi": dy.getGanZhi(),
                })
            except Exception:
                continue

        years = []
        for y in range(start_date.year, end_date.year + 1):
            rep = Solar.fromYmdHms(y, 7, 1, 12, 0, 0).getLunar()
            gz = rep.getYearInGanZhiExact()
            years.append({
                "year": y,
                "ganzhi": gz,
                "stem_ten_god": _ten_god(day_master, gz[:1]),
                "branch_links": _branch_links(gz[1:2], branches),
            })

        months = []
        for seg_start, seg_end in _month_segments(start_date, end_date):
            rep_date = seg_start + (seg_end - seg_start) // 2
            rep = Solar.fromYmdHms(rep_date.year, rep_date.month, rep_date.day, 12, 0, 0).getLunar()
            gz = rep.getMonthInGanZhiExact()
            months.append({
                "calendar_month": f"{seg_start.year}-{seg_start.month:02d}",
                "segment_start": seg_start.isoformat(),
                "segment_end": seg_end.isoformat(),
                "representative_date": rep_date.isoformat(),
                "ganzhi": gz,
                "stem_ten_god": _ten_god(day_master, gz[:1]),
                "branch_links": _branch_links(gz[1:2], branches),
                "boundary_note": "월 중 대표일의 절기월 간지. 절입 경계 정확시각은 별도 노출하지 않음.",
            })

        try:
            start_solar = yun.getStartSolar().toYmdHms()
        except Exception:
            start_solar = ""

        return {
            "ok": True,
            "engine": SAJU_ENGINE_VERSION,
            "calendar_input": "legal local time corrected to local apparent solar time",
            "true_solar": true_solar_meta,
            "pillars": pillars,
            "day_master": day_master,
            "elements": element_count,
            "natal_ten_gods": natal_ten_gods,
            "yun_policy": "gender 1=male/0=female, sect=1 (3 days=1 year convention)",
            "yun_start_solar": start_solar,
            "dayun": dayuns,
            "annual": years,
            "monthly": months,
            "not_calculated": ["신강·신약", "용신·희신·기신", "형·파·해 전체 자동판정"],
        }
    except Exception as exc:
        return {"ok": False, "engine": SAJU_ENGINE_VERSION, "error": f"{type(exc).__name__}: {exc}"}


def _thai_payload(birth_date: date, birth_time: dt_time):
    dt = datetime.combine(birth_date, birth_time)
    shifted = dt - timedelta(hours=6)
    thai_date = shifted.date()
    weekday = thai_date.weekday()
    start = datetime.combine(thai_date, dt_time(6, 0))
    if weekday == 2 and dt >= start + timedelta(hours=12):
        label, ruler, note = "수요일 밤", "Rahu(라후)", "수요일 18:00~다음날 05:59 라후 출생층"
    else:
        label, ruler, note = _THAI_DAY[weekday]
    return {
        "ok": True,
        "engine": THAI_ENGINE_VERSION,
        "thai_day": label,
        "ruler": ruler,
        "rule": note,
        "day_boundary": "06:00 local; Wednesday night split at 18:00",
        "predictive_status": "natal_baseline_only",
        "consensus_policy": "Suriyayat/Thai transit 미구현이므로 기간·날짜 합의 점수에는 사용하지 않음",
    }


def build_integrated_fortune(
    *,
    birth_date: date,
    birth_time: dt_time,
    latitude: float,
    longitude: float,
    utc_offset_hours: float,
    gender: str,
    start_date: date,
    end_date: date,
    progress_callback=None,
) -> dict[str, Any]:
    if end_date < start_date:
        raise ValueError("end_date must be on or after start_date")
    day_count = (end_date - start_date).days + 1
    if day_count > 366:
        raise ValueError("integrated fortune range is limited to 366 days per request")

    western = _western_payload(
        birth_date, birth_time, latitude, longitude, utc_offset_hours, start_date, end_date, progress_callback
    )
    saju = _saju_payload(
        birth_date, birth_time, longitude, utc_offset_hours, gender, start_date, end_date
    )
    thai = _thai_payload(birth_date, birth_time)

    return {
        "ok": True,
        "engine": ENGINE_VERSION,
        "period": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat(),
            "day_count": day_count,
            "month_segments": len(_month_segments(start_date, end_date)),
        },
        "western": western,
        "saju": saju,
        "thai": thai,
        "consensus_policy": {
            "western": "기간별 생활 주제 상대지수. 사건 확률이 아님.",
            "saju": "진태양시 보정 원국·대운·세운·월운의 계산 사실을 제공. 용희기신 등 미계산 항목은 추정하지 않음.",
            "thai": "출생요일 baseline만 제공. Suriyayat transit 미구현이므로 기간 예측 합의에 포함하지 않음.",
        },
    }
