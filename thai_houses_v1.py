# -*- coding: utf-8 -*-
"""Research-only Thai whole-sign house mapper.

This module starts Phase 2-A after the Suriyayat Lagna numeric position layer
passed independent MyHora world-coordinate validation.  It deliberately does
not promote house interpretation into the product.

Rule under test:
- the zodiac sign containing Lagna is house 1;
- each following complete 30-degree sign is the next house;
- no quadrant/intermediate cusps are created;
- a planet's research house is determined only by its Suriyayat sign relative
  to the Lagna sign.

No dignity, aspect, event score, probability, or Gemini interpretation belongs
in this module.
"""

from __future__ import annotations

import math
from typing import Any, Mapping

ENGINE_VERSION = "thai-whole-sign-houses-research-v1.0"
METHOD = "thai_whole_sign_from_validated_suriyayat_lagna"

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


def _finite_float(value: Any, label: str) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{label} must be numeric") from exc
    if not math.isfinite(result):
        raise ValueError(f"{label} must be finite")
    return result


def _wrap360(value: float) -> float:
    return float(value) % 360.0


def sign_index_from_longitude(longitude_deg: float) -> int:
    value = _wrap360(_finite_float(longitude_deg, "longitude_deg"))
    return int(value // 30.0) % 12


def house_number_for_sign(*, lagna_sign_index: int, object_sign_index: int) -> int:
    lagna = int(lagna_sign_index)
    obj = int(object_sign_index)
    if not 0 <= lagna <= 11:
        raise ValueError("lagna_sign_index must be within 0..11")
    if not 0 <= obj <= 11:
        raise ValueError("object_sign_index must be within 0..11")
    return ((obj - lagna) % 12) + 1


def _sign_payload(sign_index: int) -> dict[str, Any]:
    en, th, ko = SIGNS[sign_index]
    return {
        "sign_index": sign_index,
        "sign_en": en,
        "sign_th": th,
        "sign_ko": ko,
        "start_longitude_deg": float(sign_index * 30),
        "end_longitude_deg_exclusive": float((sign_index + 1) * 30),
    }


def _resolve_object_sign(row: Mapping[str, Any]) -> int:
    if row.get("sign_index") is not None:
        sign_index = int(row["sign_index"])
        if not 0 <= sign_index <= 11:
            raise ValueError("planet sign_index must be within 0..11")
        return sign_index
    if row.get("longitude_deg") is not None:
        return sign_index_from_longitude(row["longitude_deg"])
    raise ValueError("planet position requires sign_index or longitude_deg")


def build_whole_sign_houses_research(
    *,
    lagna_longitude_deg: float,
    planet_positions: Mapping[str, Mapping[str, Any]] | None = None,
) -> dict[str, Any]:
    """Build a non-interpreted 12-house whole-sign research structure."""
    lagna_longitude = _wrap360(_finite_float(lagna_longitude_deg, "lagna_longitude_deg"))
    lagna_sign = sign_index_from_longitude(lagna_longitude)

    houses: list[dict[str, Any]] = []
    for house_number in range(1, 13):
        sign_index = (lagna_sign + house_number - 1) % 12
        houses.append({
            "house_number": house_number,
            **_sign_payload(sign_index),
        })

    placements: dict[str, dict[str, Any]] = {}
    for key, row in (planet_positions or {}).items():
        if not isinstance(row, Mapping):
            raise ValueError(f"planet position {key!r} must be a mapping")
        sign_index = _resolve_object_sign(row)
        placements[str(key)] = {
            "house_number": house_number_for_sign(
                lagna_sign_index=lagna_sign,
                object_sign_index=sign_index,
            ),
            **_sign_payload(sign_index),
            "longitude_deg": (
                _wrap360(_finite_float(row["longitude_deg"], f"{key}.longitude_deg"))
                if row.get("longitude_deg") is not None
                else None
            ),
        }

    return {
        "available": True,
        "research_only": True,
        "engine": ENGINE_VERSION,
        "method": METHOD,
        "lagna_longitude_deg": round(lagna_longitude, 6),
        "lagna_sign": _sign_payload(lagna_sign),
        "houses": houses,
        "planet_placements": placements,
        "validation_status": "structural_rule_under_phase2a_test",
        "promotion_gate": {
            "lagna_numeric_position_required": True,
            "house_structure_interpretation_validated": False,
            "houses_allowed_in_product": False,
            "dignities_allowed": False,
            "aspects_allowed": False,
            "gemini_interpretation_allowed": False,
        },
        "policy": "Research structure only: whole-sign membership, no house meanings or predictive judgement.",
    }
