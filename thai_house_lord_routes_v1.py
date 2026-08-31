# -*- coding: utf-8 -*-
"""Research-only Thai house-lord route structure.

Phase 2-E2 encodes the repeatedly documented Thai reading order:
1) identify the source house/topic;
2) identify that house's lord (เจ้าเรือน);
3) locate the lord in its destination house;
4) only later consider dignity, relations, and other context before judgement.

This module deliberately stops before step 4 becomes interpretation. It models
source_house -> lord_planet -> destination_house as a factual route and keeps
all source houses separate when one planet rules more than one sign/house.

No good/bad sentence, event, probability, net score, or Gemini permission is
produced here.
"""

from __future__ import annotations

from typing import Any, Mapping

from thai_semantics_v1 import house_semantics

ENGINE_VERSION = "thai-house-lord-routes-research-v1.0"


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def build_house_lord_routes_research(
    *,
    houses_research: Mapping[str, Any] | None,
    house_lords_research: Mapping[str, Any] | None,
    dignities_research: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    houses = _mapping(houses_research)
    lords = _mapping(house_lords_research)
    dignities = _mapping(dignities_research)

    if not houses.get("available"):
        return {
            "available": False,
            "research_only": True,
            "engine": ENGINE_VERSION,
            "reason": "Validated whole-sign house research is required before house-lord routes can be built.",
            "routes": [],
            "promotion_gate": {
                "route_structure_validated": False,
                "route_interpretation_allowed": False,
                "combined_judgement_allowed": False,
                "event_judgement_allowed": False,
                "gemini_interpretation_allowed": False,
            },
        }
    if not lords.get("available"):
        return {
            "available": False,
            "research_only": True,
            "engine": ENGINE_VERSION,
            "reason": "House-lord facts are required before house-lord routes can be built.",
            "routes": [],
            "promotion_gate": {
                "route_structure_validated": False,
                "route_interpretation_allowed": False,
                "combined_judgement_allowed": False,
                "event_judgement_allowed": False,
                "gemini_interpretation_allowed": False,
            },
        }

    house_rows = {
        int(row.get("house_number")): row
        for row in houses.get("houses") or []
        if isinstance(row, Mapping) and row.get("house_number") is not None
    }
    placements = _mapping(houses.get("planet_placements"))
    dignity_planets = _mapping(dignities.get("planets"))

    routes: list[dict[str, Any]] = []
    for lord_row in lords.get("houses") or []:
        if not isinstance(lord_row, Mapping):
            continue
        source_number = int(lord_row.get("house_number") or 0)
        if not 1 <= source_number <= 12:
            raise ValueError("house-lord route source house must be within 1..12")
        source_house = _mapping(house_rows.get(source_number))
        lord = _mapping(lord_row.get("lord"))
        lord_key = str(lord.get("key") or "")
        placement = _mapping(placements.get(lord_key))
        destination_number = int(placement.get("house_number") or 0)
        if not 1 <= destination_number <= 12:
            raise ValueError(f"missing valid destination house for lord {lord_key!r}")
        destination_house = _mapping(house_rows.get(destination_number))

        dignity = _mapping(dignity_planets.get(lord_key))
        statuses = [
            str(row.get("key"))
            for row in dignity.get("statuses") or []
            if isinstance(row, Mapping) and row.get("key")
        ]
        advanced = [
            str(row.get("key"))
            for row in dignity.get("advanced_standards") or []
            if isinstance(row, Mapping) and row.get("key")
        ]

        source_semantics = house_semantics(source_number)
        destination_semantics = house_semantics(destination_number)
        routes.append({
            "source_house": {
                "house_number": source_number,
                "house_name_key": source_house.get("house_name_key") or source_semantics["house_name_key"],
                "house_name_thai": source_house.get("house_name_thai") or source_semantics["house_name_thai"],
                "sign_index": source_house.get("sign_index"),
                "domains": source_semantics["domains"],
                "reading_role": "subject_domain_carried_by_house_lord",
            },
            "lord_planet": {
                "key": lord_key,
                "number": lord.get("number"),
                "thai_name": lord.get("thai_name"),
                "source_sign_index": _mapping(lord.get("sign")).get("sign_index"),
            },
            "destination_house": {
                "house_number": destination_number,
                "house_name_key": destination_house.get("house_name_key") or destination_semantics["house_name_key"],
                "house_name_thai": destination_house.get("house_name_thai") or destination_semantics["house_name_thai"],
                "sign_index": destination_house.get("sign_index"),
                "domains": destination_semantics["domains"],
                "reading_role": "placement_context_or_modifier",
            },
            "lord_position_context": {
                "longitude_deg": placement.get("longitude_deg"),
                "basic_status_keys": statuses,
                "advanced_standard_keys": advanced,
                "status_judgement": None,
            },
            "route_key": f"H{source_number}:{lord_key}->H{destination_number}",
            "interpretation": None,
            "combined_judgement": None,
            "prediction": None,
            "score": None,
        })

    return {
        "available": True,
        "research_only": True,
        "engine": ENGINE_VERSION,
        "method": "source house as topic -> its house lord -> destination house as placement context",
        "routes": routes,
        "source_consensus": {
            "reading_order": "house topic first, then house lord, then destination house",
            "single_position_warning": "do not judge from a floating planet or destination house alone",
            "context_required_before_judgement": [
                "lord dignity/status",
                "planet relationships/aspects",
                "other planets participating in the house/topic",
                "school-specific predictive rules",
            ],
        },
        "promotion_gate": {
            "route_structure_validated": True,
            "source_and_destination_domains_validated": True,
            "dignity_context_attached_as_facts": True,
            "route_interpretation_allowed": False,
            "dignity_net_valence_allowed": False,
            "pair_or_aspect_synthesis_allowed": False,
            "combined_judgement_allowed": False,
            "event_judgement_allowed": False,
            "scores_allowed": False,
            "gemini_interpretation_allowed": False,
        },
        "policy": "House-lord routes are structural facts only. Do not turn source->lord->destination into a concrete good/bad outcome without a separately validated synthesis rule.",
    }
