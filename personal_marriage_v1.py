# -*- coding: utf-8 -*-
"""Single-person marriage/commitment astrology facts.

This engine is intentionally separate from two-person synastry. It never invents a
counterpart and never returns marriage/event probabilities. It describes the
native partnership/home/intimacy structure and selected-period activation of
those natal factors.
"""

from __future__ import annotations

from datetime import date, datetime, time as dt_time, timedelta, timezone

import swisseph as swe

ENGINE_VERSION = "personal-marriage-western-v1.0"

BODIES = {
    "Sun": swe.SUN,
    "Moon": swe.MOON,
    "Mercury": swe.MERCURY,
    "Venus": swe.VENUS,
    "Mars": swe.MARS,
    "Jupiter": swe.JUPITER,
    "Saturn": swe.SATURN,
    "Uranus": swe.URANUS,
    "Neptune": swe.NEPTUNE,
    "Pluto": swe.PLUTO,
    "True Node": swe.TRUE_NODE,
}
SIGNS_KO = ["양자리", "황소자리", "쌍둥이자리", "게자리", "사자자리", "처녀자리", "천칭자리", "전갈자리", "사수자리", "염소자리", "물병자리", "물고기자리"]
RULER_BY_SIGN = {
    0: "Mars", 1: "Venus", 2: "Mercury", 3: "Moon", 4: "Sun", 5: "Mercury",
    6: "Venus", 7: "Mars", 8: "Jupiter", 9: "Saturn", 10: "Saturn", 11: "Jupiter",
}
ASPECTS = {
    "conjunction": 0.0, "sextile": 60.0, "square": 90.0,
    "trine": 120.0, "quincunx": 150.0, "opposition": 180.0,
}
SUPPORTIVE = {"sextile", "trine"}
CHALLENGING = {"square", "opposition", "quincunx"}
TRANSIT_WEIGHTS = {
    "Sun": .40, "Mercury": .45, "Venus": .95, "Mars": .60, "Jupiter": 1.00,
    "Saturn": 1.00, "Uranus": .75, "Neptune": .55, "Pluto": .80,
}
TARGET_WEIGHTS = {
    "DSC": 1.00, "IC": .72, "Venus": .92, "Moon": .82, "Saturn": .75,
    "Jupiter": .66, "7th_ruler": .95, "4th_ruler": .55, "8th_ruler": .62,
}
ASPECT_WEIGHTS = {
    "conjunction": 1.00, "opposition": .95, "square": .92,
    "trine": .82, "sextile": .76, "quincunx": .68,
}


def _norm(value: float) -> float:
    return float(value) % 360.0


def _angle_distance(a: float, b: float) -> float:
    d = abs(_norm(a) - _norm(b)) % 360.0
    return min(d, 360.0 - d)


def _utc_datetime(birth_date: date, birth_time: dt_time, utc_offset_hours: float) -> datetime:
    local = datetime.combine(birth_date, birth_time)
    return (local - timedelta(hours=float(utc_offset_hours))).replace(tzinfo=timezone.utc)


def _jd(dt: datetime) -> float:
    dt = dt.astimezone(timezone.utc)
    hour = dt.hour + dt.minute / 60.0 + dt.second / 3600.0
    return swe.julday(dt.year, dt.month, dt.day, hour, swe.GREG_CAL)


def _positions(jd_ut: float, include_moon: bool = True) -> dict:
    out = {}
    flags = swe.FLG_SWIEPH | swe.FLG_SPEED
    for name, pid in BODIES.items():
        if name == "Moon" and not include_moon:
            continue
        xx, _ = swe.calc_ut(jd_ut, pid, flags)
        lon = _norm(xx[0])
        out[name] = {
            "longitude": round(lon, 6),
            "sign_index": int(lon // 30.0),
            "sign": SIGNS_KO[int(lon // 30.0)],
            "degree": round(lon % 30.0, 3),
        }
    return out


def _house_data(jd_ut: float, latitude: float, longitude: float) -> dict:
    cusps_raw, ascmc = swe.houses(jd_ut, float(latitude), float(longitude), b"P")
    cusps = [_norm(x) for x in cusps_raw]
    asc = _norm(ascmc[0])
    mc = _norm(ascmc[1])
    asc_sign = int(asc // 30.0)
    return {
        "asc": asc, "mc": mc, "dsc": _norm(asc + 180.0), "ic": _norm(mc + 180.0),
        "placidus_cusps": cusps,
        "whole_asc_sign": asc_sign,
    }


def _placidus_house(lon: float, cusps: list[float]) -> int:
    value = _norm(lon)
    for idx in range(12):
        start = _norm(cusps[idx])
        end = _norm(cusps[(idx + 1) % 12])
        span = (end - start) % 360.0
        offset = (value - start) % 360.0
        if offset < span or (idx == 11 and abs(offset - span) < 1e-9):
            return idx + 1
    return 1


def _whole_house(lon: float, asc_sign: int) -> int:
    return ((int(_norm(lon) // 30.0) - int(asc_sign)) % 12) + 1


def _house_profile(house_number: int, house: dict, positions: dict) -> dict:
    whole_sign_index = (house["whole_asc_sign"] + house_number - 1) % 12
    whole_ruler = RULER_BY_SIGN[whole_sign_index]
    placidus_lon = house["placidus_cusps"][house_number - 1]
    placidus_sign_index = int(placidus_lon // 30.0)
    placidus_ruler = RULER_BY_SIGN[placidus_sign_index]

    def placement(ruler: str) -> dict:
        p = positions[ruler]
        return {
            "planet": ruler,
            "sign": p["sign"],
            "degree": p["degree"],
            "whole_house": _whole_house(p["longitude"], house["whole_asc_sign"]),
            "placidus_house": _placidus_house(p["longitude"], house["placidus_cusps"]),
        }

    return {
        "house": house_number,
        "whole_sign": SIGNS_KO[whole_sign_index],
        "whole_ruler": whole_ruler,
        "whole_ruler_placement": placement(whole_ruler),
        "placidus_sign": SIGNS_KO[placidus_sign_index],
        "placidus_ruler": placidus_ruler,
        "placidus_ruler_placement": placement(placidus_ruler),
    }


def _natal_aspects(positions: dict, house: dict, profiles: dict) -> list[dict]:
    points = {name: positions[name]["longitude"] for name in ["Moon", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]}
    points["DSC"] = house["dsc"]
    points["IC"] = house["ic"]
    for label, profile_key in [("7th_ruler", "7"), ("4th_ruler", "4"), ("8th_ruler", "8")]:
        ruler = profiles[profile_key]["whole_ruler"]
        points[label] = positions[ruler]["longitude"]
    rows = []
    names = list(points)
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            if a.endswith("ruler") and b.endswith("ruler") and points[a] == points[b]:
                continue
            dist = _angle_distance(points[a], points[b])
            for aspect, exact in ASPECTS.items():
                orb = abs(dist - exact)
                limit = 3.0 if (a in {"DSC", "IC"} or b in {"DSC", "IC"}) else 4.5
                if orb <= limit:
                    tone = "supportive" if aspect in SUPPORTIVE else ("challenging" if aspect in CHALLENGING else "mixed")
                    rows.append({"a": a, "aspect": aspect, "b": b, "orb": round(orb, 3), "tone": tone})
                    break
    rows.sort(key=lambda x: (x["orb"], 0 if x["tone"] != "mixed" else 1))
    return rows[:16]


def _transit_orb(planet: str) -> float:
    return 1.4 if planet in {"Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"} else 1.0


def _timing_targets(positions: dict, house: dict, profiles: dict) -> dict:
    targets = {
        "DSC": house["dsc"], "IC": house["ic"], "Venus": positions["Venus"]["longitude"],
        "Moon": positions["Moon"]["longitude"], "Saturn": positions["Saturn"]["longitude"],
        "Jupiter": positions["Jupiter"]["longitude"],
    }
    for label, key in [("7th_ruler", "7"), ("4th_ruler", "4"), ("8th_ruler", "8")]:
        targets[label] = positions[profiles[key]["whole_ruler"]]["longitude"]
    return targets


def _daily_timing(start_date: date, end_date: date, utc_offset_hours: float, targets: dict) -> list[dict]:
    rows = []
    cursor = start_date
    local_tz = timezone(timedelta(hours=float(utc_offset_hours)))
    while cursor <= end_date:
        local = datetime.combine(cursor, dt_time(12, 0), tzinfo=local_tz)
        transits = _positions(_jd(local.astimezone(timezone.utc)), include_moon=False)
        hits = []
        for planet, p in transits.items():
            if planet not in TRANSIT_WEIGHTS:
                continue
            limit = _transit_orb(planet)
            for target, target_lon in targets.items():
                dist = _angle_distance(p["longitude"], target_lon)
                for aspect, exact in ASPECTS.items():
                    orb = abs(dist - exact)
                    if orb > limit:
                        continue
                    factor = max(0.0, 1.0 - orb / limit)
                    raw = 100.0 * TRANSIT_WEIGHTS[planet] * TARGET_WEIGHTS.get(target, .5) * ASPECT_WEIGHTS[aspect] * factor
                    tone = "supportive" if aspect in SUPPORTIVE else ("challenging" if aspect in CHALLENGING else "mixed")
                    hits.append({
                        "transit": planet, "aspect": aspect, "target": target,
                        "orb": round(orb, 3), "tone": tone, "strength": round(raw, 1),
                    })
                    break
        hits.sort(key=lambda x: (-x["strength"], x["orb"]))
        top = hits[:6]
        activation = min(100.0, sum(x["strength"] for x in top) / 2.55) if top else 0.0
        supportive = min(100.0, sum(x["strength"] for x in top if x["tone"] == "supportive") / 1.9) if top else 0.0
        pressure = min(100.0, sum(x["strength"] for x in top if x["tone"] == "challenging") / 1.9) if top else 0.0
        rows.append({
            "date": cursor.isoformat(), "activation": round(activation, 1),
            "supportive_load": round(supportive, 1), "pressure_load": round(pressure, 1),
            "hits": top,
        })
        cursor += timedelta(days=1)
    return rows


def _spaced(rows: list[dict], key: str, limit: int) -> list[dict]:
    ordered = sorted(rows, key=lambda x: (-float(x[key]), x["date"]))
    selected = []
    for row in ordered:
        current = date.fromisoformat(row["date"])
        if any(abs((current - date.fromisoformat(x["date"])).days) <= 2 for x in selected):
            continue
        selected.append(row)
        if len(selected) >= limit:
            break
    return selected


def _months(rows: list[dict]) -> list[dict]:
    grouped: dict[str, list[dict]] = {}
    for row in rows:
        grouped.setdefault(row["date"][:7], []).append(row)
    out = []
    for month, month_rows in grouped.items():
        strongest = sorted(month_rows, key=lambda x: x["activation"], reverse=True)[:5]
        out.append({
            "calendar_month": month,
            "activation": round(sum(x["activation"] for x in strongest) / max(1, len(strongest)), 1),
            "top_dates": [x["date"] for x in strongest[:3]],
        })
    return sorted(out, key=lambda x: (-x["activation"], x["calendar_month"]))


def build_personal_marriage(*, birth_date: date, birth_time: dt_time, latitude: float, longitude: float,
                            utc_offset_hours: float, start_date: date, end_date: date) -> dict:
    if end_date < start_date:
        raise ValueError("end_date must be on or after start_date")
    if (end_date - start_date).days > 365:
        raise ValueError("personal marriage range is limited to 366 days per request")
    natal_jd = _jd(_utc_datetime(birth_date, birth_time, utc_offset_hours))
    positions = _positions(natal_jd)
    house = _house_data(natal_jd, latitude, longitude)
    profiles = {str(h): _house_profile(h, house, positions) for h in (4, 5, 7, 8)}
    timing_rows = _daily_timing(start_date, end_date, utc_offset_hours, _timing_targets(positions, house, profiles))
    activation_values = [row["activation"] for row in timing_rows]
    return {
        "ok": True,
        "engine": ENGINE_VERSION,
        "mode": "personal_unmarried",
        "policy": {
            "counterpart_required": False,
            "marriage_probability": False,
            "spouse_identity_prediction": False,
            "meaning": "개인 출생차트의 4·5·7·8하우스와 관계 행성, 선택 기간 트랜짓의 상대적 활성도를 계산한다.",
        },
        "period": {"start": start_date.isoformat(), "end": end_date.isoformat(), "day_count": len(timing_rows)},
        "angles": {
            "asc": round(house["asc"], 6), "dsc": round(house["dsc"], 6),
            "mc": round(house["mc"], 6), "ic": round(house["ic"], 6),
        },
        "relationship_houses": profiles,
        "relationship_planets": {
            name: {
                **positions[name],
                "whole_house": _whole_house(positions[name]["longitude"], house["whole_asc_sign"]),
                "placidus_house": _placidus_house(positions[name]["longitude"], house["placidus_cusps"]),
            }
            for name in ("Moon", "Venus", "Mars", "Jupiter", "Saturn")
        },
        "natal_aspects": _natal_aspects(positions, house, profiles),
        "timing": {
            "average_activation": round(sum(activation_values) / max(1, len(activation_values)), 1),
            "spread": round(max(activation_values, default=0.0) - min(activation_values, default=0.0), 1),
            "top_days": _spaced(timing_rows, "activation", 8),
            "pressure_days": _spaced(timing_rows, "pressure_load", 6),
            "top_months": _months(timing_rows)[:12],
        },
        "limits": [
            "상대가 없는 개인 결혼운이므로 특정 인물과의 궁합·상대 속마음·결혼 성사 여부를 계산하지 않는다.",
            "강한 날짜는 결혼 사건 확률이 아니라 동반자·가정·친밀감·책임 주제의 상대적 활성 구간이다.",
            "실제 배우자의 외모·직업·신원처럼 계산으로 확정할 수 없는 속성은 만들지 않는다.",
        ],
    }
