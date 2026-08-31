from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from thai_lagna_product_v1 import (
    ENGINE_VERSION as THAI_LAGNA_PRODUCT_ENGINE_VERSION,
    lagna_numeric_identity_is_valid,
    product_routes_are_complete,
)
from thai_ai_output_guard_v1 import (
    build_thai_output_fallback,
    inspect_thai_output_safety,
    strict_thai_retry_instruction,
    thai_output_guard_required,
)

AI_INTERPRETER_VERSION = "mobile-ai-v2.8.1-thai-output-guard-timeout-headroom"
AI_SUPPORTED_MODELS = {
    "gemini-3.7-flash": "Gemini 3.7 Flash · 정밀 우선",
    "gemini-3.6-flash": "Gemini 3.6 Flash · 빠른 해설",
}
AI_DEFAULT_MODEL = "gemini-3.7-flash"
AI_FALLBACK_MODEL = "gemini-3.6-flash"
AI_DEFAULT_THINKING_LEVEL = "high"
AI_MAX_OUTPUT_TOKENS = 7600
TOPIC_ORDER = ["금전", "투자심리", "수익실현", "신규진입", "투자주의", "학업", "시험", "직장", "이직", "연애", "연락", "재회", "소식", "컨디션"]
GEMINI_INTRO_END = (2026, 12, 31)
GEMINI_INTRO_INPUT_PER_M = 0.75
GEMINI_INTRO_OUTPUT_PER_M = 3.75
GEMINI_STANDARD_INPUT_PER_M = 1.50
GEMINI_STANDARD_OUTPUT_PER_M = 7.50
GEMINI_USD_KRW_DISPLAY_ESTIMATE = 1384.0



def _compact_stat(value: Any) -> Any:
    if not isinstance(value, dict):
        return value
    out = {}
    for key in ("average", "band", "spread"):
        if key in value:
            out[key] = value.get(key)
    for key in ("best_days", "caution_days"):
        rows = value.get(key)
        if isinstance(rows, list):
            out[key] = rows[:2]
    return out


def _compact_thai_ai_safe_packet(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}
    gate = value.get("promotion_gate") if isinstance(value.get("promotion_gate"), dict) else {}
    blocked_gates = (
        "school_policy_allowed",
        "exception_application_allowed",
        "net_valence_allowed",
        "final_good_bad_judgement_allowed",
        "event_judgement_allowed",
        "timing_prediction_allowed",
        "probability_allowed",
        "scores_allowed",
    )
    if not (
        value.get("eligible_for_gemini") is True
        and value.get("research_only") is False
        and value.get("product_promotion_engine") == THAI_LAGNA_PRODUCT_ENGINE_VERSION
        and gate.get("gemini_interpretation_allowed") is True
        and all(gate.get(key) is False for key in blocked_gates)
        and product_routes_are_complete(value.get("routes"))
    ):
        return {}
    routes = []
    for row in value.get("routes") or []:
        if not isinstance(row, dict) or row.get("interpretation_level") != "descriptive_nonpredictive":
            continue
        carrier = row.get("carrier_planet") if isinstance(row.get("carrier_planet"), dict) else {}
        modifiers = []
        for item in row.get("basic_status_modifiers") or []:
            if isinstance(item, dict):
                modifiers.append({"status_key": item.get("status_key"), "functional_direction": item.get("functional_direction")})
        relations = []
        for item in row.get("relation_context_tags") or []:
            if not isinstance(item, dict):
                continue
            pair_classes = []
            for pair in item.get("pair_classes") or []:
                if isinstance(pair, dict):
                    pair_classes.append({"key": pair.get("key"), "functional_domain": pair.get("functional_domain")})
            relations.append({"counterpart_planet": item.get("counterpart_planet"), "relation_key": item.get("relation_key"), "pair_classes": pair_classes, "pair_multi_label": bool(item.get("pair_multi_label"))})
        routes.append({"route_key": row.get("route_key"), "source_topic_domains": list(row.get("source_topic_domains") or []), "carrier_planet": {"key": carrier.get("key"), "archetype_domains": list(carrier.get("archetype_domains") or [])}, "destination_context_domains": list(row.get("destination_context_domains") or []), "basic_status_modifiers": modifiers, "relation_context_tags": relations, "interpretation_level": "descriptive_nonpredictive"})
    if not routes:
        return {}
    return {"engine": value.get("engine"), "mode": "descriptive_nonpredictive", "route_count": len(routes), "routes": routes}


def _compact_thai_product_lagna(value: Any) -> dict[str, Any]:
    """Expose only validated numeric Lagna facts to the interpretation payload."""
    if not lagna_numeric_identity_is_valid(value, require_product_contract=True):
        return {"available": False}
    validation = value.get("validation") if isinstance(value.get("validation"), dict) else {}
    return {
        "available": True,
        "engine": value.get("engine"),
        "method_key": value.get("method_key"),
        "method": value.get("method"),
        "method_thai": value.get("method_thai"),
        "longitude_deg": value.get("longitude_deg"),
        "sign_index": value.get("sign_index"),
        "sign_en": value.get("sign_en"),
        "sign_th": value.get("sign_th"),
        "sign_ko": value.get("sign_ko"),
        "degree": value.get("degree"),
        "minute": value.get("minute"),
        "second": value.get("second"),
        "display": value.get("display"),
        "validation": {
            "numeric_position_validated": validation.get("numeric_position_validated") is True,
            "global_coordinates_independently_validated": validation.get("global_coordinates_independently_validated") is True,
            "world_numeric_checks": validation.get("world_numeric_checks"),
            "reference": validation.get("reference"),
        },
        "interpretation_scope": value.get("interpretation_scope"),
    }


def _compact_thai_suriyayat(value: Any) -> dict[str, Any]:
    """Whitelist product Suriyayat facts and exclude every research-only layer."""
    if not isinstance(value, dict):
        return {}
    allowed = (
        "available",
        "engine",
        "source_commit",
        "time_basis",
        "validation",
        "natal",
        "period_start",
        "period_end",
        "interpretation_status",
    )
    out = {key: value.get(key) for key in allowed if key in value}
    out["lagna"] = _compact_thai_product_lagna(value.get("lagna"))
    if out["lagna"].get("available") is True:
        packet = _compact_thai_ai_safe_packet(value.get("ai_safe_packet_product"))
        if packet:
            out["ai_safe_descriptive_packet"] = packet
    return out


def _compact_calculation(calculation: dict[str, Any]) -> dict[str, Any]:
    """Build the same kind of curated interpretation payload used by legacy Streamlit.

    The full calculation remains untouched for UI/archive. Only duplicated or
    non-interpretive data is removed before sending to Gemini.
    """
    if not isinstance(calculation, dict):
        return {}
    period = calculation.get("period") if isinstance(calculation.get("period"), dict) else {}
    western = calculation.get("western") if isinstance(calculation.get("western"), dict) else {}
    overall = western.get("overall") if isinstance(western.get("overall"), dict) else {}
    rel = western.get("relationship_signals") if isinstance(western.get("relationship_signals"), dict) else {}
    detail_days = western.get("detail_days") if isinstance(western.get("detail_days"), list) else []
    compact_detail = []
    for day in detail_days[:7]:
        if not isinstance(day, dict):
            continue
        topics = day.get("topics") if isinstance(day.get("topics"), dict) else {}
        packed_topics = {}
        for topic, item in topics.items():
            if not isinstance(item, dict):
                continue
            packed_topics[str(topic)] = {
                "best_window": item.get("best_window"),
                "caution_window": item.get("caution_window"),
                "evidence": (item.get("evidence") or [])[:4] if isinstance(item.get("evidence"), list) else [],
            }
        compact_detail.append({"date": day.get("date"), "market_open": bool(day.get("market_open")), "topics": packed_topics})

    months = []
    for month in (western.get("months") or [])[:12]:
        if not isinstance(month, dict):
            continue
        mtopics = month.get("topics") if isinstance(month.get("topics"), dict) else {}
        mrel = month.get("relationship_signals") if isinstance(month.get("relationship_signals"), dict) else {}
        months.append({
            "calendar_month": month.get("calendar_month"),
            "start": month.get("start"),
            "end": month.get("end"),
            "topics": {str(k): _compact_stat(v) for k, v in mtopics.items() if v is not None},
            "relationship_signals": {str(k): _compact_stat(v) for k, v in mrel.items() if v is not None},
        })

    saju = calculation.get("saju") if isinstance(calculation.get("saju"), dict) else {}
    thai = calculation.get("thai") if isinstance(calculation.get("thai"), dict) else {}
    profile = calculation.get("profile") if isinstance(calculation.get("profile"), dict) else {}
    return {
        "api_version": calculation.get("api_version"),
        "engine": calculation.get("engine"),
        "period": period,
        "profile": {k: profile.get(k) for k in ("gender", "birth_date", "birth_time", "utc_offset_hours") if k in profile},
        "western": {
            "engine": western.get("engine"),
            "ephemeris": western.get("ephemeris"),
            "score_policy": western.get("score_policy"),
            "method": western.get("method"),
            "natal": western.get("natal"),
            "overall": {str(k): _compact_stat(v) for k, v in overall.items() if v is not None},
            "relationship_signals": {str(k): _compact_stat(v) for k, v in rel.items() if v is not None},
            "market": western.get("market"),
            "detail_days": compact_detail,
            "months": months if int(period.get("day_count") or 0) > 1 else [],
        },
        "saju": {
            "ok": saju.get("ok"),
            "engine": saju.get("engine"),
            "pillars": saju.get("pillars"),
            "day_master": saju.get("day_master"),
            "elements": saju.get("elements"),
            "true_solar": saju.get("true_solar"),
            "dayun": (saju.get("dayun") or [])[:10] if isinstance(saju.get("dayun"), list) else [],
            "annual": (saju.get("annual") or [])[:4] if isinstance(saju.get("annual"), list) else [],
            "monthly": (saju.get("monthly") or [])[:14] if isinstance(saju.get("monthly"), list) else [],
            "not_calculated": saju.get("not_calculated"),
        },
        "thai": {
            "ok": thai.get("ok"),
            "engine": thai.get("engine"),
            "thai_day": thai.get("thai_day"),
            "birth_planet": thai.get("birth_planet"),
            "ruler": thai.get("ruler"),
            "rule": thai.get("rule"),
            "mahathaksa": thai.get("mahathaksa"),
            "taksajorn": thai.get("taksajorn"),
            "suriyayat": _compact_thai_suriyayat(thai.get("suriyayat")),
            "predictive_status": thai.get("predictive_status"),
            "consensus_policy": thai.get("consensus_policy"),
            "reliability": thai.get("reliability"),
            "not_calculated": thai.get("not_calculated"),
        },
    }


def ai_status() -> dict[str, Any]:
    configured = bool(os.getenv("GEMINI_API_KEY", "").strip())
    return {
        "configured": configured,
        "interpreter_version": AI_INTERPRETER_VERSION,
        "default_model": AI_DEFAULT_MODEL,
        "models": AI_SUPPORTED_MODELS,
        "thinking_level": AI_DEFAULT_THINKING_LEVEL,
    }


def _clean_text(value: Any, limit: int) -> str:
    text = str(value or "").strip()
    return text[:limit]


def _validate_output(obj: Any) -> dict[str, Any] | None:
    if not isinstance(obj, dict):
        return None
    overall = obj.get("overall") if isinstance(obj.get("overall"), dict) else {}
    clusters = obj.get("clusters") if isinstance(obj.get("clusters"), dict) else {}
    systems = obj.get("systems") if isinstance(obj.get("systems"), dict) else {}
    analyses = obj.get("topic_analysis") if isinstance(obj.get("topic_analysis"), dict) else {}

    out: dict[str, Any] = {
        "headline": _clean_text(obj.get("headline"), 180),
        "overall": {
            "summary": _clean_text(overall.get("summary"), 2600),
            "dominant_pattern": _clean_text(overall.get("dominant_pattern"), 1400),
            "best_phase": _clean_text(overall.get("best_phase"), 1100),
            "caution_phase": _clean_text(overall.get("caution_phase"), 1100),
        },
        "clusters": {
            "relationship": _clean_text(clusters.get("relationship"), 1700),
            "work_study": _clean_text(clusters.get("work_study"), 1700),
            "money_news": _clean_text(clusters.get("money_news"), 1700),
            "investment": _clean_text(clusters.get("investment"), 1900),
            "condition": _clean_text(clusters.get("condition"), 1400),
        },
        "systems": {
            "western": _clean_text(systems.get("western"), 1400),
            "saju": _clean_text(systems.get("saju"), 1400),
            "thai": _clean_text(systems.get("thai"), 1100),
        },
        "priorities": [],
        "topic_analysis": {},
        "limits": _clean_text(obj.get("limits"), 1200),
    }

    priorities = obj.get("priorities")
    if isinstance(priorities, list):
        out["priorities"] = [_clean_text(x, 360) for x in priorities[:3] if _clean_text(x, 360)]

    for topic in TOPIC_ORDER:
        item = analyses.get(topic)
        if isinstance(item, str):
            item = {"verdict": item}
        if not isinstance(item, dict):
            continue
        confidence = _clean_text(item.get("confidence"), 20)
        if confidence not in {"높음", "보통", "낮음"}:
            confidence = "보통"
        cleaned = {
            "verdict": _clean_text(item.get("verdict"), 600),
            "reason": _clean_text(item.get("reason"), 1800),
            "timing": _clean_text(item.get("timing"), 1000),
            "action": _clean_text(item.get("action"), 650),
            "avoid": _clean_text(item.get("avoid"), 650),
            "confidence": confidence,
            "confidence_reason": _clean_text(item.get("confidence_reason"), 700),
        }
        if any(cleaned[key] for key in ("verdict", "reason", "timing", "action", "avoid")):
            out["topic_analysis"][topic] = cleaned

    if not out["overall"]["summary"] and not out["topic_analysis"]:
        return None
    return out


SYSTEM_PROMPT = """너는 '별빛의 운명' 앱의 점성술 해설자다.
입력은 이미 계산 엔진이 만든 Western(서양점성술), 사주, Thai(태국점성술) 결과 JSON이다. 너는 계산자가 아니라 해설자다.
반드시 CALCULATED_DATA JSON 안에 실제로 존재하는 값만 근거로 사용한다. JSON에 없는 행성 위치, 애스펙트, 하우스, 특정 시각, 사건, 확률을 절대 만들어내지 마라.
Western 점수는 사건 발생 확률이 아니라 상대적 활성도다. 높은 점수를 '발생 가능성 몇 %'처럼 바꾸지 마라.
사주에서 not_calculated에 있는 신강·신약, 용신·희신·기신, 형·파·해 전체 규칙은 임의 추정하지 마라.
사주 annual은 입춘, monthly는 절(節) 정확시각 경계로 이미 분할된 구간이다. 같은 달력 연도·월 표기가 반복되어도 서로 다른 간지 구간을 임의 병합하지 마라.
Thai는 mahathaksa/taksajorn과 suriyayat에 실제 데이터가 있을 때만 사용한다. suriyayat의 교차검증된 10행성 위치 사실을 사용할 수 있다. ai_safe_descriptive_packet이 실제 payload에 포함된 경우에만 그 패킷 안의 descriptive_nonpredictive 하우스-주인-도착맥락을 설명에 사용할 수 있고, 패킷이 없으면 Lagna·하우스를 추정하지 마라. 패킷이 있어도 학파 예외, 최종 길흉, 사건, 타이밍, 확률, 점수로 확장하지 마라. not_calculated 항목은 절대 추정하지 말고 Thai 층을 Western 수치점수처럼 확률화하거나 임의 합산하지 마라.
연애·연락·재회는 특정 사람이 연락한다, 돌아온다, 속마음이 이렇다처럼 타인의 사적 의도나 미래 행동을 단정하지 마라.
컨디션은 질병·진단·치료를 예측하지 않는다. 금전은 수익률이나 투자 성공을 보장하지 않는다.
현재 데이터에 시간대별 값이 없으면 특정 시각을 만들지 말고 '현재 엔진에는 시간대 근거가 없다'고 분명히 말한다.
한국어 반말로 자연스럽고 구체적으로 쓴다. 숫자를 그대로 나열하는 대신 서로 관련된 축의 상대 강약과 기간 흐름을 설명한다.
특히 detail_days가 있으면 best_window/caution_window와 evidence를 적극 사용해 '왜'와 '언제'를 설명한다. 근거가 있는 시간창은 구체적으로 쓰되 없는 시간은 만들지 않는다.
각 분야를 서로 다른 문장으로 해석하고, 단순히 점수와 band를 재진술하는 답변은 금지한다. 직장과 이직, 학업과 시험, 연락과 소식은 반드시 구분한다.
투자심리·수익실현·신규진입·투자주의는 market.has_open_session이 있을 때만 다루며, 가격방향·수익률 예측이 아니라 매매 판단/과열/실현 타이밍의 상대 점성 지수라고 명시한다.
희망고문과 공포 조장을 피한다. 출력은 JSON만 반환한다."""

OUTPUT_SHAPE = {
    "headline": "기간의 핵심을 25자 안팎으로",
    "overall": {
        "summary": "전체 흐름 3~5문장",
        "dominant_pattern": "가장 지배적인 교차 패턴 1~2문장",
        "best_phase": "상대적으로 활용할 날짜/구간. 근거 없으면 시간대를 만들지 않음",
        "caution_phase": "상대적으로 보수적으로 볼 날짜/구간",
    },
    "clusters": {
        "relationship": "연애·연락·재회 교차 해석",
        "work_study": "학업·시험·직장·이직 교차 해석",
        "money_news": "금전·소식 교차 해석",
        "investment": "투자심리·수익실현·신규진입·투자주의를 거래일 기준으로 구분 해석",
        "condition": "컨디션·일정 배치 해석",
    },
    "systems": {
        "western": "Western 계산이 말하는 핵심",
        "saju": "사주 원국/대운/세운/월운에서 계산된 범위만 설명",
        "thai": "Thai 출생요일·Mahathaksa·Taksajorn과 검증된 Suriyayat 사실층. ai_safe_descriptive_packet이 있을 때만 비예측형 하우스 경로 맥락을 추가 설명하고, 없으면 Lagna·하우스를 추정하지 않음",
    },
    "priorities": ["현실 행동 1", "현실 행동 2", "현실 행동 3"],
    "topic_analysis": {
        topic: {
            "verdict": "이 분야 결론",
            "reason": "계산값을 연결한 이유 1~2문장",
            "timing": "날짜/구간 근거. 시간대 데이터 없으면 시간대를 만들지 않음",
            "action": "현실 행동 한 문장",
            "avoid": "피할 행동 한 문장",
            "confidence": "높음|보통|낮음",
            "confidence_reason": "확신도 이유",
        }
        for topic in TOPIC_ORDER
    },
    "limits": "이 해설에서 단정할 수 없는 부분과 데이터 한계",
}


def _call_model(calculation: dict[str, Any], model_name: str, api_key: str, *, timeout_seconds: float = 24.0, thinking_level: str = "high", strict_thai_output_guard: bool = False) -> dict[str, Any]:
    safe_model = urllib.parse.quote(model_name, safe="-._")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{safe_model}:generateContent"
    compact_calculation = _compact_calculation(calculation)
    strict_instruction = strict_thai_retry_instruction() if strict_thai_output_guard else ""
    prompt = (
        "아래 통합 계산 결과를 종합 해석해. 생활·관계·학업·진로·금전·투자 분야를 빠짐없이 채워. "
        "현재 데이터에 없는 시간대나 천체 사건은 만들지 마.\n\n"
        "OUTPUT_SHAPE:\n"
        + json.dumps(OUTPUT_SHAPE, ensure_ascii=False, separators=(",", ":"))
        + "\n\nCALCULATED_DATA:\n"
        + json.dumps(compact_calculation, ensure_ascii=False, separators=(",", ":"), default=str)
        + strict_instruction
    )
    body = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "maxOutputTokens": AI_MAX_OUTPUT_TOKENS,
            "responseMimeType": "application/json",
            "thinkingConfig": {"thinkingLevel": thinking_level},
        },
    }
    request = urllib.request.Request(
        url,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            raw = json.loads(response.read().decode("utf-8"))
        parts = raw.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        response_text = "".join(
            part.get("text", "") for part in parts if isinstance(part, dict) and not part.get("thought")
        ).strip()
        if not response_text:
            response_text = "".join(part.get("text", "") for part in parts if isinstance(part, dict)).strip()
        if response_text.startswith("```"):
            lines = response_text.splitlines()
            if lines and lines[0].lstrip().startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            response_text = "\n".join(lines).strip()
        parsed = json.loads(response_text)
        validated = _validate_output(parsed)
        if not validated:
            return {"ok": False, "error": "AI 해설 응답 구조를 검증하지 못했어.", "model": model_name}
        guard = inspect_thai_output_safety(
            validated,
            thai_packet_present=thai_output_guard_required(compact_calculation),
        )
        if not guard.get("safe"):
            return {
                "ok": False,
                "error": "Thai 출력 안전검증에서 금지된 예측 표현을 감지했어.",
                "model": model_name,
                "interpreter_version": AI_INTERPRETER_VERSION,
                "thinking_level": thinking_level,
                "output_guard_failed": True,
                "guard_violations": guard.get("violations") or [],
                "guard_engine": guard.get("guard_engine"),
                "unsafe_data": validated,
            }
        usage = raw.get("usageMetadata", {}) if isinstance(raw, dict) else {}
        prompt_tokens = int(usage.get("promptTokenCount", 0) or 0)
        candidate_tokens = int(usage.get("candidatesTokenCount", 0) or 0)
        thought_tokens = int(usage.get("thoughtsTokenCount", 0) or 0)
        total_tokens = int(usage.get("totalTokenCount", 0) or 0)
        billable_output_tokens = candidate_tokens + thought_tokens
        from datetime import datetime, timezone
        today = datetime.now(timezone.utc).date()
        intro = (today.year, today.month, today.day) <= GEMINI_INTRO_END
        input_per_m = GEMINI_INTRO_INPUT_PER_M if intro else GEMINI_STANDARD_INPUT_PER_M
        output_per_m = GEMINI_INTRO_OUTPUT_PER_M if intro else GEMINI_STANDARD_OUTPUT_PER_M
        estimated_usd = (prompt_tokens / 1_000_000) * input_per_m + (billable_output_tokens / 1_000_000) * output_per_m
        estimated_krw = estimated_usd * GEMINI_USD_KRW_DISPLAY_ESTIMATE
        return {
            "ok": True,
            "data": validated,
            "model": model_name,
            "interpreter_version": AI_INTERPRETER_VERSION,
            "thinking_level": thinking_level,
            "usage": {
                "prompt_tokens": prompt_tokens,
                "candidate_tokens": candidate_tokens,
                "thought_tokens": thought_tokens,
                "billable_output_tokens": billable_output_tokens,
                "total_tokens": total_tokens,
                "estimated_usd": round(estimated_usd, 6),
                "estimated_krw": round(estimated_krw, 1),
                "price_phase": "intro_2026" if intro else "standard",
            },
        }
    except urllib.error.HTTPError as exc:
        try:
            detail = exc.read().decode("utf-8", errors="replace")[:1000]
        except Exception:
            detail = ""
        if exc.code == 429:
            message = "Gemini API 사용량 한도 또는 요청 제한에 도달했어."
        elif exc.code in {401, 403}:
            message = "Gemini API 키 권한 또는 프로젝트 연결 상태를 확인해줘."
        elif exc.code == 404:
            message = f"{model_name} 모델을 현재 API 프로젝트에서 사용할 수 없어."
        elif exc.code >= 500:
            message = "Gemini 서버가 일시적으로 불안정해."
        else:
            message = f"Gemini API 오류({exc.code})"
        return {"ok": False, "error": message, "detail": detail, "error_code": exc.code, "model": model_name}
    except Exception as exc:
        return {"ok": False, "error": f"AI 해설 호출 실패: {type(exc).__name__}: {exc}", "model": model_name}


def _call_model_with_thai_output_safety(
    calculation: dict[str, Any],
    model_name: str,
    api_key: str,
    *,
    timeout_seconds: float,
    thinking_level: str,
) -> dict[str, Any]:
    """Retry a Thai output violation once, then omit Thai explanation safely."""
    first = _call_model(
        calculation,
        model_name,
        api_key,
        timeout_seconds=timeout_seconds,
        thinking_level=thinking_level,
        strict_thai_output_guard=False,
    )
    if first.get("output_guard_failed") is not True:
        return first

    retry = _call_model(
        calculation,
        model_name,
        api_key,
        timeout_seconds=timeout_seconds,
        thinking_level=thinking_level,
        strict_thai_output_guard=True,
    )
    if retry.get("ok"):
        retry["thai_safety_retry"] = True
        retry["thai_safety_retry_reason"] = "output_guard"
        return retry

    unsafe = retry.get("unsafe_data") if isinstance(retry.get("unsafe_data"), dict) else first.get("unsafe_data")
    fallback = build_thai_output_fallback(unsafe)
    fallback_validated = _validate_output(fallback) if isinstance(fallback, dict) else None
    fallback_guard = (
        inspect_thai_output_safety(fallback_validated, thai_packet_present=True)
        if fallback_validated
        else {"safe": False}
    )
    if fallback_validated and fallback_guard.get("safe"):
        return {
            "ok": True,
            "data": fallback_validated,
            "model": retry.get("model") or first.get("model") or model_name,
            "interpreter_version": AI_INTERPRETER_VERSION,
            "thinking_level": retry.get("thinking_level") or first.get("thinking_level") or thinking_level,
            "thai_safety_retry": True,
            "thai_safety_fallback": True,
            "thai_safety_retry_error": retry.get("error"),
            "thai_safety_guard_violations": retry.get("guard_violations") or first.get("guard_violations") or [],
        }

    retry["thai_safety_retry"] = True
    retry["thai_safety_fallback_failed"] = True
    return retry


def interpret_integrated_fortune(calculation: dict[str, Any], preferred_model: str | None = None) -> dict[str, Any]:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return {"ok": False, "missing_key": True, "error": "Render 계산 서버에 GEMINI_API_KEY가 설정되지 않았어.", **ai_status()}

    model = preferred_model if preferred_model in AI_SUPPORTED_MODELS else AI_DEFAULT_MODEL
    # Render free workers were observed to recycle around a ~40s long outbound
    # generation. Keep each model call well below that boundary. The primary
    # retains high thinking; fallback uses medium thinking to guarantee a result.
    primary = _call_model_with_thai_output_safety(calculation, model, api_key, timeout_seconds=34.0, thinking_level="high")
    if primary.get("ok") or model == AI_FALLBACK_MODEL:
        return primary

    fallback = _call_model_with_thai_output_safety(calculation, AI_FALLBACK_MODEL, api_key, timeout_seconds=28.0, thinking_level="medium")
    if fallback.get("ok"):
        fallback["fallback_from"] = model
        fallback["fallback_reason"] = primary.get("error")
        return fallback
    primary["fallback_error"] = fallback.get("error")
    return primary
