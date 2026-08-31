# -*- coding: utf-8 -*-
from __future__ import annotations

import unittest
from datetime import date, time

from thai_houses_v1 import (
    build_whole_sign_houses_research,
    house_number_for_sign,
    sign_index_from_longitude,
)
from thai_lagna_v1 import calculate_common_anto_0600


class ThaiWholeSignHousePhase2ATests(unittest.TestCase):
    def test_twelve_houses_are_unique_and_start_from_lagna_sign(self):
        result = build_whole_sign_houses_research(lagna_longitude_deg=350.266667)
        houses = result["houses"]
        self.assertEqual(len(houses), 12)
        self.assertEqual([row["house_number"] for row in houses], list(range(1, 13)))
        self.assertEqual(len({row["sign_index"] for row in houses}), 12)
        self.assertEqual(houses[0]["sign_index"], 11)  # Pisces
        self.assertEqual(houses[1]["sign_index"], 0)   # Aries
        self.assertEqual(houses[-1]["sign_index"], 10) # Aquarius

    def test_planet_house_mapping_is_sign_relative_only(self):
        result = build_whole_sign_houses_research(
            lagna_longitude_deg=350.266667,
            planet_positions={
                "same_sign": {"longitude_deg": 359.99},
                "next_sign": {"longitude_deg": 0.01},
                "previous_sign": {"longitude_deg": 329.99},
                "opposite_sign": {"sign_index": 5},
            },
        )
        placements = result["planet_placements"]
        self.assertEqual(placements["same_sign"]["house_number"], 1)
        self.assertEqual(placements["next_sign"]["house_number"], 2)
        self.assertEqual(placements["previous_sign"]["house_number"], 12)
        self.assertEqual(placements["opposite_sign"]["house_number"], 7)

    def test_exact_zodiac_boundary_changes_house_sign_without_quadrant_cusp(self):
        self.assertEqual(sign_index_from_longitude(359.999999), 11)
        self.assertEqual(sign_index_from_longitude(0.0), 0)
        self.assertEqual(sign_index_from_longitude(360.0), 0)
        self.assertEqual(house_number_for_sign(lagna_sign_index=11, object_sign_index=0), 2)

    def test_tokyo_independent_lmt_boundary_changes_whole_sign_house_one(self):
        legal = calculate_common_anto_0600(
            birth_date=date(1991, 3, 21), birth_time=time(7, 26),
            longitude=139.6503, utc_offset_hours=9.0,
            adjust_local_mean_time=False,
        )
        lmt = calculate_common_anto_0600(
            birth_date=date(1991, 3, 21), birth_time=time(7, 26),
            longitude=139.6503, utc_offset_hours=9.0,
            adjust_local_mean_time=True,
        )
        self.assertEqual(legal["sign_index"], 11)  # MyHora gold: Pisces 27°37′
        self.assertEqual(lmt["sign_index"], 0)     # MyHora gold: Aries 2°16′
        legal_houses = build_whole_sign_houses_research(lagna_longitude_deg=legal["longitude_deg"])
        lmt_houses = build_whole_sign_houses_research(lagna_longitude_deg=lmt["longitude_deg"])
        self.assertEqual(legal_houses["houses"][0]["sign_en"], "Pisces")
        self.assertEqual(lmt_houses["houses"][0]["sign_en"], "Aries")

    def test_phase2a_mapper_has_no_interpretation_permission(self):
        result = build_whole_sign_houses_research(lagna_longitude_deg=350.266667)
        self.assertTrue(result["research_only"])
        gate = result["promotion_gate"]
        self.assertFalse(gate["house_structure_interpretation_validated"])
        self.assertFalse(gate["houses_allowed_in_product"])
        self.assertFalse(gate["dignities_allowed"])
        self.assertFalse(gate["aspects_allowed"])
        self.assertFalse(gate["gemini_interpretation_allowed"])
        self.assertNotIn("score", result)
        self.assertNotIn("meaning", result)

    def test_invalid_nonfinite_lagna_is_rejected(self):
        for value in (float("nan"), float("inf"), float("-inf")):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    build_whole_sign_houses_research(lagna_longitude_deg=value)


if __name__ == "__main__":
    unittest.main()
