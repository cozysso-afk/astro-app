# -*- coding: utf-8 -*-
"""Research-only evidence/consensus registry for Thai interpretation rules.

Phase 2-D2 does not add horoscope predictions. It records which interpretation
claims are sufficiently consistent across independent/public Thai sources and
which are still school-dependent or numerically disputed.

The registry is deliberately machine-readable so later code cannot silently
turn a disputed teaching into a single hard-coded score.
"""

from __future__ import annotations

from typing import Any

ENGINE_VERSION = "thai-interpretation-policy-research-v1.0-consensus-registry"

CONSENSUS = {
    "house_domains": {
        "status": "validated_conservative_overlap",
        "allowed_use": "neutral_topic_domain_only",
        "numeric_score_allowed": False,
        "event_claim_allowed": False,
        "note": "Traditional 12-house topic domains overlap across references, but concrete outcomes still require contextual synthesis.",
    },
    "basic_status_direction": {
        "status": "validated_broad_direction",
        "allowed_use": "functional_direction_only",
        "numeric_score_allowed": False,
        "event_claim_allowed": False,
        "claims": {
            "kaset": "stable_or_complete_function",
            "ucca": "elevated_or_strong_function",
            "pra": "reduced_or_less_stable_function",
            "nicha": "weakened_or_reduced_power",
        },
    },
    "advanced_standards": {
        "status": "meaning_variance_not_promoted",
        "allowed_use": "position_fact_only",
        "numeric_score_allowed": False,
        "event_claim_allowed": False,
        "claims": {
            "rachayok": {
                "consensus_level": "moderate",
                "common_theme": "support_opportunity_status_or_easier_gain",
                "promoted_to_interpretation": False,
            },
            "mahachak": {
                "consensus_level": "moderate",
                "common_theme": "drive_scale_and_success_through_effort_or_obstacles",
                "promoted_to_interpretation": False,
            },
            "thewiyok": {
                "consensus_level": "low_school_variance",
                "common_theme": None,
                "promoted_to_interpretation": False,
            },
            "julachak": {
                "consensus_level": "low_school_variance",
                "common_theme": None,
                "promoted_to_interpretation": False,
            },
        },
        "note": "Rachayok/Mahachak themes recur, but application strength and counterpart standards vary by school. No ranking is promoted.",
    },
    "aspect_geometry": {
        "status": "validated_geometry",
        "allowed_use": "relation_name_and_sign_geometry_only",
        "numeric_score_allowed": False,
        "event_claim_allowed": False,
        "relations": ("kum", "leng", "yok", "trikona"),
    },
    "aspect_strength": {
        "status": "numeric_conflict_blocked",
        "allowed_use": "none",
        "numeric_score_allowed": False,
        "event_claim_allowed": False,
        "observed_source_examples": {
            "source_a": {"kum": 100, "leng": 70, "trikona": 50, "yok": 30},
            "source_b": {"kum": 100, "leng": 80, "trikona": 50, "yok": 60},
        },
        "note": "Published teaching examples disagree materially, especially Leng and Yok; no percentage is canonicalized.",
    },
    "aspect_meaning": {
        "status": "partial_consensus_not_promoted",
        "allowed_use": "none",
        "numeric_score_allowed": False,
        "event_claim_allowed": False,
        "note": "Some sources call Yok/Trikona supportive, but actual result depends on planet quality, pair relationship and houses. No pair meaning is promoted yet.",
    },
    "combined_judgement": {
        "status": "blocked_requires_context_model",
        "allowed_use": "none",
        "numeric_score_allowed": False,
        "event_claim_allowed": False,
        "required_context": (
            "planet_nature_and_meaning",
            "house_lordship",
            "occupied_house",
            "basic_and_advanced_statuses",
            "planet_pair_relationships",
            "aspect_relations",
            "natal_vs_transit_role",
            "school_policy",
        ),
    },
}


def consensus_for(rule_key: str) -> dict[str, Any]:
    key = str(rule_key)
    if key not in CONSENSUS:
        raise KeyError(key)
    # Return a shallow structural copy; nested values are treated as constants.
    return {**CONSENSUS[key]}


def build_interpretation_policy_research() -> dict[str, Any]:
    return {
        "available": True,
        "research_only": True,
        "engine": ENGINE_VERSION,
        "rules": {key: consensus_for(key) for key in CONSENSUS},
        "promotion_gate": {
            "neutral_house_domains_allowed_in_research_semantics": True,
            "basic_status_direction_allowed_in_research_semantics": True,
            "advanced_standard_interpretation_allowed": False,
            "aspect_strength_percent_allowed": False,
            "aspect_pair_interpretation_allowed": False,
            "combined_judgement_allowed": False,
            "scores_allowed": False,
            "event_judgement_allowed": False,
            "gemini_interpretation_allowed": False,
        },
        "policy": "When sources disagree, preserve the disagreement. Do not average, rank, or convert disputed rules into a hidden score.",
    }
