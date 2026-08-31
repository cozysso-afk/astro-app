# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import unittest
from datetime import date, time

from ai_interpret_v1 import _compact_calculation
from thai_astrology_v2 import build_thai_fortune


class ThaiPhase2D2PolicyIntegrationTests(unittest.TestCase):
    def _thai(self):
        return build_thai_fortune(
            birth_date=date(1991, 3, 21), birth_time=time(7, 26),
            start_date=date(2026, 8, 31), end_date=date(2026, 8, 31),
            utc_offset_hours=9.0, latitude=34.7604, longitude=127.6622,
        )

    def test_policy_registry_is_attached_as_research_only(self):
        suri = self._thai()["suriyayat"]
        policy = suri["interpretation_policy_research"]
        self.assertTrue(policy["available"])
        self.assertTrue(policy["research_only"])
        self.assertEqual(policy["rules"]["aspect_strength"]["status"], "numeric_conflict_blocked")
        self.assertEqual(policy["rules"]["combined_judgement"]["status"], "blocked_requires_context_model")

    def test_policy_does_not_open_any_interpretation_gate(self):
        gate = self._thai()["suriyayat"]["interpretation_policy_research"]["promotion_gate"]
        self.assertFalse(gate["advanced_standard_interpretation_allowed"])
        self.assertFalse(gate["aspect_strength_percent_allowed"])
        self.assertFalse(gate["aspect_pair_interpretation_allowed"])
        self.assertFalse(gate["combined_judgement_allowed"])
        self.assertFalse(gate["scores_allowed"])
        self.assertFalse(gate["event_judgement_allowed"])
        self.assertFalse(gate["gemini_interpretation_allowed"])

    def test_policy_registry_is_not_sent_to_gemini(self):
        thai = self._thai()
        compact = _compact_calculation({"period": {"day_count": 1}, "thai": thai})
        compact_suri = compact["thai"]["suriyayat"]
        self.assertNotIn("interpretation_policy_research", compact_suri)
        encoded = json.dumps(compact_suri, ensure_ascii=False)
        self.assertNotIn("numeric_conflict_blocked", encoded)
        self.assertNotIn("source_a", encoded)
        self.assertNotIn("source_b", encoded)

    def test_main_product_lagna_stays_unavailable(self):
        suri = self._thai()["suriyayat"]
        self.assertFalse(suri["lagna"]["available"])
        self.assertTrue(suri["lagna_research"]["research_only"])
        self.assertTrue(suri["semantics_research"]["research_only"])
        self.assertTrue(suri["interpretation_policy_research"]["research_only"])


if __name__ == "__main__":
    unittest.main()
