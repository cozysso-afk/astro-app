# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import unittest
from datetime import date, time

from ai_interpret_v1 import _compact_calculation
from thai_astrology_v2 import build_thai_fortune


class ThaiPhase2F2DescriptiveSynthesisIntegrationTests(unittest.TestCase):
    def _thai(self):
        return build_thai_fortune(
            birth_date=date(1991, 3, 21), birth_time=time(7, 26),
            start_date=date(2026, 8, 31), end_date=date(2026, 8, 31),
            utc_offset_hours=9.0, latitude=34.7604, longitude=127.6622,
        )

    def test_real_calculation_has_twelve_nonpredictive_descriptions(self):
        synth = self._thai()["suriyayat"]["descriptive_synthesis_research"]
        self.assertTrue(synth["available"])
        self.assertTrue(synth["research_only"])
        self.assertEqual(len(synth["route_descriptions"]), 12)
        self.assertTrue(all(row["allowed_descriptive_claim"]["interpretation_level"] == "descriptive_nonpredictive" for row in synth["route_descriptions"]))

    def test_real_descriptions_keep_every_outcome_field_empty(self):
        synth = self._thai()["suriyayat"]["descriptive_synthesis_research"]
        for row in synth["route_descriptions"]:
            self.assertIsNone(row["final_interpretation"])
            self.assertIsNone(row["prediction"])
            self.assertIsNone(row["score"])
            self.assertIsNone(row["unresolved"]["event_outcome"])
            self.assertIsNone(row["unresolved"]["timing"])
            self.assertIsNone(row["unresolved"]["probability"])
            self.assertIsNone(row["unresolved"]["combined_good_bad_judgement"])

    def test_raw_synthesis_is_stripped_and_only_safe_product_packet_is_sent(self):
        thai = self._thai()
        compact = _compact_calculation({"period": {"day_count": 1}, "thai": thai})
        compact_suri = compact["thai"]["suriyayat"]
        self.assertNotIn("descriptive_synthesis_research", compact_suri)
        packet = compact_suri["ai_safe_descriptive_packet"]
        self.assertEqual(packet["mode"], "descriptive_nonpredictive")
        self.assertEqual(packet["route_count"], 12)
        encoded = json.dumps(compact_suri, ensure_ascii=False)
        self.assertIn("source_topic_domains", encoded)
        self.assertIn("carrier_planet", encoded)
        for forbidden in ("unresolved", "final_interpretation", "prediction", "score", "probability"):
            self.assertNotIn(forbidden, encoded)

    def test_only_whitelisted_descriptive_product_gate_is_opened(self):
        thai = self._thai()
        suri = thai["suriyayat"]
        gate = suri["descriptive_synthesis_research"]["promotion_gate"]
        self.assertTrue(gate["descriptive_composition_validated"])
        self.assertFalse(gate["advanced_standard_meaning_allowed"])
        self.assertFalse(gate["aspect_strength_allowed"])
        self.assertFalse(gate["pair_net_valence_allowed"])
        self.assertFalse(gate["net_valence_allowed"])
        self.assertFalse(gate["final_interpretation_allowed"])
        self.assertFalse(gate["event_judgement_allowed"])
        self.assertFalse(gate["timing_prediction_allowed"])
        self.assertFalse(gate["probability_allowed"])
        self.assertFalse(gate["scores_allowed"])
        self.assertFalse(gate["gemini_interpretation_allowed"])
        self.assertTrue(suri["lagna"]["available"])
        product_gate = suri["lagna_product_promotion"]["promotion_gate"]
        self.assertTrue(product_gate["descriptive_house_context_allowed"])
        self.assertTrue(product_gate["gemini_descriptive_packet_allowed"])
        for key in (
            "school_policy_allowed", "exception_application_allowed", "net_valence_allowed",
            "final_good_bad_judgement_allowed", "predictive_interpretation_allowed",
            "event_judgement_allowed", "timing_prediction_allowed", "probability_allowed",
            "scores_allowed",
        ):
            self.assertFalse(product_gate[key], key)


if __name__ == "__main__":
    unittest.main()
