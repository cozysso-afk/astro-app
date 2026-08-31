# -*- coding: utf-8 -*-
from __future__ import annotations

import unittest

from thai_school_policy_v1 import (
    DEFAULT_PROFILE,
    PROFILES,
    build_source_policy_research,
    evaluate_source_policy_profile,
)


class ThaiPhase2G1SourcePolicyTests(unittest.TestCase):
    def _exceptions(self):
        return {
            "available": True,
            "candidates": [
                {"rule_key": "pra_opposition_to_kaset", "planets": ["sun", "moon"], "detected": True},
                {"rule_key": "nicha_opposition_to_ucca", "planets": ["mars", "jupiter"], "detected": True},
                {"rule_key": "reciprocal_kaset_exchange", "planets": ["moon", "mars"], "detected": True},
                {"rule_key": "pra_nicha_dusthana_reversal", "planets": ["saturn"], "detected": True},
            ],
        }

    def test_default_profile_is_none(self):
        self.assertEqual(DEFAULT_PROFILE, "none")
        result = build_source_policy_research(dignity_exceptions_research=self._exceptions())
        self.assertEqual(result["selected_profile"], "none")
        self.assertEqual(result["selected"]["projected_count"], 0)
        self.assertEqual(result["actual_engine_exception_application_count"], 0)

    def test_literal_exception_projects_three_status_rules_only(self):
        result = evaluate_source_policy_profile(
            dignity_exceptions_research=self._exceptions(),
            profile_key="literal_exception",
        )
        projected = [r for r in result["decisions"] if r["profile_allows_projection"]]
        self.assertEqual(len(projected), 3)
        by_rule = {r["rule_key"]: r for r in projected}
        self.assertEqual(by_rule["pra_opposition_to_kaset"]["projected_status"], "kaset")
        self.assertEqual(by_rule["nicha_opposition_to_ucca"]["projected_status"], "ucca")
        self.assertEqual(by_rule["reciprocal_kaset_exchange"]["projected_status"], "kaset")

    def test_literal_projection_never_mutates_base_status(self):
        result = evaluate_source_policy_profile(
            dignity_exceptions_research=self._exceptions(),
            profile_key="literal_exception",
        )
        self.assertFalse(result["base_dignities_mutated"])
        self.assertEqual(result["engine_exception_application_count"], 0)
        for row in result["decisions"]:
            self.assertFalse(row["base_status_mutated"])
            self.assertFalse(row["exception_applied_to_engine"])

    def test_standard_reach_profile_only_projects_nicha_overlay(self):
        result = evaluate_source_policy_profile(
            dignity_exceptions_research=self._exceptions(),
            profile_key="standard_reach_overlay",
        )
        projected = [r for r in result["decisions"] if r["profile_allows_projection"]]
        self.assertEqual(len(projected), 1)
        self.assertEqual(projected[0]["rule_key"], "nicha_opposition_to_ucca")
        self.assertEqual(projected[0]["overlay_status"], "ucca_standard_reach")
        self.assertIsNone(projected[0]["projected_status"])

    def test_dusthana_reversal_is_not_machine_applied_by_any_active_profile(self):
        result = build_source_policy_research(dignity_exceptions_research=self._exceptions())
        for key in ("none", "literal_exception", "standard_reach_overlay"):
            row = next(
                r for r in result["comparisons"][key]["decisions"]
                if r["rule_key"] == "pra_nicha_dusthana_reversal"
            )
            self.assertFalse(row["profile_allows_projection"])

    def test_conflicting_exchange_caution_profile_is_application_blocked(self):
        profile = PROFILES["opposition_exchange_caution"]
        self.assertFalse(profile["machine_application_allowed"])
        result = evaluate_source_policy_profile(
            dignity_exceptions_research=self._exceptions(),
            profile_key="opposition_exchange_caution",
        )
        self.assertEqual(result["projected_count"], 0)
        self.assertTrue(all(not row["profile_allows_projection"] for row in result["decisions"]))

    def test_policy_matrix_is_explicit_and_deterministic(self):
        result = build_source_policy_research(dignity_exceptions_research=self._exceptions())
        matrix = result["policy_matrix"]
        self.assertEqual(set(matrix), set(PROFILES))
        self.assertEqual(matrix["none"]["allowed_rules"], [])
        self.assertEqual(
            matrix["literal_exception"]["allowed_rules"],
            ["pra_opposition_to_kaset", "nicha_opposition_to_ucca", "reciprocal_kaset_exchange"],
        )
        self.assertEqual(matrix["standard_reach_overlay"]["allowed_rules"], ["nicha_opposition_to_ucca"])

    def test_unknown_profile_is_rejected(self):
        with self.assertRaises(ValueError):
            evaluate_source_policy_profile(
                dignity_exceptions_research=self._exceptions(),
                profile_key="invented_school",
            )

    def test_no_profile_creates_judgement_prediction_or_score(self):
        result = build_source_policy_research(dignity_exceptions_research=self._exceptions())
        for comparison in result["comparisons"].values():
            self.assertIsNone(comparison["final_judgement"])
            self.assertIsNone(comparison["prediction"])
            self.assertIsNone(comparison["score"])
            for decision in comparison["decisions"]:
                self.assertIsNone(decision["final_judgement"])
                self.assertIsNone(decision["prediction"])
                self.assertIsNone(decision["score"])

    def test_promotion_gate_keeps_production_and_predictive_layers_closed(self):
        gate = build_source_policy_research(dignity_exceptions_research=self._exceptions())["promotion_gate"]
        self.assertTrue(gate["explicit_source_profiles_validated"])
        self.assertTrue(gate["default_none_profile_validated"])
        self.assertTrue(gate["deterministic_rule_applicability_matrix_validated"])
        self.assertTrue(gate["literal_projection_research_allowed"])
        self.assertTrue(gate["non_destructive_overlay_research_allowed"])
        self.assertFalse(gate["conflicting_single_source_profile_application_allowed"])
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
