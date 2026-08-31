# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import unittest
from datetime import date, time

from ai_interpret_v1 import _compact_calculation
from thai_astrology_v2 import build_thai_fortune


class ThaiRulesPhase2BIntegrationTests(unittest.TestCase):
    def _build(self, *, with_coordinates: bool = True):
        return build_thai_fortune(
            birth_date=date(1991, 3, 21),
            birth_time=time(7, 26),
            start_date=date(2026, 8, 31),
            end_date=date(2026, 8, 31),
            utc_offset_hours=9.0,
            latitude=34.7604 if with_coordinates else None,
            longitude=127.6622 if with_coordinates else None,
        )

    def test_natal_dignity_facts_are_attached_without_interpretation(self):
        suri = self._build()["suriyayat"]
        dignity = suri["dignities_research"]
        self.assertTrue(dignity["available"])
        self.assertTrue(dignity["research_only"])
        self.assertEqual(set(dignity["planets"]), set(suri["natal"]["positions"]))
        self.assertFalse(dignity["promotion_gate"]["scores_allowed"])
        self.assertFalse(dignity["promotion_gate"]["event_judgement_allowed"])
        self.assertFalse(dignity["promotion_gate"]["gemini_interpretation_allowed"])

    def test_house_lords_require_whole_sign_house_research(self):
        with_coords = self._build(with_coordinates=True)["suriyayat"]
        lords = with_coords["house_lords_research"]
        self.assertTrue(lords["available"])
        self.assertEqual(len(lords["houses"]), 12)
        for house, lord_row in zip(with_coords["houses_research"]["houses"], lords["houses"]):
            self.assertEqual(house["house_number"], lord_row["house_number"])
            self.assertEqual(house["sign_index"], lord_row["sign"]["sign_index"])

        without_coords = self._build(with_coordinates=False)["suriyayat"]
        self.assertFalse(without_coords["houses_research"]["available"])
        self.assertFalse(without_coords["house_lords_research"]["available"])
        self.assertIn("whole-sign houses", without_coords["house_lords_research"]["reason"])

    def test_aspect_research_uses_natal_sign_geometry_only(self):
        suri = self._build()["suriyayat"]
        aspects = suri["aspects_research"]
        self.assertTrue(aspects["available"])
        self.assertTrue(aspects["research_only"])
        self.assertEqual(aspects["basis"], "traditional whole-sign relation; no Western orb substitution")
        for row in aspects["relations"]:
            self.assertIn(row["relation"]["key"], {"kum", "yok", "trikona", "leng"})
            self.assertFalse(row["orb_interpretation_applied"])
        self.assertFalse(aspects["promotion_gate"]["strength_percent_allowed"])
        self.assertFalse(aspects["promotion_gate"]["pair_meaning_allowed"])

    def test_research_rules_are_stripped_from_gemini_payload(self):
        thai = self._build()
        compact = _compact_calculation({"period": {"day_count": 1}, "thai": thai})
        suri = compact["thai"]["suriyayat"]
        for key in (
            "lagna_research", "houses_research", "house_lords_research",
            "dignities_research", "aspects_research",
        ):
            self.assertNotIn(key, suri)
        serialized = json.dumps(compact, ensure_ascii=False)
        self.assertNotIn("thai-dignities-research", serialized)
        self.assertNotIn("thai-sign-aspects-research", serialized)
        self.assertNotIn("เกษตร", serialized)
        self.assertNotIn("ตรีโกณ", serialized)

    def test_product_lagna_is_promoted_but_rule_interpretation_remains_disabled(self):
        suri = self._build()["suriyayat"]
        self.assertTrue(suri["lagna"]["available"])
        self.assertTrue(suri["dignities_research"]["research_only"])
        self.assertTrue(suri["aspects_research"]["research_only"])
        self.assertFalse(suri["dignities_research"]["promotion_gate"]["gemini_interpretation_allowed"])
        self.assertFalse(suri["aspects_research"]["promotion_gate"]["gemini_interpretation_allowed"])
        self.assertNotIn("score", suri["dignities_research"])
        self.assertNotIn("prediction", suri["aspects_research"])
        product_gate = suri["lagna_product_promotion"]["promotion_gate"]
        self.assertFalse(product_gate["exception_application_allowed"])
        self.assertFalse(product_gate["predictive_interpretation_allowed"])
        self.assertFalse(product_gate["event_judgement_allowed"])
        self.assertFalse(product_gate["scores_allowed"])


if __name__ == "__main__":
    unittest.main()
