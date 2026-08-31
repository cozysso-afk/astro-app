# -*- coding: utf-8 -*-
"""Research-only Thai source-policy profiles for dignity exceptions.

These are NOT claims that one profile is the canonical Thai school. They encode
contrasting source interpretations so exception candidates can be compared
without silently choosing a doctrine.

Profiles:
- none: production-safe research default; detect only.
- literal_exception: projects the literal replacement wording found in teaching
  sources (Pra/Pra -> Kaset, Nicha/Nicha -> Ucca, reciprocal Kaset exchange ->
  Kaset). Projection never mutates the base dignity table.
- standard_reach_overlay: preserves the natal/base status and adds a secondary
  'standard reach' overlay for supported opposition cases, matching sources
  that explicitly say the original Nicha remains Nicha while receiving Ucca
  at the end of the opposing reach.
- opposition_exchange_caution: records a conflicting single-source rule about
  certain opposition exchanges degrading toward Pra; machine application is
  blocked pending independent corroboration and an exact applicability model.

No profile enables final good/bad judgement, events, timing, probability,
scores, product use, or Gemini interpretation.
"""

from __future__ import annotations

from typing import Any, Mapping

ENGINE_VERSION = "thai-source-policy-research-v1.0-explicit-profiles"
DEFAULT_PROFILE = "none"

PROFILES = {
    "none": {
        "label": "No exception application",
        "evidence_mode": "conservative_default",
        "allowed_rules": (),
        "application_mode": "observe_only",
        "machine_application_allowed": True,
        "source_confidence": "default_safety_policy",
    },
    "literal_exception": {
        "label": "Literal teaching-source exception projection",
        "evidence_mode": "literal_replacement_wording",
        "allowed_rules": (
            "pra_opposition_to_kaset",
            "nicha_opposition_to_ucca",
            "reciprocal_kaset_exchange",
        ),
        "application_mode": "project_secondary_replacement_status",
        "machine_application_allowed": True,
        "source_confidence": "repeated_teaching_source_rule",
    },
    "standard_reach_overlay": {
        "label": "Base status retained with standard-reach overlay",
        "evidence_mode": "non_destructive_standard_reach",
        "allowed_rules": (
            "nicha_opposition_to_ucca",
        ),
        "application_mode": "project_non_destructive_overlay",
        "machine_application_allowed": True,
        "source_confidence": "detailed_explanatory_source",
    },
    "opposition_exchange_caution": {
        "label": "Conflicting opposition-exchange caution variant",
        "evidence_mode": "single_source_conflict_registry",
        "allowed_rules": (),
        "application_mode": "blocked_conflict_only",
        "machine_application_allowed": False,
        "source_confidence": "single_source_conflict_requires_corroboration",
        "blocked_claim": "some exchange-by-opposition forms are described as degrading toward Pra",
    },
}

_REPLACEMENT_STATUS = {
    "pra_opposition_to_kaset": "kaset",
    "nicha_opposition_to_ucca": "ucca",
    "reciprocal_kaset_exchange": "kaset",
}

_OVERLAY_STATUS = {
    "nicha_opposition_to_ucca": "ucca_standard_reach",
}


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _rows(value: Any) -> list[Mapping[str, Any]]:
    return [row for row in value if isinstance(row, Mapping)] if isinstance(value, list) else []


def _decision_for_candidate(candidate: Mapping[str, Any], profile_key: str) -> dict[str, Any]:
    profile = PROFILES[profile_key]
    rule_key = str(candidate.get("rule_key") or "")
    allowed = bool(profile["machine_application_allowed"] and rule_key in profile["allowed_rules"])
    decision = {
        "rule_key": rule_key,
        "planets": list(candidate.get("planets") or []),
        "candidate_detected": bool(candidate.get("detected")),
        "profile_allows_projection": allowed,
        "projection_mode": None,
        "projected_status": None,
        "overlay_status": None,
        "base_status_mutated": False,
        "exception_applied_to_engine": False,
        "final_judgement": None,
        "prediction": None,
        "score": None,
    }
    if not allowed:
        return decision
    mode = str(profile["application_mode"])
    decision["projection_mode"] = mode
    if mode == "project_secondary_replacement_status":
        decision["projected_status"] = _REPLACEMENT_STATUS.get(rule_key)
    elif mode == "project_non_destructive_overlay":
        decision["overlay_status"] = _OVERLAY_STATUS.get(rule_key)
    return decision


def evaluate_source_policy_profile(
    *,
    dignity_exceptions_research: Mapping[str, Any] | None,
    profile_key: str,
) -> dict[str, Any]:
    if profile_key not in PROFILES:
        raise ValueError(f"unknown Thai source-policy profile: {profile_key}")
    layer = _mapping(dignity_exceptions_research)
    profile = PROFILES[profile_key]
    if not layer.get("available"):
        return {
            "available": False,
            "research_only": True,
            "engine": ENGINE_VERSION,
            "profile_key": profile_key,
            "profile": profile,
            "decisions": [],
            "reason": "Dignity exception candidates are required before policy comparison.",
        }

    decisions = [_decision_for_candidate(row, profile_key) for row in _rows(layer.get("candidates"))]
    return {
        "available": True,
        "research_only": True,
        "engine": ENGINE_VERSION,
        "profile_key": profile_key,
        "profile": profile,
        "decisions": decisions,
        "projected_count": sum(1 for row in decisions if row["profile_allows_projection"]),
        "base_dignities_mutated": False,
        "engine_exception_application_count": 0,
        "final_judgement": None,
        "prediction": None,
        "score": None,
    }


def build_source_policy_research(
    *,
    dignity_exceptions_research: Mapping[str, Any] | None,
    selected_profile: str = DEFAULT_PROFILE,
) -> dict[str, Any]:
    if selected_profile not in PROFILES:
        raise ValueError(f"unknown Thai source-policy profile: {selected_profile}")
    layer = _mapping(dignity_exceptions_research)
    comparisons = {
        key: evaluate_source_policy_profile(
            dignity_exceptions_research=layer,
            profile_key=key,
        )
        for key in PROFILES
    }
    selected = comparisons[selected_profile]
    return {
        "available": bool(layer.get("available")),
        "research_only": True,
        "engine": ENGINE_VERSION,
        "default_profile": DEFAULT_PROFILE,
        "selected_profile": selected_profile,
        "profiles": PROFILES,
        "selected": selected,
        "comparisons": comparisons,
        "policy_matrix": {
            key: {
                "machine_application_allowed": bool(profile["machine_application_allowed"]),
                "application_mode": profile["application_mode"],
                "allowed_rules": list(profile["allowed_rules"]),
            }
            for key, profile in PROFILES.items()
        },
        "base_dignities_mutated": False,
        "actual_engine_exception_application_count": 0,
        "promotion_gate": {
            "explicit_source_profiles_validated": True,
            "default_none_profile_validated": True,
            "deterministic_rule_applicability_matrix_validated": True,
            "literal_projection_research_allowed": True,
            "non_destructive_overlay_research_allowed": True,
            "conflicting_single_source_profile_application_allowed": False,
            "base_status_rewrite_allowed": False,
            "production_school_selection_allowed": False,
            "final_interpretation_allowed": False,
            "event_judgement_allowed": False,
            "timing_prediction_allowed": False,
            "probability_allowed": False,
            "scores_allowed": False,
            "gemini_interpretation_allowed": False,
        },
        "policy": "Compare source-derived exception interpretations explicitly. Profile projections are diagnostic only and never mutate base dignities or product output.",
    }
