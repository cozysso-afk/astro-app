# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import unittest
from datetime import date, time

from ai_interpret_v1 import _compact_calculation
from thai_astrology_v2 import build_thai_fortune


class ThaiPhase2G3AiSafePacketIntegrationTests(unittest.TestCase):
    def _thai(self):
        return build_thai_fortune(
            birth_date=date(1991, 3, 21), birth_time=time(7, 26),
            start_date=date(2026, 8, 31), end_date=date(2026, 8, 31),
            utc_offset_hours=9.0, latitude=34.7604, longitude=127.6622,
        )

    def test_real_calculation_attaches_lagna_gated_ai_safe_packet(self):
        suri = self._thai()["suriyayat"]
        packet = suri["ai_safe_packet_research"]
        self.assertTrue(packet["available"])
        self.assertTrue(packet["research_only"])
        self.assertGreater(packet["route_count"], 0)
        self.assertFalse(packet["eligible_for_gemini"])
        self.assertFalse(packet["dependencies"]["lagna_product_available"])

    def test_real_packet_never_contains_exception_policy_or_prediction_fields(self):
        packet = self._thai()["suriyayat"]["ai_safe_packet_research"]
        encoded = json.dumps(packet["routes"], ensure_ascii=False)
        for forbidden in (
            "school_policy_research", "dignity_exceptions_research", "literal_exception",
            "standard_reach_overlay", "unresolved", "final_interpretation", "prediction",
            "score", "probability", "net_effect", "strength_percent",
        ):
            self.assertNotIn(forbidden, encoded)

    def test_current_product_lagna_state_keeps_packet_out_of_gemini_payload(self):
        thai = self._thai()
        compact = _compact_calculation({"period": {"day_count": 1}, "thai": thai})
        compact_suri = compact["thai"]["suriyayat"]
        self.assertNotIn("ai_safe_packet_research", compact_suri)
        encoded = json.dumps(compact_suri, ensure_ascii=False)
        self.assertNotIn("descriptive_nonpredictive", encoded)
        self.assertNotIn("source_topic_domains", encoded)

    def test_packet_gate_cannot_open_product_school_or_predictive_layers(self):
        suri = self._thai()["suriyayat"]
        packet = suri["ai_safe_packet_research"]
        gate = packet["promotion_gate"]
        self.assertTrue(gate["ai_safe_whitelist_validated"])
        self.assertFalse(gate["lagna_dependency_satisfied"])
        self.assertFalse(gate["gemini_interpretation_allowed"])
        self.assertFalse(gate["school_policy_allowed"])
        self.assertFalse(gate["exception_application_allowed"])
        self.assertFalse(gate["net_valence_allowed"])
        self.assertFalse(gate["final_good_bad_judgement_allowed"])
        self.assertFalse(gate["event_judgement_allowed"])
        self.assertFalse(gate["timing_prediction_allowed"])
        self.assertFalse(gate["probability_allowed"])
        self.assertFalse(gate["scores_allowed"])
        self.assertFalse(suri["lagna"]["available"])


if __name__ == "__main__":
    unittest.main()
