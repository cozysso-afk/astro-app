# -*- coding: utf-8 -*-
from __future__ import annotations

import unittest

from thai_dignities_v1 import (
    DIGNITY_SIGNS,
    SIGN_LORDS,
    build_dignity_research,
    build_house_lords_research,
    dignity_statuses_for_planet,
    house_lord_for_sign,
)


class ThaiDignityPhase2B1Tests(unittest.TestCase):
    def test_sign_lord_table_matches_kaset_reference(self):
        expected = (
            "mars", "venus", "mercury", "moon", "sun", "mercury",
            "venus", "mars", "jupiter", "saturn", "rahu", "jupiter",
        )
        self.assertEqual(SIGN_LORDS, expected)
        for sign_index, key in enumerate(expected):
            with self.subTest(sign_index=sign_index):
                self.assertEqual(house_lord_for_sign(sign_index)["key"], key)

    def test_kaset_and_pra_tables_match_reference(self):
        expected_kaset = {
            "sun": (4,), "moon": (3,), "mars": (0, 7), "mercury": (2, 5),
            "jupiter": (8, 11), "venus": (1, 6), "saturn": (9,), "rahu": (10,),
        }
        expected_pra = {
            "sun": (10,), "moon": (9,), "mars": (1, 6), "mercury": (8, 11),
            "jupiter": (2, 5), "venus": (0, 7), "saturn": (3,), "rahu": (4,),
        }
        self.assertEqual(DIGNITY_SIGNS["kaset"], expected_kaset)
        self.assertEqual(DIGNITY_SIGNS["pra"], expected_pra)

    def test_ucca_and_nicha_tables_match_reference(self):
        expected_ucca = {
            "sun": (0,), "moon": (1,), "mars": (9,), "mercury": (5,),
            "jupiter": (3,), "venus": (11,), "saturn": (6,), "rahu": (7,),
        }
        expected_nicha = {
            "sun": (6,), "moon": (7,), "mars": (3,), "mercury": (11,),
            "jupiter": (9,), "venus": (5,), "saturn": (0,), "rahu": (1,),
        }
        self.assertEqual(DIGNITY_SIGNS["ucca"], expected_ucca)
        self.assertEqual(DIGNITY_SIGNS["nicha"], expected_nicha)

    def test_statuses_allow_overlap_without_forced_ranking(self):
        mercury_virgo = dignity_statuses_for_planet(planet_key="mercury", sign_index=5)
        self.assertEqual([row["key"] for row in mercury_virgo], ["kaset", "ucca"])
        venus_virgo = dignity_statuses_for_planet(planet_key="venus", sign_index=5)
        self.assertEqual([row["key"] for row in venus_virgo], ["nicha"])

    def test_unsupported_ketu_and_uranus_are_explicit(self):
        result = build_dignity_research({
            "thai_ketu": {"sign_index": 0},
            "uranus": {"sign_index": 1},
        })
        for key in ("thai_ketu", "uranus"):
            self.assertFalse(result["planets"][key]["supported"])
            self.assertEqual(result["planets"][key]["statuses"], [])
            self.assertIn("No validated basic dignity table", result["planets"][key]["unsupported_reason"])

    def test_house_lords_follow_whole_sign_house_rows(self):
        houses = [
            {"house_number": 1, "sign_index": 11},
            {"house_number": 2, "sign_index": 0},
            {"house_number": 3, "sign_index": 1},
        ]
        result = build_house_lords_research(houses)
        self.assertEqual([row["lord"]["key"] for row in result["houses"]], ["jupiter", "mars", "venus"])
        self.assertFalse(result["promotion_gate"]["house_lord_interpretation_allowed"])
        self.assertFalse(result["promotion_gate"]["gemini_interpretation_allowed"])

    def test_dignity_output_contains_no_score_or_prediction(self):
        result = build_dignity_research({"sun": {"sign_index": 0}})
        self.assertTrue(result["research_only"])
        self.assertTrue(result["promotion_gate"]["table_facts_validated"])
        self.assertFalse(result["promotion_gate"]["scores_allowed"])
        self.assertFalse(result["promotion_gate"]["event_judgement_allowed"])
        self.assertFalse(result["promotion_gate"]["gemini_interpretation_allowed"])
        self.assertNotIn("score", result["planets"]["sun"])
        self.assertNotIn("prediction", result["planets"]["sun"])


if __name__ == "__main__":
    unittest.main()
