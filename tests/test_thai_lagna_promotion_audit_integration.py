# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import unittest
from datetime import date, time

from ai_interpret_v1 import _compact_calculation
from thai_astrology_v2 import build_thai_fortune


class ThaiPhase2G4LagnaPromotionAuditIntegrationTests(unittest.TestCase):
    def _thai(self):
        return build_thai_fortune(
            birth_date=date(1991, 3, 21), birth_time=time(7, 26),
            start_date=date(2026, 8, 31), end_date=date(2026, 8, 31),
            utc_offset_hours=9.0, latitude=34.7604, longitude=127.6622,
        )

    def test_real_calculation_attaches_complete_promotion_audit(self):
        audit = self._thai()["suriyayat"]["lagna_promotion_audit_research"]
        self.assertTrue(audit["available"])
        self.assertTrue(audit["research_only"])
        self.assertTrue(audit["promotion_gate"]["audit_complete"])
        self.assertEqual(audit["failed_checks"], [])

    def test_real_audit_marks_nonpredictive_product_prerequisites_ready(self):
        audit = self._thai()["suriyayat"]["lagna_promotion_audit_research"]
        self.assertTrue(audit["lagna_position_product_promotion_ready"])
        self.assertTrue(audit["descriptive_house_context_product_promotion_ready"])
        self.assertTrue(audit["ai_safe_packet_ready_after_explicit_lagna_promotion"])
        self.assertFalse(audit["automatic_promotion_allowed"])
        self.assertFalse(audit["product_state_changed"])

    def test_product_lagna_and_current_gemini_gate_remain_closed(self):
        suri = self._thai()["suriyayat"]
        self.assertFalse(suri["lagna"]["available"])
        lagna_gate = suri["lagna_research"]["promotion_gate"]
        self.assertTrue(lagna_gate["lagna_numeric_position_validated"])
        self.assertFalse(lagna_gate["houses_allowed"])
        self.assertFalse(lagna_gate["gemini_interpretation_allowed"])
        packet = suri["ai_safe_packet_research"]
        self.assertFalse(packet["eligible_for_gemini"])
        self.assertFalse(packet["promotion_gate"]["lagna_dependency_satisfied"])
        self.assertFalse(packet["promotion_gate"]["gemini_interpretation_allowed"])

    def test_audit_and_safe_packet_do_not_leak_into_current_gemini_payload(self):
        thai = self._thai()
        compact = _compact_calculation({"period": {"day_count": 1}, "thai": thai})
        compact_suri = compact["thai"]["suriyayat"]
        self.assertNotIn("lagna_promotion_audit_research", compact_suri)
        self.assertNotIn("ai_safe_descriptive_packet", compact_suri)
        encoded = json.dumps(compact_suri, ensure_ascii=False)
        self.assertNotIn("descriptive_house_context_product_promotion_ready", encoded)
        self.assertNotIn("source_topic_domains", encoded)
        self.assertNotIn("literal_exception", encoded)


if __name__ == "__main__":
    unittest.main()
