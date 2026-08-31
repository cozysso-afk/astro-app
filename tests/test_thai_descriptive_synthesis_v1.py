# -*- coding: utf-8 -*-
from __future__ import annotations

import unittest

from thai_descriptive_synthesis_v1 import build_descriptive_synthesis_research


class ThaiPhase2F2DescriptiveSynthesisTests(unittest.TestCase):
    def _graph(self):
        return {
            "available": True,
            "route_contexts": [
                {
                    "route_key": "H1:moon->H10",
                    "source_house": {"house_number": 1, "domains": ["self", "identity"]},
                    "lord_planet": {"key": "moon", "number": 2},
                    "destination_house": {"house_number": 10, "domains": ["work", "career"]},
                    "evidence": {
                        "basic_status_semantics": [
                            {"status_key": "ucca", "thai": "อุจ", "functional_direction": "elevated_strong"}
                        ],
                        "advanced_standard_keys": ["rachayok"],
                        "co_occupying_planets": ["mars"],
                        "planet_relations": [
                            {
                                "counterpart_planet": "jupiter",
                                "relation": {"key": "leng", "thai": "เล็ง"},
                                "pair_classifications": [
                                    {"key": "enemy", "thai": "คู่ศัตรู", "functional_domain": "friction_tension_conflict"},
                                    {"key": "element", "thai": "คู่ธาตุ", "functional_domain": "persistence_stability_continuity"},
                                ],
                                "pair_multi_label": True,
                            }
                        ],
                    },
                    "conflict_register": {
                        "multi_label_pair_overlap_present": True,
                        "advanced_standard_meaning_unresolved": True,
                        "aspect_strength_disputed": True,
                        "net_valence_unresolved": True,
                    },
                }
            ],
        }

    def _pairs(self):
        return {
            "planet_archetypes": {
                "moon": {
                    "key": "moon", "number": 2,
                    "domains": ["emotion", "care", "adaptation", "appearance", "change"],
                }
            }
        }

    def _build(self):
        return build_descriptive_synthesis_research(
            context_graph_research=self._graph(),
            planet_pairs_research=self._pairs(),
        )

    def test_route_composition_preserves_source_lord_destination(self):
        row = self._build()["route_descriptions"][0]["composition"]
        self.assertEqual(row["source_topic_domains"], ["self", "identity"])
        self.assertEqual(row["carrier_planet"]["key"], "moon")
        self.assertEqual(row["destination_context_domains"], ["work", "career"])

    def test_planet_archetype_domains_are_joined(self):
        row = self._build()["route_descriptions"][0]["composition"]
        self.assertIn("emotion", row["carrier_planet"]["archetype_domains"])
        self.assertIn("change", row["carrier_planet"]["archetype_domains"])

    def test_basic_status_is_only_a_functional_modifier(self):
        mod = self._build()["route_descriptions"][0]["composition"]["basic_status_modifiers"][0]
        self.assertEqual(mod["functional_direction"], "elevated_strong")
        self.assertEqual(mod["scope"], "lord_function_only_not_event_outcome")

    def test_multilabel_pair_classes_are_preserved_without_net_effect(self):
        rel = self._build()["route_descriptions"][0]["composition"]["relation_context_tags"][0]
        self.assertEqual([x["key"] for x in rel["pair_classes"]], ["enemy", "element"])
        self.assertTrue(rel["pair_multi_label"])
        self.assertIsNone(rel["strength_percent"])
        self.assertIsNone(rel["net_effect"])

    def test_advanced_standard_remains_unresolved(self):
        row = self._build()["route_descriptions"][0]
        self.assertEqual(row["unresolved"]["advanced_standard_keys"], ["rachayok"])
        self.assertIsNone(row["unresolved"]["advanced_standard_meaning"])

    def test_no_event_timing_probability_or_score_is_created(self):
        row = self._build()["route_descriptions"][0]
        self.assertIsNone(row["unresolved"]["event_outcome"])
        self.assertIsNone(row["unresolved"]["timing"])
        self.assertIsNone(row["unresolved"]["probability"])
        self.assertIsNone(row["unresolved"]["score"])
        self.assertIsNone(row["final_interpretation"])
        self.assertIsNone(row["prediction"])
        self.assertIsNone(row["score"])

    def test_descriptive_gate_opens_only_nonpredictive_composition(self):
        gate = self._build()["promotion_gate"]
        self.assertTrue(gate["descriptive_composition_validated"])
        self.assertTrue(gate["planet_archetype_context_validated"])
        self.assertTrue(gate["basic_status_modifier_validated"])
        self.assertTrue(gate["relation_tag_composition_validated"])
        self.assertFalse(gate["net_valence_allowed"])
        self.assertFalse(gate["final_interpretation_allowed"])
        self.assertFalse(gate["event_judgement_allowed"])
        self.assertFalse(gate["timing_prediction_allowed"])
        self.assertFalse(gate["probability_allowed"])
        self.assertFalse(gate["scores_allowed"])
        self.assertFalse(gate["gemini_interpretation_allowed"])

    def test_missing_context_graph_does_not_fabricate_synthesis(self):
        result = build_descriptive_synthesis_research(
            context_graph_research={"available": False},
            planet_pairs_research={},
        )
        self.assertFalse(result["available"])
        self.assertEqual(result["route_descriptions"], [])


if __name__ == "__main__":
    unittest.main()
