from pathlib import Path

# 1) Relationship engine: derive 365-day directional timing from the actual two-person transit pass.
rel_path = Path('relationship_western_v1.py')
rel = rel_path.read_text(encoding='utf-8')
rel = rel.replace('ENGINE_VERSION = "relationship-western-v1.2-depth-focus"', 'ENGINE_VERSION = "relationship-western-v1.3-dual-chart-timing"', 1)

anchor = '''def _side_trigger_score(hits):
    if not hits:
        return 0.0
    top = [float(x["score"]) for x in hits[:4]]
    return round(min(100.0, sum(top) / 2.35), 1)


'''
assert anchor in rel, 'relationship score anchor missing'
helpers = anchor + '''def _relationship_timing_band(score):
    if score >= 70:
        return "강함"
    if score >= 55:
        return "상승"
    if score >= 40:
        return "보통"
    if score >= 25:
        return "약함"
    return "매우 약함"


def _relationship_timing_stat(rows, key, label):
    points = [
        {"date": row["date"], "label": label, "score": float(row[key])}
        for row in rows if isinstance(row.get(key), (int, float))
    ]
    if not points:
        return None
    avg = sum(point["score"] for point in points) / len(points)

    def spaced(source, reverse, limit):
        ordered = sorted(source, key=lambda x: x["score"], reverse=reverse)
        selected = []
        for point in ordered:
            day = date.fromisoformat(point["date"])
            if any(abs((day - date.fromisoformat(existing["date"])).days) <= 1 for existing in selected):
                continue
            selected.append({**point, "score": round(point["score"], 1)})
            if len(selected) >= limit:
                break
        return selected

    return {
        "average": round(avg, 1),
        "band": _relationship_timing_band(avg),
        "spread": round(max(point["score"] for point in points) - min(point["score"] for point in points), 1),
        "best_days": spaced(points, True, 7),
        "caution_days": spaced(points, False, 5),
    }


def _relationship_directional_context(rows, start_date, end_date):
    incoming_label = "상대측 차트의 관계 트랜짓 활성도 · 실제 연락 의도/확률 아님"
    outgoing_label = "내 차트의 관계 트랜짓 활성도 · 실제 연락 결과 확률 아님"
    reconnection_label = "두 차트 동시 재접점 활성도 · 실제 재회 확률 아님"
    months = {}
    for row in rows:
        months.setdefault(row["date"][:7], []).append(row)
    monthly = []
    for month_key, month_rows in sorted(months.items()):
        monthly.append({
            "calendar_month": month_key,
            "start": month_rows[0]["date"],
            "end": month_rows[-1]["date"],
            "incoming": _relationship_timing_stat(month_rows, "counterpart_score", incoming_label),
            "outgoing": _relationship_timing_stat(month_rows, "user_score", outgoing_label),
            "reconnection": _relationship_timing_stat(month_rows, "score", reconnection_label),
        })
    return {
        "period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
        "incoming": _relationship_timing_stat(rows, "counterpart_score", incoming_label),
        "outgoing": _relationship_timing_stat(rows, "user_score", outgoing_label),
        "reconnection": _relationship_timing_stat(rows, "score", reconnection_label),
        "months": monthly,
        "source": "two-person relationship transit engine",
        "policy": "incoming/outgoing are directional chart-activation proxies. They do not reveal private intent and are not event probabilities.",
    }


'''
rel = rel.replace(anchor, helpers, 1)
old_return = '''    return {
        "available": True,
        "period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
        "policy": "daily transits to both natal charts; descriptive activation, not contact/reunion probability",
        "top_days": top_days,
        "top_months": top_months[:12],
    }
'''
new_return = '''    return {
        "available": True,
        "period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
        "policy": "daily transits to both natal charts; descriptive activation, not contact/reunion probability",
        "top_days": top_days,
        "top_months": top_months[:12],
        "directional_context": _relationship_directional_context(rows, start_date, end_date),
    }
'''
assert old_return in rel, 'relationship transit return anchor missing'
rel = rel.replace(old_return, new_return, 1)
rel_path.write_text(rel, encoding='utf-8')

# 2) Integrated engine: keep full 365-day scope, but skip irrelevant topic scoring per scan.
int_path = Path('integrated_fortune_v1.py')
s = int_path.read_text(encoding='utf-8')
s = s.replace('ENGINE_VERSION = "integrated-fortune-v2.3-interpersonal"', 'ENGINE_VERSION = "integrated-fortune-v2.4-full-year-efficient"', 1)
s = s.replace('WESTERN_ENGINE_VERSION = "western-period-engine-v6-interpersonal"', 'WESTERN_ENGINE_VERSION = "western-period-engine-v7-full-year-efficient"', 1)
old_scan = '''def _scan_intraday(day_value: date, start_time: dt_time, end_time: dt_time, step_minutes: int, natal_lons: dict, natal_houses: dict, offset_hours: float):
    points = _make_time_points(day_value, start_time, end_time, step_minutes, offset_hours)
'''
new_scan = '''def _scan_intraday(day_value: date, start_time: dt_time, end_time: dt_time, step_minutes: int, natal_lons: dict, natal_houses: dict, offset_hours: float, topic_names=None):
    points = _make_time_points(day_value, start_time, end_time, step_minutes, offset_hours)
'''
assert old_scan in s, 'integrated scan signature anchor missing'
s = s.replace(old_scan, new_scan, 1)
old_topics = '        topics = {topic: _score_topic(topic, records, snapshots, natal_houses) for topic in TOPIC_SPECS}\n'
new_topics = '        selected_topics = tuple(topic_names) if topic_names is not None else tuple(TOPIC_SPECS)\n        topics = {topic: _score_topic(topic, records, snapshots, natal_houses) for topic in selected_topics}\n'
assert old_topics in s, 'integrated topic loop anchor missing'
s = s.replace(old_topics, new_topics, 1)
old_life = '''    life = _scan_intraday(day_value, dt_time(8, 0), dt_time(22, 0), 120, natal_lons, natal_houses, offset_hours)
    market = _scan_intraday(day_value, dt_time(9, 0), dt_time(15, 30), 60, natal_lons, natal_houses, offset_hours) if _is_market_day(day_value) else []
'''
new_life = '''    life_topic_names = ("금전", "학업", "시험", "직장", "이직", "대인관계", "연애", "연락", "재회", "소식", "컨디션")
    life = _scan_intraday(day_value, dt_time(8, 0), dt_time(22, 0), 120, natal_lons, natal_houses, offset_hours, topic_names=life_topic_names)
    market = _scan_intraday(day_value, dt_time(9, 0), dt_time(15, 30), 60, natal_lons, natal_houses, offset_hours, topic_names=("금전", "투자심리")) if _is_market_day(day_value) else []
'''
assert old_life in s, 'integrated life/market scan anchor missing'
s = s.replace(old_life, new_life, 1)
# Fix a real omission: 대인관계 existed in TOPIC_ORDER/TOPIC_SPECS but was not copied into daily rows.
s = s.replace('["금전", "학업", "시험", "직장", "이직", "연애", "연락", "재회", "소식", "컨디션", "수신신호", "발신적합", "과거인연접점"]', '["금전", "학업", "시험", "직장", "이직", "대인관계", "연애", "연락", "재회", "소식", "컨디션", "수신신호", "발신적합", "과거인연접점"]', 1)
s = s.replace('["금전", "학업", "시험", "직장", "이직", "연애", "연락", "재회", "소식", "컨디션"]', '["금전", "학업", "시험", "직장", "이직", "대인관계", "연애", "연락", "재회", "소식", "컨디션"]')
int_path.write_text(s, encoding='utf-8')

# 3) Frontend: no automatic Gemini spend, robust annual jobs, and use two-person reunion timing when available.
app_path = Path('web/src/AppNext.tsx')
a = app_path.read_text(encoding='utf-8')
# Type support for direct two-person directional context.
needle = '      top_months: Array<{ calendar_month: string; score: number; top_dates: string[] }>\n'
assert needle in a, 'reunion transit type anchor missing'
a = a.replace(needle, needle + '      directional_context?: ReunionTimingContext\n', 1)
# Show 연락 as an actual integrated topic instead of hiding an engine output.
a = a.replace("const coreTopicOrder = ['금전','학업','시험','직장','이직','대인관계','연애','재회','소식','컨디션']", "const coreTopicOrder = ['금전','학업','시험','직장','이직','대인관계','연애','연락','재회','소식','컨디션']", 1)

# Client-side cost fallback for deployed interpreters that return token counts but not monetary fields.
helper_anchor = '''type AiInterpretationResponse = {
'''
helper_pos = a.index(helper_anchor)
# insert after the AiInterpretationResponse type block, immediately before AiInterpretationPanel
panel_marker = '\nfunction AiInterpretationPanel({ result, loading, error, onRetry }:'
panel_pos = a.index(panel_marker, helper_pos)
cost_helper = '''

const GEMINI_USD_KRW_ESTIMATE = 1384
function estimateGeminiUsage<T extends { prompt_tokens?: number; candidate_tokens?: number; thought_tokens?: number; total_tokens?: number; estimated_usd?: number; estimated_krw?: number }>(usage?: T) {
  if (!usage) return null
  const prompt = Number(usage.prompt_tokens ?? 0)
  const candidate = Number(usage.candidate_tokens ?? 0)
  const thought = Number(usage.thought_tokens ?? 0)
  const intro = new Date() <= new Date('2026-12-31T23:59:59Z')
  const calculatedUsd = (prompt / 1_000_000) * (intro ? .75 : 1.5) + ((candidate + thought) / 1_000_000) * (intro ? 3.75 : 7.5)
  const usd = Number.isFinite(Number(usage.estimated_usd)) ? Number(usage.estimated_usd) : calculatedUsd
  const krw = Number.isFinite(Number(usage.estimated_krw)) ? Number(usage.estimated_krw) : usd * GEMINI_USD_KRW_ESTIMATE
  return { ...usage, estimated_usd: usd, estimated_krw: krw }
}
'''
a = a[:panel_pos] + cost_helper + a[panel_pos:]
# Integrated panel uses fallback estimate.
a = a.replace('  const data = result.data\n  return <section className="ai-interpret-card">', '  const data = result.data\n  const usage = estimateGeminiUsage(result.usage)\n  return <section className="ai-interpret-card">', 1)
a = a.replace('result.usage?.total_tokens', 'usage?.total_tokens', 1)
a = a.replace('(result.usage.prompt_tokens ?? 0)', '(usage?.prompt_tokens ?? 0)', 1)
a = a.replace('(result.usage.candidate_tokens ?? 0)', '(usage?.candidate_tokens ?? 0)', 1)
a = a.replace('(result.usage.thought_tokens ?? 0)', '(usage?.thought_tokens ?? 0)', 1)
a = a.replace('result.usage.estimated_usd ?? 0', 'usage?.estimated_usd ?? 0', 1)
a = a.replace('result.usage.estimated_krw ?? 0', 'usage?.estimated_krw ?? 0', 1)
# Relationship panel cost fallback too.
rel_component = 'function RelationshipInterpretationPanel('
rel_pos = a.index(rel_component)
return_pos = a.index('  return <>', rel_pos)
a = a[:return_pos] + '  const usage = estimateGeminiUsage(ai?.usage)\n' + a[return_pos:]
a = a.replace('ai.usage?.total_tokens', 'usage?.total_tokens', 1)
a = a.replace('(ai.usage.prompt_tokens??0)', '(usage?.prompt_tokens??0)', 1)
a = a.replace('(ai.usage.candidate_tokens??0)', '(usage?.candidate_tokens??0)', 1)
a = a.replace('(ai.usage.thought_tokens??0)', '(usage?.thought_tokens??0)', 1)
a = a.replace('ai.usage.estimated_usd??0', 'usage?.estimated_usd??0', 1)
a = a.replace('ai.usage.estimated_krw??0', 'usage?.estimated_krw??0', 1)

# Replace integrated job flow: preserve 365 days, restart only once if Render loses an in-memory job.
start = a.index('  const runIntegrated = async () => {')
end = a.index('\n\n  const runReunionTiming = async', start)
new_integrated = r'''  const runIntegrated = async () => {
    setIntegratedError(''); setIntegratedResult(null); setIntegratedRequestSnapshot(null); setAiInterpretation(null); setAiError('')
    if (!birthProfile.birthDate || !birthProfile.birthTime) {
      setIntegratedError('먼저 내정보에서 생년월일과 출생시간을 저장해줘.'); return
    }
    const latitude = parseOptionalNumber(birthProfile.latitude)
    const longitude = parseOptionalNumber(birthProfile.longitude)
    if (latitude === null || longitude === null) {
      setIntegratedError('출생지역을 시·도 → 시·군·구 순서로 선택해줘. 정밀 계산에는 위치 좌표가 필요해.'); return
    }
    const body: Record<string, unknown> = {
      profile: {
        name: birthProfile.name || null,
        birth_date: birthProfile.birthDate,
        birth_time: birthProfile.birthTime,
        latitude,
        longitude,
        utc_offset_hours: Number(birthProfile.utcOffset || 9),
        gender: birthProfile.gender,
        place_key: birthProfile.placeKey,
      },
      start_date: integratedStartDate,
      end_date: integratedSelectionEnd,
    }
    const sleep = (ms: number) => new Promise((resolve)=>window.setTimeout(resolve, ms))
    setIntegratedLoading(true)
    try {
      let calculation: IntegratedApiResponse | null = null
      let lastMessage = ''
      for (let launch=0; launch<2 && !calculation; launch++) {
        let startResponse: Response
        try {
          startResponse = await fetch(`${API_BASE}/v1/fortune/integrated/start`, {
            method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body),
          })
        } catch (error) {
          lastMessage = error instanceof Error ? error.message : '통합운세 계산 서버 연결에 실패했어.'
          if (launch === 0) { await sleep(1200); continue }
          throw error
        }
        const started = await startResponse.json().catch(()=>({}))
        if (!startResponse.ok || !started?.job_id) {
          lastMessage = started?.detail || started?.error || '통합운세 계산 작업을 시작하지 못했어.'
          if (launch === 0 && startResponse.status >= 500) { await sleep(1200); continue }
          throw new Error(lastMessage)
        }
        let lostJob = false
        let transientFailures = 0
        for (let attempt=0; attempt<120; attempt++) {
          await sleep(attempt < 12 ? 1000 : 2000)
          let pollResponse: Response
          try {
            pollResponse = await fetch(`${API_BASE}/v1/fortune/integrated/jobs/${encodeURIComponent(started.job_id)}`)
          } catch (error) {
            transientFailures += 1
            lastMessage = error instanceof Error ? error.message : '통합운세 계산 상태 확인 중 연결이 끊겼어.'
            if (transientFailures <= 4) continue
            throw error
          }
          const job = await pollResponse.json().catch(()=>({}))
          if (pollResponse.status === 404) {
            lostJob = true
            lastMessage = job?.detail || '계산 작업이 서버 재시작으로 사라졌어.'
            break
          }
          if (!pollResponse.ok) {
            if ([502,503,504].includes(pollResponse.status) && transientFailures < 4) {
              transientFailures += 1
              continue
            }
            throw new Error(job?.detail || '통합운세 계산 상태를 확인하지 못했어.')
          }
          transientFailures = 0
          if (job.status === 'failed') throw new Error(job.error || '통합운세 계산 작업이 실패했어.')
          if (job.status === 'done') { calculation = job.result as IntegratedApiResponse; break }
        }
        if (!calculation && lostJob && launch === 0) { await sleep(900); continue }
      }
      if (!calculation) throw new Error(lastMessage || '정밀 계산 시간이 길어지고 있어. 다시 시도해줘.')
      setIntegratedResult(calculation)
      setIntegratedRequestSnapshot(body)
      // Gemini interpretation is intentionally NOT automatic. Calculation itself spends no Gemini credits.
    } catch (error) {
      setIntegratedError(error instanceof Error ? error.message : '통합운세 계산 중 오류가 발생했어.')
    } finally { setIntegratedLoading(false) }
  }'''
a = a[:start] + new_integrated + a[end:]

# Relationship flow: consume the two-person timing context returned by relationship engine; old single-person integrated path is fallback only.
start = a.index('  const runRelationship = async () => {')
end = a.index('\n\n\n  const runRelationshipAi = async () => {', start)
new_relationship = r'''  const runRelationship = async () => {
    setRelationshipError(''); setRelationshipResult(null); setRelationshipRequestSnapshot(null); setRelationshipAi(null); setRelationshipAiError(''); setReunionTiming(null); setReunionTimingError('')
    if (!birthProfile.birthDate || !birthProfile.birthTime) { setRelationshipError('먼저 내정보에서 본인 생년월일과 출생시간을 저장해줘.'); return }
    if (!counterpart.birthDate) { setRelationshipError('상대 생년월일은 반드시 필요해.'); return }
    if (counterpart.timeKnown && !counterpart.birthTime) { setRelationshipError('상대 출생시간을 모르면 “출생시간 모름”을 체크해줘.'); return }
    const body = {
      user: {
        name: birthProfile.name || '나', birth_date: birthProfile.birthDate, birth_time: birthProfile.birthTime, time_known: true,
        latitude: Number(birthProfile.latitude), longitude: Number(birthProfile.longitude), utc_offset_hours: Number(birthProfile.utcOffset || 9),
      },
      counterpart: {
        name: counterpart.name || '상대', birth_date: counterpart.birthDate, birth_time: counterpart.timeKnown ? counterpart.birthTime : null,
        time_known: counterpart.timeKnown, latitude: counterpart.timeKnown ? Number(counterpart.latitude) : null,
        longitude: counterpart.timeKnown ? Number(counterpart.longitude) : null, utc_offset_hours: Number(counterpart.utcOffset || 9),
      },
      start_date: relationshipStartDate,
      end_date: relationshipEndDate,
      relationship_status: selectedTool === 'marriage' ? (marriageMode === 'married' ? 'married' : 'dating') : (relationshipPurpose === 'reunion' ? 'single' : relationshipMode),
      analysis_mode: selectedTool === 'marriage' ? `marriage_${marriageMode}` : relationshipPurpose,
    }
    setRelationshipLoading(true)
    const shouldRunReunionTiming = selectedTool === 'compatibility' && relationshipPurpose === 'reunion'
    try {
      const response = await fetch(`${API_BASE}/v1/relationship/western`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
      const payload = await response.json()
      if (!response.ok) throw new Error(typeof payload?.detail === 'string' ? payload.detail : '관계 계산 요청에 실패했어.')
      const typed = payload as RelationshipApiResponse
      setRelationshipResult(typed)
      setRelationshipRequestSnapshot(body as Record<string, unknown>)
      if (shouldRunReunionTiming) {
        const direct = typed.result.reunion_transits?.directional_context
        if (direct) {
          setReunionTiming(direct)
          setReunionTimingError('')
          setReunionTimingLoading(false)
        } else {
          // Backward-compatible only: old backend can still use the previous integrated timing route.
          void runReunionTiming()
        }
      }
    } catch (error) {
      setRelationshipError(error instanceof Error ? error.message : '관계 계산 중 오류가 발생했어.')
    } finally { setRelationshipLoading(false) }
  }'''
a = a[:start] + new_relationship + a[end:]

# Explicit Gemini button wherever integrated result is rendered.
panel_call = '<AiInterpretationPanel result={aiInterpretation} loading={aiLoading} error={aiError} onRetry={()=>void runAiInterpretation()}/>'
assert panel_call in a, 'integrated AI panel call missing'
explicit = '''{!aiInterpretation&&!aiLoading&&!aiError&&<div className="relationship-ai-toolbar"><button type="button" onClick={()=>void runAiInterpretation()}><Sparkles size={17}/><span>Gemini(제미나이) 통합 정밀해설</span></button><small>원할 때만 AI 호출 · 계산 자체는 Gemini 크레딧 0원 · 완료 후 토큰/예상비용 표시</small></div>}
              ''' + panel_call
a = a.replace(panel_call, explicit)

# Make reunion wording precise: counterpart-side activation is not private intent.
a = a.replace("{ key: 'incoming', title: '상대 → 나 · 수신 신호', desc: '상대 쪽에서 연락·소식이 들어오는 흐름', stat: context.incoming },", "{ key: 'incoming', title: '상대측 → 관계 · 수신 참고신호', desc: '상대 차트 쪽 관계 트랜짓 활성도. 실제 연락 의도나 확률은 아님', stat: context.incoming },", 1)
a = a.replace("{ key: 'outgoing', title: '나 → 상대 · 발신 적합도', desc: '내가 먼저 연락했을 때 흐름이 받쳐주는 정도', stat: context.outgoing },", "{ key: 'outgoing', title: '나 → 상대 · 발신 참고신호', desc: '내 차트 쪽 관계 트랜짓 활성도. 실제 연락 결과 확률은 아님', stat: context.outgoing },", 1)
a = a.replace('수신과 발신을 섞지 않고 따로 봐.', '두 사람 차트의 방향별 활성도를 섞지 않고 따로 봐. 상대의 속마음이나 실제 행동 확률을 뜻하지 않아.', 1)
app_path.write_text(a, encoding='utf-8')

# 4) Relationship Gemini edge source: return usage tokens so UI can estimate cost.
edge_path = Path('supabase/functions/relationship-interpret-v9-preview/index.ts')
e = edge_path.read_text(encoding='utf-8')
usage_helper_anchor = 'function validate(o:any,p:Purpose)'
assert usage_helper_anchor in e, 'relationship edge validate anchor missing'
usage_helper = '''function usage(raw:any){const u=raw?.usageMetadata??{};return {prompt_tokens:Number(u.promptTokenCount??0),candidate_tokens:Number(u.candidatesTokenCount??0),thought_tokens:Number(u.thoughtsTokenCount??0),total_tokens:Number(u.totalTokenCount??0)};}\n'''
e = e.replace(usage_helper_anchor, usage_helper + usage_helper_anchor, 1)
e = e.replace('return {ok:true,data,model,interpreter_version:VERSION};', 'return {ok:true,data,model,interpreter_version:VERSION,usage:usage(raw)};', 1)
edge_path.write_text(e, encoding='utf-8')

# 5) Bump API version so production verification can prove new backend is live.
api_path = Path('api/main.py')
api = api_path.read_text(encoding='utf-8')
api = api.replace('APP_VERSION = "api-fortune-v4.8-final-review"', 'APP_VERSION = "api-fortune-v4.9-full-year-reunion-hardening"', 1)
api_path.write_text(api, encoding='utf-8')

print('patched full-year fortune, reunion timing, explicit Gemini spend, and usage reporting')
