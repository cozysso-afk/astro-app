# -*- coding: utf-8 -*-
"""Research-only non-predictive Thai descriptive synthesis.

Phase 2-F2 is the first compositional semantic layer. It combines only claims
whose components have already passed separate validation:
- source-house topic domains;
- the house-lord as the carrier of those topics;
- the destination-house context;
- conservative basic-status functional direction;
- planet archetype domains;
- validated sign-relation names and multi-label pair classes as context tags.

This is NOT a final horoscope judgement. Advanced-standard meanings, aspect
strength, pair net valence, event outcomes, timing, probabilities and scores
remain intentionally unresolved.
"""

from __future__ import annotations

from typing import Any, Mapping

ENGINE_VERSION = "thai-descriptive-synthesis-research-v1.0-nonpredictive"


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _rows(value: Any) -> list[Mapping[str, Any]]:
    return [row for row in value if isinstance(row, Mapping)] if isinstance(value, list) else []


def build_descriptive_synthesis_research(
    *,
    context_graph_research: Mapping[str, Any] | None,
    planet_pairs_research: Mapping[str, Any] | None,
) -> dict[str, Any]:
    graph = _mapping(context_graph_research)
    pair_layer = _mapping(planet_pairs_research)
    archetypes = _mapping(pair_layer.get("planet_archetypes"))

    if not graph.get("available"):
        return {
            "available": False,
            "research_only": True,
            "engine": ENGINE_VERSION,
            "reason": "A validated contextual evidence graph is required before descriptive synthesis can be built.",
            "route_descriptions": [],
            "promotion_gate": {
                "descriptive_composition_validated": False,
                "net_valence_allowed": False,
                "final_interpretation_allowed": False,
                "event_judgement_allowed": False,
                "scores_allowed": False,
                "gemini_interpretation_allowed": False,
            },
        }

    descriptions: list[dict[str, Any]] = []
    for route in _rows(graph.get("route_contexts")):
        source = _mapping(route.get("source_house"))
        lord = _mapping(route.get("lord_planet"))
        destination = _mapping(route.get("destination_house"))
        evidence = _mapping(route.get("evidence"))
        conflicts = _mapping(route.get("conflict_register"))
        lord_key = str(lord.get("key") or "")
        archetype = _mapping(archetypes.get(lord_key))

        status_modifiers = []
        for row in _rows(evidence.get("basic_status_semantics")):
            status_modifiers.append({
                "status_key": row.get("status_key"),
                "thai": row.get("thai"),
                "functional_direction": row.get("functional_direction"),
                "scope": "lord_function_only_not_event_outcome",
            })

        relation_tags = []
        for row in _rows(evidence.get("planet_relations")):
            relation = _mapping(row.get("relation"))
            pair_classes = []
            for pair in _rows(row.get("pair_classifications")):
                pair_classes.append({
                    "key": pair.get("key"),
                    "thai": pair.get("thai"),
                    "functional_domain": pair.get("functional_domain"),
                    "valence": "context_dependent",
                })
            relation_tags.append({
                "counterpart_planet": row.get("counterpart_planet"),
                "relation_key": relation.get("key"),
                "relation_thai": relation.get("thai"),
                "pair_classes": pair_classes,
                "pair_multi_label": bool(row.get("pair_multi_label")),
                "strength_percent": None,
                "net_effect": None,
            })

        descriptions.append({
            "route_key": route.get("route_key"),
            "composition": {
                "source_topic_domains": list(source.get("domains") or []),
                "carrier_planet": {
                    "key": lord_key,
                    "number": lord.get("number"),
                    "archetype_domains": list(archetype.get("domains") or []),
                },
                "destination_context_domains": list(destination.get("domains") or []),
                "basic_status_modifiers": status_modifiers,
                "relation_context_tags": relation_tags,
            },
            "allowed_descriptive_claim": {
                "schema": "source topic is carried by its lord into the destination-house context; validated status/relation tags may qualify context without deciding outcome",
                "interpretation_level": "descriptive_nonpredictive",
            },
            "unresolved": {
                "advanced_standard_keys": list(evidence.get("advanced_standard_keys") or []),
                "advanced_standard_meaning": None,
                "aspect_strength": None,
                "pair_net_valence": None,
                "combined_good_bad_judgement": None,
                "event_outcome": None,
                "timing": None,
                "probability": None,
                "score": None,
                "conflicts_preserved": dict(conflicts),
            },
            "final_interpretation": None,
            "prediction": None,
            "score": None,
        })

    descriptions.sort(key=lambda row: int(str(row.get("route_key") or "H0").split(":", 1)[0].replace("H", "") or 0))
    return {
        "available": True,
        "research_only": True,
        "engine": ENGINE_VERSION,
        "mode": "structured descriptive semantics; non-predictive",
        "route_descriptions": descriptions,
        "source_consensus": {
            "composition_order": "source house/lord/destination first; dignity and relationships qualify context",
            "single_factor_rule": "no single placement, dignity or pair class is sufficient for final judgement",
            "allowed_basic_status_use": "functional strength/stability direction only",
            "allowed_relation_use": "relationship/context tag only; no canonical strength or net valence",
        },
        "promotion_gate": {
            "descriptive_composition_validated": True,
            "planet_archetype_context_validated": True,
            "basic_status_modifier_validated": True,
            "relation_tag_composition_validated": True,
            "pair_multilabel_preservation_validated": True,
            "advanced_standard_meaning_allowed": False,
            "aspect_strength_allowed": False,
            "pair_net_valence_allowed": False,
            "net_valence_allowed": False,
            "final_interpretation_allowed": False,
            "event_judgement_allowed": False,
            "timing_prediction_allowed": False,
            "probability_allowed": False,
            "scores_allowed": False,
            "gemini_interpretation_allowed": False,
        },
        "policy": "Compose validated semantic components only. Descriptive structure is allowed in research; outcome prediction and net good/bad judgement remain blocked.",
    }
