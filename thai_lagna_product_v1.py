# -*- coding: utf-8 -*-
"""Explicit product promotion for validated Thai Suriyayat Lagna context.

This layer is intentionally separate from the research calculator. It can only
promote after the Phase 2G4 audit passes and an explicit enable flag is supplied.
Promotion exposes the validated traditional numeric Lagna and a sanitized,
non-predictive AI packet. It does not promote school-variant exceptions,
predictive judgement, event timing, probability or scores.
"""

from __future__ import annotations

import math
import re
from typing import Any, Mapping

from thai_ai_safe_packet_v1 import build_ai_safe_packet_research

ENGINE_VERSION = "thai-lagna-product-promotion-v1.1-fail-closed"
SELECTED_METHOD_KEY = "common_anto_0600_lmt"
INTERPRETATION_SCOPE = "descriptive_nonpredictive_house_context_only"
MIN_WORLD_NUMERIC_CHECKS = 16
PRODUCT_SIGNS = (
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
_ROUTE_KEY_RE = re.compile(r"^H([1-9]|1[0-2]):[a-z][a-z0-9_]*->H([1-9]|1[0-2])$")


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _packed_identity(longitude: float) -> tuple[int, int, int, int]:
    total_arcmin = longitude * 60.0
    sign_index = int(total_arcmin // 1800.0) % 12
    within_arcmin = total_arcmin - sign_index * 1800.0
    degree = int(within_arcmin // 60.0)
    minute_float = within_arcmin - degree * 60.0
    minute = int(minute_float)
    second = int(round((minute_float - minute) * 60.0))
    if second >= 60:
        minute += 1
        second -= 60
    if minute >= 60:
        degree += 1
        minute -= 60
    if degree >= 30:
        sign_index = (sign_index + 1) % 12
        degree -= 30
    return sign_index, degree, minute, second


def lagna_numeric_identity_is_valid(value: Any, *, require_product_contract: bool = False) -> bool:
    """Validate that every exposed Lagna identity field describes one position."""
    row = _mapping(value)
    if row.get("available") is not True or row.get("method") != SELECTED_METHOD_KEY:
        return False
    if isinstance(row.get("longitude_deg"), bool) or not isinstance(row.get("longitude_deg"), (int, float)):
        return False
    if any(isinstance(row.get(key), bool) or not isinstance(row.get(key), int) for key in ("sign_index", "degree", "minute", "second")):
        return False

    longitude = float(row["longitude_deg"])
    if not math.isfinite(longitude) or not 0.0 <= longitude < 360.0:
        return False
    expected_sign, expected_degree, expected_minute, expected_second = _packed_identity(longitude)
    if (
        row.get("sign_index"), row.get("degree"), row.get("minute"), row.get("second")
    ) != (expected_sign, expected_degree, expected_minute, expected_second):
        return False

    sign_en, sign_th, sign_ko = PRODUCT_SIGNS[expected_sign]
    if (row.get("sign_en"), row.get("sign_th"), row.get("sign_ko")) != (sign_en, sign_th, sign_ko):
        return False
    if row.get("display") != f"{sign_ko} {expected_degree}°{expected_minute:02d}′{expected_second:02d}″":
        return False

    if not require_product_contract:
        return True
    validation = _mapping(row.get("validation"))
    return bool(
        row.get("engine") == ENGINE_VERSION
        and row.get("method_key") == SELECTED_METHOD_KEY
        and row.get("interpretation_scope") == INTERPRETATION_SCOPE
        and validation.get("numeric_position_validated") is True
        and validation.get("global_coordinates_independently_validated") is True
        and isinstance(validation.get("world_numeric_checks"), int)
        and not isinstance(validation.get("world_numeric_checks"), bool)
        and validation.get("world_numeric_checks") >= MIN_WORLD_NUMERIC_CHECKS
    )


def product_routes_are_complete(value: Any) -> bool:
    """Require one unique structural route for each source house H1..H12."""
    if not isinstance(value, list) or len(value) != 12:
        return False
    source_houses: set[int] = set()
    route_keys: set[str] = set()
    for row in value:
        route = _mapping(row)
        route_key = route.get("route_key")
        if not isinstance(route_key, str):
            return False
        match = _ROUTE_KEY_RE.fullmatch(route_key)
        if match is None or route.get("interpretation_level") != "descriptive_nonpredictive":
            return False
        source_houses.add(int(match.group(1)))
        route_keys.add(route_key)
    return source_houses == set(range(1, 13)) and len(route_keys) == 12


def _blocked(reason: str) -> dict[str, Any]:
    return {
        "available": False,
        "engine": ENGINE_VERSION,
        "explicit_promotion": False,
        "reason": reason,
        "lagna": {"available": False, "reason": reason},
        "ai_safe_packet_product": {},
        "promotion_gate": {
            "numeric_lagna_product_allowed": False,
            "descriptive_house_context_allowed": False,
            "gemini_descriptive_packet_allowed": False,
            "school_policy_allowed": False,
            "exception_application_allowed": False,
            "predictive_interpretation_allowed": False,
            "event_judgement_allowed": False,
            "timing_prediction_allowed": False,
            "probability_allowed": False,
            "scores_allowed": False,
        },
    }


def build_lagna_product_promotion(
    *,
    lagna_research: Mapping[str, Any] | None,
    promotion_audit: Mapping[str, Any] | None,
    descriptive_synthesis_research: Mapping[str, Any] | None,
    explicit_enable: bool,
) -> dict[str, Any]:
    if explicit_enable is not True:
        return _blocked("Explicit product promotion flag is required.")

    audit = _mapping(promotion_audit)
    if not (
        audit.get("available") is True
        and audit.get("lagna_position_product_promotion_ready") is True
        and audit.get("descriptive_house_context_product_promotion_ready") is True
        and audit.get("ai_safe_packet_ready_after_explicit_lagna_promotion") is True
        and not (audit.get("failed_checks") or [])
    ):
        return _blocked("Phase 2G4 promotion audit is not fully ready.")

    research = _mapping(lagna_research)
    if research.get("available") is not True:
        return _blocked("Validated Lagna research layer is unavailable.")
    if research.get("selected_traditional_candidate") != SELECTED_METHOD_KEY:
        return _blocked("Unexpected traditional Lagna candidate selection.")
    validation = _mapping(research.get("validation"))
    if validation.get("global_coordinates_independently_validated") is not True:
        return _blocked("Independent world-coordinate Lagna validation is required.")

    candidate = _mapping(research.get(SELECTED_METHOD_KEY))
    if candidate.get("available") is not True:
        return _blocked("Selected validated Lagna candidate is unavailable.")
    if not lagna_numeric_identity_is_valid(candidate):
        return _blocked("Selected Lagna candidate has inconsistent numeric or zodiac identity fields.")
    sign_index = int(candidate["sign_index"])

    packet = build_ai_safe_packet_research(
        descriptive_synthesis_research=descriptive_synthesis_research,
        lagna_product_available=True,
    )
    if not (
        packet.get("available") is True
        and packet.get("eligible_for_gemini") is True
        and _mapping(packet.get("promotion_gate")).get("gemini_interpretation_allowed") is True
        and int(packet.get("route_count") or 0) == 12
        and product_routes_are_complete(packet.get("routes"))
    ):
        return _blocked("Sanitized descriptive AI packet failed promotion requirements.")

    world_ref = _mapping(validation.get("world_reference"))
    lagna = {
        "available": True,
        "engine": ENGINE_VERSION,
        "source_research_engine": research.get("engine"),
        "method_key": SELECTED_METHOD_KEY,
        "method": candidate.get("method"),
        "method_thai": candidate.get("method_thai"),
        "longitude_deg": candidate.get("longitude_deg"),
        "sign_index": sign_index,
        "sign_en": candidate.get("sign_en"),
        "sign_th": candidate.get("sign_th"),
        "sign_ko": candidate.get("sign_ko"),
        "degree": candidate.get("degree"),
        "minute": candidate.get("minute"),
        "second": candidate.get("second"),
        "display": candidate.get("display"),
        "validation": {
            "numeric_position_validated": True,
            "global_coordinates_independently_validated": True,
            "world_numeric_checks": int(world_ref.get("numeric_checks") or 0),
            "reference": validation.get("reference"),
        },
        "interpretation_scope": INTERPRETATION_SCOPE,
        "predictive_interpretation_allowed": False,
        "event_judgement_allowed": False,
        "timing_prediction_allowed": False,
        "probability_allowed": False,
        "scores_allowed": False,
    }
    packet_product = dict(packet)
    packet_product["research_only"] = False
    packet_product["product_promotion_engine"] = ENGINE_VERSION

    return {
        "available": True,
        "engine": ENGINE_VERSION,
        "explicit_promotion": True,
        "audit_engine": audit.get("engine"),
        "lagna": lagna,
        "ai_safe_packet_product": packet_product,
        "promotion_gate": {
            "numeric_lagna_product_allowed": True,
            "descriptive_house_context_allowed": True,
            "gemini_descriptive_packet_allowed": True,
            "school_policy_allowed": False,
            "exception_application_allowed": False,
            "net_valence_allowed": False,
            "final_good_bad_judgement_allowed": False,
            "predictive_interpretation_allowed": False,
            "event_judgement_allowed": False,
            "timing_prediction_allowed": False,
            "probability_allowed": False,
            "scores_allowed": False,
        },
        "policy": "Explicitly promote validated numeric Lagna and sanitized descriptive house context only. Predictive Thai interpretation and school-variant exception application remain blocked.",
    }
