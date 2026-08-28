from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing anchor: {label}')
    return text.replace(old, new, 1)

# ---------------- integrated calculation engine ----------------
p = ROOT / 'integrated_fortune_v1.py'
s = p.read_text(encoding='utf-8')
s = s.replace('ENGINE_VERSION = "integrated-fortune-v1"', 'ENGINE_VERSION = "integrated-fortune-v2"', 1)
s = replace_once(
    s,
    'TOPIC_ORDER = ["금전", "학업", "시험", "직장", "이직", "연애", "연락", "재회", "소식", "컨디션"]',
    'TOPIC_ORDER = ["금전", "투자심리", "수익실현", "신규진입", "투자주의", "학업", "시험", "직장", "이직", "연애", "연락", "재회", "소식", "컨디션"]\nINVESTMENT_KEYS = {"투자심리", "수익실현", "신규진입", "투자주의"}',
    'integrated topic order',
)
s = replace_once(
    s,
    '''def _derived_scores(topic_results: dict):\n    out = {k: _blend_topic(v) for k, v in topic_results.items() if k != "투자심리"}\n    out.update(_relationship_direction_scores(topic_results))\n    return out\n''',
    '''def _derived_scores(topic_results: dict):\n    # Keep the original life-topic scores and restore the investment derivatives\n    # that existed in the legacy Streamlit engine. They remain relative astrology\n    # indices, never price-direction or profit probabilities.\n    out = {k: _blend_topic(v) for k, v in topic_results.items()}\n    money = topic_results.get("금전") or {"activation": 0.0, "favorability": 50.0}\n    invest = topic_results.get("투자심리") or {"activation": 0.0, "favorability": 50.0}\n    overheat = max(0.0, float(invest.get("activation", 0.0)) - float(invest.get("favorability", 50.0)))\n    realize = _clamp(.40 * float(money.get("activation", 0.0)) + .40 * float(money.get("favorability", 50.0)) + .20 * (100.0 - .70 * overheat))\n    entry = _clamp(.25 * float(money.get("activation", 0.0)) + .35 * float(money.get("favorability", 50.0)) + .15 * float(invest.get("activation", 0.0)) + .25 * float(invest.get("favorability", 50.0)) - .25 * overheat)\n    risk = _clamp(.55 * float(invest.get("activation", 0.0)) + .45 * (100.0 - float(invest.get("favorability", 50.0))) + .15 * overheat)\n    out.update({\n        "수익실현": int(round(realize)),\n        "신규진입": int(round(entry)),\n        "투자주의": int(round(risk)),\n    })\n    out.update(_relationship_direction_scores(topic_results))\n    return out\n\n\ndef _is_market_day(day_value: date) -> bool:\n    # The API intentionally avoids making price claims. This is only a display\n    # gate for investment indices. Weekends are always closed; exchange holidays\n    # fall back to weekday display when a calendar dependency is unavailable.\n    try:\n        import pandas as pd\n        import exchange_calendars as xcals\n        cal = xcals.get_calendar("XKRX")\n        return bool(cal.is_session(pd.Timestamp(day_value.isoformat())))\n    except Exception:\n        return day_value.weekday() < 5\n\n\ndef _rolling_window(rows: list[dict], key: str, size: int = 3):\n    usable = [row for row in rows if isinstance(row.get(key), (int, float)) and row.get("dt") is not None]\n    if not usable:\n        return None, None\n    size = max(1, min(size, len(usable)))\n    windows = []\n    for i in range(0, len(usable) - size + 1):\n        chunk = usable[i:i+size]\n        avg = sum(float(r[key]) for r in chunk) / len(chunk)\n        windows.append((avg, chunk[0]["dt"], chunk[-1]["dt"]))\n    best = max(windows, key=lambda x: x[0])\n    worst = min(windows, key=lambda x: x[0])\n    def pack(item):\n        avg, start_dt, end_dt = item\n        return {\n            "start": start_dt.strftime("%H:%M"),\n            "end": end_dt.strftime("%H:%M"),\n            "score": round(avg, 1),\n        }\n    return pack(best), pack(worst)\n\n\ndef _daily_detail(day_value: date, natal_lons: dict, natal_houses: dict, offset_hours: float):\n    rows = _scan_intraday(day_value, dt_time(7, 30), dt_time(23, 0), 30, natal_lons, natal_houses, offset_hours)\n    details = {}\n    keys = ["금전", "학업", "시험", "직장", "이직", "연애", "연락", "재회", "소식", "컨디션"]\n    if _is_market_day(day_value):\n        keys += ["투자심리", "수익실현", "신규진입", "투자주의"]\n    for key in keys:\n        best, worst = _rolling_window(rows, key, 3)\n        if not best:\n            continue\n        evidence = []\n        if key in TOPIC_SPECS:\n            scored = [r for r in rows if isinstance(r.get(key), (int, float))]\n            if scored:\n                peak = max(scored, key=lambda r: float(r.get(key, 0)))\n                topic_raw = (peak.get("topics") or {}).get(key) or {}\n                raw_evidence = topic_raw.get("evidence") or []\n                evidence = [str(x) for x in raw_evidence[:6]]\n        elif key in {"수익실현", "신규진입", "투자주의"}:\n            scored = [r for r in rows if isinstance(r.get(key), (int, float))]\n            if scored:\n                peak = max(scored, key=lambda r: float(r.get(key, 0)))\n                for base_key in ("금전", "투자심리"):\n                    raw = ((peak.get("topics") or {}).get(base_key) or {}).get("evidence") or []\n                    evidence.extend(str(x) for x in raw[:3])\n        details[key] = {"best_window": best, "caution_window": worst, "evidence": evidence[:6]}\n    return {"date": day_value.isoformat(), "market_open": _is_market_day(day_value), "topics": details}\n''',
    'derived investment scores',
)

old_overall = '''    overall = {key: _period_stats(rows, key) for key in TOPIC_ORDER}\n    relationship_signals = {\n        key: _period_stats(rows, key) for key in ["수신신호", "발신적합", "과거인연접점"]\n    }\n'''
new_overall = '''    market_rows = [r for r in rows if _is_market_day(date.fromisoformat(r["date"]))]\n    overall = {\n        key: _period_stats(market_rows if key in INVESTMENT_KEYS else rows, key)\n        for key in TOPIC_ORDER\n    }\n    relationship_signals = {\n        key: _period_stats(rows, key) for key in ["수신신호", "발신적합", "과거인연접점"]\n    }\n    market_info = {\n        "has_open_session": bool(market_rows),\n        "session_count": len(market_rows),\n        "session_dates": [r["date"] for r in market_rows],\n    }\n    # Rich intraday evidence is intentionally limited to short ranges to keep\n    # annual/monthly payloads and Gemini prompts bounded.\n    detail_days = []\n    if day_count <= 7:\n        for i in range(day_count):\n            detail_days.append(_daily_detail(start_date + timedelta(days=i), natal_lons, natal_houses, float(utc_offset_hours)))\n'''
s = replace_once(s, old_overall, new_overall, 'overall period stats')

old_month = '''        seg_rows = [r for r in rows if seg_start.isoformat() <= r["date"] <= seg_end.isoformat()]\n        months.append({\n            "calendar_month": f"{seg_start.year}-{seg_start.month:02d}",\n            "start": seg_start.isoformat(),\n            "end": seg_end.isoformat(),\n            "topics": {key: _period_stats(seg_rows, key) for key in TOPIC_ORDER},\n'''
new_month = '''        seg_rows = [r for r in rows if seg_start.isoformat() <= r["date"] <= seg_end.isoformat()]\n        seg_market_rows = [r for r in seg_rows if _is_market_day(date.fromisoformat(r["date"]))]\n        months.append({\n            "calendar_month": f"{seg_start.year}-{seg_start.month:02d}",\n            "start": seg_start.isoformat(),\n            "end": seg_end.isoformat(),\n            "topics": {key: _period_stats(seg_market_rows if key in INVESTMENT_KEYS else seg_rows, key) for key in TOPIC_ORDER},\n'''
s = replace_once(s, old_month, new_month, 'monthly market stats')
s = replace_once(
    s,
    '        "relationship_signals": relationship_signals,\n        "months": months,',
    '        "relationship_signals": relationship_signals,\n        "market": market_info,\n        "detail_days": detail_days,\n        "months": months,',
    'western market/detail output',
)
p.write_text(s, encoding='utf-8')

# ---------------- Gemini interpretation ----------------
p = ROOT / 'ai_interpret_v1.py'
s = p.read_text(encoding='utf-8')
s = s.replace('AI_INTERPRETER_VERSION = "mobile-ai-v1"', 'AI_INTERPRETER_VERSION = "mobile-ai-v2"', 1)
s = replace_once(
    s,
    'TOPIC_ORDER = ["금전", "학업", "시험", "직장", "이직", "연애", "연락", "재회", "소식", "컨디션"]',
    'TOPIC_ORDER = ["금전", "투자심리", "수익실현", "신규진입", "투자주의", "학업", "시험", "직장", "이직", "연애", "연락", "재회", "소식", "컨디션"]\nGEMINI_INTRO_END = (2026, 12, 31)\nGEMINI_INTRO_INPUT_PER_M = 0.75\nGEMINI_INTRO_OUTPUT_PER_M = 3.75\nGEMINI_STANDARD_INPUT_PER_M = 1.50\nGEMINI_STANDARD_OUTPUT_PER_M = 7.50\nGEMINI_USD_KRW_DISPLAY_ESTIMATE = 1384.0',
    'ai topic order and pricing',
)
s = replace_once(
    s,
    '            "money_news": _clean_text(clusters.get("money_news"), 1700),\n            "condition": _clean_text(clusters.get("condition"), 1400),',
    '            "money_news": _clean_text(clusters.get("money_news"), 1700),\n            "investment": _clean_text(clusters.get("investment"), 1900),\n            "condition": _clean_text(clusters.get("condition"), 1400),',
    'ai investment cluster validation',
)
s = replace_once(
    s,
    '''한국어 반말로 자연스럽고 구체적으로 쓴다. 숫자를 그대로 나열하는 대신 서로 관련된 축의 상대 강약과 기간 흐름을 설명한다.\n희망고문과 공포 조장을 피한다. 출력은 JSON만 반환한다."""''',
    '''한국어 반말로 자연스럽고 구체적으로 쓴다. 숫자를 그대로 나열하는 대신 서로 관련된 축의 상대 강약과 기간 흐름을 설명한다.\n특히 detail_days가 있으면 best_window/caution_window와 evidence를 적극 사용해 '왜'와 '언제'를 설명한다. 근거가 있는 시간창은 구체적으로 쓰되 없는 시간은 만들지 않는다.\n각 분야를 서로 다른 문장으로 해석하고, 단순히 점수와 band를 재진술하는 답변은 금지한다. 직장과 이직, 학업과 시험, 연락과 소식은 반드시 구분한다.\n투자심리·수익실현·신규진입·투자주의는 market.has_open_session이 있을 때만 다루며, 가격방향·수익률 예측이 아니라 매매 판단/과열/실현 타이밍의 상대 점성 지수라고 명시한다.\n희망고문과 공포 조장을 피한다. 출력은 JSON만 반환한다."""''',
    'richer system prompt',
)
s = replace_once(
    s,
    '        "money_news": "금전·소식 교차 해석",\n        "condition": "컨디션·일정 배치 해석",',
    '        "money_news": "금전·소식 교차 해석",\n        "investment": "투자심리·수익실현·신규진입·투자주의를 거래일 기준으로 구분 해석",\n        "condition": "컨디션·일정 배치 해석",',
    'ai output investment cluster',
)
s = replace_once(
    s,
    '        "아래 통합 계산 결과를 종합 해석해. 10개 생활 분야를 모두 가능한 범위에서 채워. "',
    '        "아래 통합 계산 결과를 종합 해석해. 생활·관계·학업·진로·금전·투자 분야를 빠짐없이 채워. "',
    'ai prompt topic count',
)
old_usage = '''        usage = raw.get("usageMetadata", {}) if isinstance(raw, dict) else {}\n        return {\n            "ok": True,\n            "data": validated,\n            "model": model_name,\n            "interpreter_version": AI_INTERPRETER_VERSION,\n            "usage": {\n                "prompt_tokens": int(usage.get("promptTokenCount", 0) or 0),\n                "candidate_tokens": int(usage.get("candidatesTokenCount", 0) or 0),\n                "thought_tokens": int(usage.get("thoughtsTokenCount", 0) or 0),\n                "total_tokens": int(usage.get("totalTokenCount", 0) or 0),\n            },\n        }\n'''
new_usage = '''        usage = raw.get("usageMetadata", {}) if isinstance(raw, dict) else {}\n        prompt_tokens = int(usage.get("promptTokenCount", 0) or 0)\n        candidate_tokens = int(usage.get("candidatesTokenCount", 0) or 0)\n        thought_tokens = int(usage.get("thoughtsTokenCount", 0) or 0)\n        total_tokens = int(usage.get("totalTokenCount", 0) or 0)\n        billable_output_tokens = candidate_tokens + thought_tokens\n        from datetime import datetime, timezone\n        today = datetime.now(timezone.utc).date()\n        intro = (today.year, today.month, today.day) <= GEMINI_INTRO_END\n        input_per_m = GEMINI_INTRO_INPUT_PER_M if intro else GEMINI_STANDARD_INPUT_PER_M\n        output_per_m = GEMINI_INTRO_OUTPUT_PER_M if intro else GEMINI_STANDARD_OUTPUT_PER_M\n        estimated_usd = (prompt_tokens / 1_000_000) * input_per_m + (billable_output_tokens / 1_000_000) * output_per_m\n        estimated_krw = estimated_usd * GEMINI_USD_KRW_DISPLAY_ESTIMATE\n        return {\n            "ok": True,\n            "data": validated,\n            "model": model_name,\n            "interpreter_version": AI_INTERPRETER_VERSION,\n            "usage": {\n                "prompt_tokens": prompt_tokens,\n                "candidate_tokens": candidate_tokens,\n                "thought_tokens": thought_tokens,\n                "billable_output_tokens": billable_output_tokens,\n                "total_tokens": total_tokens,\n                "estimated_usd": round(estimated_usd, 6),\n                "estimated_krw": round(estimated_krw, 1),\n                "price_phase": "intro_2026" if intro else "standard",\n            },\n        }\n'''
s = replace_once(s, old_usage, new_usage, 'ai token cost usage')
p.write_text(s, encoding='utf-8')

# ---------------- API version ----------------
p = ROOT / 'api/main.py'
s = p.read_text(encoding='utf-8')
s = s.replace('APP_VERSION = "api-fortune-v3"', 'APP_VERSION = "api-fortune-v4"', 1)
p.write_text(s, encoding='utf-8')

# ---------------- mobile UI ----------------
p = ROOT / 'web/src/AppNext.tsx'
s = p.read_text(encoding='utf-8')
s = replace_once(
    s,
    '    relationship_signals: Record<string, FortuneStat | null>\n    months: FortuneMonth[]',
    '    relationship_signals: Record<string, FortuneStat | null>\n    market?: { has_open_session: boolean; session_count: number; session_dates: string[] }\n    detail_days?: Array<{ date: string; market_open: boolean; topics: Record<string, { best_window?: { start: string; end: string; score: number }; caution_window?: { start: string; end: string; score: number }; evidence?: string[] }> }>\n    months: FortuneMonth[]',
    'frontend western market detail type',
)
s = replace_once(
    s,
    '  usage?: { prompt_tokens?: number; candidate_tokens?: number; thought_tokens?: number; total_tokens?: number }',
    '  usage?: { prompt_tokens?: number; candidate_tokens?: number; thought_tokens?: number; billable_output_tokens?: number; total_tokens?: number; estimated_usd?: number; estimated_krw?: number; price_phase?: string }',
    'frontend usage type',
)
s = replace_once(
    s,
    '    clusters: { relationship: string; work_study: string; money_news: string; condition: string }',
    '    clusters: { relationship: string; work_study: string; money_news: string; investment?: string; condition: string }',
    'frontend AI cluster type',
)
s = replace_once(
    s,
    "const topicOrder = ['금전','학업','시험','직장','이직','연애','연락','재회','소식','컨디션']",
    "const topicOrder = ['금전','투자심리','수익실현','신규진입','투자주의','학업','시험','직장','이직','연애','연락','재회','소식','컨디션']\nconst relationshipSignalOrder = ['수신신호','발신적합','과거인연접점']",
    'frontend topic order',
)
# Add token/cost panel and investment cluster.
s = replace_once(
    s,
    '''    <div className="ai-interpret-head"><span className="ai-orb"><Sparkles size={19}/></span><div><span className="eyebrow">GEMINI INTERPRETATION</span><h3>{data.headline || '통합 계산 해설'}</h3><small>{result.model || 'Gemini'} · 계산 후 해설층</small></div></div>\n    <p className="ai-summary">{data.overall.summary}</p>''',
    '''    <div className="ai-interpret-head"><span className="ai-orb"><Sparkles size={19}/></span><div><span className="eyebrow">GEMINI INTERPRETATION</span><h3>{data.headline || '통합 계산 해설'}</h3><small>{result.model || 'Gemini'} · 계산 후 해설층</small></div></div>\n    {result.usage?.total_tokens ? <div className="ai-usage-card"><strong>이번 해설 API 사용량</strong><span>입력 {(result.usage.prompt_tokens ?? 0).toLocaleString()} · 본문출력 {(result.usage.candidate_tokens ?? 0).toLocaleString()} · 사고 {(result.usage.thought_tokens ?? 0).toLocaleString()} tokens</span><b>예상비용 ${Number(result.usage.estimated_usd ?? 0).toFixed(4)} ≈ {Math.round(result.usage.estimated_krw ?? 0).toLocaleString()}원</b><small>최초 생성 예상치 · 저장된 기록 재열람은 Gemini 재호출이 없으면 0원</small></div> : null}\n    <p className="ai-summary">{data.overall.summary}</p>''',
    'AI usage panel',
)
s = replace_once(
    s,
    '''      {data.clusters.money_news && <div><strong>금전 · 소식</strong><p>{data.clusters.money_news}</p></div>}\n      {data.clusters.condition && <div><strong>컨디션</strong><p>{data.clusters.condition}</p></div>}''',
    '''      {data.clusters.money_news && <div><strong>금전 · 소식</strong><p>{data.clusters.money_news}</p></div>}\n      {data.clusters.investment && <div><strong>주식 · 투자</strong><p>{data.clusters.investment}</p></div>}\n      {data.clusters.condition && <div><strong>컨디션</strong><p>{data.clusters.condition}</p></div>}''',
    'AI investment cluster UI',
)
s = s.replace('<details className="ai-details"><summary>분야별 정밀 해석 보기</summary>', '<details className="ai-details" open><summary>분야별 정밀 해석</summary>', 1)

# Preserve fixed-order full topic list in addition to score-ranked highlights.
anchor = '''  const topIntegratedTopics = integratedResult\n    ? topicOrder\n        .map((topic) => ({ topic, stat: integratedResult.western.overall[topic] }))\n        .filter((row): row is { topic: string; stat: FortuneStat } => Boolean(row.stat))\n        .sort((a,b) => b.stat.average - a.stat.average)\n    : []\n'''
replacement = '''  const orderedIntegratedTopics = integratedResult\n    ? topicOrder\n        .map((topic) => ({ topic, stat: integratedResult.western.overall[topic] }))\n        .filter((row): row is { topic: string; stat: FortuneStat } => Boolean(row.stat))\n    : []\n  const topIntegratedTopics = [...orderedIntegratedTopics].sort((a,b) => b.stat.average - a.stat.average)\n  const orderedRelationshipSignals = integratedResult\n    ? relationshipSignalOrder\n        .map((topic) => ({ topic, stat: integratedResult.western.relationship_signals[topic] }))\n        .filter((row): row is { topic: string; stat: FortuneStat } => Boolean(row.stat))\n    : []\n'''
s = replace_once(s, anchor, replacement, 'ordered topic definitions')

s = s.replace('{topIntegratedTopics.slice(0,3).map(({topic,stat})=>', '{orderedIntegratedTopics.map(({topic,stat})=>', 1)
s = s.replace('{topIntegratedTopics.slice(0,6).map(({topic,stat})=>', '{orderedIntegratedTopics.map(({topic,stat})=>', 1)

# Insert relationship direction + investment sections after the home core card.
home_core_tail = '''                {cautionIntegratedTopics.length>0 && <div className="best-window"><span>상대적 주의 흐름</span><strong>{cautionIntegratedTopics.map((row)=>`${row.topic} ${row.stat.average.toFixed(1)}`).join(' · ')}</strong></div>}\n              </section>\n'''
home_core_new = '''                {cautionIntegratedTopics.length>0 && <div className="best-window"><span>상대적 주의 흐름</span><strong>{cautionIntegratedTopics.map((row)=>`${row.topic} ${row.stat.average.toFixed(1)}`).join(' · ')}</strong></div>}\n              </section>\n\n              {orderedRelationshipSignals.length > 0 && <section className="result-card"><div className="result-card-title"><span>CONTACT SIGNALS</span><strong>연락 방향 보조지표</strong></div><div className="integrated-topic-grid signal-grid">{orderedRelationshipSignals.map(({topic,stat})=><div className="integrated-topic signal-topic" key={`signal-${topic}`}><span>{topic === '수신신호' ? '수신 보조신호' : topic === '발신적합' ? '발신 적합도' : '과거인연 접점'}</span><strong>{stat.average.toFixed(1)}</strong><small>{stat.band}</small></div>)}</div><p className="result-note">사건 확률이나 특정 상대의 행동 예측이 아니라 연락축 내부의 상대 활성도야.</p></section>}\n\n              {integratedResult.western.market?.has_open_session && <section className="result-card market-flow-card"><div className="result-card-title"><span>MARKET FLOW</span><strong>주식 · 투자 흐름</strong></div><div className="integrated-topic-grid">{['수익실현','신규진입','투자주의'].map((topic)=>{const stat=integratedResult.western.overall[topic]; if(!stat) return null; return <div className="integrated-topic market-topic" key={`market-${topic}`}><span>{topic}</span><strong>{stat.average.toFixed(1)}</strong><small>{stat.band}</small></div>})}</div><p className="result-note">거래일만 집계한 점성술 상대지수야. 실제 가격·수급·거래량·손절 기준이 우선이야.</p></section>}\n'''
s = replace_once(s, home_core_tail, home_core_new, 'home core extras')

# Add intraday detail for daily/weekly short ranges before systems summary.
marker = '''              <section className="result-card">\n                <div className="result-card-title"><span>SYSTEMS</span><strong>사주 · Thai 요약</strong></div>'''
detail_section = '''              {integratedResult.western.detail_days?.length ? <section className="result-card"><div className="result-card-title"><span>TIME FLOW</span><strong>시간 흐름 · 계산 근거</strong></div><div className="time-detail-list">{integratedResult.western.detail_days.map((day)=><details key={`day-${day.date}`} open={integratedResult.period.day_count===1}><summary>{day.date}{day.market_open ? ' · KRX 거래일' : ''}</summary><div className="time-topic-list">{Object.entries(day.topics).map(([topic,detail])=><div className="time-topic" key={`${day.date}-${topic}`}><strong>{topic}</strong>{detail.best_window && <span>↑ 상대적으로 좋은 구간 {detail.best_window.start}~{detail.best_window.end} · {detail.best_window.score}</span>}{detail.caution_window && <span>↓ 주의 구간 {detail.caution_window.start}~{detail.caution_window.end} · {detail.caution_window.score}</span>}{detail.evidence?.length ? <small>{detail.evidence.slice(0,2).join(' · ')}</small> : null}</div>)}</div></details>)}</div></section> : null}\n\n              <section className="result-card">\n                <div className="result-card-title"><span>SYSTEMS</span><strong>사주 · Thai 요약</strong></div>'''
s = replace_once(s, marker, detail_section, 'intraday detail UI')
p.write_text(s, encoding='utf-8')

# ---------------- CSS readability ----------------
p = ROOT / 'web/src/ai-interpret.css'
s = p.read_text(encoding='utf-8')
# Append overrides instead of rewriting the theme.
s += '''\n\n/* v2 readability restoration · iPhone */\n.ai-interpret-card { padding: 20px; gap: 17px; }\n.ai-interpret-head h3 { font-size: 1.22rem; line-height: 1.38; }\n.ai-interpret-head small { font-size: .72rem; }\n.ai-summary { font-size: .94rem; line-height: 1.82; color:#514858; }\n.ai-highlight strong, .ai-priorities > strong, .ai-system-note > strong { font-size: .82rem; }\n.ai-highlight span { font-size: .86rem; line-height: 1.72; }\n.ai-cluster-grid strong { font-size: .82rem; }\n.ai-cluster-grid p { font-size: .84rem; line-height: 1.68; }\n.ai-priorities p, .ai-system-note p { font-size: .84rem; line-height: 1.68; }\n.ai-details summary { font-size: .88rem; padding: 5px 0; }\n.ai-topic-title strong { font-size: .94rem; }\n.ai-topic-title span { font-size: .68rem; }\n.ai-topic-list p { font-size: .84rem; line-height: 1.7; }\n.ai-limits { font-size: .74rem; line-height: 1.62; }\n.ai-usage-card { display:grid; gap:5px; padding:12px 14px; border-radius:16px; background:linear-gradient(135deg,rgba(239,232,250,.9),rgba(229,247,244,.88)); border:1px solid rgba(170,178,204,.28); }\n.ai-usage-card strong { font-size:.82rem; color:#51445d; }\n.ai-usage-card span, .ai-usage-card small { font-size:.73rem; line-height:1.5; color:#786d80; }\n.ai-usage-card b { font-size:.84rem; color:#6a5676; }\n.ai-settings-card strong, .ai-api-state strong { font-size:.86rem; }\n.ai-settings-card small, .ai-api-state small { font-size:.72rem; }\n.ai-settings-card select { font-size:.78rem; height:44px; }\n'''
p.write_text(s, encoding='utf-8')

p = ROOT / 'web/src/integrated.css'
s = p.read_text(encoding='utf-8')
s += '''\n\n/* v2 full-flow readability */\n.integrated-topic { padding: 13px 10px; gap: 5px; }\n.integrated-topic span { font-size: .76rem; }\n.integrated-topic strong { font-size: 1.22rem; }\n.integrated-topic small { font-size: .69rem; }\n.best-window span { font-size: .72rem; }\n.best-window strong { font-size: .84rem; line-height: 1.55; }\n.result-note { font-size: .76rem !important; line-height:1.58 !important; }\n.time-detail-list { display:grid; gap:10px; }\n.time-detail-list details { border:1px solid rgba(176,181,205,.25); border-radius:15px; padding:11px 12px; background:rgba(255,255,255,.68); }\n.time-detail-list summary { font-weight:850; color:#55485f; font-size:.84rem; }\n.time-topic-list { display:grid; gap:8px; margin-top:10px; }\n.time-topic { display:grid; gap:4px; padding:9px 10px; border-radius:12px; background:rgba(247,244,251,.72); }\n.time-topic strong { font-size:.8rem; color:#55445f; }\n.time-topic span { font-size:.74rem; line-height:1.5; color:#716578; }\n.time-topic small { font-size:.68rem; line-height:1.48; color:#8b7e91; }\n.market-flow-card { background:linear-gradient(145deg,rgba(255,252,244,.95),rgba(238,247,244,.92)); }\n.market-topic:nth-child(1) { background:linear-gradient(145deg,#fff5e8,#f5e4fb); }\n.market-topic:nth-child(2) { background:linear-gradient(145deg,#edf7ff,#eaf8f3); }\n.market-topic:nth-child(3) { background:linear-gradient(145deg,#fff1f1,#f7edf8); }\n.signal-topic { background:linear-gradient(145deg,#f5efff,#eef8fb); }\n@media (max-width:420px) { .integrated-topic-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }\n'''
p.write_text(s, encoding='utf-8')

print('restore_mobile_fortune_depth_v1: patched')
