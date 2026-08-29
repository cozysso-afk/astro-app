# -*- coding: utf-8 -*-
"""Deterministic astrocartography-style city/country activation ranking.

This module does not claim that a city guarantees success, love, money, or safety.
It calculates how closely selected natal planets fall to the four angular axes
(ASC/DC/MC/IC) at a set of real-world cities at the user's birth instant, then
scores those activations by purpose.  It is designed for the '지역·국가운'
feature in 별빛의 운명.
"""

from __future__ import annotations

import math
from datetime import date, datetime, time as dt_time, timedelta, timezone
from typing import Any

import swisseph as swe

ENGINE_VERSION = "astrocartography-world-lines-v2.0"

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
}

# Curated representative cities.  The ranking is among this catalog, not every
# settlement on Earth.  Keeping the catalog explicit makes the output auditable.
CITIES = [
    ("서울", "대한민국", 37.5665, 126.9780), ("부산", "대한민국", 35.1796, 129.0756),
    ("도쿄", "일본", 35.6762, 139.6503), ("오사카", "일본", 34.6937, 135.5023),
    ("타이베이", "대만", 25.0330, 121.5654), ("홍콩", "홍콩", 22.3193, 114.1694),
    ("싱가포르", "싱가포르", 1.3521, 103.8198), ("방콕", "태국", 13.7563, 100.5018),
    ("하노이", "베트남", 21.0278, 105.8342), ("호치민", "베트남", 10.8231, 106.6297),
    ("쿠알라룸푸르", "말레이시아", 3.1390, 101.6869), ("자카르타", "인도네시아", -6.2088, 106.8456),
    ("마닐라", "필리핀", 14.5995, 120.9842), ("뉴델리", "인도", 28.6139, 77.2090),
    ("뭄바이", "인도", 19.0760, 72.8777), ("두바이", "아랍에미리트", 25.2048, 55.2708),
    ("이스탄불", "튀르키예", 41.0082, 28.9784), ("아테네", "그리스", 37.9838, 23.7275),
    ("로마", "이탈리아", 41.9028, 12.4964), ("밀라노", "이탈리아", 45.4642, 9.1900),
    ("파리", "프랑스", 48.8566, 2.3522), ("니스", "프랑스", 43.7102, 7.2620),
    ("마드리드", "스페인", 40.4168, -3.7038), ("바르셀로나", "스페인", 41.3874, 2.1686),
    ("리스본", "포르투갈", 38.7223, -9.1393), ("런던", "영국", 51.5072, -0.1276),
    ("암스테르담", "네덜란드", 52.3676, 4.9041), ("베를린", "독일", 52.5200, 13.4050),
    ("뮌헨", "독일", 48.1351, 11.5820), ("취리히", "스위스", 47.3769, 8.5417),
    ("빈", "오스트리아", 48.2082, 16.3738), ("프라하", "체코", 50.0755, 14.4378),
    ("코펜하겐", "덴마크", 55.6761, 12.5683), ("스톡홀름", "스웨덴", 59.3293, 18.0686),
    ("헬싱키", "핀란드", 60.1699, 24.9384), ("더블린", "아일랜드", 53.3498, -6.2603),
    ("뉴욕", "미국", 40.7128, -74.0060), ("보스턴", "미국", 42.3601, -71.0589),
    ("워싱턴DC", "미국", 38.9072, -77.0369), ("시카고", "미국", 41.8781, -87.6298),
    ("로스앤젤레스", "미국", 34.0522, -118.2437), ("샌프란시스코", "미국", 37.7749, -122.4194),
    ("시애틀", "미국", 47.6062, -122.3321), ("호놀룰루", "미국", 21.3099, -157.8581),
    ("밴쿠버", "캐나다", 49.2827, -123.1207), ("토론토", "캐나다", 43.6532, -79.3832),
    ("몬트리올", "캐나다", 45.5019, -73.5674), ("멕시코시티", "멕시코", 19.4326, -99.1332),
    ("리우데자네이루", "브라질", -22.9068, -43.1729), ("상파울루", "브라질", -23.5505, -46.6333),
    ("부에노스아이레스", "아르헨티나", -34.6037, -58.3816), ("산티아고", "칠레", -33.4489, -70.6693),
    ("시드니", "호주", -33.8688, 151.2093), ("멜버른", "호주", -37.8136, 144.9631),
    ("브리즈번", "호주", -27.4698, 153.0251), ("오클랜드", "뉴질랜드", -36.8509, 174.7645),
    ("케이프타운", "남아프리카공화국", -33.9249, 18.4241), ("카이로", "이집트", 30.0444, 31.2357),
]

PURPOSES: dict[str, dict[str, dict[str, float]]] = {
    "overall": {
        "Sun": {"ASC": 1.00, "MC": .95, "DC": .45, "IC": .35},
        "Venus": {"ASC": .95, "DC": .95, "MC": .65, "IC": .55},
        "Jupiter": {"ASC": .90, "MC": .95, "DC": .80, "IC": .50},
        "Mercury": {"ASC": .55, "MC": .65, "DC": .45, "IC": .25},
        "Moon": {"ASC": .55, "DC": .45, "MC": .25, "IC": .70},
        "Saturn": {"ASC": -.20, "MC": .20, "DC": -.25, "IC": -.35},
        "Mars": {"ASC": -.20, "MC": .10, "DC": -.25, "IC": -.20},
        "Uranus": {"ASC": -.15, "MC": .05, "DC": -.20, "IC": -.20},
        "Neptune": {"ASC": -.10, "MC": -.15, "DC": -.10, "IC": .10},
        "Pluto": {"ASC": -.20, "MC": .05, "DC": -.25, "IC": -.20},
    },
    "love": {
        "Venus": {"ASC": 1.00, "DC": 1.00, "MC": .40, "IC": .55},
        "Moon": {"ASC": .65, "DC": .75, "MC": .15, "IC": .80},
        "Jupiter": {"ASC": .60, "DC": .85, "MC": .30, "IC": .45},
        "Sun": {"ASC": .50, "DC": .55, "MC": .25, "IC": .25},
        "Mars": {"ASC": .20, "DC": .30, "MC": .05, "IC": -.10},
        "Saturn": {"ASC": -.20, "DC": -.35, "MC": .05, "IC": -.30},
        "Uranus": {"ASC": -.10, "DC": -.20, "MC": .05, "IC": -.15},
        "Neptune": {"ASC": .05, "DC": .15, "MC": -.10, "IC": .15},
        "Pluto": {"ASC": -.10, "DC": -.15, "MC": .00, "IC": -.15},
    },
    "career": {
        "Sun": {"ASC": .55, "DC": .20, "MC": 1.00, "IC": .15},
        "Jupiter": {"ASC": .50, "DC": .30, "MC": 1.00, "IC": .20},
        "Mercury": {"ASC": .45, "DC": .30, "MC": .85, "IC": .15},
        "Saturn": {"ASC": -.05, "DC": -.10, "MC": .60, "IC": -.20},
        "Mars": {"ASC": .10, "DC": -.10, "MC": .45, "IC": -.20},
        "Venus": {"ASC": .30, "DC": .30, "MC": .55, "IC": .20},
        "Uranus": {"ASC": .05, "DC": -.10, "MC": .20, "IC": -.15},
        "Neptune": {"ASC": -.10, "DC": -.10, "MC": -.20, "IC": .00},
        "Pluto": {"ASC": -.10, "DC": -.15, "MC": .25, "IC": -.20},
    },
    "study": {
        "Mercury": {"ASC": .85, "DC": .35, "MC": 1.00, "IC": .35},
        "Jupiter": {"ASC": .75, "DC": .35, "MC": .90, "IC": .30},
        "Saturn": {"ASC": .20, "DC": -.05, "MC": .55, "IC": .15},
        "Sun": {"ASC": .45, "DC": .20, "MC": .55, "IC": .20},
        "Moon": {"ASC": .25, "DC": .15, "MC": .10, "IC": .40},
        "Neptune": {"ASC": -.05, "DC": -.05, "MC": -.10, "IC": .10},
        "Uranus": {"ASC": .10, "DC": .00, "MC": .10, "IC": .00},
    },
    "rest_creative": {
        "Venus": {"ASC": .70, "DC": .55, "MC": .35, "IC": .85},
        "Moon": {"ASC": .55, "DC": .45, "MC": .15, "IC": 1.00},
        "Neptune": {"ASC": .30, "DC": .25, "MC": .10, "IC": .65},
        "Sun": {"ASC": .55, "DC": .25, "MC": .35, "IC": .45},
        "Jupiter": {"ASC": .55, "DC": .35, "MC": .35, "IC": .55},
        "Saturn": {"ASC": -.15, "DC": -.20, "MC": .00, "IC": -.35},
        "Mars": {"ASC": -.20, "DC": -.15, "MC": .05, "IC": -.25},
        "Pluto": {"ASC": -.15, "DC": -.15, "MC": .05, "IC": -.25},
    },
}

PURPOSE_LABELS = {
    "overall": "종합·장기거주",
    "love": "연애·관계",
    "career": "커리어·성취",
    "study": "공부·연구",
    "rest_creative": "휴식·창작",
}


def _norm180(value: float) -> float:
    return ((float(value) + 180.0) % 360.0) - 180.0


def _birth_jd(birth_date: date, birth_time: dt_time, utc_offset_hours: float) -> float:
    local = datetime.combine(birth_date, birth_time).replace(
        tzinfo=timezone(timedelta(hours=float(utc_offset_hours)))
    )
    utc = local.astimezone(timezone.utc)
    hour = utc.hour + utc.minute / 60.0 + utc.second / 3600.0
    return swe.julday(utc.year, utc.month, utc.day, hour, swe.GREG_CAL)


def _planet_equatorial(jd: float) -> dict[str, tuple[float, float]]:
    out: dict[str, tuple[float, float]] = {}
    flags = swe.FLG_SWIEPH | swe.FLG_EQUATORIAL
    for name, pid in BODIES.items():
        xx, _ = swe.calc_ut(float(jd), pid, flags)
        out[name] = (float(xx[0]), float(xx[1]))  # right ascension deg, declination deg
    return out


def _angular_proximity(jd: float, ra_deg: float, dec_deg: float, lat: float, lon: float) -> dict[str, float]:
    gst_deg = float(swe.sidtime(float(jd))) * 15.0
    lst_deg = (gst_deg + float(lon)) % 360.0
    hour_angle = _norm180(lst_deg - float(ra_deg))

    phi = math.radians(float(lat))
    dec = math.radians(float(dec_deg))
    h = math.radians(hour_angle)
    sin_alt = math.sin(phi) * math.sin(dec) + math.cos(phi) * math.cos(dec) * math.cos(h)
    altitude = math.degrees(math.asin(max(-1.0, min(1.0, sin_alt))))

    mc_sep = abs(hour_angle)
    ic_sep = abs(abs(hour_angle) - 180.0)
    horizon_sep = abs(altitude)
    rising = hour_angle < 0.0
    # A body cannot be exactly on both ASC and DC at once; the non-active horizon
    # side gets a large separation so it cannot win the closest-angle selection.
    return {
        "MC": mc_sep,
        "IC": ic_sep,
        "ASC": horizon_sep if rising else 180.0,
        "DC": horizon_sep if not rising else 180.0,
    }


def _closeness(separation_deg: float) -> float:
    # Strongest inside roughly 5°, still visible to about 15°.  This is an
    # activation curve, not a distance in kilometers and not a probability.
    sep = max(0.0, float(separation_deg))
    return math.exp(-((sep / 7.0) ** 2))


def _city_score(jd: float, positions: dict[str, tuple[float, float]], city: tuple[str, str, float, float], purpose: str) -> dict[str, Any]:
    city_name, country, lat, lon = city
    weights = PURPOSES[purpose]
    contributions: list[dict[str, Any]] = []
    total = 0.0
    positive_cap = 0.0

    for planet, angle_weights in weights.items():
        if planet not in positions:
            continue
        ra, dec = positions[planet]
        proximity = _angular_proximity(jd, ra, dec, lat, lon)
        for angle, weight in angle_weights.items():
            positive_cap += max(0.0, weight)
            close = _closeness(proximity[angle])
            contribution = float(weight) * close
            total += contribution
            if close >= 0.12 and abs(weight) >= 0.1:
                contributions.append({
                    "planet": planet,
                    "angle": angle,
                    "separation_deg": round(float(proximity[angle]), 2),
                    "weight": round(float(weight), 2),
                    "contribution": round(contribution, 4),
                    "tone": "supportive" if weight > 0 else "caution",
                })

    # Normalize to a readable 0-100 activation/suitability index.  A neutral city
    # sits near the middle; negative angular pressure can push it lower.
    denom = max(1.0, positive_cap * 0.24)
    normalized = 50.0 + 42.0 * math.tanh(total / denom)
    contributions.sort(key=lambda x: abs(x["contribution"]), reverse=True)
    return {
        "city": city_name,
        "country": country,
        "latitude": lat,
        "longitude": lon,
        "score": round(max(0.0, min(100.0, normalized)), 1),
        "evidence": contributions[:5],
    }


def _split_world_line(points: list[dict[str, float]]) -> list[list[dict[str, float]]]:
    """Split a sampled line at antimeridian jumps so clients do not draw across the globe."""
    if not points:
        return []
    segments: list[list[dict[str, float]]] = []
    current: list[dict[str, float]] = [points[0]]
    for point in points[1:]:
        if abs(float(point["longitude"]) - float(current[-1]["longitude"])) > 180.0:
            if len(current) >= 2:
                segments.append(current)
            current = [point]
        else:
            current.append(point)
    if len(current) >= 2:
        segments.append(current)
    return segments


def _horizon_segments(*, ra_deg: float, dec_deg: float, gst_deg: float, rising: bool) -> list[list[dict[str, float]]]:
    """Sample the exact altitude=0 rising/setting curve from -85° to +85° latitude."""
    segments: list[list[dict[str, float]]] = []
    current: list[dict[str, float]] = []
    dec = math.radians(float(dec_deg))
    for lat in range(-85, 86, 2):
        phi = math.radians(float(lat))
        value = -math.tan(phi) * math.tan(dec)
        if not -1.0 <= value <= 1.0:
            if len(current) >= 2:
                segments.extend(_split_world_line(current))
            current = []
            continue
        h_abs = math.degrees(math.acos(max(-1.0, min(1.0, value))))
        hour_angle = -h_abs if rising else h_abs
        lon = _norm180(float(ra_deg) + hour_angle - float(gst_deg))
        current.append({"latitude": float(lat), "longitude": round(lon, 4)})
    if len(current) >= 2:
        segments.extend(_split_world_line(current))
    return segments


def _astrocartography_lines(jd: float, positions: dict[str, tuple[float, float]]) -> list[dict[str, Any]]:
    """Return standard natal astrocartography angular lines for a world map.

    MC/IC are meridians where the planet culminates/anti-culminates. ASC/DC are
    the sampled terrestrial loci where the planet is exactly on the horizon.
    """
    gst_deg = float(swe.sidtime(float(jd))) * 15.0
    lines: list[dict[str, Any]] = []
    vertical_lats = [-85.0, 85.0]
    for planet, (ra_deg, dec_deg) in positions.items():
        mc_lon = round(_norm180(float(ra_deg) - gst_deg), 4)
        ic_lon = round(_norm180(mc_lon + 180.0), 4)
        lines.append({
            "planet": planet,
            "angle": "MC",
            "segments": [[
                {"latitude": vertical_lats[0], "longitude": mc_lon},
                {"latitude": vertical_lats[1], "longitude": mc_lon},
            ]],
        })
        lines.append({
            "planet": planet,
            "angle": "IC",
            "segments": [[
                {"latitude": vertical_lats[0], "longitude": ic_lon},
                {"latitude": vertical_lats[1], "longitude": ic_lon},
            ]],
        })
        lines.append({
            "planet": planet,
            "angle": "ASC",
            "segments": _horizon_segments(ra_deg=ra_deg, dec_deg=dec_deg, gst_deg=gst_deg, rising=True),
        })
        lines.append({
            "planet": planet,
            "angle": "DC",
            "segments": _horizon_segments(ra_deg=ra_deg, dec_deg=dec_deg, gst_deg=gst_deg, rising=False),
        })
    return lines


def build_location_fit(*, birth_date: date, birth_time: dt_time, utc_offset_hours: float) -> dict[str, Any]:
    jd = _birth_jd(birth_date, birth_time, utc_offset_hours)
    positions = _planet_equatorial(jd)
    world_lines = _astrocartography_lines(jd, positions)

    by_purpose: dict[str, list[dict[str, Any]]] = {}
    for purpose in PURPOSES:
        rows = [_city_score(jd, positions, city, purpose) for city in CITIES]
        rows.sort(key=lambda row: row["score"], reverse=True)
        by_purpose[purpose] = rows

    overall = by_purpose["overall"]
    country_best: dict[str, dict[str, Any]] = {}
    for row in overall:
        current = country_best.get(row["country"])
        if current is None or row["score"] > current["score"]:
            country_best[row["country"]] = row
    countries = sorted(
        [
            {
                "country": country,
                "score": row["score"],
                "best_city": row["city"],
                "evidence": row["evidence"][:3],
            }
            for country, row in country_best.items()
        ],
        key=lambda row: row["score"],
        reverse=True,
    )

    return {
        "ok": True,
        "engine": ENGINE_VERSION,
        "policy": {
            "meaning": "출생 순간의 행성이 각 도시에서 ASC/DC/MC/IC 축에 얼마나 가까이 놓이는지 목적별 가중치로 비교한 상대 활성도",
            "probability": False,
            "guarantee": False,
            "catalog_scope": f"대표 도시 {len(CITIES)}곳 비교",
            "distance_rule": "각도 축 근접도 기반; 실제 생활비·비자·치안·언어·직업시장 등 현실 조건은 별도 판단",
        },
        "map": {
            "projection": "web_mercator",
            "latitude_limit": 85.0,
            "line_policy": "ASC=자기표현·새 출발, DC=관계·타인, MC=커리어·사회적 방향, IC=집·내면·정착. 행성선 자체는 길흉 확률이 아니며 목적별 도시 점수와 함께 읽는다.",
            "lines": world_lines,
        },
        "countries": countries[:16],
        "purposes": {
            purpose: {
                "label": PURPOSE_LABELS[purpose],
                "cities": rows[:10],
            }
            for purpose, rows in by_purpose.items()
        },
    }
