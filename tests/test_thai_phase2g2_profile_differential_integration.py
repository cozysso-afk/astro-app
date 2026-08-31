# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import unittest
from datetime import date, time

from ai_interpret_v1 import _compact_calculation
from thai_astrology_v2 import build_thai_fortune


class ThaiPhase2G2ProfileDifferentialIntegrationTests(unittest.TestCase):
    def _thai(self):
        return build_thai_fortune(
            birth_date=date(1991, 3, 21), birth_time=time(7, 26),
            start_date=date(2026, 8, 31), end_date=date(2026, 8, 31),
            utc_offset_hours=9.0, latitude=34.7604, longitude=127.6622,
        )

    def test_real_profiles_share_identical_candidate_rows(self):
        layer = self._thai()["suriyayat"]["school_policy_research"]
        comparisons = layer["comparisons"]
        keys = ("none", "literal_exception", "standard_reach_overlay")
        identities = [
            [(row["rule_key"], tuple(row["planets"])) for row in comparisons[key]["decisions"]]
            for key in keys
        ]
        self.assertTrue(all(rows == identities[0] for rows in identities[1:]))

    def test_real_profile_differences_are_projection_fields_only(self):
        layer = self._thai()["suriyayat"]["school_policy_research"]
        comparisons = layer["comparisons"]
        protected = (
            "rule_key", "planets", "candidate_detected", "base_status_mutated",
            "exception_applied_to_engine", "final_judgement", "prediction", "score",
        )
        left = comparisons["literal_exception"]["decisions"]
        right = comparisons["standard_reach_overlay"]["decisions"]
        self.assertEqual(len(left), len(right))
        for a, b in zip(left, right):
            for key in protected:
                self.assertEqual(a[key], b[key])

    def test_real_profiles_cannot_change_engine_output_contract(self):
        layer = self._thai()["suriyayat"]["school_policy_research"]
        for key in ("none", "literal_exception", "standard_reach_overlay"):
            view = layer["comparisons"][key]
            self.assertFalse(view["base_dignities_mutated"])
            self.assertEqual(view["engine_exception_application_count"], 0)
            self.assertIsNone(view["final_judgement"])
            self.assertIsNone(view["prediction"])
            self.assertIsNone(view["score"])

    def test_profile_diagnostics_remain_outside_gemini_payload(self):
        thai = self._thai()
        compact = _compact_calculation({"period": {"day_count": 1}, "thai": thai})
        encoded = json.dumps(compact["thai"]["suriyayat"], ensure_ascii=False)
        self.assertNotIn("school_policy_research", compact["thai"]["suriyayat"])
        self.assertNotIn("literal_exception", encoded)
        self.assertNotIn("standard_reach_overlay", encoded)
        self.assertNotIn("project_secondary_replacement_status", encoded)
        self.assertNotIn("project_non_destructive_overlay", encoded)


if __name__ == "__main__":
    unittest.main()
