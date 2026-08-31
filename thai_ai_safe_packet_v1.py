# -*- coding: utf-8 -*-
"""Research-only AI-safe packet builder for validated Thai descriptive semantics.

The packet is deliberately narrower than the descriptive synthesis layer. It
removes unresolved fields, scores, predictions, final judgements, school-policy
exceptions and source-conflict internals. Even a clean packet is NOT eligible
for Gemini until the product Lagna dependency is explicitly promoted.
"""

from __future__ import annotations

from typing import Any, Mapping

ENGINE_VERSION = "thai-ai-safe-packet-research-v1.0-lagna-gated"


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _rows(value: Any) -> list[Mapping[str, Any]]:
    return [row for row in value if isinstance(row, Mapping)] if isinstance(value, list) else []


def _compact_route(row: Mapping[str, Any]) -> dict[str, Any]:
    composition = _mapping(row.get("composition"))
    carrier = _mapping(composition.get("carrier_planet"))
    modifiers = []
    for item in _rows(composition.get("basic_status_modifiers")):
        modifiers.append({
            "status_key": item.get("status_key"),
            "functional_direction": item.get("functional_direction"),
        })
    relations = []
    for item in _rows(composition.get("relation_context_tags")):
        pair_classes = []
        for pair in _rows(item.get("pair_classes")):
            pair_classes.append({
                "key": pair.get("key"),
                "functional_domain": pair.get("functional_domain"),
            })
        relations.append({
            "counterpart_planet": item.get("counterpart_planet"),
            "relation_key": item.get("relation_key"),
            "pair_classes": pair_classes,
            "pair_multi_label": bool(item.get("pair_multi_label")),
        })
    return {
        "route_key": row.get("route_key"),
        "source_topic_domains": list(composition.get("source_topic_domains") or []),
        "carrier_planet": {
            "key": carrier.get("key"),
            "archetype_domains": list(carrier.get("archetype_domains") or []),
        },
        "destination_context_domains": list(composition.get("destination_context_domains") or []),
        "basic_status_modifiers": modifiers,
        "relation_context_tags": relations,
        "interpretation_level": "descriptive_nonpredictive",
    }


def build_ai_safe_packet_research(
    *,
    descriptive_synthesis_research: Mapping[str, Any] | None,
    lagna_product_available: bool,
) -> dict[str, Any]:
    synthesis = _mapping(descriptive_synthesis_research)
    gate = _mapping(synthesis.get("promotion_gate"))
    descriptive_validated = bool(
        synthesis.get("available")
        and gate.get("descriptive_composition_validated") is True
        and gate.get("planet_archetype_context_validated") is True
        and gate.get("basic_status_modifier_validated") is True
        and gate.get("relation_tag_composition_validated") is True
        and gate.get("pair_multilabel_preservation_validated") is True
    )

    routes = [_compact_route(row) for row in _rows(synthesis.get("route_descriptions"))] if descriptive_validated else []
    clean_contract = all(
        all(forbidden not in route for forbidden in ("unresolved", "final_interpretation", "prediction", "score"))
        for route in routes
    )
    lagna_dependency_satisfied = bool(lagna_product_available)
    eligible_for_gemini = bool(descriptive_validated and clean_contract and lagna_dependency_satisfied)

    return {
        "available": descriptive_validated,
        "research_only": True,
        "engine": ENGINE_VERSION,
        "routes": routes,
        "route_count": len(routes),
        "sanitization": {
            "whitelist_only": True,
            "unresolved_removed": True,
            "final_interpretation_removed": True,
            "prediction_removed": True,
            "score_removed": True,
            "school_policy_removed": True,
            "dignity_exception_candidates_removed": True,
            "raw_conflict_register_removed": True,
        },
        "dependencies": {
            "descriptive_composition_validated": descriptive_validated,
            "lagna_product_available": lagna_dependency_satisfied,
        },
        "eligible_for_gemini": eligible_for_gemini,
        "blocked_reason": None if eligible_for_gemini else (
            "Suriyayat Lagna is not yet promoted for product interpretation."
            if descriptive_validated and not lagna_dependency_satisfied
            else "Validated descriptive synthesis is not available."
        ),
        "promotion_gate": {
            "ai_safe_whitelist_validated": bool(descriptive_validated and clean_contract),
            "lagna_dependency_satisfied": lagna_dependency_satisfied,
            "gemini_interpretation_allowed": eligible_for_gemini,
            "school_policy_allowed": False,
            "exception_application_allowed": False,
            "net_valence_allowed": False,
            "final_good_bad_judgement_allowed": False,
            "event_judgement_allowed": False,
            "timing_prediction_allowed": False,
            "probability_allowed": False,
            "scores_allowed": False,
        },
        "policy": "Only sanitized descriptive semantics may ever enter Gemini, and only after the product Lagna dependency is explicitly promoted. No exception-school projection, net valence, event, timing, probability or score is included.",
    }
