# -*- coding: utf-8 -*-
"""Research-only Thai dignity exception candidate registry.

Traditional Thai teaching sources document several exception rules on top of
basic Kaset/Pra/Ucca/Nicha tables. The rules are not universally applied in the
same way across schools, so this module DETECTS candidate conditions without
rewriting the base dignity result.

Candidate rules represented here:
1. Pra + Pra in opposition -> some schools treat both as Kaset.
2. Nicha + Nicha in opposition -> some schools treat both as Ucca.
3. Reciprocal exchange of each other's Kaset signs -> some schools treat both
   as Kaset (เกษตรแลกเรือน / สลับเรือน).
4. Pra or Nicha occupying Ari/Marana/Vinasa (houses 6/8/12) -> some schools
   describe a reversal/mitigation principle.

No candidate rule is automatically applied. Advanced-standard combination,
final benefic/malefic judgement, prediction, score and Gemini use remain closed.
"""

from __future__ import annotations

import itertools
from typing import Any, Mapping

ENGINE_VERSION = "thai-dignity-exception-research-v1.0-candidate-only"
DUSTHANA_HOUSES = frozenset((6, 8, 12))

RULE_REGISTRY = {
    "pra_opposition_to_kaset": {
        "thai_rule": "ประกับประเล็งกันกลับเป็นเกษตร",
        "condition": "two planets each have Pra status and form validated Thai Leng relation",
        "candidate_effect": "kaset_like_in_supporting_school",
        "support_status": "repeated_in_multiple_thai_teaching_sources",
        "school_variance": True,
        "auto_apply": False,
    },
    "nicha_opposition_to_ucca": {
        "thai_rule": "นิจกับนิจเล็งกันกลับเป็นอุจ",
        "condition": "two planets each have Nicha status and form validated Thai Leng relation",
        "candidate_effect": "ucca_like_in_supporting_school",
        "support_status": "repeated_in_multiple_thai_teaching_sources",
        "school_variance": True,
        "auto_apply": False,
    },
    "reciprocal_kaset_exchange": {
        "thai_rule": "ดาวสลับเรือนเกษตรกัน / เกษตรแลกเรือน",
        "condition": "planet A occupies a sign ruled by B while B occupies a sign ruled by A",
        "candidate_effect": "kaset_like_exchange_in_supporting_school",
        "support_status": "repeated_in_teaching_sources_and_dictionary_definition",
        "school_variance": True,
        "auto_apply": False,
    },
    "pra_nicha_dusthana_reversal": {
        "thai_rule": "ประหรือนิจอยู่เรือนอริ มรณะ วินาศอาจกลับให้คุณ",
        "condition": "planet has Pra or Nicha status and occupies house 6, 8 or 12",
        "candidate_effect": "reversal_or_mitigation_in_supporting_school",
        "support_status": "documented_in_thai_exception_teaching_sources",
        "school_variance": True,
        "auto_apply": False,
    },
    "standard_relation_amplification": {
        "thai_rule": "ดาวได้มาตรฐานสัมพันธ์ตรีโกณหรือเล็งกันอาจให้ผลแรง",
        "condition": "two standard-position planets form Trikona or Leng relation",
        "candidate_effect": "amplification_claim_requires_school_policy",
        "support_status": "documented_but_interpretive_and_school_dependent",
        "school_variance": True,
        "auto_apply": False,
        "machine_detection_enabled": False,
        "reason_not_detected": "which standards qualify and how to rank mixed standards require a promoted school policy",
    },
    "thewiyok_julachak_lagna_full_effect": {
        "thai_rule": "เทวีโชคหรือจุลจักรให้คุณเต็มที่เมื่อกุมลัคนาในบางตำรา",
        "condition": "advanced-standard planet exactly conjuncts Lagna under the supporting rule",
        "candidate_effect": "full_effect_claim_requires_exact_conjunction_and_school_policy",
        "support_status": "documented_but_school_dependent",
        "school_variance": True,
        "auto_apply": False,
        "machine_detection_enabled": False,
        "reason_not_detected": "whole-sign house membership is not an exact Lagna conjunction",
    },
}


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _rows(value: Any) -> list[Mapping[str, Any]]:
    return [row for row in value if isinstance(row, Mapping)] if isinstance(value, list) else []


def _status_keys(planet_row: Mapping[str, Any]) -> set[str]:
    return {str(row.get("key")) for row in _rows(planet_row.get("statuses")) if row.get("key")}


def _advanced_keys(planet_row: Mapping[str, Any]) -> set[str]:
    return {str(row.get("key")) for row in _rows(planet_row.get("advanced_standards")) if row.get("key")}


def _relation_pairs(aspects_research: Mapping[str, Any]) -> dict[frozenset[str], str]:
    result: dict[frozenset[str], str] = {}
    for row in _rows(aspects_research.get("relations")):
        first = str(row.get("first") or "")
        second = str(row.get("second") or "")
        relation = _mapping(row.get("relation"))
        key = str(relation.get("key") or "")
        if first and second and key:
            result[frozenset((first, second))] = key
    return result


def _candidate(rule_key: str, *, planets: list[str], evidence: dict[str, Any]) -> dict[str, Any]:
    rule = RULE_REGISTRY[rule_key]
    return {
        "rule_key": rule_key,
        "thai_rule": rule["thai_rule"],
        "planets": planets,
        "evidence": evidence,
        "candidate_effect": rule["candidate_effect"],
        "support_status": rule["support_status"],
        "school_variance": bool(rule["school_variance"]),
        "detected": True,
        "applied": False,
        "base_status_overridden": False,
        "replacement_status": None,
        "net_valence": None,
        "prediction": None,
        "score": None,
    }


def build_dignity_exception_research(
    *,
    dignities_research: Mapping[str, Any] | None,
    aspects_research: Mapping[str, Any] | None,
    houses_research: Mapping[str, Any] | None,
) -> dict[str, Any]:
    dignities = _mapping(dignities_research)
    aspects = _mapping(aspects_research)
    houses = _mapping(houses_research)
    planets = _mapping(dignities.get("planets"))

    if not dignities.get("available"):
        return {
            "available": False,
            "research_only": True,
            "engine": ENGINE_VERSION,
            "reason": "Validated dignity-table facts are required before exception candidates can be detected.",
            "registry": RULE_REGISTRY,
            "candidates": [],
            "promotion_gate": {
                "candidate_detection_validated": False,
                "exception_application_allowed": False,
                "base_status_rewrite_allowed": False,
                "final_interpretation_allowed": False,
                "gemini_interpretation_allowed": False,
            },
        }

    supported = {
        str(key): row for key, row in planets.items()
        if isinstance(row, Mapping) and row.get("supported") is True
    }
    relations = _relation_pairs(aspects)
    candidates: list[dict[str, Any]] = []

    # Pra/Pra and Nicha/Nicha opposition candidates.
    for first, second in itertools.combinations(sorted(supported), 2):
        relation = relations.get(frozenset((first, second)))
        if relation != "leng":
            continue
        first_status = _status_keys(supported[first])
        second_status = _status_keys(supported[second])
        if "pra" in first_status and "pra" in second_status:
            candidates.append(_candidate(
                "pra_opposition_to_kaset",
                planets=[first, second],
                evidence={"relation": "leng", "first_status": "pra", "second_status": "pra"},
            ))
        if "nicha" in first_status and "nicha" in second_status:
            candidates.append(_candidate(
                "nicha_opposition_to_ucca",
                planets=[first, second],
                evidence={"relation": "leng", "first_status": "nicha", "second_status": "nicha"},
            ))

    # Reciprocal occupation of each other's ruled/Kaset signs.
    for first, second in itertools.combinations(sorted(supported), 2):
        first_lord = str(_mapping(supported[first].get("sign_lord")).get("key") or "")
        second_lord = str(_mapping(supported[second].get("sign_lord")).get("key") or "")
        if first_lord == second and second_lord == first:
            candidates.append(_candidate(
                "reciprocal_kaset_exchange",
                planets=[first, second],
                evidence={
                    "first_current_sign_lord": first_lord,
                    "second_current_sign_lord": second_lord,
                    "reciprocal": True,
                },
            ))

    # Pra/Nicha in houses 6/8/12. Requires the validated whole-sign research layer.
    placements = _mapping(houses.get("planet_placements")) if houses.get("available") else {}
    for planet_key in sorted(supported):
        statuses = _status_keys(supported[planet_key])
        weak_statuses = sorted(statuses.intersection(("pra", "nicha")))
        if not weak_statuses:
            continue
        placement = _mapping(placements.get(planet_key))
        house_number = int(placement.get("house_number") or 0)
        if house_number in DUSTHANA_HOUSES:
            candidates.append(_candidate(
                "pra_nicha_dusthana_reversal",
                planets=[planet_key],
                evidence={"statuses": weak_statuses, "house_number": house_number},
            ))

    # Preserve deterministic order without assigning priority/strength.
    candidates.sort(key=lambda row: (str(row["rule_key"]), tuple(row["planets"])))

    return {
        "available": True,
        "research_only": True,
        "engine": ENGINE_VERSION,
        "registry": RULE_REGISTRY,
        "candidates": candidates,
        "candidate_count": len(candidates),
        "base_dignities_unchanged": True,
        "school_policy": {
            "required": True,
            "selected_school": None,
            "default_application": "none",
            "reason": "exception rules are documented but their scope and interpretation vary by school and source",
        },
        "promotion_gate": {
            "candidate_detection_validated": True,
            "source_variance_preserved": True,
            "reciprocal_exchange_definition_validated": True,
            "opposition_exception_conditions_validated": True,
            "dusthana_exception_condition_documented": True,
            "exception_application_allowed": False,
            "base_status_rewrite_allowed": False,
            "advanced_standard_exception_application_allowed": False,
            "net_valence_allowed": False,
            "final_interpretation_allowed": False,
            "event_judgement_allowed": False,
            "scores_allowed": False,
            "gemini_interpretation_allowed": False,
        },
        "policy": "Detect documented exception candidates only. Never overwrite Kaset/Pra/Ucca/Nicha facts until an explicit school policy and interpretation gate are promoted.",
    }
