# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import unittest

from ai_interpret_v1 import _compact_calculation


class ThaiResearchAiIsolationTests(unittest.TestCase):
    def test_lagna_and_house_research_are_not_sent_to_gemini_payload(self):
        calculation = {
            "period": {"day_count": 1},
            "thai": {
                "ok": True,
                "engine": "thai-test",
                "suriyayat": {
                    "available": True,
                    "engine": "suriyayat-test",
                    "validation": {"status": "cross_validated"},
                    "natal": {
                        "positions": {
                            "sun": {"longitude_deg": 336.0, "sign_index": 11},
                        }
                    },
                    "period_start": {"positions": {}},
                    "period_end": {"positions": {}},
                    "lagna": {"available": False, "reason": "research only"},
                    "lagna_research": {
                        "research_only": True,
                        "common_anto_0600_lmt": {"longitude_deg": 350.266667},
                        "secret_marker": "LAGNA_RESEARCH_MUST_NOT_LEAK",
                    },
                    "houses_research": {
                        "research_only": True,
                        "houses": [{"house_number": 1, "sign_index": 11}],
                        "secret_marker": "HOUSE_RESEARCH_MUST_NOT_LEAK",
                    },
                    "future_research_layer": {"secret_marker": "FUTURE_RESEARCH_MUST_NOT_LEAK"},
                    "interpretation_status": "facts_only",
                    "policy": "safe facts",
                },
            },
        }
        compact = _compact_calculation(calculation)
        suriyayat = compact["thai"]["suriyayat"]
        self.assertIn("natal", suriyayat)
        self.assertEqual(suriyayat["natal"]["positions"]["sun"]["sign_index"], 11)
        self.assertIn("lagna", suriyayat)
        self.assertFalse(suriyayat["lagna"]["available"])
        self.assertNotIn("lagna_research", suriyayat)
        self.assertNotIn("houses_research", suriyayat)
        self.assertNotIn("future_research_layer", suriyayat)
        serialized = json.dumps(compact, ensure_ascii=False)
        self.assertNotIn("LAGNA_RESEARCH_MUST_NOT_LEAK", serialized)
        self.assertNotIn("HOUSE_RESEARCH_MUST_NOT_LEAK", serialized)
        self.assertNotIn("FUTURE_RESEARCH_MUST_NOT_LEAK", serialized)
        self.assertNotIn("350.266667", serialized)

    def test_only_explicit_suriyayat_fact_keys_are_whitelisted(self):
        calculation = {
            "period": {},
            "thai": {
                "suriyayat": {
                    "available": True,
                    "engine": "safe-engine",
                    "source_commit": "abc",
                    "time_basis": "basis",
                    "validation": {"status": "ok"},
                    "natal": {"positions": {}},
                    "period_start": {"positions": {}},
                    "period_end": {"positions": {}},
                    "lagna": {"available": False},
                    "interpretation_status": "facts_only",
                    "policy": "facts only",
                    "unexpected": {"research_only": True},
                }
            },
        }
        suriyayat = _compact_calculation(calculation)["thai"]["suriyayat"]
        self.assertEqual(
            set(suriyayat),
            {
                "available", "engine", "source_commit", "time_basis", "validation",
                "natal", "period_start", "period_end", "lagna",
                "interpretation_status",
            },
        )
        self.assertNotIn("policy", suriyayat)


if __name__ == "__main__":
    unittest.main()
