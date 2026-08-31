# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import unittest
from datetime import date, time

from ai_interpret_v1 import _compact_calculation
from thai_astrology_v2 import build_thai_fortune


class ThaiPhase2E2HouseLordRouteIntegrationTests(unittest.TestCase):
    def _thai(self):
        return build_thai_fortune(
            birth_date=date(1991, 3, 21),
            birth_time=time(7, 26),
            start_date=date(2026, 8, 31),
            end_date=date(2026, 8, 31),
            utc_offset_hours=9.0,
            latitude=34.7604,
            longitude=127.6622,
        )

    def test_real_calculation_has_twelve_research_routes_when_house_research_is_available(self):
        thai = self._thai()
        routes = thai["suriyayat"]["house_lord_routes_research"]
        self.assertTrue(routes["available"])
        self.assertTrue(routes["research_only"])
        self.assertEqual(len(routes["routes"]), 12)
        self.assertEqual([row["source_house"]["house_number"] for row in routes["routes"]], list(range(1, 13)))

    def test_routes_keep_interpretation_and_scores_empty(self):
        thai = self._thai()
        routes = thai["suriyayat"]["house_lord_routes_research"]
        for row in routes["routes"]:
            self.assertIsNone(row["interpretation"])
            self.assertIsNone(row["combined_judgement"])
            self.assertIsNone(row["prediction"])
            self.assertIsNone(row["score"])
            self.assertIsNone(row["lord_position_context"]["status_judgement"])

    def test_routes_are_stripped_from_gemini_payload(self):
        thai = self._thai()
        compact = _compact_calculation({"period": {"day_count": 1}, "thai": thai})
        compact_suri = compact["thai"]["suriyayat"]
        self.assertNotIn("house_lord_routes_research", compact_suri)
        encoded = json.dumps(compact_suri, ensure_ascii=False)
        self.assertNotIn("subject_domain_carried_by_house_lord", encoded)
        self.assertNotIn("placement_context_or_modifier", encoded)
        self.assertNotIn("route_key", encoded)

    def test_product_lagna_and_synthesis_gates_stay_closed(self):
        thai = self._thai()
        self.assertFalse(thai["suriyayat"]["lagna"]["available"])
        gate = thai["suriyayat"]["house_lord_routes_research"]["promotion_gate"]
        self.assertFalse(gate["route_interpretation_allowed"])
        self.assertFalse(gate["pair_or_aspect_synthesis_allowed"])
        self.assertFalse(gate["combined_judgement_allowed"])
        self.assertFalse(gate["gemini_interpretation_allowed"])
        self.assertEqual(
            thai["engine"],
            "thai-mahathaksa-taksajorn-suriyayat-v2.8-phase2e2-house-lord-routes-research",
        )


if __name__ == "__main__":
    unittest.main()
