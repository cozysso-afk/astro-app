# -*- coding: utf-8 -*-
from __future__ import annotations

import unittest

from thai_planet_pairs_v1 import (
    PAIR_TABLES,
    PLANET_ARCHETYPES,
    build_planet_pair_research,
    classify_pair,
    pair_relationship,
    planet_archetype,
)


class ThaiPhase2E1PlanetPairTests(unittest.TestCase):
    def test_eight_traditional_planet_archetypes_are_present_without_scores(self):
        self.assertEqual(
            list(PLANET_ARCHETYPES),
            ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn", "rahu"],
        )
        for key in PLANET_ARCHETYPES:
            row = planet_archetype(key)
            self.assertTrue(row["domains"])
            self.assertIsNone(row["prediction"])
            self.assertIsNone(row["score"])

    def test_friend_table_matches_traditional_pairs(self):
        self.assertEqual(
            PAIR_TABLES["friend"]["pairs"],
            (("sun", "jupiter"), ("moon", "mercury"), ("mars", "venus"), ("saturn", "rahu")),
        )

    def test_enemy_table_matches_traditional_pairs(self):
        self.assertEqual(
            PAIR_TABLES["enemy"]["pairs"],
            (("sun", "mars"), ("moon", "jupiter"), ("mercury", "rahu"), ("venus", "saturn")),
        )

    def test_element_and_equal_power_tables_match_traditional_pairs(self):
        self.assertEqual(
            PAIR_TABLES["element"]["pairs"],
            (("sun", "saturn"), ("moon", "jupiter"), ("mars", "rahu"), ("mercury", "venus")),
        )
        self.assertEqual(
            PAIR_TABLES["equal_power"]["pairs"],
            (("sun", "venus"), ("moon", "rahu"), ("mars", "jupiter"), ("mercury", "saturn")),
        )

    def test_moon_jupiter_overlap_is_preserved_not_collapsed(self):
        self.assertEqual(classify_pair("moon", "jupiter"), ["enemy", "element"])
        row = pair_relationship("moon", "jupiter")
        self.assertTrue(row["multi_label"])
        self.assertEqual([x["key"] for x in row["classifications"]], ["enemy", "element"])
        self.assertIsNone(row["combined_judgement"])
        self.assertIsNone(row["prediction"])
        self.assertIsNone(row["score"])

    def test_pair_classes_are_context_dependent_not_intrinsic_good_bad_scores(self):
        for pair in (("sun", "jupiter"), ("sun", "mars"), ("sun", "saturn"), ("sun", "venus")):
            row = pair_relationship(*pair)
            self.assertTrue(row["classifications"])
            for cls in row["classifications"]:
                self.assertEqual(cls["valence"], "context_dependent")
                self.assertIsNone(cls["prediction"])
                self.assertIsNone(cls["score"])

    def test_ketu_and_uranus_are_not_forced_into_eight_planet_pair_system(self):
        with self.assertRaises(ValueError):
            classify_pair("sun", "ketu")
        with self.assertRaises(ValueError):
            classify_pair("uranus", "saturn")

    def test_active_tags_require_an_existing_thai_sign_relation(self):
        aspects = {
            "available": True,
            "relations": [
                {
                    "first": "moon",
                    "second": "jupiter",
                    "relation": {"key": "trikona", "thai": "ตรีโกณ", "basis": "whole-sign relation"},
                },
                {
                    "first": "sun",
                    "second": "mercury",
                    "relation": {"key": "kum", "thai": "กุม", "basis": "whole-sign relation"},
                },
                {
                    "first": "ketu",
                    "second": "sun",
                    "relation": {"key": "leng", "thai": "เล็ง", "basis": "whole-sign relation"},
                },
            ],
        }
        result = build_planet_pair_research(aspects)
        self.assertEqual(len(result["active_natal_pair_tags"]), 1)
        row = result["active_natal_pair_tags"][0]
        self.assertEqual((row["first"], row["second"]), ("moon", "jupiter"))
        self.assertEqual([x["key"] for x in row["classifications"]], ["enemy", "element"])
        self.assertEqual(row["sign_relation"]["key"], "trikona")

    def test_promotion_gate_keeps_judgement_and_gemini_closed(self):
        result = build_planet_pair_research({"available": True, "relations": []})
        gate = result["promotion_gate"]
        self.assertTrue(gate["planet_archetype_vocabulary_validated"])
        self.assertTrue(gate["pair_membership_tables_validated"])
        self.assertTrue(gate["multi_label_overlap_preserved"])
        self.assertFalse(gate["pair_net_valence_allowed"])
        self.assertFalse(gate["pair_strength_score_allowed"])
        self.assertFalse(gate["combined_judgement_allowed"])
        self.assertFalse(gate["event_judgement_allowed"])
        self.assertFalse(gate["gemini_interpretation_allowed"])


if __name__ == "__main__":
    unittest.main()
