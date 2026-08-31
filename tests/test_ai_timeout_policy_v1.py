from __future__ import annotations

import os
import unittest
from unittest.mock import patch

import ai_interpret_v1 as ai


class GeminiTimeoutPolicyTests(unittest.TestCase):
    def test_primary_and_fallback_keep_sub_40s_outbound_headroom(self):
        failed={"ok":False,"error":"timeout","model":"gemini-3.7-flash"}
        passed={"ok":True,"data":{"headline":"ok"},"model":"gemini-3.6-flash"}
        with patch.dict(os.environ,{"GEMINI_API_KEY":"test-key"},clear=False):
            with patch("ai_interpret_v1._call_model_with_thai_output_safety",side_effect=[failed,passed]) as call:
                result=ai.interpret_integrated_fortune({},"gemini-3.7-flash")
        self.assertTrue(result["ok"])
        self.assertEqual(call.call_count,2)
        first=call.call_args_list[0].kwargs
        second=call.call_args_list[1].kwargs
        self.assertEqual(first["timeout_seconds"],34.0)
        self.assertEqual(first["thinking_level"],"medium")
        self.assertFalse(first["compact_output"])
        self.assertEqual(second["timeout_seconds"],34.0)
        self.assertEqual(second["thinking_level"],"low")
        self.assertTrue(second["compact_output"])
        self.assertLess(first["timeout_seconds"],40.0)
        self.assertLess(second["timeout_seconds"],40.0)

    def test_interpreter_version_marks_transport_budget_hotfix(self):
        self.assertEqual(ai.AI_INTERPRETER_VERSION,"mobile-ai-v2.8.4-thai-transport-budgeted")

    def test_double_failure_preserves_fallback_transport_diagnostics(self):
        primary={
            "ok":False,
            "error":"primary timeout",
            "model":"gemini-3.7-flash",
            "thinking_level":"medium",
            "elapsed_seconds":34.01,
        }
        fallback={
            "ok":False,
            "error":"fallback timeout",
            "model":"gemini-3.6-flash",
            "thinking_level":"low",
            "compact_output":True,
            "timeout_seconds":34.0,
            "elapsed_seconds":34.02,
            "request_chars":32000,
        }
        with patch.dict(os.environ,{"GEMINI_API_KEY":"test-key"},clear=False):
            with patch("ai_interpret_v1._call_model_with_thai_output_safety",side_effect=[primary,fallback]):
                result=ai.interpret_integrated_fortune({},"gemini-3.7-flash")
        self.assertFalse(result["ok"])
        self.assertEqual(result["fallback_error"],"fallback timeout")
        self.assertEqual(result["fallback_diagnostics"]["model"],"gemini-3.6-flash")
        self.assertEqual(result["fallback_diagnostics"]["thinking_level"],"low")
        self.assertEqual(result["fallback_diagnostics"]["request_chars"],32000)


if __name__ == "__main__":
    unittest.main()
