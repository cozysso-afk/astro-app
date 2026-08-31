# -*- coding: utf-8 -*-
from __future__ import annotations

import copy
import unittest

from thai_lagna_product_v1 import build_lagna_product_promotion


def _synthesis():
    routes = []
    for idx in range(1, 13):
        routes.append({
            "route_key": f"H{idx}:mars:H{idx}",
            "composition": {
                "source_topic_domains": [f"source_{idx}"],
                "carrier_planet": {"key": "mars", "archetype_domains": ["action"]},
                "destination_context_domains": [f"dest_{idx}"],
                "basic_status_modifiers": [],
                "relation_context_tags": [],
            },
            "allowed_descriptive_claim": {"interpretation_level": "descriptive_nonpredictive"},
            "unresolved": {},
            "final_interpretation": None,
            "prediction": None,
            "score": None,
        })
    return {
        "available": True,
        "route_descriptions": routes,
        "promotion_gate": {
            "descriptive_composition_validated": True,
            "planet_archetype_context_validated": True,
            "basic_status_modifier_validated": True,
            "relation_tag_composition_validated": True,
            "pair_multilabel_preservation_validated": True,
        },
    }


def _lagna():
    return {
        "available": True,
        "engine": "lagna-research",
        "selected_traditional_candidate": "common_anto_0600_lmt",
        "validation": {
            "global_coordinates_independently_validated": True,
            "reference": "independent-world-gold",
            "world_reference": {"numeric_checks": 16},
        },
        "common_anto_0600_lmt": {
            "available": True,
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
        },
    }


def _audit():
    return {
        "available": True,
        "engine": "promotion-audit",
        "failed_checks": [],
        "lagna_position_product_promotion_ready": True,
        "descriptive_house_context_product_promotion_ready": True,
        "ai_safe_packet_ready_after_explicit_lagna_promotion": True,
    }


class ThaiPhase2G5LagnaProductPromotionTests(unittest.TestCase):
    def _build(self, **overrides):
        values = {
            "lagna_research": _lagna(),
            "promotion_audit": _audit(),
            "descriptive_synthesis_research": _synthesis(),
            "explicit_enable": True,
        }
        values.update(overrides)
        return build_lagna_product_promotion(**values)

    def test_explicit_flag_is_mandatory(self):
        result = self._build(explicit_enable=False)
        self.assertFalse(result["available"])
        self.assertFalse(result["lagna"]["available"])
        self.assertEqual(result["ai_safe_packet_product"], {})

    def test_full_audit_is_mandatory(self):
        audit = _audit()
        audit["failed_checks"] = ["world_reference"]
        result = self._build(promotion_audit=audit)
        self.assertFalse(result["available"])
        self.assertIn("audit", result["reason"].lower())

    def test_selected_traditional_candidate_is_pinned(self):
        lagna = _lagna()
        lagna["selected_traditional_candidate"] = "astronomical_suriyayat_sidereal_crosscheck"
        result = self._build(lagna_research=lagna)
        self.assertFalse(result["available"])
        self.assertIn("candidate", result["reason"].lower())

    def test_product_lagna_exposes_minimal_validated_numeric_position(self):
        result = self._build()
        lagna = result["lagna"]
        self.assertTrue(result["available"])
        self.assertTrue(lagna["available"])
        self.assertEqual(lagna["method_key"], "common_anto_0600_lmt")
        self.assertEqual(lagna["longitude_deg"], 123.456)
        self.assertEqual(lagna["sign_index"], 4)
        self.assertEqual(lagna["validation"]["world_numeric_checks"], 16)
        self.assertEqual(lagna["interpretation_scope"], "descriptive_nonpredictive_house_context_only")

    def test_product_ai_packet_requires_all_twelve_routes(self):
        synthesis = _synthesis()
        synthesis["route_descriptions"] = synthesis["route_descriptions"][:-1]
        result = self._build(descriptive_synthesis_research=synthesis)
        self.assertFalse(result["available"])
        self.assertEqual(result["ai_safe_packet_product"], {})

    def test_product_ai_packet_is_eligible_but_remains_nonpredictive(self):
        result = self._build()
        packet = result["ai_safe_packet_product"]
        self.assertTrue(packet["eligible_for_gemini"])
        self.assertFalse(packet["research_only"])
        gate = packet["promotion_gate"]
        self.assertTrue(gate["gemini_interpretation_allowed"])
        self.assertFalse(gate["school_policy_allowed"])
        self.assertFalse(gate["exception_application_allowed"])
        self.assertFalse(gate["final_good_bad_judgement_allowed"])
        self.assertFalse(gate["event_judgement_allowed"])
        self.assertFalse(gate["timing_prediction_allowed"])
        self.assertFalse(gate["probability_allowed"])
        self.assertFalse(gate["scores_allowed"])

    def test_product_promotion_never_enables_predictive_gates(self):
        result = self._build()
        gate = result["promotion_gate"]
        self.assertTrue(gate["numeric_lagna_product_allowed"])
        self.assertTrue(gate["descriptive_house_context_allowed"])
        self.assertTrue(gate["gemini_descriptive_packet_allowed"])
        self.assertFalse(gate["school_policy_allowed"])
        self.assertFalse(gate["exception_application_allowed"])
        self.assertFalse(gate["net_valence_allowed"])
        self.assertFalse(gate["final_good_bad_judgement_allowed"])
        self.assertFalse(gate["predictive_interpretation_allowed"])
        self.assertFalse(gate["event_judgement_allowed"])
        self.assertFalse(gate["timing_prediction_allowed"])
        self.assertFalse(gate["probability_allowed"])
        self.assertFalse(gate["scores_allowed"])

    def test_invalid_numeric_position_fails_closed(self):
        for bad in (float("nan"), -1.0, 360.0):
            lagna = copy.deepcopy(_lagna())
            lagna["common_anto_0600_lmt"]["longitude_deg"] = bad
            result = self._build(lagna_research=lagna)
            self.assertFalse(result["available"])


if __name__ == "__main__":
    unittest.main()
