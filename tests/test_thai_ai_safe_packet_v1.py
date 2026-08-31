# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import unittest

from thai_ai_safe_packet_v1 import build_ai_safe_packet_research


def _synthesis():
    return {
        "available": True,
        "research_only": True,
        "route_descriptions": [
            {
                "route_key": "H1:mars:H10",
                "composition": {
                    "source_topic_domains": ["self", "identity"],
                    "carrier_planet": {"key": "mars", "number": 3, "archetype_domains": ["drive", "action"]},
                    "destination_context_domains": ["career", "public_role"],
                    "basic_status_modifiers": [
                        {"status_key": "kaset", "thai": "เกษตร", "functional_direction": "stable_self_supported", "scope": "lord_function_only_not_event_outcome"}
                    ],
                    "relation_context_tags": [
                        {
                            "counterpart_planet": "jupiter",
                            "relation_key": "trikona",
                            "relation_thai": "ตรีโกณ",
                            "pair_classes": [
                                {"key": "friend", "thai": "คู่มิตร", "functional_domain": "cooperation_support", "valence": "context_dependent"},
                                {"key": "element", "thai": "คู่ธาตุ", "functional_domain": "elemental_resonance", "valence": "context_dependent"},
                            ],
                            "pair_multi_label": True,
                            "strength_percent": None,
                            "net_effect": None,
                        }
                    ],
                },
                "allowed_descriptive_claim": {"interpretation_level": "descriptive_nonpredictive"},
                "unresolved": {
                    "advanced_standard_keys": ["mahachak"],
                    "advanced_standard_meaning": None,
                    "aspect_strength": None,
                    "pair_net_valence": None,
                    "combined_good_bad_judgement": None,
                    "event_outcome": None,
                    "timing": None,
                    "probability": None,
                    "score": None,
                    "conflicts_preserved": {"aspect_strength": "unresolved"},
                },
                "final_interpretation": None,
                "prediction": None,
                "score": None,
            }
        ],
        "promotion_gate": {
            "descriptive_composition_validated": True,
            "planet_archetype_context_validated": True,
            "basic_status_modifier_validated": True,
            "relation_tag_composition_validated": True,
            "pair_multilabel_preservation_validated": True,
            "gemini_interpretation_allowed": False,
        },
    }


class ThaiPhase2G3AiSafePacketTests(unittest.TestCase):
    def test_validated_synthesis_builds_whitelist_packet(self):
        packet = build_ai_safe_packet_research(descriptive_synthesis_research=_synthesis(), lagna_product_available=False)
        self.assertTrue(packet["available"])
        self.assertEqual(packet["route_count"], 1)
        self.assertTrue(packet["sanitization"]["whitelist_only"])
        self.assertTrue(packet["promotion_gate"]["ai_safe_whitelist_validated"])

    def test_unpromoted_lagna_blocks_gemini(self):
        packet = build_ai_safe_packet_research(descriptive_synthesis_research=_synthesis(), lagna_product_available=False)
        self.assertFalse(packet["eligible_for_gemini"])
        self.assertFalse(packet["promotion_gate"]["lagna_dependency_satisfied"])
        self.assertFalse(packet["promotion_gate"]["gemini_interpretation_allowed"])
        self.assertIn("Lagna", packet["blocked_reason"])

    def test_promoted_lagna_would_open_only_packet_gate(self):
        packet = build_ai_safe_packet_research(descriptive_synthesis_research=_synthesis(), lagna_product_available=True)
        self.assertTrue(packet["eligible_for_gemini"])
        self.assertTrue(packet["promotion_gate"]["gemini_interpretation_allowed"])
        self.assertFalse(packet["promotion_gate"]["school_policy_allowed"])
        self.assertFalse(packet["promotion_gate"]["exception_application_allowed"])
        self.assertFalse(packet["promotion_gate"]["final_good_bad_judgement_allowed"])
        self.assertFalse(packet["promotion_gate"]["event_judgement_allowed"])
        self.assertFalse(packet["promotion_gate"]["scores_allowed"])

    def test_forbidden_unresolved_prediction_score_fields_are_removed(self):
        packet = build_ai_safe_packet_research(descriptive_synthesis_research=_synthesis(), lagna_product_available=True)
        encoded = json.dumps(packet["routes"], ensure_ascii=False)
        for forbidden in ("unresolved", "final_interpretation", "prediction", "score", "conflicts_preserved", "strength_percent", "net_effect"):
            self.assertNotIn(forbidden, encoded)

    def test_school_policy_and_exception_terms_are_not_copied(self):
        synthesis = _synthesis()
        synthesis["school_policy_research"] = {"literal_exception": True}
        synthesis["dignity_exceptions_research"] = {"pra_opposition_to_kaset": True}
        packet = build_ai_safe_packet_research(descriptive_synthesis_research=synthesis, lagna_product_available=True)
        encoded = json.dumps(packet["routes"], ensure_ascii=False)
        self.assertNotIn("literal_exception", encoded)
        self.assertNotIn("pra_opposition_to_kaset", encoded)

    def test_multilabel_pair_context_is_preserved_without_valence(self):
        packet = build_ai_safe_packet_research(descriptive_synthesis_research=_synthesis(), lagna_product_available=True)
        relation = packet["routes"][0]["relation_context_tags"][0]
        self.assertTrue(relation["pair_multi_label"])
        self.assertEqual([row["key"] for row in relation["pair_classes"]], ["friend", "element"])
        encoded = json.dumps(relation, ensure_ascii=False)
        self.assertNotIn("valence", encoded)
        self.assertNotIn("net_effect", encoded)

    def test_missing_or_unvalidated_synthesis_cannot_fabricate_packet(self):
        packet = build_ai_safe_packet_research(descriptive_synthesis_research={"available": False}, lagna_product_available=True)
        self.assertFalse(packet["available"])
        self.assertEqual(packet["routes"], [])
        self.assertFalse(packet["eligible_for_gemini"])
        self.assertFalse(packet["promotion_gate"]["ai_safe_whitelist_validated"])

    def test_packet_contains_no_numeric_strength_probability_or_score(self):
        packet = build_ai_safe_packet_research(descriptive_synthesis_research=_synthesis(), lagna_product_available=True)
        encoded = json.dumps(packet["routes"], ensure_ascii=False)
        self.assertNotIn("probability", encoded)
        self.assertNotIn("strength_percent", encoded)
        self.assertNotIn("score", encoded)


if __name__ == "__main__":
    unittest.main()
