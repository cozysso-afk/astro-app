# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import unittest

from ai_interpret_v1 import _compact_thai_suriyayat


class ThaiPhase2G3AiSafePacketCompactionTests(unittest.TestCase):
    def _route(self):
        return {
            "route_key": "H1:mars:H10",
            "source_topic_domains": ["self"],
            "carrier_planet": {"key": "mars", "archetype_domains": ["action"]},
            "destination_context_domains": ["career"],
            "basic_status_modifiers": [{"status_key": "kaset", "functional_direction": "stable_self_supported"}],
            "relation_context_tags": [
                {
                    "counterpart_planet": "jupiter",
                    "relation_key": "trikona",
                    "pair_classes": [{"key": "friend", "functional_domain": "cooperation_support"}],
                    "pair_multi_label": False,
                }
            ],
            "interpretation_level": "descriptive_nonpredictive",
        }

    def _suriyayat(self, eligible: bool):
        return {
            "available": True,
            "engine": "suriyayat-test",
            "natal": {},
            "ai_safe_packet_research": {
                "eligible_for_gemini": eligible,
                "engine": "thai-ai-safe-packet-research-v1.0-lagna-gated",
                "route_count": 1,
                "routes": [self._route()],
                "promotion_gate": {"gemini_interpretation_allowed": eligible},
                "school_policy_research": {"literal_exception": True},
                "dignity_exceptions_research": {"nicha_opposition_to_ucca": True},
                "score": 999,
                "prediction": "forbidden",
            },
        }

    def test_ineligible_packet_is_not_compacted(self):
        compact = _compact_thai_suriyayat(self._suriyayat(False))
        self.assertNotIn("ai_safe_descriptive_packet", compact)

    def test_eligible_packet_is_compacted_under_product_safe_name(self):
        compact = _compact_thai_suriyayat(self._suriyayat(True))
        packet = compact["ai_safe_descriptive_packet"]
        self.assertEqual(packet["route_count"], 1)
        self.assertEqual(packet["routes"][0]["route_key"], "H1:mars:H10")
        self.assertEqual(packet["routes"][0]["interpretation_level"], "descriptive_nonpredictive")

    def test_second_whitelist_strips_research_policy_prediction_and_score(self):
        compact = _compact_thai_suriyayat(self._suriyayat(True))
        encoded = json.dumps(compact["ai_safe_descriptive_packet"], ensure_ascii=False)
        for forbidden in (
            "school_policy_research", "dignity_exceptions_research", "literal_exception",
            "nicha_opposition_to_ucca", "prediction", "score",
        ):
            self.assertNotIn(forbidden, encoded)

    def test_packet_requires_both_eligibility_and_promotion_gate(self):
        value = self._suriyayat(True)
        value["ai_safe_packet_research"]["promotion_gate"]["gemini_interpretation_allowed"] = False
        compact = _compact_thai_suriyayat(value)
        self.assertNotIn("ai_safe_descriptive_packet", compact)


if __name__ == "__main__":
    unittest.main()
