# -*- coding: utf-8 -*-
"""Research-only Thai house-lord and basic planetary-status facts.

Phase 2-B1 intentionally implements only table lookups that can be stated as
factual positions. It does not attach predictions, benefic/malefic scores,
event probabilities, house meanings, or Gemini interpretation.

Validated table scope:
- เจ้าเรือน / เกษตร (sign lord / domicile)
- ประ
- อุจ
- นิจ

The supported standard table is the traditional 1..8 Thai planet set:
Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu. Thai Ketu and Uranus
remain explicitly unsupported in this dignity layer rather than being guessed.
"""

from __future__ import annotations

from typing import Any, Mapping

ENGINE_VERSION = "thai-dignities-research-v1.0-basic-table"

SIGNS = (
    ("Aries", "เมษ", "양자리"),
    ("Taurus", "พฤษภ", "황소자리"),
    ("Gemini", "มิถุน", "쌍둥이자리"),
    ("Cancer", "กรกฎ", "게자리"),
    ("Leo", "สิงห์", "사자자리"),
    ("Virgo", "กันย์", "처녀자리"),
    ("Libra", "ตุล", "천칭자리"),
    ("Scorpio", "พิจิก", "전갈자리"),
    ("Sagittarius", "ธนู", "사수자리"),
    ("Capricorn", "มกร", "염소자리"),
    ("Aquarius", "กุมภ์", "물병자리"),
    ("Pisces", "มีน", "물고기자리"),
)

PLANETS = {
    "sun": {"number": 1, "thai": "อาทิตย์", "ko": "태양"},
    "moon": {"number": 2, "thai": "จันทร์", "ko": "달"},
    "mars": {"number": 3, "thai": "อังคาร", "ko": "화성"},
    "mercury": {"number": 4, "thai": "พุธ", "ko": "수성"},
    "jupiter": {"number": 5, "thai": "พฤหัสบดี", "ko": "목성"},
    "venus": {"number": 6, "thai": "ศุกร์", "ko": "금성"},
    "saturn": {"number": 7, "thai": "เสาร์", "ko": "토성"},
    "rahu": {"number": 8, "thai": "ราหู", "ko": "라후"},
}

# Sign lord / Kaset table, Aries..Pisces.
SIGN_LORDS = (
    "mars",      # Aries
    "venus",     # Taurus
    "mercury",   # Gemini
    "moon",      # Cancer
    "sun",       # Leo
    "mercury",   # Virgo
    "venus",     # Libra
    "mars",      # Scorpio
    "jupiter",   # Sagittarius
    "saturn",    # Capricorn
    "rahu",      # Aquarius
    "jupiter",   # Pisces
)

# Each status is a set of sign indices by planet. Multiple statuses are allowed
# because some tables overlap (for example Mercury in Virgo is both Kaset and Uj).
DIGNITY_SIGNS = {
    "kaset": {
        "sun": (4,), "moon": (3,), "mars": (0, 7), "mercury": (2, 5),
        "jupiter": (8, 11), "venus": (1, 6), "saturn": (9,), "rahu": (10,),
    },
    "pra": {
        "sun": (10,), "moon": (9,), "mars": (1, 6), "mercury": (8, 11),
        "jupiter": (2, 5), "venus": (0, 7), "saturn": (3,), "rahu": (4,),
    },
    "ucca": {
        "sun": (0,), "moon": (1,), "mars": (9,), "mercury": (5,),
        "jupiter": (3,), "venus": (11,), "saturn": (6,), "rahu": (7,),
    },
    "nicha": {
        "sun": (6,), "moon": (7,), "mars": (3,), "mercury": (11,),
        "jupiter": (9,), "venus": (5,), "saturn": (0,), "rahu": (1,),
    },
}

STATUS_META = {
    "kaset": {"thai": "เกษตร", "label": "domicile/sign lord"},
    "pra": {"thai": "ประ", "label": "pra"},
    "ucca": {"thai": "อุจ", "label": "exaltation sign"},
    "nicha": {"thai": "นิจ", "label": "fall sign"},
}


def _sign_payload(sign_index: int) -> dict[str, Any]:
    if not 0 <= int(sign_index) <= 11:
        raise ValueError("sign_index must be within 0..11")
    idx = int(sign_index)
    en, th, ko = SIGNS[idx]
    return {"sign_index": idx, "sign_en": en, "sign_th": th, "sign_ko": ko}


def _planet_payload(key: str) -> dict[str, Any]:
    row = PLANETS[key]
    return {"key": key, "number": row["number"], "thai_name": row["thai"], "label_ko": row["ko"]}


def house_lord_for_sign(sign_index: int) -> dict[str, Any]:
    idx = int(sign_index)
    if not 0 <= idx <= 11:
        raise ValueError("sign_index must be within 0..11")
    key = SIGN_LORDS[idx]
    return {**_planet_payload(key), "sign": _sign_payload(idx)}


def dignity_statuses_for_planet(*, planet_key: str, sign_index: int) -> list[dict[str, Any]]:
    if planet_key not in PLANETS:
        return []
    idx = int(sign_index)
    if not 0 <= idx <= 11:
        raise ValueError("sign_index must be within 0..11")
    out: list[dict[str, Any]] = []
    for status_key in ("kaset", "pra", "ucca", "nicha"):
        if idx in DIGNITY_SIGNS[status_key][planet_key]:
            meta = STATUS_META[status_key]
            out.append({"key": status_key, "thai": meta["thai"], "label": meta["label"]})
    return out


def _resolve_sign(row: Mapping[str, Any]) -> int:
    if row.get("sign_index") is None:
        raise ValueError("position requires sign_index")
    idx = int(row["sign_index"])
    if not 0 <= idx <= 11:
        raise ValueError("position sign_index must be within 0..11")
    return idx


def build_dignity_research(planet_positions: Mapping[str, Mapping[str, Any]]) -> dict[str, Any]:
    planets: dict[str, dict[str, Any]] = {}
    for raw_key, row in planet_positions.items():
        key = str(raw_key)
        if not isinstance(row, Mapping):
            raise ValueError(f"position {key!r} must be a mapping")
        sign_index = _resolve_sign(row)
        supported = key in PLANETS
        planets[key] = {
            "supported": supported,
            "planet": _planet_payload(key) if supported else {"key": key},
            "sign": _sign_payload(sign_index),
            "sign_lord": house_lord_for_sign(sign_index),
            "statuses": dignity_statuses_for_planet(planet_key=key, sign_index=sign_index) if supported else [],
            "unsupported_reason": None if supported else "No validated basic dignity table in this research layer for this body.",
        }

    return {
        "available": True,
        "research_only": True,
        "engine": ENGINE_VERSION,
        "supported_planets": list(PLANETS),
        "planets": planets,
        "reference_scope": {
            "house_lord_and_kaset": "traditional Thai Kaset table",
            "pra": "traditional Thai Pra table",
            "ucca_nicha": "traditional Thai Uj/Nij table",
        },
        "promotion_gate": {
            "table_facts_validated": True,
            "interpretive_strength_validated": False,
            "house_meanings_allowed": False,
            "scores_allowed": False,
            "event_judgement_allowed": False,
            "gemini_interpretation_allowed": False,
        },
        "policy": "Table facts only. Multiple statuses may coexist; no rank, score, good/bad judgement, or prediction is produced.",
    }


def build_house_lords_research(houses: list[Mapping[str, Any]]) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    for house in houses:
        number = int(house.get("house_number") or 0)
        sign_index = int(house.get("sign_index"))
        if not 1 <= number <= 12:
            raise ValueError("house_number must be within 1..12")
        rows.append({"house_number": number, "sign": _sign_payload(sign_index), "lord": house_lord_for_sign(sign_index)})
    return {
        "available": True,
        "research_only": True,
        "engine": ENGINE_VERSION,
        "houses": rows,
        "promotion_gate": {"house_lord_facts_validated": True, "house_lord_interpretation_allowed": False, "gemini_interpretation_allowed": False},
    }
