# -*- coding: utf-8 -*-
from __future__ import annotations

import unittest
from unittest.mock import patch

from ai_interpret_v1 import _call_model_with_thai_output_safety
from thai_ai_output_guard_v1 import FALLBACK_NOTE


def _unsafe_output(label: str = "first"):
    return {
        "headline": f"{label} headline",
        "overall": {
            "summary": "Western 흐름은 점검이 필요해. Thai Lagna상 반드시 연락이 온다.",
            "dominant_pattern": "",
            "best_phase": "",
            "caution_phase": "",
        },
        "clusters": {
            "relationship": "재회 가능성 80%야.",
            "work_study": "",
            "money_news": "",
            "investment": "",
            "condition": "",
        },
        "systems": {
            "western": "Western 계산은 상대 흐름만 보여줘.",
            "saju": "",
            "thai": "Suriyayat 기준 9월 3일 반드시 재회한다.",
        },
        "priorities": [],
        "topic_analysis": {},
        "limits": "원래 한계 문구",
    }


def _guard_failure(label: str = "first"):
    return {
        "ok": False,
        "error": "Thai output safety guard rejected model output.",
        "model": "gemini-test",
        "thinking_level": "high",
        "output_guard_failed": True,
        "guard_violations": [{"code": "deterministic_event"}],
        "unsafe_data": _unsafe_output(label),
    }


class ThaiPhase2G52RetryFallbackIntegrationTests(unittest.TestCase):
    def test_safe_first_response_is_returned_without_retry(self):
        safe = {"ok": True, "data": {"headline": "safe"}, "model": "gemini-test"}
        with patch("ai_interpret_v1._call_model", return_value=safe) as call:
            result = _call_model_with_thai_output_safety({}, "gemini-test", "key", timeout_seconds=10, thinking_level="high")
        self.assertIs(result, safe)
        self.assertEqual(call.call_count, 1)
        self.assertFalse(call.call_args.kwargs["strict_thai_output_guard"])

    def test_guard_failure_gets_exactly_one_strict_retry(self):
        retried = {"ok": True, "data": {"headline": "strict safe"}, "model": "gemini-test"}
        with patch("ai_interpret_v1._call_model", side_effect=[_guard_failure(), retried]) as call:
            result = _call_model_with_thai_output_safety({}, "gemini-test", "key", timeout_seconds=10, thinking_level="high")
        self.assertTrue(result["ok"])
        self.assertTrue(result["thai_safety_retry"])
        self.assertEqual(call.call_count, 2)
        self.assertFalse(call.call_args_list[0].kwargs["strict_thai_output_guard"])
        self.assertTrue(call.call_args_list[1].kwargs["strict_thai_output_guard"])

    def test_second_guard_failure_returns_non_thai_fallback_without_third_call(self):
        with patch("ai_interpret_v1._call_model", side_effect=[_guard_failure("first"), _guard_failure("second")]) as call:
            result = _call_model_with_thai_output_safety({}, "gemini-test", "key", timeout_seconds=10, thinking_level="high")
        self.assertTrue(result["ok"])
        self.assertTrue(result["thai_safety_fallback"])
        self.assertEqual(call.call_count, 2)
        self.assertEqual(result["data"]["systems"]["thai"], "")
        self.assertIn("Western 흐름은 점검이 필요해", result["data"]["overall"]["summary"])
        self.assertNotIn("반드시 연락", result["data"]["overall"]["summary"])
        self.assertIn(FALLBACK_NOTE, result["data"]["limits"])

    def test_strict_retry_transport_failure_uses_first_guarded_output_for_fallback(self):
        transport = {"ok": False, "error": "timeout", "model": "gemini-test"}
        with patch("ai_interpret_v1._call_model", side_effect=[_guard_failure("first"), transport]) as call:
            result = _call_model_with_thai_output_safety({}, "gemini-test", "key", timeout_seconds=10, thinking_level="high")
        self.assertTrue(result["ok"])
        self.assertTrue(result["thai_safety_fallback"])
        self.assertEqual(call.call_count, 2)
        self.assertEqual(result["data"]["systems"]["thai"], "")
        self.assertEqual(result["thai_safety_retry_error"], "timeout")

    def test_non_guard_model_failure_does_not_consume_strict_retry(self):
        failure = {"ok": False, "error": "server unavailable", "model": "gemini-test"}
        with patch("ai_interpret_v1._call_model", return_value=failure) as call:
            result = _call_model_with_thai_output_safety({}, "gemini-test", "key", timeout_seconds=10, thinking_level="high")
        self.assertIs(result, failure)
        self.assertEqual(call.call_count, 1)


if __name__ == "__main__":
    unittest.main()
