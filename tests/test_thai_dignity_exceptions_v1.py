# -*- coding: utf-8 -*-
from __future__ import annotations

import unittest

from thai_dignity_exceptions_v1 import RULE_REGISTRY, build_dignity_exception_research


class ThaiPhase2F3DignityExceptionTests(unittest.TestCase):
    def _dignities(self):
        return {
            "available": True,
            "planets": {
                "sun": {
                    "supported": True,
                    "statuses": [{"key": "pra"}],
                    "advanced_standards": [],
                    "sign_lord": {"key": "moon"},
                },
                "moon": {
                    "supported": True,
                    "statuses": [{"key": "pra"}, {"key": "nicha"}],
                    "advanced_standards": [],
                    "sign_lord": {"key": "sun"},
                },
                "mars": {
                    "supported": True,
                    "statuses": [{"key": "nicha"}],
                    "advanced_standards": [],
                    "sign_lord": {"key": "venus"},
                },
                "venus": {
                    "supported": True,
                    "statuses": [{"key": "nicha"}],
                    "advanced_standards": [],
                    "sign_lord": {"key": "mars"},
                },
                "thai_ketu": {
                    "supported": False,
                    "statuses": [],
                    "advanced_standards": [],
                    "sign_lord": {"key": "sun"},
                },
            },
        }

    def _aspects(self):
        return {
            "relations": [
                {"first": "sun", "second": "moon", "relation": {"key": "leng"}},
                {"first": "mars", "second": "venus", "relation": {"key": "leng"}},
                {"first": "sun", "second": "mars", "relation": {"key": "trikona"}},
            ]
        }

    def _houses(self):
        return {
            "available": True,
            "planet_placements": {
                "sun": {"house_number": 6},
                "moon": {"house_number": 8},
                "mars": {"house_number": 12},
                "venus": {"house_number": 5},
                "thai_ketu": {"house_number": 6},
            },
        }

    def _build(self):
        return build_dignity_exception_research(
            dignities_research=self._dignities(),
            aspects_research=self._aspects(),
            houses_research=self._houses(),
        )

    def test_registry_keeps_rules_as_school_variant_candidates(self):
        for key in (
            "pra_opposition_to_kaset",
            "nicha_opposition_to_ucca",
            "reciprocal_kaset_exchange",
            "pra_nicha_dusthana_reversal",
        ):
            self.assertIn(key, RULE_REGISTRY)
            self.assertTrue(RULE_REGISTRY[key]["school_variance"])
            self.assertFalse(RULE_REGISTRY[key]["auto_apply"])

    def test_pra_pra_leng_detects_kaset_candidate_only(self):
        rows = [r for r in self._build()["candidates"] if r["rule_key"] == "pra_opposition_to_kaset"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(set(rows[0]["planets"]), {"sun", "moon"})
        self.assertEqual(rows[0]["candidate_effect"], "kaset_like_in_supporting_school")
        self.assertFalse(rows[0]["applied"])
        self.assertIsNone(rows[0]["replacement_status"])

    def test_nicha_nicha_leng_detects_ucca_candidate_only(self):
        rows = [r for r in self._build()["candidates"] if r["rule_key"] == "nicha_opposition_to_ucca"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(set(rows[0]["planets"]), {"mars", "venus"})
        self.assertEqual(rows[0]["candidate_effect"], "ucca_like_in_supporting_school")
        self.assertFalse(rows[0]["base_status_overridden"])

    def test_non_leng_pair_does_not_trigger_opposition_exception(self):
        rows = self._build()["candidates"]
        self.assertFalse(any(set(r["planets"]) == {"sun", "mars"} and "opposition" in r["rule_key"] for r in rows))

    def test_reciprocal_sign_lord_exchange_is_detected(self):
        rows = [r for r in self._build()["candidates"] if r["rule_key"] == "reciprocal_kaset_exchange"]
        pairs = [set(r["planets"]) for r in rows]
        self.assertIn({"sun", "moon"}, pairs)
        self.assertIn({"mars", "venus"}, pairs)
        self.assertTrue(all(r["evidence"]["reciprocal"] for r in rows))

    def test_pra_or_nicha_in_6_8_12_is_detected_without_reversal_application(self):
        rows = [r for r in self._build()["candidates"] if r["rule_key"] == "pra_nicha_dusthana_reversal"]
        by_planet = {r["planets"][0]: r for r in rows}
        self.assertEqual(set(by_planet), {"sun", "moon", "mars"})
        self.assertEqual(by_planet["sun"]["evidence"]["house_number"], 6)
        self.assertEqual(by_planet["moon"]["evidence"]["house_number"], 8)
        self.assertEqual(by_planet["mars"]["evidence"]["house_number"], 12)
        self.assertTrue(all(r["applied"] is False for r in rows))

    def test_unsupported_thai_ketu_is_not_forced_into_exception_engine(self):
        self.assertFalse(any("thai_ketu" in r["planets"] for r in self._build()["candidates"]))

    def test_machine_detection_stays_off_for_ambiguous_advanced_rules(self):
        self.assertFalse(RULE_REGISTRY["standard_relation_amplification"]["machine_detection_enabled"])
        self.assertFalse(RULE_REGISTRY["thewiyok_julachak_lagna_full_effect"]["machine_detection_enabled"])

    def test_base_dignity_rewrite_and_all_prediction_gates_are_closed(self):
        result = self._build()
        self.assertTrue(result["base_dignities_unchanged"])
        self.assertIsNone(result["school_policy"]["selected_school"])
        gate = result["promotion_gate"]
        self.assertTrue(gate["candidate_detection_validated"])
        self.assertTrue(gate["source_variance_preserved"])
        self.assertFalse(gate["exception_application_allowed"])
        self.assertFalse(gate["base_status_rewrite_allowed"])
        self.assertFalse(gate["net_valence_allowed"])
        self.assertFalse(gate["final_interpretation_allowed"])
        self.assertFalse(gate["event_judgement_allowed"])
        self.assertFalse(gate["scores_allowed"])
        self.assertFalse(gate["gemini_interpretation_allowed"])

    def test_missing_dignity_layer_does_not_fabricate_candidates(self):
        result = build_dignity_exception_research(
            dignities_research={"available": False},
            aspects_research={},
            houses_research={},
        )
        self.assertFalse(result["available"])
        self.assertEqual(result["candidates"], [])


if __name__ == "__main__":
    unittest.main()
