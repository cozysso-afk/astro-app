# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import unittest
from datetime import date, time

from ai_interpret_v1 import _compact_calculation
from thai_astrology_v2 import build_thai_fortune


class ThaiPhase2G1SourcePolicyIntegrationTests(unittest.TestCase):
    def _thai(self):
        return build_thai_fortune(
            birth_date=date(1991, 3, 21), birth_time=time(7, 26),
            start_date=date(2026, 8, 31), end_date=date(2026, 8, 31),
            utc_offset_hours=9.0, latitude=34.7604, longitude=127.6622,
        )

    def test_real_calculation_uses_none_as_default_source_policy(self):
        layer = self._thai()["suriyayat"]["school_policy_research"]
        self.assertTrue(layer["available"])
        self.assertTrue(layer["research_only"])
        self.assertEqual(layer["default_profile"], "none")
        self.assertEqual(layer["selected_profile"], "none")
        self.assertEqual(layer["selected"]["projected_count"], 0)
        self.assertEqual(layer["actual_engine_exception_application_count"], 0)
        self.assertFalse(layer["base_dignities_mutated"])

    def test_real_profile_comparisons_are_diagnostic_only(self):
        layer = self._thai()["suriyayat"]["school_policy_research"]
        self.assertEqual(
            set(layer["comparisons"]),
            {"none", "literal_exception", "standard_reach_overlay", "opposition_exchange_caution"},
        )
        for comparison in layer["comparisons"].values():
            self.assertFalse(comparison["base_dignities_mutated"])
            self.assertEqual(comparison["engine_exception_application_count"], 0)
            self.assertIsNone(comparison["final_judgement"])
            self.assertIsNone(comparison["prediction"])
            self.assertIsNone(comparison["score"])
            for decision in comparison["decisions"]:
                self.assertFalse(decision["base_status_mutated"])
                self.assertFalse(decision["exception_applied_to_engine"])

    def test_source_policy_research_is_stripped_from_gemini_payload(self):
        thai = self._thai()
        compact = _compact_calculation({"period": {"day_count": 1}, "thai": thai})
        compact_suri = compact["thai"]["suriyayat"]
        self.assertNotIn("school_policy_research", compact_suri)
        encoded = json.dumps(compact_suri, ensure_ascii=False)
        self.assertNotIn("literal_exception", encoded)
        self.assertNotIn("standard_reach_overlay", encoded)
        self.assertNotIn("ucca_standard_reach", encoded)

    def test_school_selection_and_all_predictive_gates_remain_closed_after_lagna_promotion(self):
        thai = self._thai()
        suri = thai["suriyayat"]
        layer = suri["school_policy_research"]
        gate = layer["promotion_gate"]
        self.assertTrue(gate["explicit_source_profiles_validated"])
        self.assertTrue(gate["default_none_profile_validated"])
        self.assertFalse(gate["base_status_rewrite_allowed"])
        self.assertFalse(gate["production_school_selection_allowed"])
        self.assertFalse(gate["final_interpretation_allowed"])
        self.assertFalse(gate["event_judgement_allowed"])
        self.assertFalse(gate["timing_prediction_allowed"])
        self.assertFalse(gate["probability_allowed"])
        self.assertFalse(gate["scores_allowed"])
        self.assertFalse(gate["gemini_interpretation_allowed"])
        self.assertTrue(suri["lagna"]["available"])
        product_gate = suri["lagna_product_promotion"]["promotion_gate"]
        self.assertFalse(product_gate["school_policy_allowed"])
        self.assertFalse(product_gate["exception_application_allowed"])
        self.assertFalse(product_gate["predictive_interpretation_allowed"])
        self.assertFalse(product_gate["event_judgement_allowed"])
        self.assertFalse(product_gate["timing_prediction_allowed"])
        self.assertFalse(product_gate["probability_allowed"])
        self.assertFalse(product_gate["scores_allowed"])


if __name__ == "__main__":
    unittest.main()
