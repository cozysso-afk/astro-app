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
                _candidate("pra_opposition_to_kaset", ["sun", "saturn"], {"relation": "leng"}),
                _candidate("nicha_opposition_to_ucca", ["moon", "mars"], {"relation": "leng"}),
                _candidate(
                    "reciprocal_kaset_exchange",
                    ["mercury", "jupiter"],
                    {"first_current_sign_lord": "jupiter", "second_current_sign_lord": "mercury", "reciprocal": True},
                ),
                _candidate("pra_nicha_dusthana_reversal", ["venus"], {"statuses": ["pra"], "house_number": 8}),
            ],
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

    @staticmethod
    def _projected(selected):
        return [row for row in selected["decisions"] if row["profile_allows_projection"]]

    def test_same_candidate_corpus_is_seen_by_all_profiles(self):
        profiles = self._profiles()
        identities = []
        for profile in profiles.values():
            identities.append([(row["rule_key"], tuple(row["planets"])) for row in profile["selected"]["decisions"]])
        self.assertTrue(all(rows == identities[0] for rows in identities[1:]))
        self.assertEqual(len(identities[0]), 4)

    def test_none_profile_projects_nothing_but_keeps_candidate_rows(self):
        none = self._profiles()["none"]["selected"]
        self.assertEqual(none["projected_count"], 0)
        self.assertEqual(len(none["decisions"]), 4)
        self.assertFalse(any(row["profile_allows_projection"] for row in none["decisions"]))

    def test_literal_profile_projects_only_three_strong_exception_rules(self):
        literal = self._profiles()["literal_exception"]["selected"]
        projected = self._projected(literal)
        self.assertEqual(literal["projected_count"], 3)
        self.assertEqual(
            {row["rule_key"] for row in projected},
            {"pra_opposition_to_kaset", "nicha_opposition_to_ucca", "reciprocal_kaset_exchange"},
        )
        self.assertEqual({row["projected_status"] for row in projected}, {"kaset", "ucca"})

    def test_standard_reach_overlay_projects_only_nicha_opposition(self):
        overlay = self._profiles()["standard_reach_overlay"]["selected"]
        projected = self._projected(overlay)
        self.assertEqual(overlay["projected_count"], 1)
        self.assertEqual(projected[0]["rule_key"], "nicha_opposition_to_ucca")
        self.assertEqual(projected[0]["overlay_status"], "ucca_standard_reach")
        self.assertIsNone(projected[0]["projected_status"])

    def test_literal_and_overlay_differ_only_in_projection_fields(self):
        profiles = self._profiles()
        literal = profiles["literal_exception"]["selected"]["decisions"]
        overlay = profiles["standard_reach_overlay"]["selected"]["decisions"]
        allowed = {"profile_allows_projection", "projection_mode", "projected_status", "overlay_status"}
        protected = {
            "rule_key", "planets", "candidate_detected", "base_status_mutated",
            "exception_applied_to_engine", "final_judgement", "prediction", "score",
        }
        self.assertEqual(len(literal), len(overlay))
        for left, right in zip(literal, overlay):
            self.assertTrue(all(left[key] == right[key] for key in protected))
            differing = {key for key in left if left.get(key) != right.get(key)}
            self.assertTrue(differing.issubset(allowed))

    def test_dusthana_reversal_candidate_never_projects(self):
        for profile in self._profiles().values():
            row = next(
                item for item in profile["selected"]["decisions"]
                if item["rule_key"] == "pra_nicha_dusthana_reversal"
            )
            self.assertFalse(row["profile_allows_projection"])
            self.assertIsNone(row["projected_status"])
            self.assertIsNone(row["overlay_status"])

    def test_all_profiles_keep_engine_and_prediction_invariants(self):
        for profile in self._profiles().values():
            self.assertFalse(profile["base_dignities_mutated"])
            self.assertEqual(profile["actual_engine_exception_application_count"], 0)
            selected = profile["selected"]
            self.assertFalse(selected["base_dignities_mutated"])
            self.assertEqual(selected["engine_exception_application_count"], 0)
            self.assertIsNone(selected["final_judgement"])
            self.assertIsNone(selected["prediction"])
            self.assertIsNone(selected["score"])
            for decision in selected["decisions"]:
                self.assertFalse(decision["base_status_mutated"])
                self.assertFalse(decision["exception_applied_to_engine"])
                self.assertIsNone(decision["final_judgement"])
                self.assertIsNone(decision["prediction"])
                self.assertIsNone(decision["score"])

    def test_profile_projection_is_deterministic(self):
        layer = self._synthetic_layer()
        for key in ("none", "literal_exception", "standard_reach_overlay"):
            first = build_source_policy_research(dignity_exceptions_research=copy.deepcopy(layer), selected_profile=key)
            second = build_source_policy_research(dignity_exceptions_research=copy.deepcopy(layer), selected_profile=key)
            self.assertEqual(first["selected"], second["selected"])

    def test_top_level_policy_contract_is_identical_except_selection(self):
        profiles = self._profiles()
        stable_keys = (
            "available", "research_only", "engine", "default_profile", "profiles",
            "comparisons", "policy_matrix", "base_dignities_mutated",
            "actual_engine_exception_application_count", "promotion_gate", "policy",
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
