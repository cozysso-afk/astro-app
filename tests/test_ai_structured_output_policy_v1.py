from __future__ import annotations

import json
import unittest
from unittest.mock import patch

import ai_interpret_v1 as ai


class _FakeResponse:
    def __init__(self, payload: dict):
        self._payload = payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def read(self) -> bytes:
        return json.dumps(self._payload, ensure_ascii=False).encode("utf-8")


def _raw_response(text: str, *, finish_reason: str = "STOP", thought_tokens: int = 0) -> dict:
    return {
        "candidates": [
            {
                "finishReason": finish_reason,
                "content": {"parts": [{"text": text}]},
            }
        ],
        "usageMetadata": {
            "promptTokenCount": 100,
            "candidatesTokenCount": 50,
            "thoughtsTokenCount": thought_tokens,
            "totalTokenCount": 150 + thought_tokens,
        },
    }


class GeminiStructuredOutputPolicyTests(unittest.TestCase):
    def test_primary_request_requires_schema_complete_json_with_expanded_headroom(self):
        output = json.dumps({"headline": "핵심", "overall": {"summary": "안전한 요약"}}, ensure_ascii=False)
        with patch(
            "ai_interpret_v1.urllib.request.urlopen",
            return_value=_FakeResponse(_raw_response(output)),
        ) as urlopen:
            result = ai._call_model({}, "gemini-3.7-flash", "test-key", timeout_seconds=34.0)

        self.assertTrue(result["ok"])
        request = urlopen.call_args.args[0]
        body = json.loads(request.data.decode("utf-8"))
        config = body["generationConfig"]
        self.assertEqual(config["maxOutputTokens"], 12000)
        self.assertEqual(config["responseMimeType"], "application/json")
        self.assertEqual(config["responseSchema"], ai.AI_RESPONSE_SCHEMA)
        self.assertNotIn("additionalProperties", json.dumps(config["responseSchema"]))
        self.assertEqual(config["responseSchema"]["required"], list(ai.OUTPUT_SHAPE))
        topic_schema = config["responseSchema"]["properties"]["topic_analysis"]
        self.assertEqual(topic_schema["required"], ai.TOPIC_ORDER)
        self.assertEqual(
            topic_schema["properties"]["재회"]["properties"]["confidence"]["enum"],
            ["높음", "보통", "낮음"],
        )
        prompt = body["contents"][0]["parts"][0]["text"]
        self.assertNotIn("OUTPUT_SHAPE:", prompt)
        self.assertIn("responseSchema의 모든 필드", prompt)

    def test_compact_fallback_uses_smaller_complete_json_budget(self):
        output = json.dumps({"headline": "핵심", "overall": {"summary": "짧은 요약"}}, ensure_ascii=False)
        with patch(
            "ai_interpret_v1.urllib.request.urlopen",
            return_value=_FakeResponse(_raw_response(output)),
        ) as urlopen:
            result = ai._call_model(
                {},
                "gemini-3.6-flash",
                "test-key",
                timeout_seconds=34.0,
                thinking_level="low",
                compact_output=True,
            )

        self.assertTrue(result["ok"])
        body = json.loads(urlopen.call_args.args[0].data.decode("utf-8"))
        self.assertEqual(body["generationConfig"]["maxOutputTokens"], 8000)
        self.assertIn("각 문자열은 한 문장으로 압축", body["contents"][0]["parts"][0]["text"])

    def test_transport_failure_preserves_elapsed_request_diagnostics(self):
        with patch(
            "ai_interpret_v1.urllib.request.urlopen",
            side_effect=TimeoutError("test timeout"),
        ):
            result = ai._call_model(
                {},
                "gemini-3.6-flash",
                "test-key",
                timeout_seconds=34.0,
                thinking_level="low",
                compact_output=True,
            )

        self.assertFalse(result["ok"])
        self.assertEqual(result["timeout_seconds"], 34.0)
        self.assertEqual(result["thinking_level"], "low")
        self.assertTrue(result["compact_output"])
        self.assertGreater(result["request_chars"], 0)
        self.assertGreaterEqual(result["elapsed_seconds"], 0)

    def test_truncated_json_preserves_finish_reason_and_usage_for_diagnosis(self):
        truncated = '{"headline":"핵심","overall":{"summary":"끝나지 않은 문장'
        raw = _raw_response(truncated, finish_reason="MAX_TOKENS", thought_tokens=7400)
        with patch(
            "ai_interpret_v1.urllib.request.urlopen",
            return_value=_FakeResponse(raw),
        ):
            result = ai._call_model({}, "gemini-3.7-flash", "test-key", timeout_seconds=34.0)

        self.assertFalse(result["ok"])
        self.assertTrue(result["response_incomplete"])
        self.assertEqual(result["finish_reason"], "MAX_TOKENS")
        self.assertEqual(result["usage"]["thought_tokens"], 7400)
        self.assertGreater(result["response_chars"], 0)
        self.assertIn("Unterminated string", result["json_error"])


if __name__ == "__main__":
    unittest.main()
