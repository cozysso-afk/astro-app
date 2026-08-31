# -*- coding: utf-8 -*-
"""Research-only Thai contextual evidence graph.

Phase 2-F1 joins already-validated factual layers without producing a horoscope
judgement. Each house-lord route is enriched with:
- the source house/topic and destination house;
- the lord's basic status semantics and advanced-standard position facts;
- co-occupying planets in the destination house;
- validated Thai sign relations involving the lord;
- any overlapping traditional pair classes for the related planet pair.

The graph preserves contradictions and school variance. It never collapses
signals into a net benefic/malefic label, numeric strength, event prediction,
or Gemini-ready interpretation.
"""

from __future__ import annotations

from typing import Any, Mapping

ENGINE_VERSION = "thai-context-graph-research-v1.0-evidence-only"


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _list_of_mappings(value: Any) -> list[Mapping[str, Any]]:
    if not isinstance(value, list):
        return []
    return [row for row in value if isinstance(row, Mapping)]


def _pair_key(first: str, second: str) -> frozenset[str]:
    return frozenset((str(first), str(second)))


def build_context_graph_research(
    *,
    house_lord_routes_research: Mapping[str, Any] | None,
    houses_research: Mapping[str, Any] | None,
    aspects_research: Mapping[str, Any] | None,
    planet_pairs_research: Mapping[str, Any] | None,
    semantics_research: Mapping[str, Any] | None,
    interpretation_policy_research: Mapping[str, Any] | None,
) -> dict[str, Any]:
    routes_layer = _mapping(house_lord_routes_research)
    houses = _mapping(houses_research)
    aspects = _mapping(aspects_research)
    pairs = _mapping(planet_pairs_research)
    semantics = _mapping(semantics_research)
    policy = _mapping(interpretation_policy_research)

    if not routes_layer.get("available"):
        return {
            "available": False,
            "research_only": True,
            "engine": ENGINE_VERSION,
            "reason": "Validated house-lord route research is required before the contextual graph can be built.",
            "route_contexts": [],
            "promotion_gate": {
                "context_graph_structure_validated": False,
                "net_valence_allowed": False,
                "combined_judgement_allowed": False,
                "scores_allowed": False,
                "event_judgement_allowed": False,
                "gemini_interpretation_allowed": False,
            },
        }

    placements = _mapping(houses.get("planet_placements"))
    semantic_planets = _mapping(semantics.get("planet_status_semantics"))
    policy_rules = _mapping(policy.get("rules"))

    # Index all validated Thai sign relations by participating planet.
    relations_by_planet: dict[str, list[dict[str, Any]]] = {}
    for row in _list_of_mappings(aspects.get("relations")):
        first = str(row.get("first") or "")
        second = str(row.get("second") or "")
        relation = _mapping(row.get("relation"))
        if not first or not second or not relation:
            continue
        base = {
            "first": first,
            "second": second,
            "relation": {
                "key": relation.get("key"),
                "thai": relation.get("thai"),
                "house_counts": list(relation.get("house_counts") or []),
                "basis": relation.get("basis"),
            },
            "exact_longitude_separation_deg": row.get("exact_longitude_separation_deg"),
            "strength_percent": None,
            "pair_meaning": None,
            "prediction": None,
            "score": None,
        }
        relations_by_planet.setdefault(first, []).append(base)
        relations_by_planet.setdefault(second, []).append(base)

    # Pair tags are multi-label and are indexed independently of aspect geometry.
    pair_tags: dict[frozenset[str], dict[str, Any]] = {}
    for row in _list_of_mappings(pairs.get("active_natal_pair_tags")):
        first = str(row.get("first") or "")
        second = str(row.get("second") or "")
        if not first or not second:
            continue
        classes = []
        for item in _list_of_mappings(row.get("classifications")):
            classes.append({
                "key": item.get("key"),
                "thai": item.get("thai"),
                "functional_domain": item.get("functional_domain"),
                "valence": "context_dependent",
            })
        pair_tags[_pair_key(first, second)] = {
            "classifications": classes,
            "multi_label": bool(row.get("multi_label")),
            "net_valence": None,
        }

    occupants_by_house: dict[int, list[str]] = {}
    for planet_key, placement in placements.items():
        if not isinstance(placement, Mapping):
            continue
        house_number = int(placement.get("house_number") or 0)
        if 1 <= house_number <= 12:
            occupants_by_house.setdefault(house_number, []).append(str(planet_key))
    for house_number in occupants_by_house:
        occupants_by_house[house_number].sort()

    route_contexts: list[dict[str, Any]] = []
    for route in _list_of_mappings(routes_layer.get("routes")):
        source = _mapping(route.get("source_house"))
        lord = _mapping(route.get("lord_planet"))
        destination = _mapping(route.get("destination_house"))
        position_context = _mapping(route.get("lord_position_context"))
        lord_key = str(lord.get("key") or "")
        destination_number = int(destination.get("house_number") or 0)

        basic_status_semantics = []
        semantic_row = _mapping(semantic_planets.get(lord_key))
        for status in _list_of_mappings(semantic_row.get("basic_status_semantics")):
            basic_status_semantics.append({
                "status_key": status.get("status_key"),
                "thai": status.get("thai"),
                "functional_direction": status.get("functional_direction"),
                "keywords": list(status.get("keywords") or []),
            })

        relation_contexts: list[dict[str, Any]] = []
        multilabel_overlap = False
        for relation_row in relations_by_planet.get(lord_key, []):
            first = relation_row["first"]
            second = relation_row["second"]
            counterpart = second if first == lord_key else first
            pair = pair_tags.get(_pair_key(lord_key, counterpart), {"classifications": [], "multi_label": False, "net_valence": None})
            multilabel_overlap = multilabel_overlap or bool(pair.get("multi_label"))
            relation_contexts.append({
                "counterpart_planet": counterpart,
                "relation": relation_row["relation"],
                "exact_longitude_separation_deg": relation_row["exact_longitude_separation_deg"],
                "pair_classifications": list(pair.get("classifications") or []),
                "pair_multi_label": bool(pair.get("multi_label")),
                "aspect_strength_percent": None,
                "pair_net_valence": None,
                "combined_effect": None,
                "prediction": None,
                "score": None,
            })
        relation_contexts.sort(key=lambda row: (str(row["counterpart_planet"]), str(_mapping(row["relation"]).get("key") or "")))

        advanced_keys = [str(key) for key in position_context.get("advanced_standard_keys") or []]
        co_occupants = [p for p in occupants_by_house.get(destination_number, []) if p != lord_key]
        route_contexts.append({
            "route_key": route.get("route_key"),
            "source_house": dict(source),
            "lord_planet": dict(lord),
            "destination_house": dict(destination),
            "evidence": {
                "basic_status_semantics": basic_status_semantics,
                "advanced_standard_keys": advanced_keys,
                "co_occupying_planets": co_occupants,
                "planet_relations": relation_contexts,
            },
            "conflict_register": {
                "multi_label_pair_overlap_present": multilabel_overlap,
                "advanced_standard_meaning_unresolved": bool(advanced_keys),
                "aspect_strength_disputed": bool(relation_contexts),
                "net_valence_unresolved": True,
                "school_policy_required": True,
            },
            "net_valence": None,
            "combined_judgement": None,
            "prediction": None,
            "score": None,
        })

    route_contexts.sort(key=lambda row: int(_mapping(row.get("source_house")).get("house_number") or 0))

    aspect_strength_rule = _mapping(policy_rules.get("aspect_strength"))
    combined_rule = _mapping(policy_rules.get("combined_judgement"))
    return {
        "available": True,
        "research_only": True,
        "engine": ENGINE_VERSION,
        "graph_scope": "natal house-lord contextual evidence only",
        "route_contexts": route_contexts,
        "blocked_rule_snapshot": {
            "aspect_strength_status": aspect_strength_rule.get("status"),
            "aspect_strength_canonical_percent": None,
            "combined_judgement_status": combined_rule.get("status"),
            "required_context": list(combined_rule.get("required_context") or []),
        },
        "source_consensus": {
            "reading_sequence": "house lordship and destination are read before combining dignity and planetary relationships",
            "context_rule": "single placement or single dignity is insufficient for a final judgement",
            "conflict_rule": "preserve overlapping pair classes and school/numeric disagreement instead of averaging",
        },
        "promotion_gate": {
            "context_graph_structure_validated": True,
            "route_context_join_validated": True,
            "basic_status_semantics_join_validated": True,
            "aspect_geometry_join_validated": True,
            "pair_multilabel_join_validated": True,
            "advanced_standard_meaning_validated": False,
            "aspect_strength_canonicalized": False,
            "net_valence_allowed": False,
            "combined_judgement_allowed": False,
            "scores_allowed": False,
            "event_judgement_allowed": False,
            "gemini_interpretation_allowed": False,
        },
        "policy": "Evidence graph only. Preserve all context and conflicts; do not average or rank them into a hidden score or concrete prediction.",
    }
