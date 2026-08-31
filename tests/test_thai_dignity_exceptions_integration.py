# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import unittest
from datetime import date, time

from ai_interpret_v1 import _compact_calculation
from thai_astrology_v2 import build_thai_fortune


class ThaiPhase2F3DignityExceptionIntegrationTests(unittest.TestCase):
    def _thai(self):
        return build_thai_fortune(
            birth_date=date(1991, 3, 21), birth_time=time(7, 26),
            start_date=date(2026, 8, 31), end_date=date(2026, 8, 31),
            utc_offset_hours=9.0, latitude=34.7604, longitude=127.6622,
        )

    def test_real_calculation_attaches_exception_candidate_registry(self):
        layer = self._thai()["suriyayat"]["dignity_exceptions_research"]
        self.assertTrue(layer["available"])
        self.assertTrue(layer["research_only"])
        self.assertTrue(layer["base_dignities_unchanged"])
        self.assertIn("pra_opposition_to_kaset", layer["registry"])
        self.assertIn("reciprocal_kaset_exchange", layer["registry"])

    def test_any_real_candidates_are_never_applied(self):
        layer = self._thai()["suriyayat"]["dignity_exceptions_research"]
        for row in layer["candidates"]:
            self.assertTrue(row["detected"])
            self.assertFalse(row["applied"])
            self.assertFalse(row["base_status_overridden"])
            self.assertIsNone(row["replacement_status"])
            self.assertIsNone(row["net_valence"])
            self.assertIsNone(row["prediction"])
            self.assertIsNone(row["score"])

    def test_exception_research_is_stripped_from_gemini_payload(self):
        thai = self._thai()
        compact = _compact_calculation({"period": {"day_count": 1}, "thai": thai})
        compact_suri = compact["thai"]["suriyayat"]
        self.assertNotIn("dignity_exceptions_research", compact_suri)
        encoded = json.dumps(compact_suri, ensure_ascii=False)
        self.assertNotIn("pra_opposition_to_kaset", encoded)
        self.assertNotIn("reciprocal_kaset_exchange", encoded)
        self.assertNotIn("base_status_overridden", encoded)

    def test_school_policy_and_exception_gates_stay_closed_after_lagna_promotion(self):
        thai = self._thai()
        suri = thai["suriyayat"]
        layer = suri["dignity_exceptions_research"]
        self.assertTrue(layer["school_policy"]["required"])
        self.assertIsNone(layer["school_policy"]["selected_school"])
        gate = layer["promotion_gate"]
        self.assertTrue(gate["candidate_detection_validated"])
        self.assertTrue(gate["source_variance_preserved"])
        self.assertFalse(gate["exception_application_allowed"])
        self.assertFalse(gate["base_status_rewrite_allowed"])
        self.assertFalse(gate["advanced_standard_exception_application_allowed"])
        self.assertFalse(gate["net_valence_allowed"])
        self.assertFalse(gate["final_interpretation_allowed"])
        self.assertFalse(gate["event_judgement_allowed"])
        self.assertFalse(gate["scores_allowed"])
        self.assertFalse(gate["gemini_interpretation_allowed"])
        self.assertTrue(suri["lagna"]["available"])
        product_gate = suri["lagna_product_promotion"]["promotion_gate"]
        self.assertFalse(product_gate["school_policy_allowed"])
        self.assertFalse(product_gate["exception_application_allowed"])
        self.assertFalse(product_gate["final_good_bad_judgement_allowed"])
        self.assertFalse(product_gate["event_judgement_allowed"])
        self.assertFalse(product_gate["scores_allowed"])


if __name__ == "__main__":
    unittest.main()
