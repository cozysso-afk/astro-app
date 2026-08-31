# -*- coding: utf-8 -*-
from __future__ import annotations

import copy
import unittest

from thai_school_policy_v1 import build_source_policy_research


def _candidate(rule_key: str, planets: list[str], evidence: dict) -> dict:
    return {
        "rule_key": rule_key,
        "thai_rule": rule_key,
        "planets": planets,
        "evidence": evidence,
        "candidate_effect": "research_candidate",
        "support_status": "synthetic_gold",
        "school_variance": True,
        "detected": True,
        "applied": False,
        "base_status_overridden": False,
        "replacement_status": None,
        "net_valence": None,
        "prediction": None,
        "score": None,
    }


class ThaiPhase2G2ProfileDifferentialTests(unittest.TestCase):
    def _synthetic_layer(self):
        return {
            "available": True,
            "research_only": True,
            "engine": "synthetic-gold",
            "base_dignities_unchanged": True,
            "candidates": [
                _candidate(
                    "pra_opposition_to_kaset",
                    ["sun", "saturn"],
                    {"relation": "leng", "first_status": "pra", "second_status": "pra"},
                ),
                _candidate(
                    "nicha_opposition_to_ucca",
                    ["moon", "mars"],
                    {"relation": "leng", "first_status": "nicha", "second_status": "nicha"},
                ),
                _candidate(
                    "reciprocal_kaset_exchange",
                    ["mercury", "jupiter"],
                    {"first_current_sign_lord": "jupiter", "second_current_sign_lord": "mercury", "reciprocal": True},
                ),
                _candidate(
                    "pra_nicha_dusthana_reversal",
                    ["venus"],
                    {"statuses": ["pra"], "house_number": 8},
                ),
            ],
            "promotion_gate": {
                "candidate_detection_validated": True,
                "exception_application_allowed": False,
                "base_status_rewrite_allowed": False,
                "final_interpretation_allowed": False,
                "gemini_interpretation_allowed": False,
            },
        }

    def _profiles(self):
        layer = self._synthetic_layer()
        return {
            key: build_source_policy_research(
                dignity_exceptions_research=copy.deepcopy(layer),
                selected_profile=key,
            )
            for key in ("none", "literal_exception", "standard_reach_overlay")
        }

    def test_same_candidate_corpus_is_seen_by_all_profiles(self):
        profiles = self._profiles()
        counts = {key: value["candidate_count"] for key, value in profiles.items()}
        self.assertEqual(set(counts.values()), {4})

    def test_none_profile_projects_nothing(self):
        none = self._profiles()["none"]
        self.assertEqual(none["selected"]["projected_count"], 0)
        self.assertEqual(none["selected"]["decisions"], [])

    def test_literal_profile_projects_only_three_strong_exception_rules(self):
        literal = self._profiles()["literal_exception"]["selected"]
        self.assertEqual(literal["projected_count"], 3)
        rules = {row["rule_key"] for row in literal["decisions"]}
        self.assertEqual(
            rules,
            {"pra_opposition_to_kaset", "nicha_opposition_to_ucca", "reciprocal_kaset_exchange"},
        )
        self.assertNotIn("pra_nicha_dusthana_reversal", rules)

    def test_standard_reach_overlay_differs_from_literal_projection(self):
        profiles = self._profiles()
        literal = profiles["literal_exception"]["selected"]
        overlay = profiles["standard_reach_overlay"]["selected"]
        self.assertEqual(literal["projected_count"], 3)
        self.assertEqual(overlay["projected_count"], 1)
        self.assertEqual(overlay["decisions"][0]["rule_key"], "nicha_opposition_to_ucca")
        self.assertNotEqual(literal["decisions"], overlay["decisions"])

    def test_differential_outputs_never_mutate_base_status(self):
        for profile in self._profiles().values():
            self.assertFalse(profile["base_dignities_mutated"])
            self.assertEqual(profile["actual_engine_exception_application_count"], 0)
            for decision in profile["selected"]["decisions"]:
                self.assertFalse(decision["base_status_mutated"])
                self.assertFalse(decision["exception_applied_to_engine"])

    def test_all_profiles_keep_final_judgement_prediction_and_score_empty(self):
        for profile in self._profiles().values():
            selected = profile["selected"]
            self.assertIsNone(selected["final_judgement"])
            self.assertIsNone(selected["prediction"])
            self.assertIsNone(selected["score"])

    def test_dusthana_reversal_is_blocked_in_all_profiles(self):
        for profile in self._profiles().values():
            decisions = profile["selected"]["decisions"]
            self.assertFalse(any(row["rule_key"] == "pra_nicha_dusthana_reversal" for row in decisions))

    def test_profile_projection_is_deterministic(self):
        layer = self._synthetic_layer()
        for key in ("none", "literal_exception", "standard_reach_overlay"):
            first = build_source_policy_research(dignity_exceptions_research=copy.deepcopy(layer), selected_profile=key)
            second = build_source_policy_research(dignity_exceptions_research=copy.deepcopy(layer), selected_profile=key)
            self.assertEqual(first["selected"], second["selected"])

    def test_projection_diff_is_confined_to_selected_policy_view(self):
        profiles = self._profiles()
        stable_keys = (
            "available",
            "research_only",
            "default_profile",
            "actual_engine_exception_application_count",
            "base_dignities_mutated",
        )
        for key in stable_keys:
            values = {repr(profile[key]) for profile in profiles.values()}
            self.assertEqual(len(values), 1, key)

    def test_promotion_gates_remain_closed_under_every_profile(self):
        for profile in self._profiles().values():
            gate = profile["promotion_gate"]
            self.assertFalse(gate["base_status_rewrite_allowed"])
            self.assertFalse(gate["production_school_selection_allowed"])
            self.assertFalse(gate["final_interpretation_allowed"])
            self.assertFalse(gate["event_judgement_allowed"])
            self.assertFalse(gate["timing_prediction_allowed"])
            self.assertFalse(gate["probability_allowed"])
            self.assertFalse(gate["scores_allowed"])
            self.assertFalse(gate["gemini_interpretation_allowed"])


if __name__ == "__main__":
    unittest.main()
