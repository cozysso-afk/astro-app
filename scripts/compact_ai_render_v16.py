from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
p=ROOT/'ai_interpret_v1.py'
s=p.read_text(encoding='utf-8')

s=s.replace('AI_INTERPRETER_VERSION = "mobile-ai-v2"','AI_INTERPRETER_VERSION = "mobile-ai-v2.1-render-safe"')
s=s.replace('AI_MAX_OUTPUT_TOKENS = 12000','AI_MAX_OUTPUT_TOKENS = 7600')

insert_after='GEMINI_USD_KRW_DISPLAY_ESTIMATE = 1384.0\n'
compact_code=r'''


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
        "thai": {k: thai.get(k) for k in ("ok", "engine", "thai_day", "ruler", "rule", "predictive_status", "consensus_policy") if k in thai},
    }
'''
if compact_code.strip() not in s:
    s=s.replace(insert_after,insert_after+compact_code,1)

# tighten output hints without deleting fields
s=s.replace('"summary": "전체 흐름 4~7문장"','"summary": "전체 흐름 3~5문장"')
s=s.replace('"dominant_pattern": "가장 지배적인 교차 패턴 2~4문장"','"dominant_pattern": "가장 지배적인 교차 패턴 1~2문장"')
s=s.replace('"reason": "계산값을 연결한 이유"','"reason": "계산값을 연결한 이유 1~2문장"')
s=s.replace('"action": "현실 행동"','"action": "현실 행동 한 문장"')
s=s.replace('"avoid": "피할 행동"','"avoid": "피할 행동 한 문장"')

# change model call to support bounded timeout/thinking and compact payload
s=s.replace('def _call_model(calculation: dict[str, Any], model_name: str, api_key: str) -> dict[str, Any]:',
'''def _call_model(calculation: dict[str, Any], model_name: str, api_key: str, *, timeout_seconds: float = 24.0, thinking_level: str = "high") -> dict[str, Any]:''')
s=s.replace('+ json.dumps(calculation, ensure_ascii=False, separators=(",", ":"), default=str)',
              '+ json.dumps(_compact_calculation(calculation), ensure_ascii=False, separators=(",", ":"), default=str)')
s=s.replace('"thinkingConfig": {"thinkingLevel": AI_DEFAULT_THINKING_LEVEL},','"thinkingConfig": {"thinkingLevel": thinking_level},')
s=s.replace('with urllib.request.urlopen(request, timeout=75) as response:', 'with urllib.request.urlopen(request, timeout=timeout_seconds) as response:')
# include thinking level for UI/audit
s=s.replace('"interpreter_version": AI_INTERPRETER_VERSION,\n            "usage": {', '"interpreter_version": AI_INTERPRETER_VERSION,\n            "thinking_level": thinking_level,\n            "usage": {', 1)

# replace orchestrator with a Render-safe bounded primary then fallback
start=s.index('def interpret_integrated_fortune(')
new_orchestrator=r'''def interpret_integrated_fortune(calculation: dict[str, Any], preferred_model: str | None = None) -> dict[str, Any]:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return {"ok": False, "missing_key": True, "error": "Render 계산 서버에 GEMINI_API_KEY가 설정되지 않았어.", **ai_status()}

    model = preferred_model if preferred_model in AI_SUPPORTED_MODELS else AI_DEFAULT_MODEL
    # Render free workers were observed to recycle around a ~40s long outbound
    # generation. Keep each model call well below that boundary. The primary
    # retains high thinking; fallback uses medium thinking to guarantee a result.
    primary = _call_model(calculation, model, api_key, timeout_seconds=22.0, thinking_level="high")
    if primary.get("ok") or model == AI_FALLBACK_MODEL:
        return primary

    fallback = _call_model(calculation, AI_FALLBACK_MODEL, api_key, timeout_seconds=16.0, thinking_level="medium")
    if fallback.get("ok"):
        fallback["fallback_from"] = model
        fallback["fallback_reason"] = primary.get("error")
        return fallback
    primary["fallback_error"] = fallback.get("error")
    return primary
'''
s=s[:start]+new_orchestrator+'\n'
p.write_text(s,encoding='utf-8')
print('compacted Gemini payload and bounded Render calls')
