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

    def test_descriptive_synthesis_is_not_sent_to_gemini(self):
        thai = self._thai()
        compact = _compact_calculation({"period": {"day_count": 1}, "thai": thai})
        compact_suri = compact["thai"]["suriyayat"]
        self.assertNotIn("descriptive_synthesis_research", compact_suri)
        encoded = json.dumps(compact_suri, ensure_ascii=False)
        self.assertNotIn("descriptive_nonpredictive", encoded)
        self.assertNotIn("source_topic_domains", encoded)
        self.assertNotIn("carrier_planet", encoded)

    def test_only_descriptive_research_gate_is_opened(self):
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
        self.assertFalse(suri["lagna"]["available"])


if __name__ == "__main__":
    unittest.main()
