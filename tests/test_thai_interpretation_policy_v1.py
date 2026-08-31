# -*- coding: utf-8 -*-
from __future__ import annotations

import unittest

from thai_interpretation_policy_v1 import CONSENSUS, build_interpretation_policy_research, consensus_for


class ThaiPhase2D2InterpretationPolicyTests(unittest.TestCase):
    def test_registry_covers_every_current_semantic_decision(self):
        self.assertEqual(
            set(CONSENSUS),
            {
                "house_domains", "basic_status_direction", "advanced_standards",
                "aspect_geometry", "aspect_strength", "aspect_meaning", "combined_judgement",
            },
        )

    def test_basic_promoted_research_semantics_are_non_numeric(self):
        houses = consensus_for("house_domains")
        basic = consensus_for("basic_status_direction")
        self.assertEqual(houses["status"], "validated_conservative_overlap")
        self.assertEqual(basic["status"], "validated_broad_direction")
        self.assertFalse(houses["numeric_score_allowed"])
        self.assertFalse(basic["numeric_score_allowed"])
        self.assertFalse(houses["event_claim_allowed"])
        self.assertFalse(basic["event_claim_allowed"])

    def test_advanced_standards_preserve_school_variance(self):
        advanced = consensus_for("advanced_standards")
        self.assertEqual(advanced["status"], "meaning_variance_not_promoted")
        self.assertEqual(advanced["claims"]["rachayok"]["consensus_level"], "moderate")
        self.assertEqual(advanced["claims"]["mahachak"]["consensus_level"], "moderate")
        self.assertEqual(advanced["claims"]["thewiyok"]["consensus_level"], "low_school_variance")
        self.assertEqual(advanced["claims"]["julachak"]["consensus_level"], "low_school_variance")
        for row in advanced["claims"].values():
            self.assertFalse(row["promoted_to_interpretation"])

    def test_aspect_strength_conflict_is_explicit_and_not_averaged(self):
        strength = consensus_for("aspect_strength")
        self.assertEqual(strength["status"], "numeric_conflict_blocked")
        a = strength["observed_source_examples"]["source_a"]
        b = strength["observed_source_examples"]["source_b"]
        self.assertEqual(a["kum"], b["kum"])
        self.assertNotEqual(a["leng"], b["leng"])
        self.assertEqual(a["trikona"], b["trikona"])
        self.assertNotEqual(a["yok"], b["yok"])
        self.assertFalse(strength["numeric_score_allowed"])
        self.assertNotIn("average", strength)
        self.assertNotIn("canonical_percent", strength)

    def test_aspect_geometry_does_not_imply_pair_meaning(self):
        geometry = consensus_for("aspect_geometry")
        meaning = consensus_for("aspect_meaning")
        self.assertEqual(geometry["status"], "validated_geometry")
        self.assertEqual(meaning["status"], "partial_consensus_not_promoted")
        self.assertFalse(meaning["numeric_score_allowed"])
        self.assertEqual(meaning["allowed_use"], "none")

    def test_combined_judgement_requires_context_not_single_status(self):
        combined = consensus_for("combined_judgement")
        self.assertEqual(combined["status"], "blocked_requires_context_model")
        required = set(combined["required_context"])
        self.assertTrue({"house_lordship", "occupied_house", "planet_pair_relationships", "school_policy"}.issubset(required))
        self.assertFalse(combined["numeric_score_allowed"])
        self.assertFalse(combined["event_claim_allowed"])

    def test_global_gate_keeps_product_gemini_and_scores_closed(self):
        policy = build_interpretation_policy_research()
        self.assertTrue(policy["research_only"])
        gate = policy["promotion_gate"]
        self.assertTrue(gate["neutral_house_domains_allowed_in_research_semantics"])
        self.assertTrue(gate["basic_status_direction_allowed_in_research_semantics"])
        self.assertFalse(gate["advanced_standard_interpretation_allowed"])
        self.assertFalse(gate["aspect_strength_percent_allowed"])
        self.assertFalse(gate["aspect_pair_interpretation_allowed"])
        self.assertFalse(gate["combined_judgement_allowed"])
        self.assertFalse(gate["scores_allowed"])
        self.assertFalse(gate["event_judgement_allowed"])
        self.assertFalse(gate["gemini_interpretation_allowed"])


if __name__ == "__main__":
    unittest.main()
