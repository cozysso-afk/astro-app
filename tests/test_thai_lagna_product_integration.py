# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import unittest
from datetime import date, time

from ai_interpret_v1 import _compact_calculation
from thai_astrology_v2 import build_thai_fortune


class ThaiPhase2G5LagnaProductIntegrationTests(unittest.TestCase):
    def _thai(self):
        return build_thai_fortune(
            birth_date=date(1991, 3, 21), birth_time=time(7, 26),
            start_date=date(2026, 8, 31), end_date=date(2026, 8, 31),
            utc_offset_hours=9.0, latitude=34.7604, longitude=127.6622,
        )

    def test_real_product_lagna_is_promoted_from_audit(self):
        suri = self._thai()["suriyayat"]
        lagna = suri["lagna"]
        promotion = suri["lagna_product_promotion"]
        self.assertTrue(promotion["explicit_promotion"])
        self.assertTrue(promotion["available"])
        self.assertTrue(lagna["available"])
        self.assertEqual(lagna["method_key"], "common_anto_0600_lmt")
        self.assertTrue(lagna["validation"]["numeric_position_validated"])
        self.assertTrue(lagna["validation"]["global_coordinates_independently_validated"])
        self.assertGreaterEqual(lagna["validation"]["world_numeric_checks"], 16)

    def test_research_lagna_remains_immutable(self):
        suri = self._thai()["suriyayat"]
        research = suri["lagna_research"]
        self.assertTrue(research["research_only"])
        self.assertEqual(research["promotion_status"], "research_only_not_for_interpretation")
        self.assertTrue(research["promotion_gate"]["lagna_numeric_position_validated"])
        self.assertFalse(research["promotion_gate"]["houses_allowed"])
        self.assertFalse(research["promotion_gate"]["gemini_interpretation_allowed"])
        self.assertEqual(suri["lagna"]["longitude_deg"], research["common_anto_0600_lmt"]["longitude_deg"])

    def test_product_ai_packet_is_enabled_with_twelve_routes(self):
        packet = self._thai()["suriyayat"]["ai_safe_packet_product"]
        self.assertTrue(packet["eligible_for_gemini"])
        self.assertFalse(packet["research_only"])
        self.assertEqual(packet["route_count"], 12)
        self.assertTrue(packet["promotion_gate"]["gemini_interpretation_allowed"])
        self.assertFalse(packet["promotion_gate"]["event_judgement_allowed"])
        self.assertFalse(packet["promotion_gate"]["timing_prediction_allowed"])
        self.assertFalse(packet["promotion_gate"]["probability_allowed"])
        self.assertFalse(packet["promotion_gate"]["scores_allowed"])

    def test_compactor_receives_only_safe_descriptive_packet(self):
        compact = _compact_calculation({"period": {"day_count": 1}, "thai": self._thai()})
        compact_suri = compact["thai"]["suriyayat"]
        self.assertTrue(compact_suri["lagna"]["available"])
        packet = compact_suri["ai_safe_descriptive_packet"]
        self.assertEqual(packet["mode"], "descriptive_nonpredictive")
        self.assertEqual(packet["route_count"], 12)
        encoded = json.dumps(compact_suri, ensure_ascii=False)
        for forbidden in ("lagna_research", "school_policy_research", "literal_exception", "final_judgement", "prediction", "score", "probability", "net_effect"):
            self.assertNotIn(forbidden, encoded)

    def test_predictive_and_school_gates_stay_closed(self):
        gate = self._thai()["suriyayat"]["lagna_product_promotion"]["promotion_gate"]
        self.assertTrue(gate["numeric_lagna_product_allowed"])
        self.assertTrue(gate["descriptive_house_context_allowed"])
        self.assertTrue(gate["gemini_descriptive_packet_allowed"])
        for key in ("school_policy_allowed", "exception_application_allowed", "net_valence_allowed", "final_good_bad_judgement_allowed", "predictive_interpretation_allowed", "event_judgement_allowed", "timing_prediction_allowed", "probability_allowed", "scores_allowed"):
            self.assertFalse(gate[key], key)


if __name__ == "__main__":
    unittest.main()
