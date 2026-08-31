# -*- coding: utf-8 -*-
"""Research-only promotion audit for Thai Suriyayat Lagna product exposure.

This module does not promote anything. It aggregates the validation state of
Lagna, whole-sign houses, dignity/aspect facts, descriptive synthesis, source
policy safety and the AI-safe packet so a later product change cannot silently
skip a prerequisite.
"""

from __future__ import annotations

from typing import Any, Mapping

ENGINE_VERSION = "thai-lagna-product-promotion-audit-v1.0"


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def build_lagna_promotion_audit(
    *,
    lagna_research: Mapping[str, Any] | None,
    houses_research: Mapping[str, Any] | None,
    dignities_research: Mapping[str, Any] | None,
    aspects_research: Mapping[str, Any] | None,
    descriptive_synthesis_research: Mapping[str, Any] | None,
    school_policy_research: Mapping[str, Any] | None,
    ai_safe_packet_research: Mapping[str, Any] | None,
) -> dict[str, Any]:
    lagna = _mapping(lagna_research)
    houses = _mapping(houses_research)
    dignities = _mapping(dignities_research)
    aspects = _mapping(aspects_research)
    synthesis = _mapping(descriptive_synthesis_research)
    school = _mapping(school_policy_research)
    packet = _mapping(ai_safe_packet_research)

    lagna_validation = _mapping(lagna.get("validation"))
    lagna_gate = _mapping(lagna.get("promotion_gate"))
    house_gate = _mapping(houses.get("promotion_gate"))
    dignity_gate = _mapping(dignities.get("promotion_gate"))
    aspect_gate = _mapping(aspects.get("promotion_gate"))
    synthesis_gate = _mapping(synthesis.get("promotion_gate"))
    school_gate = _mapping(school.get("promotion_gate"))
    packet_gate = _mapping(packet.get("promotion_gate"))

    checks = {
        "lagna_research_available": lagna.get("available") is True,
        "lagna_numeric_position_validated": lagna_gate.get("lagna_numeric_position_validated") is True,
        "global_coordinates_compute_supported": lagna_validation.get("global_coordinates_compute_supported") is True,
        "global_coordinates_independently_validated": lagna_validation.get("global_coordinates_independently_validated") is True,
        "world_reference_has_numeric_checks": int(_mapping(lagna_validation.get("world_reference")).get("numeric_checks") or 0) >= 16,
        "whole_sign_houses_available": houses.get("available") is True,
        "whole_sign_structure_documented": house_gate.get("house_structure_rule_documented") is True,
        "house_name_labels_validated": house_gate.get("house_name_labels_validated") is True,
        "dignity_table_facts_validated": dignity_gate.get("table_facts_validated") is True,
        "advanced_standard_table_facts_validated": dignity_gate.get("advanced_standard_table_facts_validated") is True,
        "thai_sign_aspect_geometry_documented": aspect_gate.get("sign_geometry_rule_documented") is True,
        "descriptive_composition_validated": synthesis_gate.get("descriptive_composition_validated") is True,
        "planet_archetype_context_validated": synthesis_gate.get("planet_archetype_context_validated") is True,
        "basic_status_modifier_validated": synthesis_gate.get("basic_status_modifier_validated") is True,
        "relation_tag_composition_validated": synthesis_gate.get("relation_tag_composition_validated") is True,
        "pair_multilabel_preservation_validated": synthesis_gate.get("pair_multilabel_preservation_validated") is True,
        "source_policy_default_none": school.get("default_profile") == "none" and school.get("selected_profile") == "none",
        "source_policy_never_mutates_base": school.get("base_dignities_mutated") is False and int(school.get("actual_engine_exception_application_count") or 0) == 0,
        "production_school_selection_still_blocked": school_gate.get("production_school_selection_allowed") is False,
        "ai_safe_whitelist_validated": packet_gate.get("ai_safe_whitelist_validated") is True,
        "ai_safe_packet_currently_lagna_blocked": packet.get("eligible_for_gemini") is False and packet_gate.get("lagna_dependency_satisfied") is False,
        "event_judgement_still_blocked": synthesis_gate.get("event_judgement_allowed") is False and packet_gate.get("event_judgement_allowed") is False,
        "timing_prediction_still_blocked": synthesis_gate.get("timing_prediction_allowed") is False and packet_gate.get("timing_prediction_allowed") is False,
        "probability_still_blocked": synthesis_gate.get("probability_allowed") is False and packet_gate.get("probability_allowed") is False,
        "scores_still_blocked": synthesis_gate.get("scores_allowed") is False and packet_gate.get("scores_allowed") is False,
        "exception_application_still_blocked": packet_gate.get("exception_application_allowed") is False,
        "net_valence_still_blocked": packet_gate.get("net_valence_allowed") is False,
        "final_good_bad_judgement_still_blocked": packet_gate.get("final_good_bad_judgement_allowed") is False,
    }

    position_ready_keys = (
        "lagna_research_available",
        "lagna_numeric_position_validated",
        "global_coordinates_compute_supported",
        "global_coordinates_independently_validated",
        "world_reference_has_numeric_checks",
    )
    descriptive_ready_keys = position_ready_keys + (
        "whole_sign_houses_available",
        "whole_sign_structure_documented",
        "house_name_labels_validated",
        "dignity_table_facts_validated",
        "advanced_standard_table_facts_validated",
        "thai_sign_aspect_geometry_documented",
        "descriptive_composition_validated",
        "planet_archetype_context_validated",
        "basic_status_modifier_validated",
        "relation_tag_composition_validated",
        "pair_multilabel_preservation_validated",
        "source_policy_default_none",
        "source_policy_never_mutates_base",
        "production_school_selection_still_blocked",
        "ai_safe_whitelist_validated",
        "ai_safe_packet_currently_lagna_blocked",
        "event_judgement_still_blocked",
        "timing_prediction_still_blocked",
        "probability_still_blocked",
        "scores_still_blocked",
        "exception_application_still_blocked",
        "net_valence_still_blocked",
        "final_good_bad_judgement_still_blocked",
    )

    lagna_position_ready = all(checks[key] for key in position_ready_keys)
    descriptive_product_ready = all(checks[key] for key in descriptive_ready_keys)
    failed = [key for key, passed in checks.items() if not passed]

    return {
        "available": True,
        "research_only": True,
        "engine": ENGINE_VERSION,
        "checks": checks,
        "failed_checks": failed,
        "lagna_position_product_promotion_ready": lagna_position_ready,
        "descriptive_house_context_product_promotion_ready": descriptive_product_ready,
        "ai_safe_packet_ready_after_explicit_lagna_promotion": descriptive_product_ready,
        "automatic_promotion_allowed": False,
        "product_state_changed": False,
        "promotion_gate": {
            "audit_complete": True,
            "lagna_position_ready": lagna_position_ready,
            "descriptive_house_context_ready": descriptive_product_ready,
            "ai_safe_packet_ready_after_explicit_lagna_promotion": descriptive_product_ready,
            "automatic_promotion_allowed": False,
            "predictive_interpretation_allowed": False,
            "event_judgement_allowed": False,
            "timing_prediction_allowed": False,
            "probability_allowed": False,
            "scores_allowed": False,
        },
        "policy": "Audit readiness only. A later explicit product-layer change is still required to expose Lagna or allow the sanitized descriptive packet into Gemini; predictive Thai rules remain out of scope.",
    }
