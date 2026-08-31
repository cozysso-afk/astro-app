# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import unittest
from datetime import date, time

from ai_interpret_v1 import _compact_calculation
from thai_astrology_v2 import build_thai_fortune
from thai_dignities_v1 import ADVANCED_STANDARD_SIGNS, advanced_standard_statuses_for_planet
from thai_houses_v1 import HOUSE_NAMES, build_whole_sign_houses_research


class ThaiPhase2CLabelsAndStandardsTests(unittest.TestCase):
    def test_house_name_sequence_matches_thai_reference(self):
        expected = (
            ("tanu", "ตนุ"),
            ("kutumba", "กฎุมพะ"),
            ("sahajja", "สหัชชะ"),
            ("bandhu", "พันธุ"),
            ("putta", "ปุตตะ"),
            ("ari", "อริ"),
            ("patni", "ปัตนิ"),
            ("marana", "มรณะ"),
            ("subha", "ศุภะ"),
            ("kamma", "กัมมะ"),
            ("labha", "ลาภะ"),
            ("vinasa", "วินาศ"),
        )
        self.assertEqual(HOUSE_NAMES, expected)
        houses = build_whole_sign_houses_research(lagna_longitude_deg=350.266667)["houses"]
        self.assertEqual(
            [(row["house_name_key"], row["house_name_thai"]) for row in houses],
            list(expected),
        )

    def test_house_labels_do_not_enable_house_meanings(self):
        result = build_whole_sign_houses_research(lagna_longitude_deg=350.266667)
        gate = result["promotion_gate"]
        self.assertTrue(gate["house_name_labels_validated"])
        self.assertFalse(gate["house_meanings_allowed"])
        self.assertFalse(gate["houses_allowed_in_product"])
        self.assertFalse(gate["gemini_interpretation_allowed"])
        for row in result["houses"]:
            self.assertNotIn("meaning", row)
            self.assertNotIn("score", row)

    def test_rachayok_and_thewiyok_tables_match_reference(self):
        self.assertEqual(ADVANCED_STANDARD_SIGNS["rachayok"], {
            "sun": (2,), "moon": (5,), "mars": (1,), "mercury": (4,),
            "jupiter": (0,), "venus": (3,), "saturn": (7,), "rahu": (6,),
        })
        self.assertEqual(ADVANCED_STANDARD_SIGNS["thewiyok"], {
            "sun": (8,), "moon": (11,), "mars": (7,), "mercury": (10,),
            "jupiter": (6,), "venus": (9,), "saturn": (1,), "rahu": (0,),
        })

    def test_mahachak_and_julachak_tables_match_reference(self):
        self.assertEqual(ADVANCED_STANDARD_SIGNS["mahachak"], {
            "sun": (3,), "moon": (0,), "mars": (5,), "mercury": (4,),
            "jupiter": (7,), "venus": (8,), "saturn": (1,), "rahu": (9,),
        })
        self.assertEqual(ADVANCED_STANDARD_SIGNS["julachak"], {
            "sun": (9,), "moon": (6,), "mars": (11,), "mercury": (10,),
            "jupiter": (1,), "venus": (2,), "saturn": (7,), "rahu": (3,),
        })

    def test_advanced_statuses_can_coexist_without_ranking(self):
        mercury_leo = advanced_standard_statuses_for_planet(planet_key="mercury", sign_index=4)
        self.assertEqual([row["key"] for row in mercury_leo], ["rachayok", "mahachak"])
        saturn_taurus = advanced_standard_statuses_for_planet(planet_key="saturn", sign_index=1)
        self.assertEqual([row["key"] for row in saturn_taurus], ["thewiyok", "mahachak"])

    def test_real_calculation_contains_labels_and_advanced_facts_but_ai_does_not(self):
        thai = build_thai_fortune(
            birth_date=date(1991, 3, 21), birth_time=time(7, 26),
            start_date=date(2026, 8, 31), end_date=date(2026, 8, 31),
            utc_offset_hours=9.0, latitude=34.7604, longitude=127.6622,
        )
        suri = thai["suriyayat"]
        self.assertTrue(suri["houses_research"]["promotion_gate"]["house_name_labels_validated"])
        self.assertTrue(suri["dignities_research"]["promotion_gate"]["advanced_standard_table_facts_validated"])
        compact = _compact_calculation({"period": {"day_count": 1}, "thai": thai})
        serialized = json.dumps(compact, ensure_ascii=False)
        for marker in ("ราชาโชค", "เทวีโชค", "มหาจักร", "จุลจักร", "house_name_thai"):
            self.assertNotIn(marker, serialized)

    def test_no_prediction_permissions_opened(self):
        thai = build_thai_fortune(
            birth_date=date(1991, 3, 21), birth_time=time(7, 26),
            start_date=date(2026, 8, 31), end_date=date(2026, 8, 31),
            utc_offset_hours=9.0, latitude=34.7604, longitude=127.6622,
        )
        dignity = thai["suriyayat"]["dignities_research"]
        self.assertFalse(dignity["promotion_gate"]["interpretive_strength_validated"])
        self.assertFalse(dignity["promotion_gate"]["scores_allowed"])
        self.assertFalse(dignity["promotion_gate"]["event_judgement_allowed"])
        self.assertFalse(dignity["promotion_gate"]["gemini_interpretation_allowed"])


if __name__ == "__main__":
    unittest.main()
