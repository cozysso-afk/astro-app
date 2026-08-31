# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import unittest
from datetime import date, time

from ai_interpret_v1 import _compact_calculation
from thai_astrology_v2 import build_thai_fortune
from thai_semantics_v1 import BASIC_STATUS_SEMANTICS, HOUSE_DOMAINS, basic_status_semantics, build_semantics_research, house_semantics


class ThaiPhase2D1SemanticVocabularyTests(unittest.TestCase):
    def test_all_twelve_house_domains_are_present_without_predictions(self):
        self.assertEqual(set(HOUSE_DOMAINS), set(range(1, 13)))
        expected_names = [
            "ตนุ", "กฎุมพะ", "สหัชชะ", "พันธุ", "ปุตตะ", "อริ",
            "ปัตนิ", "มรณะ", "ศุภะ", "กัมมะ", "ลาภะ", "วินาศ",
        ]
        self.assertEqual([HOUSE_DOMAINS[i]["thai"] for i in range(1, 13)], expected_names)
        for number in range(1, 13):
            row = house_semantics(number)
            self.assertTrue(row["domains"])
            self.assertIsNone(row["prediction"])
            self.assertIsNone(row["score"])

    def test_core_house_domains_cover_cross_source_consensus(self):
        self.assertIn("self", house_semantics(1)["domains"])
        self.assertIn("money", house_semantics(2)["domains"])
        self.assertIn("communication", house_semantics(3)["domains"])
        self.assertIn("home", house_semantics(4)["domains"])
        self.assertIn("children", house_semantics(5)["domains"])
        self.assertIn("obstacles", house_semantics(6)["domains"])
        self.assertIn("partner", house_semantics(7)["domains"])
        self.assertIn("inheritance", house_semantics(8)["domains"])
        self.assertIn("higher_education", house_semantics(9)["domains"])
        self.assertIn("work", house_semantics(10)["domains"])
        self.assertIn("gains", house_semantics(11)["domains"])
        self.assertIn("hidden_matters", house_semantics(12)["domains"])

    def test_basic_status_direction_is_conservative_and_non_numeric(self):
        expected = {
            "kaset": "stable_strong",
            "pra": "unstable_reduced",
            "ucca": "elevated_strong",
            "nicha": "weakened",
        }
        self.assertEqual(set(BASIC_STATUS_SEMANTICS), set(expected))
        for key, direction in expected.items():
            row = basic_status_semantics(key)
            self.assertEqual(row["functional_direction"], direction)
            self.assertIsNone(row["prediction"])
            self.assertIsNone(row["score"])

    def test_advanced_standards_and_aspect_meanings_remain_uninterpreted(self):
        research = build_semantics_research(
            houses_research={"available": True, "houses": [{"house_number": 1}]},
            dignities_research={
                "available": True,
                "planets": {
                    "mercury": {
                        "statuses": [{"key": "kaset"}, {"key": "ucca"}],
                        "advanced_standards": [{"key": "rachayok"}, {"key": "mahachak"}],
                    }
                },
            },
        )
        planet = research["planet_status_semantics"]["mercury"]
        self.assertEqual(
            [row["status_key"] for row in planet["basic_status_semantics"]],
            ["kaset", "ucca"],
        )
        self.assertEqual(planet["advanced_standard_semantics"], [])
        self.assertIsNone(planet["combined_judgement"])
        gate = research["promotion_gate"]
        self.assertFalse(gate["advanced_standard_meanings_validated"])
        self.assertFalse(gate["aspect_pair_meanings_validated"])
        self.assertFalse(gate["combined_judgement_validated"])

    def test_no_event_score_or_gemini_permission_is_opened(self):
        research = build_semantics_research(
            houses_research={"available": True, "houses": [{"house_number": 10}]},
            dignities_research={"available": True, "planets": {}},
        )
        gate = research["promotion_gate"]
        self.assertTrue(gate["neutral_house_domains_validated"])
        self.assertTrue(gate["basic_status_direction_validated"])
        self.assertFalse(gate["scores_allowed"])
        self.assertFalse(gate["event_judgement_allowed"])
        self.assertFalse(gate["gemini_interpretation_allowed"])

    def test_research_semantics_stay_out_while_safe_vocabulary_is_whitelisted(self):
        thai = build_thai_fortune(
            birth_date=date(1991, 3, 21), birth_time=time(7, 26),
            start_date=date(2026, 8, 31), end_date=date(2026, 8, 31),
            utc_offset_hours=9.0, latitude=34.7604, longitude=127.6622,
        )
        suri = thai["suriyayat"]
        # The integration workflow attaches semantics_research before this test runs.
        self.assertIn("semantics_research", suri)
        self.assertTrue(suri["semantics_research"]["research_only"])
        compact = _compact_calculation({"period": {"day_count": 1}, "thai": thai})
        compact_suri = compact["thai"]["suriyayat"]
        # Test the actual data contract: the research object itself must not be
        # whitelisted. Descriptive engine/status strings may legitimately contain
        # the word "semantics" and are not research payload leakage.
        self.assertNotIn("semantics_research", compact_suri)
        serialized_suri = json.dumps(compact_suri, ensure_ascii=False)
        self.assertIn("basic_status_modifiers", serialized_suri)
        self.assertIn("source_topic_domains", serialized_suri)
        for forbidden in (
            "advanced_standard_semantics", "combined_judgement", "prediction",
            "score", "probability", "aspect_strength_percent",
        ):
            self.assertNotIn(forbidden, serialized_suri)


if __name__ == "__main__":
    unittest.main()
