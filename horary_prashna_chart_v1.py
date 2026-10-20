"""Chart-backed Horary / D1 Prashna evidence, without invented event certainty.

Western and sidereal D1 use independent house/sign rules. This is a narrow,
transparent v1 evidence reader; it does not assert precise yes/no or timing
without a full traditional judgement contract.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import swisseph as swe

from western_house_system_v1 import calculate_quadrant_houses

VERSION = "horary-prashna-chart-evidence-v1"
BODY_IDS = {
    "Sun": swe.SUN, "Moon": swe.MOON, "Mercury": swe.MERCURY,
    "Venus": swe.VENUS, "Mars": swe.MARS, "Jupiter": swe.JUPITER,
    "Saturn": swe.SATURN,
}
SIGNS = ["양", "황소", "쌍둥이", "게", "사자", "처녀", "천칭", "전갈", "사수", "염소", "물병", "물고기"]
RULERS = ["Mars", "Venus", "Mercury", "Moon", "Sun", "Mercury",
          "Venus", "Mars", "Jupiter", "Saturn", "Saturn", "Jupiter"]
PLANET_KO = {
    "Sun": "태양", "Moon": "달", "Mercury": "수성", "Venus": "금성",
    "Mars": "화성", "Jupiter": "목성", "Saturn": "토성",
}
HOUSE_BY_DOMAIN = {
    "LOST_ITEM": 2, "RELATIONSHIP": 7, "CAREER": 10,
    "EXAM_EDUCATION": 9, "MONEY": 2, "BUSINESS_CONTRACT": 7,
    "PROPERTY_MOVE": 4, "TRAVEL_FOREIGN": 9, "HEALTH": 6,
    "LEGAL_CONFLICT": 7, "FAMILY_CHILDREN": 5,
    "COMMUNICATION_NEWS": 3,
}
ASPECTS = [(0, "합"), (60, "육십분위"), (90, "사분위"),
           (120, "삼분위"), (180, "충")]
HIGH_STAKES = {"medical_non_diagnostic", "legal_decision_support_only", "financial_decision_support_only", "financial_legal_decision_support_only"}


def _sign(lon: float) -> int:
    return int((lon % 360) // 30)


def _sign_text(lon: float) -> str:
    return f"{SIGNS[_sign(lon)]}자리 {lon % 30:.1f}°"


def _distance(a: float, b: float) -> float:
    return abs(((a - b + 180) % 360) - 180)


def _aspects(a: dict, b: dict, who: str) -> list[dict]:
    if a["id"] == b["id"]:
        return []
    angle = _distance(a["longitude"], b["longitude"])
    results = []
    for exact, label in ASPECTS:
        orb = abs(angle - exact)
        if orb > 7:
            continue
        future = _distance(
            a["longitude"] + a["speed"] * 0.2,
            b["longitude"] + b["speed"] * 0.2,
        )
        applying = abs(future - exact) < orb - 1e-6
        results.append({
            "pair": who, "aspect": label, "orb": round(orb, 2),
            "phase": "적용" if applying else "분리 또는 정체",
            "applying": applying,
            "quality": "완화" if exact in (60, 120) else "긴장" if exact in (90, 180) else "합류",
        })
    return sorted(results, key=lambda row: row["orb"])


def _positions(jd: float) -> dict[str, dict]:
    out = {}
    for name, ident in BODY_IDS.items():
        vector, _flags = swe.calc_ut(jd, ident, swe.FLG_SWIEPH | swe.FLG_SPEED)
        out[name] = {"id": name, "longitude": float(vector[0]) % 360,
                     "speed": float(vector[3]), "retrograde": vector[3] < 0}
    return out


def _western(jd: float, lat: float, lon: float, domain: str, pos: dict):
    cusps, ascmc, meta = calculate_quadrant_houses(jd, lat, lon)
    house = HOUSE_BY_DOMAIN.get(domain)
    target_house = house if house is not None else None
    lord_1 = RULERS[_sign(float(cusps[0]))]
    lord_target = RULERS[_sign(float(cusps[target_house - 1]))] if target_house else None
    contacts = (_aspects(pos[lord_1], pos[lord_target], "1하우스 주인성–질문 하우스 주인성")
                if lord_target else [])
    if lord_target and lord_target != "Moon":
        contacts += _aspects(pos["Moon"], pos[lord_target], "달–질문 하우스 주인성")
    contacts.sort(key=lambda row: (not row["applying"], row["orb"]))
    applying = [row for row in contacts if row["applying"]]
    if not target_house:
        summary = "질문 대상 하우스를 확정할 수 없어 전통 호라리 성사 판정은 유보해."
    elif applying:
        top = applying[0]
        tendency = ("완화 각이라 조율·진행 쪽 상징이 있지만" if top["quality"] == "완화"
                    else "긴장 각이라 조건 변경·지연을 점검할 단서가 있지만" if top["quality"] == "긴장"
                    else "합류 각이지만 그 자체로 좋은 결과와 나쁜 결과가 갈리지는 않으므로")
        summary = (f"{top['pair']} 사이에 {top['aspect']} 적용각(오브 {top['orb']}°)이 보여. "
                   f"{tendency} 실제 약속의 성사·지연·무산을 확정할 수는 없어.")
    else:
        summary = "선별한 주요 지표 사이에 좁은 적용각이 확인되지 않아. 이것만으로 무산이나 지연이라고 판정하지 않아."
    return {
        "ascendant": _sign_text(float(ascmc[0])),
        "house_system": meta["used"], "house_fallback": bool(meta["fallback"]),
        "question_house": target_house,
        "querent_lord": lord_1, "quesited_lord": lord_target,
        "querent_position": _sign_text(pos[lord_1]["longitude"]),
        "quesited_position": _sign_text(pos[lord_target]["longitude"]) if lord_target else None,
        "moon": _sign_text(pos["Moon"]["longitude"]),
        "contacts": contacts[:5], "summary": summary,
    }


def _vedic_aspect_houses(planet: str) -> set[int]:
    if planet == "Mars":
        return {4, 7, 8}
    if planet == "Jupiter":
        return {5, 7, 9}
    if planet == "Saturn":
        return {3, 7, 10}
    return {7}


def _prashna(jd: float, tropical_asc: float, domain: str, pos: dict):
    # Set the explicitly named reference ayanamsa; do not reuse the Western
    # house rulership or its aspect/orb scheme.
    swe.set_sid_mode(swe.SIDM_LAHIRI)
    ayanamsa = float(swe.get_ayanamsa_ut(jd))
    sid_asc = (tropical_asc - ayanamsa) % 360
    sid_sign = _sign(sid_asc)
    house = HOUSE_BY_DOMAIN.get(domain)
    lagna_lord = RULERS[sid_sign]
    bhava_sign = (sid_sign + house - 1) % 12 if house else None
    bhava_lord = RULERS[bhava_sign] if bhava_sign is not None else None
    sid_positions = {name: (row["longitude"] - ayanamsa) % 360 for name, row in pos.items()}
    def bhava(name: str) -> int:
        return (_sign(sid_positions[name]) - sid_sign) % 12 + 1
    contacts = []
    if bhava_lord:
        target_bhava = bhava(bhava_lord)
        for name in (lagna_lord, "Moon"):
            if name == bhava_lord:
                contacts.append({"body": name, "link": "동일 주인성", "house": target_bhava})
                continue
            offset = (_sign(sid_positions[bhava_lord]) - _sign(sid_positions[name])) % 12 + 1
            if offset in _vedic_aspect_houses(name):
                contacts.append({"body": name, "link": f"{offset}번째 라시 시선", "house": target_bhava})
    if house is None:
        summary = "질문 바바가 불명확해 프라슈나의 관계 판단을 유보해."
    elif contacts:
        summary = "라그나 주인성 또는 달이 질문 바바 주인성과 연결돼 있어. 연결 자체만으로 결과를 확정할 수는 없어."
    else:
        summary = "기본 D1 라시 시선에서 직접 연결이 뚜렷하지 않아. 단절 또는 무산을 의미하지는 않아."
    return {
        "ayanamsa": "Lahiri", "ayanamsa_degrees": round(ayanamsa, 4),
        "lagna": _sign_text(sid_asc), "lagna_lord": lagna_lord,
        "moon": _sign_text(sid_positions["Moon"]), "moon_bhava": bhava("Moon"),
        "question_bhava": house, "question_bhava_lord": bhava_lord,
        "question_lord_bhava": bhava(bhava_lord) if bhava_lord else None,
        "contacts": contacts[:5], "summary": summary,
    }


def build_horary_chart_report(instant_utc: datetime, latitude: float,
                              longitude: float, classification: dict[str, Any]) -> dict[str, Any]:
    utc = instant_utc.astimezone(timezone.utc)
    decimal = utc.hour + utc.minute / 60 + utc.second / 3600 + utc.microsecond / 3600000000
    jd = swe.julday(utc.year, utc.month, utc.day, decimal)
    positions = _positions(jd)
    west = _western(jd, latitude, longitude, classification["primary_type"], positions)
    # Recalculate physical tropical ascendant independently of interpretation.
    _cusps, ascmc, _meta = calculate_quadrant_houses(jd, latitude, longitude)
    prashna = _prashna(jd, float(ascmc[0]), classification["primary_type"], positions)
    high_risk = classification.get("risk_profile", "") in HIGH_STAKES
    active = [row for row in west["contacts"] if row["applying"]]
    ease = any(row["quality"] == "완화" for row in active)
    friction = any(row["quality"] == "긴장" for row in active)
    p_has = bool(prashna["contacts"])
    if ease and friction:
        state = "진행·조정 신호 혼합"
        conclusion = ("서양 호라리에 완화 각과 긴장 각이 함께 접근하고 있어. "
                      "진행 여지와 일정 조정의 가능성을 함께 살피는 해석이 맞아. "
                      "프라슈나에서 연결 단서가 있어도 무산·성사를 확정할 수는 없어.")
    elif friction:
        state = "조정·지연 근거 우세"
        conclusion = ("서양 호라리의 주요 적용각에 긴장 근거가 있어. "
                      "기다릴 시간이 늘거나 약속 조건이 바뀌는지 우선 확인할 만해. "
                      "단 이것만으로 약속이 무산된다고 확정할 수 없어.")
    elif ease:
        state = "진행·조율 근거 확인"
        conclusion = ("서양 호라리 주요 적용각에서 완화 근거가 확인돼. "
                      "진행이나 조율 가능성을 우선 살피되, 실제 성사는 당사자의 답변과 "
                      "구체적인 시간 합의로 확정해야 해.")
    elif active:
        state = "접촉 근거 확인 · 방향 미정"
        conclusion = ("서양 호라리에 합류 적용각이 있지만 그 각만으로 진행과 차질의 "
                      "방향은 구분되지 않아. 접촉은 연결의 단서일 뿐 실제 결과를 확정하지 않아.")
    elif p_has:
        state = "프라슈나 연결 근거만 확인"
        conclusion = ("프라슈나 D1에서는 질문 바바와의 연결 단서가 있지만 서양 호라리 "
                      "주요 지표의 좁은 적용각은 확인되지 않았어. 양쪽의 결론을 강제로 "
                      "일치시키지 않고 추가 근거가 필요하다고 봐. 성사나 무산을 확정할 수 없어.")
    else:
        state = "근거 제한적 · 성사/지연/무산 판정 유보"
        conclusion = ("현재 간이 규칙으로는 성사·지연·무산 중 하나를 선택할 충분한 근거가 없어. "
                      "차트에서 지표를 찾지 못했다는 이유로 무산이라고 해석하지 않아.")
    if p_has:
        conclusion += " 프라슈나 D1의 연결 단서는 별도 검토하며 서양 각점수에 합산하지 않아."
    if high_risk:
        conclusion = "건강·법률·재정 관련 사실이나 전문 판단은 차트로 확정하지 않아. 실제 증거와 전문가 상담을 우선해."
    return {
        "engine_version": VERSION, "julian_day_ut": round(jd, 6),
        "western": west, "prashna": prashna,
        "synthesis": {
            "status": state if not high_risk else "민감 질문 · 사실 판정 제외",
            "conclusion": conclusion,
            "timing": "정확한 지연·성사 시각은 이 간이 계산에서 산출하지 않았어.",
            "limitations": "Swiss Ephemeris 위치·주인성·선별 적용각·D1 바바/라시 시선만 계산한 1차 해설이야. 완전한 전통 horary judgement(리셉션·방해·본질적 품위·VOC 등) 또는 프라슈나 전체 요가 판정은 아직 포함하지 않아.",
        },
    }
