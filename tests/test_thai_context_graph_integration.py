# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import unittest
from datetime import date, time

from ai_interpret_v1 import _compact_calculation
from thai_astrology_v2 import build_thai_fortune


class ThaiPhase2F1ContextGraphIntegrationTests(unittest.TestCase):
    def _thai(self):
        return build_thai_fortune(
            birth_date=date(1991, 3, 21), birth_time=time(7, 26),
            start_date=date(2026, 8, 31), end_date=date(2026, 8, 31),
            utc_offset_hours=9.0, latitude=34.7604, longitude=127.6622,
        )

    def test_real_calculation_exposes_twelve_context_bundles(self):
        graph = self._thai()["suriyayat"]["context_graph_research"]
        self.assertTrue(graph["available"])
        self.assertTrue(graph["research_only"])
        self.assertEqual(len(graph["route_contexts"]), 12)
        self.assertEqual(
            [x["source_house"]["house_number"] for x in graph["route_contexts"]],
            list(range(1, 13)),
        )

    def test_real_context_graph_never_creates_hidden_score_or_prediction(self):
        graph = self._thai()["suriyayat"]["context_graph_research"]
        for row in graph["route_contexts"]:
            self.assertIsNone(row["net_valence"])
            self.assertIsNone(row["combined_judgement"])
            self.assertIsNone(row["prediction"])
            self.assertIsNone(row["score"])
            for rel in row["evidence"]["planet_relations"]:
                self.assertIsNone(rel["aspect_strength_percent"])
                self.assertIsNone(rel["pair_net_valence"])
                self.assertIsNone(rel["combined_effect"])
                self.assertIsNone(rel["prediction"])
                self.assertIsNone(rel["score"])

    def test_real_context_graph_preserves_pair_overlap_if_active(self):
        suri = self._thai()["suriyayat"]
        active = suri["planet_pairs_research"]["active_natal_pair_tags"]
        graph = suri["context_graph_research"]
        expected = {
            frozenset((row["first"], row["second"])): [x["key"] for x in row["classifications"]]
            for row in active
            if row.get("classifications")
        }
        observed = {}
        for route in graph["route_contexts"]:
            lord = route["lord_planet"]["key"]
            for rel in route["evidence"]["planet_relations"]:
                if rel["pair_classifications"]:
                    observed.setdefault(
                        frozenset((lord, rel["counterpart_planet"])),
                        [x["key"] for x in rel["pair_classifications"]],
                    )
        for pair, classes in observed.items():
            self.assertEqual(classes, expected[pair])

    def test_context_graph_is_stripped_from_gemini_payload(self):
        thai = self._thai()
        compact = _compact_calculation({"period": {"day_count": 1}, "thai": thai})
        compact_suri = compact["thai"]["suriyayat"]
        self.assertNotIn("context_graph_research", compact_suri)
        encoded = json.dumps(compact_suri, ensure_ascii=False)
        self.assertNotIn("multi_label_pair_overlap_present", encoded)
        self.assertNotIn("aspect_strength_canonical_percent", encoded)
        self.assertNotIn("co_occupying_planets", encoded)

    def test_product_lagna_is_promoted_but_context_graph_judgement_gates_remain_closed(self):
        thai = self._thai()
        suri = thai["suriyayat"]
        self.assertTrue(suri["lagna"]["available"])
        gate = suri["context_graph_research"]["promotion_gate"]
        self.assertFalse(gate["advanced_standard_meaning_validated"])
        self.assertFalse(gate["aspect_strength_canonicalized"])
        self.assertFalse(gate["net_valence_allowed"])
        self.assertFalse(gate["combined_judgement_allowed"])
        self.assertFalse(gate["scores_allowed"])
        self.assertFalse(gate["event_judgement_allowed"])
        self.assertFalse(gate["gemini_interpretation_allowed"])
        product_gate = suri["lagna_product_promotion"]["promotion_gate"]
        self.assertFalse(product_gate["net_valence_allowed"])
        self.assertFalse(product_gate["final_good_bad_judgement_allowed"])
        self.assertFalse(product_gate["event_judgement_allowed"])


if __name__ == "__main__":
    unittest.main()
