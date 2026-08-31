# -*- coding: utf-8 -*-
from __future__ import annotations

import unittest

from thai_aspects_v1 import build_aspect_research, classify_sign_relation


class ThaiAspectPhase2B2Tests(unittest.TestCase):
    def test_same_sign_is_kum(self):
        result = classify_sign_relation(first_sign_index=0, second_sign_index=0)
        self.assertEqual(result["key"], "kum")
        self.assertEqual(result["thai"], "กุม")
        self.assertEqual(result["house_counts"], (1,))

    def test_third_eleventh_sign_count_is_yok(self):
        forward = classify_sign_relation(first_sign_index=0, second_sign_index=2)
        backward = classify_sign_relation(first_sign_index=0, second_sign_index=10)
        self.assertEqual(forward["key"], "yok")
        self.assertEqual(backward["key"], "yok")
        self.assertEqual(forward["house_counts"], (3, 11))

    def test_fifth_ninth_sign_count_is_trikona(self):
        self.assertEqual(classify_sign_relation(first_sign_index=1, second_sign_index=5)["key"], "trikona")
        self.assertEqual(classify_sign_relation(first_sign_index=1, second_sign_index=9)["key"], "trikona")

    def test_seventh_sign_count_is_leng(self):
        result = classify_sign_relation(first_sign_index=3, second_sign_index=9)
        self.assertEqual(result["key"], "leng")
        self.assertEqual(result["thai"], "เล็ง")
        self.assertEqual(result["house_counts"], (7,))

    def test_unlisted_sign_relation_is_none(self):
        self.assertIsNone(classify_sign_relation(first_sign_index=0, second_sign_index=1))
        self.assertIsNone(classify_sign_relation(first_sign_index=0, second_sign_index=3))
        self.assertIsNone(classify_sign_relation(first_sign_index=0, second_sign_index=5))

    def test_exact_longitude_does_not_replace_sign_based_rule(self):
        result = build_aspect_research({
            "a": {"sign_index": 0, "longitude_deg": 0.1},
            "b": {"sign_index": 0, "longitude_deg": 29.9},
            "c": {"sign_index": 2, "longitude_deg": 60.0},
        })
        pair = {(row["first"], row["second"]): row for row in result["relations"]}
        self.assertEqual(pair[("a", "b")]["relation"]["key"], "kum")
        self.assertAlmostEqual(pair[("a", "b")]["exact_longitude_separation_deg"], 29.8)
        self.assertFalse(pair[("a", "b")]["orb_interpretation_applied"])
        self.assertEqual(pair[("a", "c")]["relation"]["key"], "yok")

    def test_research_gate_forbids_strength_and_meaning(self):
        result = build_aspect_research({
            "sun": {"sign_index": 0},
            "moon": {"sign_index": 6},
        })
        self.assertTrue(result["research_only"])
        gate = result["promotion_gate"]
        self.assertTrue(gate["sign_geometry_rule_documented"])
        self.assertFalse(gate["strength_percent_allowed"])
        self.assertFalse(gate["pair_meaning_allowed"])
        self.assertFalse(gate["event_judgement_allowed"])
        self.assertFalse(gate["gemini_interpretation_allowed"])


if __name__ == "__main__":
    unittest.main()
