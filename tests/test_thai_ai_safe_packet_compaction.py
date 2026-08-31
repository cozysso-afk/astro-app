# -*- coding: utf-8 -*-
from __future__ import annotations

import copy
import json
import unittest

from ai_interpret_v1 import _compact_thai_suriyayat


class ThaiPhase2G51AiSafePacketCompactionTests(unittest.TestCase):
    def _route(self, house_number: int):
        return {
            "route_key": f"H{house_number}:mars->H10",
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
            "lagna": {
                "available": True,
                "engine": "thai-lagna-product-promotion-v1.1-fail-closed",
                "method_key": "common_anto_0600_lmt",
                "method": "common_anto_0600_lmt",
                "method_thai": "อันโตนาทีสามัญ 06:00 ปรับเวลาท้องถิ่น",
                "longitude_deg": 123.456,
                "sign_index": 4,
                "sign_en": "Leo",
                "sign_th": "สิงห์",
                "sign_ko": "사자자리",
                "degree": 3,
                "minute": 27,
                "second": 22,
                "display": "사자자리 3°27′22″",
                "validation": {
                    "numeric_position_validated": True,
                    "global_coordinates_independently_validated": True,
                    "world_numeric_checks": 16,
                    "reference": "independent-world-gold",
                },
                "interpretation_scope": "descriptive_nonpredictive_house_context_only",
            },
            "ai_safe_packet_product": {
                "eligible_for_gemini": eligible,
                "research_only": False,
                "engine": "thai-ai-safe-packet-research-v1.0-lagna-gated",
                "product_promotion_engine": "thai-lagna-product-promotion-v1.1-fail-closed",
                "route_count": 12,
                "routes": [self._route(index) for index in range(1, 13)],
                "promotion_gate": {
                    "gemini_interpretation_allowed": eligible,
                    "school_policy_allowed": False,
                    "exception_application_allowed": False,
                    "net_valence_allowed": False,
                    "final_good_bad_judgement_allowed": False,
                    "event_judgement_allowed": False,
                    "timing_prediction_allowed": False,
                    "probability_allowed": False,
                    "scores_allowed": False,
                },
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
        self.assertEqual(packet["route_count"], 12)
        self.assertEqual(packet["routes"][0]["route_key"], "H1:mars->H10")
        self.assertEqual(packet["routes"][0]["source_topic_domains"], ["self"])
        self.assertEqual(packet["routes"][0]["carrier_planet"]["key"], "mars")
        self.assertEqual(packet["routes"][0]["destination_context_domains"], ["career"])
        self.assertEqual(packet["routes"][0]["interpretation_level"], "descriptive_nonpredictive")

    def test_transport_packet_keeps_safe_semantics_but_drops_duplicate_relation_detail(self):
        compact = _compact_thai_suriyayat(self._suriyayat(True))
        packet = compact["ai_safe_descriptive_packet"]
        self.assertEqual(len(packet["routes"]), 12)
        for route in packet["routes"]:
            self.assertIn("basic_status_modifiers", route)
            self.assertNotIn("relation_context_tags", route)
        self.assertLess(len(json.dumps(packet, ensure_ascii=False)), 6000)

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
        value["ai_safe_packet_product"]["promotion_gate"]["gemini_interpretation_allowed"] = False
        compact = _compact_thai_suriyayat(value)
        self.assertNotIn("ai_safe_descriptive_packet", compact)

    def test_product_packet_rejects_any_open_predictive_or_school_gate(self):
        blocked_gates = (
            "school_policy_allowed", "exception_application_allowed", "net_valence_allowed",
            "final_good_bad_judgement_allowed", "event_judgement_allowed",
            "timing_prediction_allowed", "probability_allowed", "scores_allowed",
        )
        for gate_name in blocked_gates:
            with self.subTest(gate_name=gate_name):
                value = self._suriyayat(True)
                value["ai_safe_packet_product"]["promotion_gate"][gate_name] = True
                compact = _compact_thai_suriyayat(value)
                self.assertNotIn("ai_safe_descriptive_packet", compact)

    def test_research_packet_never_falls_back_into_product_payload(self):
        value = self._suriyayat(True)
        value["ai_safe_packet_research"] = value.pop("ai_safe_packet_product")
        compact = _compact_thai_suriyayat(value)
        self.assertNotIn("ai_safe_descriptive_packet", compact)

    def test_product_packet_requires_complete_unique_twelve_house_routes(self):
        for mutate in ("missing", "duplicate"):
            with self.subTest(mutate=mutate):
                value = self._suriyayat(True)
                routes = value["ai_safe_packet_product"]["routes"]
                if mutate == "missing":
                    routes.pop()
                else:
                    routes[-1] = copy.deepcopy(routes[0])
                compact = _compact_thai_suriyayat(value)
                self.assertNotIn("ai_safe_descriptive_packet", compact)

    def test_product_lagna_requires_validation_scope_and_numeric_identity(self):
        mutations = {
            "validation": lambda lagna: lagna["validation"].update(numeric_position_validated=False),
            "scope": lambda lagna: lagna.update(interpretation_scope="predictive"),
            "engine": lambda lagna: lagna.update(engine="research-engine"),
            "world_checks": lambda lagna: lagna["validation"].update(world_numeric_checks=15),
            "longitude": lambda lagna: lagna.update(longitude_deg=999.0),
            "sign": lambda lagna: lagna.update(sign_index=11),
        }
        for name, mutate in mutations.items():
            with self.subTest(name=name):
                value = self._suriyayat(True)
                mutate(value["lagna"])
                compact = _compact_thai_suriyayat(value)
                self.assertEqual(compact["lagna"], {"available": False})
                self.assertNotIn("ai_safe_descriptive_packet", compact)


if __name__ == "__main__":
    unittest.main()
