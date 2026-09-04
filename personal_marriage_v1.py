# -*- coding: utf-8 -*-
"""Single-person unmarried marriage forecast.

This engine is intentionally separate from two-person synastry. With no known
counterpart it uses the native partnership/home/intimacy structure and selected-
period transits to produce an entertainment-oriented marriage potential index,
timing windows and spouse archetype clues. Scores are interpretive astrology
indices rather than empirical probabilities, and no literal person's identity is
fabricated.
"""

from __future__ import annotations

from datetime import date, datetime, time as dt_time, timedelta, timezone

import swisseph as swe

ENGINE_VERSION = "personal-marriage-western-v1.1-fun-forecast"

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


SIGN_ARCHETYPE = {
    "양자리": {
        "appearance": "선이 또렷하고 활동적인 인상, 빠른 걸음이나 탄탄한 체형 쪽",
        "personality": "직진형·독립적·결단이 빠르고 경쟁심이 있는 타입",
    },
    "황소자리": {
        "appearance": "목소리나 목선이 인상적이고 단정하며 안정감 있는 체형·분위기",
        "personality": "느긋하지만 고집이 있고 감각·생활 안정·경제 감각을 중시하는 타입",
    },
    "쌍둥이자리": {
        "appearance": "젊어 보이고 슬림하거나 가벼운 인상, 표정과 손동작이 풍부한 편",
        "personality": "말이 빠르고 호기심이 많으며 정보·이동·사람을 연결하는 타입",
    },
    "게자리": {
        "appearance": "눈매나 얼굴선이 부드럽고 편안하며 친근한 인상",
        "personality": "가족·정서적 안전·돌봄을 중요하게 여기고 보호적인 타입",
    },
    "사자자리": {
        "appearance": "헤어·자세·존재감이 눈에 띄고 당당하거나 화려한 인상",
        "personality": "자존감·표현력·리더십이 강하고 인정받는 것을 좋아하는 타입",
    },
    "처녀자리": {
        "appearance": "깔끔하고 정돈된 인상, 마른 체형이나 섬세한 디테일이 두드러지는 편",
        "personality": "실무적·분석적·꼼꼼하고 생활 루틴과 효율을 중시하는 타입",
    },
    "천칭자리": {
        "appearance": "균형 잡힌 이목구비, 옷차림과 미감이 좋고 세련된 인상",
        "personality": "예의·균형·협상 감각이 좋고 관계의 분위기를 중요하게 보는 타입",
    },
    "전갈자리": {
        "appearance": "눈빛이 강하거나 신비롭고 선명한 인상, 차분한 카리스마",
        "personality": "집중력·충성도·경계심이 강하고 친밀감은 깊게 가는 타입",
    },
    "사수자리": {
        "appearance": "키가 크거나 팔다리가 길고 활동적인 인상, 캐주얼·스포티한 느낌",
        "personality": "낙천적·솔직하고 여행·배움·새 경험을 좋아하는 타입",
    },
    "염소자리": {
        "appearance": "뼈대나 턱선이 또렷하고 마른 편, 실제 나이보다 성숙하거나 단정한 인상",
        "personality": "책임감·직업의식·장기계획이 강하고 쉽게 관계를 시작하지 않는 타입",
    },
    "물병자리": {
        "appearance": "개성이 분명하고 슬림하거나 독특한 스타일, 평범하지 않은 분위기",
        "personality": "독립적·합리적·친구 같은 관계를 선호하고 자기 세계가 있는 타입",
    },
    "물고기자리": {
        "appearance": "눈매가 부드럽거나 몽환적이고 유연한 분위기, 선이 둥근 편",
        "personality": "감수성·공감력이 높고 예술·상상력·정서적 연결을 중시하는 타입",
    },
}

PLANET_CAREERS = {
    "Sun": ["관리·리더십", "공공·대외업무", "창작·브랜딩"],
    "Moon": ["돌봄·복지·상담", "식음료·서비스", "주거·부동산"],
    "Mercury": ["IT·데이터·기획", "교육·언어·콘텐츠", "영업·무역·유통"],
    "Venus": ["디자인·뷰티·패션", "금융·고객관계", "문화·예술·외교"],
    "Mars": ["기술·엔지니어링", "운영·현장관리", "스포츠·의료·안전"],
    "Jupiter": ["교육·연구", "법·행정·컨설팅", "해외·여행·국제업무"],
    "Saturn": ["공무·행정·규제", "건설·엔지니어링", "재무·감사·관리"],
    "Uranus": ["IT·스타트업", "과학·기술", "혁신·프리랜스"],
    "Neptune": ["영상·음악·예술", "치유·상담", "비영리·서비스"],
    "Pluto": ["금융·투자·세무", "연구·보안·수사", "의료·심층전문직"],
}

MEETING_BY_HOUSE = {
    1: "내가 직접 시작한 활동·자기계발·개인 프로젝트에서 연결될 가능성",
    2: "돈·쇼핑·자산·식음료·생활 취향을 공유하는 자리에서 연결될 가능성",
    3: "동네·지인 소개·짧은 이동·교육·SNS/메신저 같은 소통 경로",
    4: "가족·주거·이사·부동산·고향이나 오래 아는 생활권을 통한 연결",
    5: "취미·공연·데이트·창작·여가·스포츠처럼 즐거움을 위한 자리",
    6: "직장 실무·루틴·운동·건강관리·자주 가는 생활 동선",
    7: "소개팅·중개·협업·계약처럼 처음부터 일대일 관계가 분명한 경로",
    8: "공동재정·보험·세무·연구·심층 상담처럼 사적인 정보를 다루는 환경",
    9: "여행·외국·대학원·자격공부·종교·전문교육처럼 세계가 넓어지는 자리",
    10: "직장·공적 활동·커리어 네트워크·업무상 만남처럼 사회적 역할이 드러나는 곳",
    11: "친구·모임·온라인 커뮤니티·동호회·단체 활동을 통한 연결",
    12: "조용한 온라인 연결·비공개 활동·휴식·치유·봉사처럼 외부 노출이 적은 환경",
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
            if points[a] == points[b] and (a.endswith("ruler") or b.endswith("ruler")):
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
        lon = positions[profiles[key]["whole_ruler"]]["longitude"]
        duplicate = next((name for name, value in targets.items() if _angle_distance(value, lon) < 1e-8), None)
        if duplicate:
            # Prefer the 7H-ruler label when one physical planet has multiple semantic aliases.
            if label == "7th_ruler":
                targets.pop(duplicate, None)
                targets[label] = lon
            continue
        targets[label] = lon
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



def _window_theme(row: dict) -> list[str]:
    themes = []
    targets = {hit.get("target") for hit in row.get("hits", [])}
    planets = {hit.get("transit") for hit in row.get("hits", [])}
    if targets & {"DSC", "7th_ruler"}:
        themes.append("배우자·파트너십")
    if targets & {"Venus", "Moon"} or "Venus" in planets:
        themes.append("연애·호감")
    if targets & {"IC", "4th_ruler"}:
        themes.append("동거·가정")
    if "8th_ruler" in targets:
        themes.append("친밀감·공유자원")
    if planets & {"Jupiter", "Saturn"} and targets & {"DSC", "7th_ruler", "IC", "4th_ruler"}:
        themes.append("공식화·책임")
    return themes[:3] or ["관계 전환"]


def _marriage_forecast(rows: list[dict]) -> dict:
    strongest = sorted(rows, key=lambda x: (-float(x["activation"]), x["date"]))[:8]
    core = strongest[:5]
    if not core:
        score = 20.0
        supportive = pressure = commitment = 0.0
    else:
        activation = sum(float(x["activation"]) for x in core) / len(core)
        supportive = sum(float(x["supportive_load"]) for x in core) / len(core)
        pressure = sum(float(x["pressure_load"]) for x in core) / len(core)
        commitment_strengths = [
            float(hit.get("strength", 0))
            for row in strongest for hit in row.get("hits", [])
            if hit.get("transit") in {"Jupiter", "Saturn"}
            and hit.get("target") in {"DSC", "7th_ruler", "IC", "4th_ruler"}
        ]
        commitment = min(100.0, sum(sorted(commitment_strengths, reverse=True)[:4]) / 2.0) if commitment_strengths else 0.0
        # Entertainment-oriented interpretive index. Strong activation raises eventfulness;
        # supportive load and Jupiter/Saturn commitment hits raise formalisation potential;
        # pressure tempers the result without treating hard aspects as "no marriage".
        score = 10.0 + activation * .45 + supportive * .25 + commitment * .20 - pressure * .10
        score = max(5.0, min(95.0, score))
    if score >= 80:
        label = "매우 강함"
    elif score >= 65:
        label = "강함"
    elif score >= 50:
        label = "중간 이상"
    elif score >= 35:
        label = "보통"
    else:
        label = "낮음"
    windows = []
    for row in _spaced(rows, "activation", 6):
        windows.append({
            "date": row["date"],
            "score": row["activation"],
            "themes": _window_theme(row),
            "supportive_load": row["supportive_load"],
            "pressure_load": row["pressure_load"],
            "strongest_hit": row.get("hits", [None])[0] if row.get("hits") else None,
        })
    return {
        "marriage_probability_percent": round(score, 1),
        "label": label,
        "supportive_component": round(supportive, 1),
        "pressure_component": round(pressure, 1),
        "commitment_component": round(commitment, 1),
        "strong_windows": windows,
        "probability_note": "통계적·과학적 확률이 아니라 선택 기간의 결혼/공식화 신호를 0~100으로 번역한 점성 엔터테인먼트 지수다.",
    }


def _spouse_archetype(profiles: dict, natal_aspects: list[dict]) -> dict:
    seventh = profiles["7"]
    career_house = profiles["4"]  # 10th from the 7th = partner-career derivative house.
    signs = []
    for sign in (seventh["whole_sign"], seventh["placidus_sign"]):
        if sign not in signs:
            signs.append(sign)
    appearance = [SIGN_ARCHETYPE[x]["appearance"] for x in signs if x in SIGN_ARCHETYPE]
    personality = [SIGN_ARCHETYPE[x]["personality"] for x in signs if x in SIGN_ARCHETYPE]
    ruler = seventh["whole_ruler"]
    ruler_house = int(seventh["whole_ruler_placement"]["whole_house"])
    career_ruler = career_house["whole_ruler"]
    careers = list(PLANET_CAREERS.get(career_ruler, []))
    extras = []
    for row in natal_aspects:
        pair = {row.get("a"), row.get("b")}
        if not (pair & {"DSC", "7th_ruler"}):
            continue
        if "Saturn" in pair:
            extras.append("책임감이 강하거나 실제 나이보다 성숙해 보이는 사람")
        if "Jupiter" in pair:
            extras.append("교육·전문성·해외경험처럼 시야를 넓혀 주는 배경이 있는 사람")
        if "Venus" in pair:
            extras.append("미감·옷차림·대인매너를 중요하게 여기는 사람")
        if "Mars" in pair:
            extras.append("행동력이 빠르거나 운동·기술·현장성이 강한 사람")
    personality.extend(x for x in extras if x not in personality)
    meeting = MEETING_BY_HOUSE.get(ruler_house, "7하우스 주인행성의 배치와 연결된 생활권")
    identity_clues = [
        f"배우자 축: {seventh['whole_sign']} 중심" + (f" + 플라시두스 {seventh['placidus_sign']} 보조" if seventh['placidus_sign'] != seventh['whole_sign'] else ""),
        f"7하우스 주인행성 {ruler}가 홀사인 {ruler_house}하우스에 위치",
        f"배우자 직업 단서는 7하우스의 10번째인 본인 4하우스와 그 주인행성 {career_ruler}를 우선 참고",
    ]
    return {
        "summary": f"{seventh['whole_sign']} 배우자상과 {ruler} 주인행성 성격이 중심이고, 실제 만남 환경은 {ruler_house}하우스 주제가 강하게 잡힌다.",
        "appearance_hints": appearance[:4],
        "personality_hints": personality[:5],
        "career_clusters": careers[:4],
        "meeting_route": meeting,
        "identity_clues": identity_clues,
        "precision_note": "외모·직업·만남 경로는 7하우스/DSC와 주인행성, 파생 10하우스를 이용한 전통적 배우자상 추정이다. 실제 이름·주소·회사처럼 특정 개인의 신원을 맞히는 기능은 아니다.",
    }


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
    natal_aspects = _natal_aspects(positions, house, profiles)
    timing_rows = _daily_timing(start_date, end_date, utc_offset_hours, _timing_targets(positions, house, profiles))
    activation_values = [row["activation"] for row in timing_rows]
    forecast = _marriage_forecast(timing_rows)
    spouse_archetype = _spouse_archetype(profiles, natal_aspects)
    return {
        "ok": True,
        "engine": ENGINE_VERSION,
        "mode": "personal_unmarried",
        "policy": {
            "counterpart_required": False,
            "marriage_probability": True,
            "spouse_archetype_prediction": True,
            "specific_identity_claims": False,
            "entertainment_index": True,
            "meaning": "상대가 없을 때도 개인 차트로 결혼 가능성 지수·강한 시기·배우자상(외모/성향/직업군/만남 경로)을 적극적으로 본다.",
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
        "natal_aspects": natal_aspects,
        "forecast": forecast,
        "spouse_archetype": spouse_archetype,
        "timing": {
            "average_activation": round(sum(activation_values) / max(1, len(activation_values)), 1),
            "spread": round(max(activation_values, default=0.0) - min(activation_values, default=0.0), 1),
            "top_days": _spaced(timing_rows, "activation", 8),
            "pressure_days": _spaced(timing_rows, "pressure_load", 6),
            "top_months": _months(timing_rows)[:12],
        },
        "limits": [
            "결혼 가능성 %는 통계적 확률이 아니라 점성학적 신호 강도를 재미용 0~100 지수로 번역한 값이다.",
            "배우자 외모·성향·직업군·만남 경로는 차트에서 적극적으로 추정하되 실제 미래 인물의 이름·주소·회사 같은 특정 신원은 만들어내지 않는다.",
            "특정 상대가 생기면 이 개인 결혼운과 별도로 두 사람의 실제 결혼궁합을 계산해야 한다.",
        ],
    }
