# -*- coding: utf-8 -*-
from __future__ import annotations

import copy
import unittest

from thai_lagna_promotion_audit_v1 import build_lagna_promotion_audit


def _layers():
    return {
        "lagna_research": {
            "available": True,
            "validation": {
                "global_coordinates_compute_supported": True,
                "global_coordinates_independently_validated": True,
                "world_reference": {"numeric_checks": 16},
            },
            "promotion_gate": {"lagna_numeric_position_validated": True},
        },
        "houses_research": {
            "available": True,
            "promotion_gate": {
                "house_structure_rule_documented": True,
                "house_name_labels_validated": True,
            },
        },
        "dignities_research": {
            "available": True,
            "promotion_gate": {
                "table_facts_validated": True,
                "advanced_standard_table_facts_validated": True,
            },
        },
        "aspects_research": {
            "available": True,
            "promotion_gate": {"sign_geometry_rule_documented": True},
        },
        "descriptive_synthesis_research": {
            "available": True,
            "promotion_gate": {
                "descriptive_composition_validated": True,
                "planet_archetype_context_validated": True,
                "basic_status_modifier_validated": True,
                "relation_tag_composition_validated": True,
                "pair_multilabel_preservation_validated": True,
                "event_judgement_allowed": False,
                "timing_prediction_allowed": False,
                "probability_allowed": False,
                "scores_allowed": False,
            },
        },
        "school_policy_research": {
            "default_profile": "none",
            "selected_profile": "none",
            "base_dignities_mutated": False,
            "actual_engine_exception_application_count": 0,
            "promotion_gate": {"production_school_selection_allowed": False},
        },
        "ai_safe_packet_research": {
            "eligible_for_gemini": False,
            "promotion_gate": {
                "ai_safe_whitelist_validated": True,
                "lagna_dependency_satisfied": False,
                "exception_application_allowed": False,
                "net_valence_allowed": False,
                "final_good_bad_judgement_allowed": False,
                "event_judgement_allowed": False,
                "timing_prediction_allowed": False,
                "probability_allowed": False,
                "scores_allowed": False,
            },
        },
    }


class ThaiPhase2G4LagnaPromotionAuditTests(unittest.TestCase):
    def _audit(self, layers=None):
        return build_lagna_promotion_audit(**(layers or _layers()))

    def test_full_prerequisite_matrix_marks_position_and_descriptive_ready(self):
        audit = self._audit()
        self.assertTrue(audit["lagna_position_product_promotion_ready"])
        self.assertTrue(audit["descriptive_house_context_product_promotion_ready"])
        self.assertTrue(audit["ai_safe_packet_ready_after_explicit_lagna_promotion"])
        self.assertEqual(audit["failed_checks"], [])

    def test_world_coordinate_validation_is_mandatory(self):
        layers = _layers()
        layers["lagna_research"]["validation"]["global_coordinates_independently_validated"] = False
        audit = self._audit(layers)
        self.assertFalse(audit["lagna_position_product_promotion_ready"])
        self.assertFalse(audit["descriptive_house_context_product_promotion_ready"])
        self.assertIn("global_coordinates_independently_validated", audit["failed_checks"])

    def test_source_policy_must_remain_default_none(self):
        layers = _layers()
        layers["school_policy_research"]["selected_profile"] = "literal_exception"
        audit = self._audit(layers)
        self.assertTrue(audit["lagna_position_product_promotion_ready"])
        self.assertFalse(audit["descriptive_house_context_product_promotion_ready"])
        self.assertIn("source_policy_default_none", audit["failed_checks"])

    def test_ai_safe_whitelist_is_required_for_descriptive_promotion(self):
        layers = _layers()
        layers["ai_safe_packet_research"]["promotion_gate"]["ai_safe_whitelist_validated"] = False
        audit = self._audit(layers)
        self.assertTrue(audit["lagna_position_product_promotion_ready"])
        self.assertFalse(audit["descriptive_house_context_product_promotion_ready"])
        self.assertIn("ai_safe_whitelist_validated", audit["failed_checks"])

    def test_audit_requires_packet_to_still_be_lagna_blocked_before_explicit_promotion(self):
        layers = _layers()
        layers["ai_safe_packet_research"]["eligible_for_gemini"] = True
        layers["ai_safe_packet_research"]["promotion_gate"]["lagna_dependency_satisfied"] = True
        audit = self._audit(layers)
        self.assertFalse(audit["descriptive_house_context_product_promotion_ready"])
        self.assertIn("ai_safe_packet_currently_lagna_blocked", audit["failed_checks"])

    def test_predictive_and_scoring_gates_must_remain_closed(self):
        for check_key, layer_key, gate_key in (
            ("event_judgement_still_blocked", "ai_safe_packet_research", "event_judgement_allowed"),
            ("timing_prediction_still_blocked", "ai_safe_packet_research", "timing_prediction_allowed"),
            ("probability_still_blocked", "ai_safe_packet_research", "probability_allowed"),
            ("scores_still_blocked", "ai_safe_packet_research", "scores_allowed"),
            ("exception_application_still_blocked", "ai_safe_packet_research", "exception_application_allowed"),
            ("net_valence_still_blocked", "ai_safe_packet_research", "net_valence_allowed"),
            ("final_good_bad_judgement_still_blocked", "ai_safe_packet_research", "final_good_bad_judgement_allowed"),
        ):
            layers = _layers()
            layers[layer_key]["promotion_gate"][gate_key] = True
            audit = self._audit(layers)
            self.assertFalse(audit["descriptive_house_context_product_promotion_ready"], check_key)
            self.assertIn(check_key, audit["failed_checks"])

    def test_audit_never_changes_product_state_automatically(self):
        audit = self._audit()
        self.assertFalse(audit["automatic_promotion_allowed"])
        self.assertFalse(audit["product_state_changed"])
        self.assertFalse(audit["promotion_gate"]["automatic_promotion_allowed"])
        self.assertFalse(audit["promotion_gate"]["predictive_interpretation_allowed"])

    def test_missing_layers_fail_closed(self):
        layers = _layers()
        layers["houses_research"] = {"available": False}
        layers["descriptive_synthesis_research"] = {"available": False}
        audit = self._audit(layers)
        self.assertFalse(audit["descriptive_house_context_product_promotion_ready"])
        self.assertIn("whole_sign_houses_available", audit["failed_checks"])
        self.assertIn("descriptive_composition_validated", audit["failed_checks"])


if __name__ == "__main__":
    unittest.main()
