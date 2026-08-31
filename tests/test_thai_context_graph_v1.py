# -*- coding: utf-8 -*-
from __future__ import annotations

import unittest

from thai_context_graph_v1 import build_context_graph_research


class ThaiPhase2F1ContextGraphTests(unittest.TestCase):
    def _fixture(self):
        routes = {
            "available": True,
            "routes": [
                {
                    "route_key": "H1:moon->H10",
                    "source_house": {"house_number": 1, "domains": ["self"]},
                    "lord_planet": {"key": "moon", "number": 2},
                    "destination_house": {"house_number": 10, "domains": ["work"]},
                    "lord_position_context": {
                        "advanced_standard_keys": ["rachayok"],
                    },
                },
                {
                    "route_key": "H2:mars->H10",
                    "source_house": {"house_number": 2, "domains": ["money"]},
                    "lord_planet": {"key": "mars", "number": 3},
                    "destination_house": {"house_number": 10, "domains": ["work"]},
                    "lord_position_context": {"advanced_standard_keys": []},
                },
            ],
        }
        houses = {
            "planet_placements": {
                "moon": {"house_number": 10},
                "mars": {"house_number": 10},
                "jupiter": {"house_number": 4},
                "thai_ketu": {"house_number": 10},
            }
        }
        aspects = {
            "relations": [
                {
                    "first": "moon",
                    "second": "jupiter",
                    "relation": {"key": "leng", "thai": "เล็ง", "house_counts": (7,), "basis": "whole-sign relation"},
                    "exact_longitude_separation_deg": 179.5,
                },
                {
                    "first": "moon",
                    "second": "thai_ketu",
                    "relation": {"key": "yok", "thai": "โยค", "house_counts": (3, 11), "basis": "whole-sign relation"},
                    "exact_longitude_separation_deg": 61.2,
                },
            ]
        }
        pairs = {
            "active_natal_pair_tags": [
                {
                    "first": "moon",
                    "second": "jupiter",
                    "classifications": [
                        {"key": "enemy", "thai": "คู่ศัตรู", "functional_domain": "friction_tension_conflict"},
                        {"key": "element", "thai": "คู่ธาตุ", "functional_domain": "persistence_stability_continuity"},
                    ],
                    "multi_label": True,
                }
            ]
        }
        semantics = {
            "planet_status_semantics": {
                "moon": {
                    "basic_status_semantics": [
                        {
                            "status_key": "ucca",
                            "thai": "อุจ",
                            "functional_direction": "elevated_strong",
                            "keywords": ["elevated"],
                        }
                    ]
                },
                "mars": {"basic_status_semantics": []},
            }
        }
        policy = {
            "rules": {
                "aspect_strength": {"status": "numeric_conflict_blocked"},
                "combined_judgement": {
                    "status": "blocked_requires_context_model",
                    "required_context": (
                        "planet_nature_and_meaning",
                        "house_lordship",
                        "occupied_house",
                        "basic_and_advanced_statuses",
                        "planet_pair_relationships",
                        "aspect_relations",
                        "natal_vs_transit_role",
                        "school_policy",
                    ),
                },
            }
        }
        return routes, houses, aspects, pairs, semantics, policy

    def _build(self):
        return build_context_graph_research(
            house_lord_routes_research=self._fixture()[0],
            houses_research=self._fixture()[1],
            aspects_research=self._fixture()[2],
            planet_pairs_research=self._fixture()[3],
            semantics_research=self._fixture()[4],
            interpretation_policy_research=self._fixture()[5],
        )

    def test_route_contexts_preserve_source_order(self):
        graph = self._build()
        self.assertTrue(graph["available"])
        self.assertEqual([r["source_house"]["house_number"] for r in graph["route_contexts"]], [1, 2])

    def test_basic_status_semantics_are_joined_without_judgement(self):
        row = self._build()["route_contexts"][0]
        statuses = row["evidence"]["basic_status_semantics"]
        self.assertEqual(statuses[0]["status_key"], "ucca")
        self.assertEqual(statuses[0]["functional_direction"], "elevated_strong")
        self.assertIsNone(row["net_valence"])
        self.assertIsNone(row["combined_judgement"])

    def test_co_occupants_include_supported_and_unsupported_pair_bodies(self):
        row = self._build()["route_contexts"][0]
        self.assertEqual(row["evidence"]["co_occupying_planets"], ["mars", "thai_ketu"])

    def test_multilabel_moon_jupiter_is_preserved(self):
        row = self._build()["route_contexts"][0]
        rel = next(r for r in row["evidence"]["planet_relations"] if r["counterpart_planet"] == "jupiter")
        self.assertTrue(rel["pair_multi_label"])
        self.assertEqual([x["key"] for x in rel["pair_classifications"]], ["enemy", "element"])
        self.assertIsNone(rel["pair_net_valence"])
        self.assertTrue(row["conflict_register"]["multi_label_pair_overlap_present"])

    def test_ketu_relation_can_exist_without_forced_pair_class(self):
        row = self._build()["route_contexts"][0]
        rel = next(r for r in row["evidence"]["planet_relations"] if r["counterpart_planet"] == "thai_ketu")
        self.assertEqual(rel["pair_classifications"], [])
        self.assertFalse(rel["pair_multi_label"])

    def test_aspect_strength_is_never_canonicalized(self):
        graph = self._build()
        self.assertEqual(graph["blocked_rule_snapshot"]["aspect_strength_status"], "numeric_conflict_blocked")
        self.assertIsNone(graph["blocked_rule_snapshot"]["aspect_strength_canonical_percent"])
        for row in graph["route_contexts"]:
            for rel in row["evidence"]["planet_relations"]:
                self.assertIsNone(rel["aspect_strength_percent"])

    def test_advanced_standard_presence_marks_unresolved_meaning(self):
        row = self._build()["route_contexts"][0]
        self.assertEqual(row["evidence"]["advanced_standard_keys"], ["rachayok"])
        self.assertTrue(row["conflict_register"]["advanced_standard_meaning_unresolved"])

    def test_no_scores_predictions_or_net_valence_are_created(self):
        graph = self._build()
        for row in graph["route_contexts"]:
            self.assertIsNone(row["score"])
            self.assertIsNone(row["prediction"])
            self.assertIsNone(row["net_valence"])
            self.assertIsNone(row["combined_judgement"])

    def test_all_synthesis_gates_stay_closed(self):
        gate = self._build()["promotion_gate"]
        self.assertTrue(gate["context_graph_structure_validated"])
        self.assertTrue(gate["pair_multilabel_join_validated"])
        self.assertFalse(gate["aspect_strength_canonicalized"])
        self.assertFalse(gate["net_valence_allowed"])
        self.assertFalse(gate["combined_judgement_allowed"])
        self.assertFalse(gate["scores_allowed"])
        self.assertFalse(gate["event_judgement_allowed"])
        self.assertFalse(gate["gemini_interpretation_allowed"])

    def test_missing_route_layer_does_not_fabricate_graph(self):
        graph = build_context_graph_research(
            house_lord_routes_research={"available": False},
            houses_research={}, aspects_research={}, planet_pairs_research={},
            semantics_research={}, interpretation_policy_research={},
        )
        self.assertFalse(graph["available"])
        self.assertEqual(graph["route_contexts"], [])


if __name__ == "__main__":
    unittest.main()
