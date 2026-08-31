# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import unittest
from datetime import date, time

from ai_interpret_v1 import _compact_calculation
from thai_astrology_v2 import build_thai_fortune


class ThaiPhase2E1PlanetPairIntegrationTests(unittest.TestCase):
    def _thai(self):
        return build_thai_fortune(
            birth_date=date(1991, 3, 21),
            birth_time=time(7, 26),
            start_date=date(2026, 8, 31),
            end_date=date(2026, 8, 31),
            utc_offset_hours=9.0,
            latitude=34.7604,
            longitude=127.6622,
        )

    def test_pair_research_is_attached_and_remains_research_only(self):
        thai = self._thai()
        research = thai["suriyayat"]["planet_pairs_research"]
        self.assertTrue(research["available"])
        self.assertTrue(research["research_only"])
        self.assertEqual(len(research["planet_archetypes"]), 8)
        gate = research["promotion_gate"]
        self.assertTrue(gate["pair_membership_tables_validated"])
        self.assertFalse(gate["pair_net_valence_allowed"])
        self.assertFalse(gate["combined_judgement_allowed"])
        self.assertFalse(gate["event_judgement_allowed"])
        self.assertFalse(gate["gemini_interpretation_allowed"])

    def test_real_natal_pair_tags_preserve_every_classification(self):
        thai = self._thai()
        active = thai["suriyayat"]["planet_pairs_research"]["active_natal_pair_tags"]
        for row in active:
            classes = [item["key"] for item in row["classifications"]]
            if {row["first"], row["second"]} == {"moon", "jupiter"}:
                self.assertEqual(classes, ["enemy", "element"])
                self.assertTrue(row["multi_label"])
                break
        else:
            # The concrete natal chart may not put Moon-Jupiter into one of the
            # validated sign relations; the catalog must still preserve overlap.
            catalog = thai["suriyayat"]["planet_pairs_research"]["pair_tables"]
            self.assertIn(["moon", "jupiter"], catalog["enemy"]["pairs"])
            self.assertIn(["moon", "jupiter"], catalog["element"]["pairs"])

    def test_pair_research_is_not_sent_to_gemini(self):
        thai = self._thai()
        compact = _compact_calculation({"period": {"day_count": 1}, "thai": thai})
        compact_suri = compact["thai"]["suriyayat"]
        self.assertNotIn("planet_pairs_research", compact_suri)
        encoded = json.dumps(compact_suri, ensure_ascii=False)
        self.assertNotIn("affinity_trust_support", encoded)
        self.assertNotIn("friction_tension_conflict", encoded)
        self.assertNotIn("multi_label", encoded)

    def test_product_lagna_and_interpretation_gates_stay_closed(self):
        thai = self._thai()
        suri = thai["suriyayat"]
        self.assertFalse(suri["lagna"]["available"])
        # This is a Phase 2E1 feature contract, not a permanent dependency on
        # later top-level status wording or engine version labels.
        self.assertTrue(thai["engine"].startswith("thai-mahathaksa-taksajorn-suriyayat-v2."))
        research = suri["planet_pairs_research"]
        self.assertTrue(research["available"])
        self.assertTrue(research["research_only"])
        self.assertEqual(research["engine"], "thai-planet-pairs-research-v1.0-multilabel")
        self.assertEqual(len(research["planet_archetypes"]), 8)
        gate = research["promotion_gate"]
        self.assertTrue(gate["pair_membership_tables_validated"])
        self.assertTrue(gate["multi_label_overlap_preserved"])
        self.assertFalse(gate["pair_net_valence_allowed"])
        self.assertFalse(gate["combined_judgement_allowed"])
        self.assertFalse(gate["event_judgement_allowed"])
        self.assertFalse(gate["gemini_interpretation_allowed"])


if __name__ == "__main__":
    unittest.main()
