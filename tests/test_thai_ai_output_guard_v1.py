# -*- coding: utf-8 -*-
from __future__ import annotations

import unittest

from thai_ai_output_guard_v1 import (
    FALLBACK_NOTE,
    build_thai_output_fallback,
    inspect_thai_output_safety,
    strict_thai_retry_instruction,
    thai_output_guard_required,
)


def _safe_output():
    return {
        "headline": "관계와 진로를 차분히 보는 흐름",
        "overall": {
            "summary": "Western과 사주 흐름을 함께 보면 서두르기보다 점검하는 편이 좋아.",
            "dominant_pattern": "활성도는 있지만 사건 발생을 보장하지 않아.",
            "best_phase": "계산된 Western 날짜 구간을 참고해.",
            "caution_phase": "과열 판단은 피하는 게 좋아.",
        },
        "clusters": {
            "relationship": "연락 여부를 단정할 수 없고 현실 상호작용을 확인해야 해.",
            "work_study": "준비와 점검에 초점을 둬.",
            "money_news": "지출과 정보 확인을 우선해.",
            "investment": "수익을 보장하지 않는 상대적 지표야.",
            "condition": "일정 밀도를 조절해.",
        },
        "systems": {
            "western": "Western detail_days의 계산 구간을 설명해.",
            "saju": "계산된 세운과 월운 범위만 설명해.",
            "thai": "Thai Lagna의 하우스 경로는 관계 주제가 자기 영역과 연결되는 구조를 보여줄 뿐 사건을 보장하지 않아.",
        },
        "priorities": ["사실 확인", "일정 점검"],
        "topic_analysis": {
            "연락": {
                "verdict": "연락 여부는 단정할 수 없어.",
                "reason": "현재 계산값은 상대적 흐름만 보여줘.",
                "timing": "Western detail_days에 있는 구간만 참고해.",
                "action": "현실 신호를 확인해.",
                "avoid": "확정적으로 기대하지 마.",
                "confidence": "보통",
                "confidence_reason": "복수 시스템의 근거가 섞여 있어.",
            }
        },
        "limits": "미래 사건은 확정할 수 없어.",
    }


def _compact_with_packet():
    return {
        "thai": {
            "suriyayat": {
                "ai_safe_descriptive_packet": {
                    "mode": "descriptive_nonpredictive",
                    "route_count": 12,
                    "routes": [{"route_key": f"H{i}:x->H{i}"} for i in range(1, 13)],
                }
            }
        }
    }


class ThaiPhase2G52OutputGuardTests(unittest.TestCase):
    def test_guard_activates_only_for_complete_promoted_packet(self):
        self.assertTrue(thai_output_guard_required(_compact_with_packet()))
        self.assertFalse(thai_output_guard_required({}))
        bad = _compact_with_packet()
        bad["thai"]["suriyayat"]["ai_safe_descriptive_packet"]["route_count"] = 11
        self.assertFalse(thai_output_guard_required(bad))

    def test_safe_descriptive_thai_output_passes(self):
        result = inspect_thai_output_safety(_safe_output(), thai_packet_present=True)
        self.assertTrue(result["safe"], result["violations"])

    def test_numeric_probability_is_rejected(self):
        value = _safe_output()
        value["clusters"]["relationship"] = "재회 가능성은 82%야."
        result = inspect_thai_output_safety(value, thai_packet_present=True)
        self.assertIn("numeric_probability", {v["code"] for v in result["violations"]})

    def test_deterministic_contact_claim_is_rejected(self):
        value = _safe_output()
        value["clusters"]["relationship"] = "이번 흐름에서는 반드시 연락이 온다."
        result = inspect_thai_output_safety(value, thai_packet_present=True)
        codes = {v["code"] for v in result["violations"]}
        self.assertIn("deterministic_event", codes)
        self.assertIn("certainty_event", codes)

    def test_denial_of_event_claim_is_allowed(self):
        value = _safe_output()
        value["clusters"]["relationship"] = "연락이 온다고 단정할 수 없어."
        result = inspect_thai_output_safety(value, thai_packet_present=True)
        self.assertTrue(result["safe"], result["violations"])

    def test_thai_exact_date_is_rejected(self):
        value = _safe_output()
        value["systems"]["thai"] = "Suriyayat 기준 9월 3일에 관계 사건이 두드러져."
        result = inspect_thai_output_safety(value, thai_packet_present=True)
        self.assertIn("thai_exact_timing", {v["code"] for v in result["violations"]})

    def test_thai_exact_time_is_rejected(self):
        value = _safe_output()
        value["overall"]["summary"] = "Thai Lagna상 오후 3:20에 움직임이 강해."
        result = inspect_thai_output_safety(value, thai_packet_present=True)
        self.assertIn("thai_exact_timing", {v["code"] for v in result["violations"]})

    def test_thai_score_is_rejected(self):
        value = _safe_output()
        value["systems"]["thai"] = "태국점성 점수는 88점이야."
        result = inspect_thai_output_safety(value, thai_packet_present=True)
        self.assertIn("thai_score", {v["code"] for v in result["violations"]})

    def test_thai_final_good_bad_is_rejected(self):
        value = _safe_output()
        value["systems"]["thai"] = "Lagna 기준 대길이라 볼 수 있어."
        result = inspect_thai_output_safety(value, thai_packet_present=True)
        self.assertIn("thai_final_good_bad", {v["code"] for v in result["violations"]})

    def test_exact_date_without_thai_attribution_can_survive(self):
        value = _safe_output()
        value["systems"]["western"] = "Western detail_days에 계산된 9월 3일 구간을 참고해."
        result = inspect_thai_output_safety(value, thai_packet_present=True)
        self.assertTrue(result["safe"], result["violations"])

    def test_guard_is_inert_without_promoted_packet(self):
        value = _safe_output()
        value["systems"]["thai"] = "태국점성상 재회 확률은 90%고 9월 3일 반드시 연락이 온다."
        result = inspect_thai_output_safety(value, thai_packet_present=False)
        self.assertTrue(result["safe"])

    def test_fallback_removes_thai_and_unsafe_cross_section_sentences(self):
        value = _safe_output()
        value["overall"]["summary"] = "Western 흐름은 점검이 필요해. Thai Lagna상 반드시 연락이 온다."
        value["systems"]["thai"] = "Suriyayat 기준 9월 3일 재회 확률은 85%야."
        fallback = build_thai_output_fallback(value)
        self.assertIsNotNone(fallback)
        self.assertEqual(fallback["systems"]["thai"], "")
        self.assertIn("Western 흐름은 점검이 필요해", fallback["overall"]["summary"])
        self.assertNotIn("반드시 연락", fallback["overall"]["summary"])
        self.assertIn(FALLBACK_NOTE, fallback["limits"])
        checked = inspect_thai_output_safety(fallback, thai_packet_present=True)
        self.assertTrue(checked["safe"], checked["violations"])

    def test_strict_retry_instruction_names_detected_rule_without_relaxing_scope(self):
        text = strict_thai_retry_instruction([{"code": "numeric_probability"}, {"code": "thai_exact_timing"}])
        self.assertIn("numeric_probability", text)
        self.assertIn("thai_exact_timing", text)
        self.assertIn("systems.thai", text)
        self.assertIn("비예측형", text)


if __name__ == "__main__":
    unittest.main()
