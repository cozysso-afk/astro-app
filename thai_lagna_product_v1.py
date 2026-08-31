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
from typing import Any, Mapping

from thai_ai_safe_packet_v1 import build_ai_safe_packet_research

ENGINE_VERSION = "thai-lagna-product-promotion-v1.0-descriptive-only"
SELECTED_METHOD_KEY = "common_anto_0600_lmt"


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


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
    try:
        longitude = float(candidate.get("longitude_deg"))
        sign_index = int(candidate.get("sign_index"))
    except (TypeError, ValueError):
        return _blocked("Selected Lagna candidate has invalid numeric position fields.")
    if not math.isfinite(longitude) or not (0.0 <= longitude < 360.0) or not (0 <= sign_index <= 11):
        return _blocked("Selected Lagna candidate is outside valid zodiac bounds.")

    packet = build_ai_safe_packet_research(
        descriptive_synthesis_research=descriptive_synthesis_research,
        lagna_product_available=True,
    )
    if not (
        packet.get("available") is True
        and packet.get("eligible_for_gemini") is True
        and _mapping(packet.get("promotion_gate")).get("gemini_interpretation_allowed") is True
        and int(packet.get("route_count") or 0) == 12
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
        "interpretation_scope": "descriptive_nonpredictive_house_context_only",
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
