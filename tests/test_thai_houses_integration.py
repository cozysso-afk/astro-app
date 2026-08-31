# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import unittest
from datetime import date, time

from ai_interpret_v1 import _compact_calculation
from thai_astrology_v2 import build_thai_fortune


class ThaiWholeSignHouseResearchIntegrationTests(unittest.TestCase):
    def _yeosu(self):
        return build_thai_fortune(
            birth_date=date(1991, 3, 21),
            birth_time=time(7, 26),
            start_date=date(2026, 8, 31),
            end_date=date(2026, 8, 31),
            utc_offset_hours=9.0,
            latitude=34.7604,
            longitude=127.6622,
        )

    def test_calculation_contains_noninterpreted_house_research_layer(self):
        thai = self._yeosu()
        suri = thai["suriyayat"]
        self.assertFalse(suri["lagna"]["available"])
        houses = suri["houses_research"]
        self.assertTrue(houses["available"])
        self.assertTrue(houses["research_only"])
        self.assertEqual(houses["method"], "thai_whole_sign_from_validated_suriyayat_lagna")
        selected = suri["lagna_research"]["common_anto_0600_lmt"]
        self.assertEqual(houses["lagna_sign"]["sign_index"], selected["sign_index"])
        self.assertEqual(houses["houses"][0]["sign_index"], selected["sign_index"])
        self.assertEqual(len(houses["houses"]), 12)

    def test_natal_suriyayat_planets_are_mapped_by_sign_only(self):
        suri = self._yeosu()["suriyayat"]
        houses = suri["houses_research"]
        natal = suri["natal"]["positions"]
        self.assertEqual(set(houses["planet_placements"]), set(natal))
        lagna_sign = houses["lagna_sign"]["sign_index"]
        for key, position in natal.items():
            expected = ((int(position["sign_index"]) - lagna_sign) % 12) + 1
            self.assertEqual(houses["planet_placements"][key]["house_number"], expected, key)

    def test_missing_coordinates_do_not_fabricate_houses(self):
        result = build_thai_fortune(
            birth_date=date(1991, 3, 21), birth_time=time(7, 26),
            start_date=date(2026, 8, 31), end_date=date(2026, 8, 31),
            utc_offset_hours=9.0, latitude=None, longitude=None,
        )
        houses = result["suriyayat"]["houses_research"]
        self.assertFalse(houses["available"])
        self.assertTrue(houses["research_only"])
        self.assertIn("validated Lagna", houses["reason"])

    def test_real_integrated_calculation_still_strips_house_and_lagna_research_from_ai(self):
        thai = self._yeosu()
        compact = _compact_calculation({"period": {"day_count": 1}, "thai": thai})
        suri = compact["thai"]["suriyayat"]
        self.assertNotIn("lagna_research", suri)
        self.assertNotIn("houses_research", suri)
        serialized = json.dumps(compact, ensure_ascii=False)
        self.assertNotIn("thai_whole_sign_from_validated_suriyayat_lagna", serialized)
        self.assertNotIn("common_anto_0600_lmt", serialized)

    def test_research_house_gate_stays_closed(self):
        houses = self._yeosu()["suriyayat"]["houses_research"]
        gate = houses["promotion_gate"]
        self.assertTrue(gate["lagna_numeric_position_required"])
        self.assertFalse(gate["house_structure_interpretation_validated"])
        self.assertFalse(gate["houses_allowed_in_product"])
        self.assertFalse(gate["dignities_allowed"])
        self.assertFalse(gate["aspects_allowed"])
        self.assertFalse(gate["gemini_interpretation_allowed"])


if __name__ == "__main__":
    unittest.main()
