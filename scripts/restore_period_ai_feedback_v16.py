from pathlib import Path
import re

APP = Path('web/src/AppNext.tsx')
ARCHIVE = Path('web/src/lib/archive.ts')
app = APP.read_text(encoding='utf-8')
archive = ARCHIVE.read_text(encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'[{label}] expected 1 match, got {count}')
    return text.replace(old, new, 1)

# ---------------------------------------------------------------------------
# AppNext imports + durable browser cache.
# ---------------------------------------------------------------------------
app = replace_once(
    app,
    "import { ensureSupabaseSession, supabase } from './lib/supabase'\n",
    "import { ensureSupabaseSession, supabase } from './lib/supabase'\nimport { fortuneAiCacheId, fortuneCalculationCacheId, readReadingCache, relationshipAiCacheId, writeReadingCache } from './lib/readingCache'\n",
    'reading cache import',
)

# ---------------------------------------------------------------------------
# Period AI summary/detail UI + actual-outcome record helpers.
# ---------------------------------------------------------------------------
insert_marker = "function relationshipLimitKo(text: string) {"
if insert_marker not in app:
    raise SystemExit('relationshipLimitKo marker missing')
period_helpers = r'''
type OutcomeEvent = '' | 'none' | 'received' | 'sent' | 'both'
type OutcomeTimeBucket = '' | 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night'
type OutcomeChannel = '' | 'message' | 'dm' | 'call' | 'in_person' | 'other'
type DailyOutcomeRecord = {
  date: string
  event: OutcomeEvent
  past_connection: boolean
  event_time_bucket: OutcomeTimeBucket
  channel: OutcomeChannel
  note: string
  saved_at: string
  scores: Record<string, number | null>
}

const OUTCOME_STORAGE_KEY = 'starlight-destiny.relationship-outcomes.v2'

function emptyOutcome(dateValue: string): DailyOutcomeRecord {
  return { date: dateValue, event: '', past_connection: false, event_time_bucket: '', channel: '', note: '', saved_at: '', scores: {} }
}

function readDailyOutcomes(): DailyOutcomeRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(OUTCOME_STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((row)=>row && typeof row.date === 'string') : []
  } catch { return [] }
}

function readDailyOutcome(dateValue: string): DailyOutcomeRecord | null {
  return readDailyOutcomes().find((row)=>row.date === dateValue) ?? null
}

function writeDailyOutcome(record: DailyOutcomeRecord) {
  const current = readDailyOutcomes()
  const next = [record, ...current.filter((row)=>row.date !== record.date)]
    .sort((a,b)=>b.date.localeCompare(a.date))
    .slice(0, 500)
  window.localStorage.setItem(OUTCOME_STORAGE_KEY, JSON.stringify(next))
}

function summarizeDailyOutcomes(records: DailyOutcomeRecord[]) {
  const usable = records.filter((row)=>row.event)
  const contact = usable.filter((row)=>row.event === 'received' || row.event === 'both')
  const none = usable.filter((row)=>row.event === 'none')
  const mean = (rows: DailyOutcomeRecord[], key: string) => {
    const values = rows.map((row)=>row.scores[key]).filter((value): value is number=>typeof value === 'number' && Number.isFinite(value))
    return values.length ? values.reduce((sum,value)=>sum+value,0)/values.length : null
  }
  return {
    n: usable.length,
    contactN: contact.length,
    noneN: none.length,
    incomingContact: mean(contact,'수신신호'),
    incomingNone: mean(none,'수신신호'),
    reconnectionContact: mean(contact,'재접점'),
    reconnectionNone: mean(none,'재접점'),
  }
}

function PeriodAiInterpretationPanel({ result, loading, error, cacheSource, onRetry }: {
  result: AiInterpretationResponse | null
  loading: boolean
  error: string
  cacheSource: 'local' | 'server' | 'fresh' | ''
  onRetry: () => void
}) {
  if (loading && !result) return <section className="period-ai-card is-loading"><LoaderCircle className="spin" size={21}/><div><span className="period-ai-kicker">GEMINI PERIOD READING</span><h3>자연어 해설을 불러오는 중…</h3><p className="period-ai-summary">저장본이 있으면 바로 읽고, 없을 때만 Gemini를 한 번 호출해.</p></div></section>
  if (error && !result) return <section className="period-ai-card"><span className="period-ai-kicker">GEMINI PERIOD READING</span><h3>자연어 해설을 아직 불러오지 못했어</h3><p className="period-ai-summary">{error}</p><button className="period-ai-retry" type="button" onClick={onRetry}>해설 다시 확인</button></section>
  if (!result?.ok || !result.data) return null
  const data = result.data
  const usage = estimateGeminiUsage(result.usage)
  const cached = cacheSource === 'local' || cacheSource === 'server'
  return <section className="period-ai-card">
    <span className="period-ai-kicker">GEMINI PERIOD SUMMARY</span>
    <h3>{data.headline || '기간 흐름 요약'}</h3>
    <p className="period-ai-summary">{data.overall.summary}</p>
    <div className="period-ai-chips">
      {data.overall.best_phase && <span className="period-ai-chip">좋은 흐름 · {data.overall.best_phase}</span>}
      {data.overall.caution_phase && <span className="period-ai-chip">주의 흐름 · {data.overall.caution_phase}</span>}
    </div>
    <div className="period-ai-cache-note"><CheckCircle2 size={14}/><span>{cached ? '저장된 해설 즉시 조회 · 이번 Gemini API 재호출 0회' : '최초 해설 자동 저장 완료 · 같은 계산값 재조회는 Gemini API 0회'}</span></div>
    {usage?.total_tokens ? <div className="period-ai-cost"><span>최초 생성 · 입력 {(usage.prompt_tokens??0).toLocaleString()} / 출력 {(usage.candidate_tokens??0).toLocaleString()} / 사고 {(usage.thought_tokens??0).toLocaleString()} tokens</span><b>${Number(usage.estimated_usd??0).toFixed(4)} ≈ {Math.round(usage.estimated_krw??0).toLocaleString()}원</b><small>저장본 재조회 비용 0원</small></div> : null}
    <details className="period-ai-details">
      <summary>상세 해설 보기</summary>
      <div className="period-ai-detail-body">
        {data.overall.dominant_pattern && <div className="period-ai-section"><strong>기간을 관통하는 패턴</strong><p>{data.overall.dominant_pattern}</p></div>}
        <div className="period-ai-section"><strong>분야별 종합</strong><p>{[data.clusters.relationship&&`관계 · ${data.clusters.relationship}`,data.clusters.work_study&&`일·학업 · ${data.clusters.work_study}`,data.clusters.money_news&&`돈·소식 · ${data.clusters.money_news}`,data.clusters.investment&&`투자 · ${data.clusters.investment}`,data.clusters.condition&&`컨디션 · ${data.clusters.condition}`].filter(Boolean).join('\n\n')}</p></div>
        {!!data.priorities?.length && <div className="period-ai-section"><strong>우선순위</strong><p>{data.priorities.map((item,index)=>`${index+1}. ${item}`).join('\n')}</p></div>}
        <div className="period-ai-topic-list">{Object.entries(data.topic_analysis ?? {}).map(([topic,item])=><article className="period-ai-topic" key={topic}><strong>{topic}</strong><b>{item.verdict}</b>{item.reason&&<p>근거 · {item.reason}</p>}{item.timing&&<p>시기 · {item.timing}</p>}{item.action&&<p>활용 · {item.action}</p>}{item.avoid&&<p>피할 것 · {item.avoid}</p>}<p>확신도 · {item.confidence}{item.confidence_reason?` · ${item.confidence_reason}`:''}</p></article>)}</div>
        <div className="period-ai-section"><strong>체계별 교차해석</strong><p>{[data.systems?.western&&`서양점성술 · ${data.systems.western}`,data.systems?.saju&&`사주 · ${data.systems.saju}`,data.systems?.thai&&`태국점성술 · ${data.systems.thai}`].filter(Boolean).join('\n\n')}</p></div>
        {data.limits && <div className="period-ai-section"><strong>해설 한계</strong><p>{data.limits}</p></div>}
      </div>
    </details>
  </section>
}

'''
app = app.replace(insert_marker, period_helpers + insert_marker, 1)

# Relationship button must disappear once an interpretation is already loaded.
old_toolbar = "    <div className=\"relationship-ai-toolbar\"><button type=\"button\" onClick={onAi} disabled={aiLoading}><Sparkles size={17}/><span>{aiLoading?'Gemini(제미나이) 관계 해석 중…':'Gemini(제미나이) 관계 정밀해석'}</span></button><small>원할 때만 AI 호출 · 완료 후 토큰/예상비용 표시</small></div>"
new_toolbar = "    {!ai?.ok&&<div className=\"relationship-ai-toolbar\"><button type=\"button\" onClick={onAi} disabled={aiLoading}><Sparkles size={17}/><span>{aiLoading?'Gemini(제미나이) 관계 해석 중…':'Gemini(제미나이) 관계 정밀해석'}</span></button><small>최초 1회 생성 후 자동 저장 · 같은 계산값은 저장본 즉시 조회</small></div>}"
app = replace_once(app, old_toolbar, new_toolbar, 'relationship ai button hide after cache')

# ---------------------------------------------------------------------------
# State for cache source, duplicate-start guard and outcome form.
# ---------------------------------------------------------------------------
state_marker = "  const [aiModel, setAiModel] = useState(loadAiModel)\n"
state_add = """  const [aiModel, setAiModel] = useState(loadAiModel)\n  const [aiCacheSource, setAiCacheSource] = useState<'local'|'server'|'fresh'|''>('')\n  const [relationshipAiCacheSource, setRelationshipAiCacheSource] = useState<'local'|'fresh'|''>('')\n  const aiRequestRef = useRef('')\n  const [outcomeDraft, setOutcomeDraft] = useState<DailyOutcomeRecord>(()=>emptyOutcome(queryDate))\n  const [outcomeSaved, setOutcomeSaved] = useState(false)\n  const [outcomeNonce, setOutcomeNonce] = useState(0)\n"""
app = replace_once(app, state_marker, state_add, 'cache/outcome states')

# Load previously stored personal outcome when date changes.
use_effect_marker = "  useEffect(() => {\n    if (mainView === 'settings') void refreshPushState()\n  }, [mainView])\n"
use_effect_add = use_effect_marker + """\n  useEffect(() => {\n    const existing = readDailyOutcome(queryDate)\n    setOutcomeDraft(existing ?? emptyOutcome(queryDate))\n    setOutcomeSaved(false)\n  }, [queryDate])\n"""
app = replace_once(app, use_effect_marker, use_effect_add, 'outcome date restore effect')

# ---------------------------------------------------------------------------
# Fortune AI job polling: persist successful AI locally and in period archive.
# ---------------------------------------------------------------------------
app = replace_once(
    app,
    "  const pollAiInterpretationJob = async (jobId: string, periodStart?: string, periodEndValue?: string) => {",
    "  const pollAiInterpretationJob = async (jobId: string, periodStart?: string, periodEndValue?: string, cacheId?: string, ttlDays = 90, requestForArchive?: Record<string, unknown>) => {",
    'poll signature',
)

old_payload_tail = """          if (!payload.data) throw new Error('완료된 AI 해설 결과가 비어 있어.')
          const currentStart = integratedCalendarYear ? `${integratedCalendarYear}-01-01` : queryDate
          const currentEnd = integratedCalendarYear ? `${integratedCalendarYear}-12-31` : periodEnd(queryDate, period)
          if (!periodStart || (currentStart === periodStart && currentEnd === periodEndValue)) {
            setAiInterpretation(annotatePayload(payload))
          }
          window.localStorage.removeItem(AI_JOB_STORAGE_KEY)
          setAiConfigured(true)
          return
"""
new_payload_tail = """          if (!payload.data) throw new Error('완료된 AI 해설 결과가 비어 있어.')
          const annotated = annotatePayload(payload)
          if (cacheId) await writeReadingCache(cacheId, 'fortune-ai', annotated, ttlDays)
          const currentStart = integratedStartDate
          const currentEnd = integratedSelectionEnd
          if (!periodStart || (currentStart === periodStart && currentEnd === periodEndValue)) {
            setAiInterpretation(annotated)
            setAiCacheSource(data?.reused ? 'server' : 'fresh')
          }
          if (requestForArchive && selectedTool === null && periodStart && periodEndValue) {
            const calc = integratedResult
            if (calc && calc.period.start === periodStart && calc.period.end === periodEndValue) {
              const archiveRequest = {...requestForArchive, archive_mode:'period_fortune_v16'}
              void saveArchive({kind:'daily',periodKey:period,title:`${period==='today'?'오늘':period==='week'?'주간':period==='month'?'월간':'연간'}운세 · ${periodStart}`,periodStart,periodEnd:periodEndValue,engine:calc.engine,request:archiveRequest,result:calc as unknown as Record<string,unknown>,interpretation:annotated as unknown as Record<string,unknown>},`period:${fortuneCalculationCacheId(requestForArchive)}`)
            }
          }
          window.localStorage.removeItem(AI_JOB_STORAGE_KEY)
          setAiConfigured(true)
          aiRequestRef.current = cacheId || ''
          return
"""
app = replace_once(app, old_payload_tail, new_payload_tail, 'poll done cache')

# Resume persisted AI jobs with their cache/archive metadata.
old_resume_type = "      const saved = JSON.parse(raw) as { jobId?: string; periodStart?: string; periodEnd?: string }\n      if (saved.jobId) void pollAiInterpretationJob(saved.jobId, saved.periodStart, saved.periodEnd)"
new_resume_type = "      const saved = JSON.parse(raw) as { jobId?: string; periodStart?: string; periodEnd?: string; cacheId?: string; ttlDays?: number; request?: Record<string,unknown> }\n      if (saved.jobId) void pollAiInterpretationJob(saved.jobId, saved.periodStart, saved.periodEnd, saved.cacheId, saved.ttlDays ?? 90, saved.request)"
app = replace_once(app, old_resume_type, new_resume_type, 'resume cache metadata')

# AI request first checks IndexedDB; only a miss reaches Supabase/Gemini.
app = replace_once(
    app,
    "  const runAiInterpretation = async (calculation: IntegratedApiResponse | null = integratedResult) => {\n    if (!calculation) return\n    setAiLoading(true); setAiError(''); setAiInterpretation(null)\n    try {",
    """  const runAiInterpretation = async (calculation: IntegratedApiResponse | null = integratedResult, requestOverride: Record<string,unknown> | null = integratedRequestSnapshot) => {
    if (!calculation) return
    const requestForCache = requestOverride ?? { start_date: calculation.period.start, end_date: calculation.period.end }
    const cacheId = fortuneAiCacheId(requestForCache, calculation as unknown as Record<string,unknown>, aiModel)
    const ttlDays = selectedTool === 'integrated' || period === 'year' ? 370 : period === 'today' ? 90 : 30
    if (aiRequestRef.current === cacheId && (aiLoading || aiInterpretation?.ok)) return
    aiRequestRef.current = cacheId
    setAiLoading(true); setAiError('')
    try {
      const cached = await readReadingCache<AiInterpretationResponse>(cacheId)
      if (cached?.ok && cached.data) {
        const annotated = annotatePayload(cached)
        setAiInterpretation(annotated)
        setAiCacheSource('local')
        setAiLoading(false)
        if (selectedTool === null) {
          const archiveRequest = {...requestForCache, archive_mode:'period_fortune_v16'}
          void saveArchive({kind:'daily',periodKey:period,title:`${period==='today'?'오늘':period==='week'?'주간':period==='month'?'월간':'연간'}운세 · ${calculation.period.start}`,periodStart:calculation.period.start,periodEnd:calculation.period.end,engine:calculation.engine,request:archiveRequest,result:calculation as unknown as Record<string,unknown>,interpretation:annotated as unknown as Record<string,unknown>},`period:${fortuneCalculationCacheId(requestForCache)}`)
        }
        return
      }
      setAiInterpretation(null)
      setAiCacheSource('')""",
    'run AI local-first',
)

old_pending = "      const pending = { jobId: String(data.job_id), periodStart: calculation.period.start, periodEnd: calculation.period.end }\n      window.localStorage.setItem(AI_JOB_STORAGE_KEY, JSON.stringify(pending))\n      setAiConfigured(true)\n      void pollAiInterpretationJob(pending.jobId, pending.periodStart, pending.periodEnd)"
new_pending = "      const pending = { jobId: String(data.job_id), periodStart: calculation.period.start, periodEnd: calculation.period.end, cacheId, ttlDays, request: requestForCache }\n      window.localStorage.setItem(AI_JOB_STORAGE_KEY, JSON.stringify(pending))\n      setAiConfigured(true)\n      void pollAiInterpretationJob(pending.jobId, pending.periodStart, pending.periodEnd, pending.cacheId, pending.ttlDays, pending.request)"
app = replace_once(app, old_pending, new_pending, 'pending cache metadata')

old_ai_catch = "      window.localStorage.removeItem(AI_JOB_STORAGE_KEY)\n      setAiLoading(false)\n      const message = error instanceof Error ? error.message : 'AI 해설 요청에 실패했어.'"
new_ai_catch = "      window.localStorage.removeItem(AI_JOB_STORAGE_KEY)\n      setAiLoading(false)\n      aiRequestRef.current = ''\n      const message = error instanceof Error ? error.message : 'AI 해설 요청에 실패했어.'"
app = replace_once(app, old_ai_catch, new_ai_catch, 'AI retry guard reset')

# ---------------------------------------------------------------------------
# Automatically restore the exact calculation when a previously viewed period
# is selected. This avoids recomputation and immediately unlocks local AI cache.
# ---------------------------------------------------------------------------
run_integrated_marker = "\n  const runIntegrated = async () => {"
if run_integrated_marker not in app:
    raise SystemExit('runIntegrated marker missing')
auto_restore = r'''

  useEffect(() => {
    if (mainView !== 'home' || integratedLoading || !birthProfile.birthDate || !birthProfile.birthTime) return
    if (!(selectedTool === null || selectedTool === 'integrated' || selectedTool === 'precision')) return
    const latitude = parseOptionalNumber(birthProfile.latitude)
    const longitude = parseOptionalNumber(birthProfile.longitude)
    if (latitude === null || longitude === null) return
    const body: Record<string,unknown> = {
      profile: { name: birthProfile.name || '나', birth_date: birthProfile.birthDate, birth_time: birthProfile.birthTime, latitude, longitude, utc_offset_hours: Number(birthProfile.utcOffset || 9), gender: birthProfile.gender, place_key: birthProfile.placeKey },
      start_date: integratedStartDate,
      end_date: integratedSelectionEnd,
    }
    const cacheId = fortuneCalculationCacheId(body)
    let cancelled = false
    void (async()=>{
      const cached = await readReadingCache<{request:Record<string,unknown>;result:IntegratedApiResponse}>(cacheId)
      if (cancelled || !cached?.result) return
      if (cached.result.period.start !== integratedStartDate || cached.result.period.end !== integratedSelectionEnd) return
      setIntegratedResult(cached.result)
      setIntegratedRequestSnapshot(cached.request)
      setIntegratedError('')
      setIntegratedProgress(null)
      if (selectedTool === null) void runAiInterpretation(cached.result, cached.request)
    })()
    return ()=>{cancelled=true}
  }, [mainView, selectedTool, period, queryDate, annualFortuneYear, birthProfile.birthDate, birthProfile.birthTime, birthProfile.latitude, birthProfile.longitude, birthProfile.utcOffset, birthProfile.gender, birthProfile.placeKey, aiModel])
'''
app = app.replace(run_integrated_marker, auto_restore + run_integrated_marker, 1)

# Calculation request cache: short-circuit exact repeats and save first result.
body_end = """      start_date: integratedStartDate,
      end_date: integratedSelectionEnd,
    }
    const sleep = (ms: number) => new Promise((resolve)=>window.setTimeout(resolve, ms))
"""
body_end_new = """      start_date: integratedStartDate,
      end_date: integratedSelectionEnd,
    }
    const calculationCacheId = fortuneCalculationCacheId(body as unknown as Record<string,unknown>)
    const cachedCalculation = await readReadingCache<{request:Record<string,unknown>;result:IntegratedApiResponse}>(calculationCacheId)
    if (cachedCalculation?.result && cachedCalculation.result.period.start === integratedStartDate && cachedCalculation.result.period.end === integratedSelectionEnd) {
      setIntegratedResult(cachedCalculation.result)
      setIntegratedRequestSnapshot(cachedCalculation.request)
      if (selectedTool === null) void runAiInterpretation(cachedCalculation.result, cachedCalculation.request)
      return
    }
    const sleep = (ms: number) => new Promise((resolve)=>window.setTimeout(resolve, ms))
"""
app = replace_once(app, body_end, body_end_new, 'calculation cache read')

old_calc_done = """      setIntegratedResult(calculation)
      setIntegratedRequestSnapshot(body)
      // Gemini interpretation is intentionally NOT automatic. Calculation itself spends no Gemini credits.
"""
new_calc_done = """      setIntegratedResult(calculation)
      setIntegratedRequestSnapshot(body)
      const calcTtlDays = selectedTool === 'integrated' || period === 'year' ? 370 : period === 'today' ? 90 : 30
      await writeReadingCache(calculationCacheId, 'fortune-calculation', {request:body as unknown as Record<string,unknown>, result:calculation}, calcTtlDays)
      if (selectedTool === null) {
        const archiveRequest = {...body, archive_mode:'period_fortune_v16'} as unknown as Record<string,unknown>
        void saveArchive({kind:'daily',periodKey:period,title:`${period==='today'?'오늘':period==='week'?'주간':period==='month'?'월간':'연간'}운세 · ${calculation.period.start}`,periodStart:calculation.period.start,periodEnd:calculation.period.end,engine:calculation.engine,request:archiveRequest,result:calculation as unknown as Record<string,unknown>},`period:${calculationCacheId}`)
        void runAiInterpretation(calculation, body as unknown as Record<string,unknown>)
      }
      // Period fortunes auto-interpret once and cache. Integrated/precision keep explicit AI controls.
"""
app = replace_once(app, old_calc_done, new_calc_done, 'calculation cache write + period AI auto')

# ---------------------------------------------------------------------------
# Relationship AI local cache. Once seen, the button disappears and cache loads
# automatically for the identical relationship calculation.
# ---------------------------------------------------------------------------
rel_start = """    const analysisMode = (snapshotMode || currentMode) as RelationshipAnalysisMode
    if (analysisMode === 'reunion' && !reunionTiming) { setRelationshipAiError('재회 시기 계산이 먼저 완료되어야 해.'); return }
    setRelationshipAiLoading(true); setRelationshipAiError('')
    try {
"""
rel_start_new = """    const analysisMode = (snapshotMode || currentMode) as RelationshipAnalysisMode
    if (analysisMode === 'reunion' && !reunionTiming) { setRelationshipAiError('재회 시기 계산이 먼저 완료되어야 해.'); return }
    const relationshipCacheId = relationshipAiCacheId(relationshipResult as unknown as Record<string,unknown>, analysisMode, aiModel, reunionTiming)
    setRelationshipAiLoading(true); setRelationshipAiError('')
    try {
      const cached = await readReadingCache<RelationshipAiResponse>(relationshipCacheId)
      if (cached?.ok && cached.data) {
        if (revision !== relationshipRevisionRef.current) return
        setRelationshipAi(annotatePayload(cached))
        setRelationshipAiCacheSource('local')
        return
      }
"""
app = replace_once(app, rel_start, rel_start_new, 'relationship local cache read')

rel_success = """      if (!payload?.ok || !payload.data) throw new Error(payload?.error || '관계 AI 해설 응답이 비어 있어.')
      if (revision !== relationshipRevisionRef.current) return
      setRelationshipAi(annotatePayload(payload))
"""
rel_success_new = """      if (!payload?.ok || !payload.data) throw new Error(payload?.error || '관계 AI 해설 응답이 비어 있어.')
      if (revision !== relationshipRevisionRef.current) return
      const annotated = annotatePayload(payload)
      await writeReadingCache(relationshipCacheId, 'relationship-ai', annotated, 370)
      setRelationshipAi(annotated)
      setRelationshipAiCacheSource('fresh')
"""
app = replace_once(app, rel_success, rel_success_new, 'relationship local cache write')

# Reset cache source whenever relationship inputs invalidate.
app = app.replace("    setRelationshipAi(null)\n    setRelationshipAiError('')", "    setRelationshipAi(null)\n    setRelationshipAiCacheSource('')\n    setRelationshipAiError('')", 1)

# ---------------------------------------------------------------------------
# Outcome handler + calibration summary.
# ---------------------------------------------------------------------------
remove_archive_marker = "  async function removeArchive(item: ArchiveItem) {"
if remove_archive_marker not in app:
    raise SystemExit('removeArchive marker missing')
outcome_handler = r'''
  const outcomeCalibration = useMemo(() => {
    void outcomeNonce
    return summarizeDailyOutcomes(readDailyOutcomes())
  }, [outcomeNonce])

  async function saveDailyOutcome() {
    if (!integratedResult || period !== 'today' || !outcomeDraft.event) {
      setActionNotice('실제 연락 결과를 먼저 선택해줘.')
      window.setTimeout(()=>setActionNotice(''),1800)
      return
    }
    const signals = integratedResult.western.relationship_signals ?? {}
    const overall = integratedResult.western.overall ?? {}
    const record: DailyOutcomeRecord = {
      ...outcomeDraft,
      date: queryDate,
      note: outcomeDraft.note.trim().slice(0,200),
      saved_at: new Date().toISOString(),
      scores: {
        '수신신호': signals['수신신호']?.average ?? null,
        '발신적합': signals['발신적합']?.average ?? null,
        '재접점': signals['과거인연재접점']?.average ?? null,
        '연락': overall['연락']?.average ?? null,
        '재회': overall['재회']?.average ?? null,
        '연애': overall['연애']?.average ?? null,
        '소식': overall['소식']?.average ?? null,
      },
    }
    writeDailyOutcome(record)
    setOutcomeDraft(record)
    setOutcomeSaved(true)
    setOutcomeNonce((value)=>value+1)
    void saveArchive({kind:'outcome',periodKey:'today',title:`실제 결과 · ${queryDate}`,periodStart:queryDate,periodEnd:queryDate,engine:'relationship-outcome-v2',request:{date:queryDate,archive_mode:'personal_outcome_v16'},result:record as unknown as Record<string,unknown>},`outcome:${queryDate}`)
    window.setTimeout(()=>setOutcomeSaved(false),2200)
  }

'''
app = app.replace(remove_archive_marker, outcome_handler + remove_archive_marker, 1)

# ---------------------------------------------------------------------------
# Period result: restore automatic natural-language summary + detail UI and
# daily personal outcome form.
# ---------------------------------------------------------------------------
period_headline = """              <div className=\"result-headline\"><CheckCircle2 size={20}/><div><strong>{period==='today'?'오늘':periods.find((item)=>item.key===period)?.label}운세 계산 완료</strong><span>{integratedResult.engine} · {integratedResult.period.day_count}일 분석</span></div></div>

              <section className=\"result-card\">
"""
period_headline_new = """              <div className=\"result-headline\"><CheckCircle2 size={20}/><div><strong>{period==='today'?'오늘':periods.find((item)=>item.key===period)?.label}운세 계산 완료</strong><span>{integratedResult.engine} · {integratedResult.period.day_count}일 분석</span></div></div>
              <PeriodAiInterpretationPanel result={aiInterpretation} loading={aiLoading} error={aiError} cacheSource={aiCacheSource} onRetry={()=>void runAiInterpretation(integratedResult, integratedRequestSnapshot)}/>

              <section className=\"result-card\">
"""
app = replace_once(app, period_headline, period_headline_new, 'period AI panel render')

systems_end = """              <section className=\"result-card\">
                <div className=\"result-card-title\"><span>SYSTEMS</span><strong>체계별 보조 흐름</strong></div>
                <div className=\"saju-summary\">
                  {integratedResult.saju.ok && integratedResult.saju.day_master && <span>사주 일간 <b>{integratedResult.saju.day_master}</b></span>}
                  {activeDayun && <span>현재 대운 <b>{activeDayun.ganzhi}</b> · {activeDayun.start_year}~{activeDayun.end_year}</span>}
                  <span>Thai(태국점성술) <b>{integratedResult.thai.thai_day}</b> · {integratedResult.thai.ruler}</span>
                </div>
              </section>
"""
outcome_ui = systems_end + r'''

              {period==='today' && <details className="result-card outcome-card">
                <summary>실제 결과 기록 · 개인보정</summary>
                <div className="outcome-form">
                  <p className="outcome-note">연락이 온 날뿐 아니라 연락이 없던 날도 같이 기록해야 비교가 덜 치우쳐. 현재 점수를 즉시 바꾸는 용도가 아니라, 네 기록이 쌓일수록 수신·재접점 지표가 실제 경험과 얼마나 맞는지 개인별로 검증하는 데이터야.</p>
                  <div className="outcome-grid">
                    <label><span>이 날 실제 연락 결과</span><select value={outcomeDraft.event} onChange={(e)=>setOutcomeDraft({...outcomeDraft,event:e.target.value as OutcomeEvent})}><option value="">기록 안 함</option><option value="none">연락 없음</option><option value="received">연락 받음</option><option value="sent">내가 먼저 보냄</option><option value="both">서로 주고받음</option></select></label>
                    <label><span>연락 시각대</span><select value={outcomeDraft.event_time_bucket} onChange={(e)=>setOutcomeDraft({...outcomeDraft,event_time_bucket:e.target.value as OutcomeTimeBucket})}><option value="">시간 기록 안 함</option><option value="dawn">새벽 00~06</option><option value="morning">오전 06~12</option><option value="afternoon">오후 12~18</option><option value="evening">저녁 18~22</option><option value="night">밤 22~24</option></select></label>
                    <label><span>연락 경로</span><select value={outcomeDraft.channel} onChange={(e)=>setOutcomeDraft({...outcomeDraft,channel:e.target.value as OutcomeChannel})}><option value="">경로 기록 안 함</option><option value="message">문자·메신저</option><option value="dm">DM·SNS</option><option value="call">전화</option><option value="in_person">직접 만남</option><option value="other">기타</option></select></label>
                    <label><span>짧은 메모</span><input type="text" maxLength={200} value={outcomeDraft.note} onChange={(e)=>setOutcomeDraft({...outcomeDraft,note:e.target.value})} placeholder="예: 저녁에 먼저 전화 옴"/></label>
                    <label className="outcome-check"><input type="checkbox" checked={outcomeDraft.past_connection} onChange={(e)=>setOutcomeDraft({...outcomeDraft,past_connection:e.target.checked})}/><span>과거 인연 관련 연락</span></label>
                  </div>
                  <button className="outcome-save" type="button" onClick={()=>void saveDailyOutcome()}>실제 결과 저장</button>
                  {outcomeSaved && <div className="outcome-saved">저장 완료 · 이후 개인보정 비교에 포함할게.</div>}
                  <p className="outcome-note">개인보정 기록 {outcomeCalibration.n}일{outcomeCalibration.n<5?` · 비교 시작까지 ${5-outcomeCalibration.n}일 더 필요`:outcomeCalibration.contactN&&outcomeCalibration.noneN?` · 연락 받은 날 수신 평균 ${outcomeCalibration.incomingContact?.toFixed(1)??'—'} / 연락 없는 날 ${outcomeCalibration.incomingNone?.toFixed(1)??'—'} · 재접점 ${outcomeCalibration.reconnectionContact?.toFixed(1)??'—'} / ${outcomeCalibration.reconnectionNone?.toFixed(1)??'—'}`:' · 연락 있음/없음 양쪽 표본이 더 필요'}</p>
                </div>
              </details>}
'''
app = replace_once(app, systems_end, outcome_ui, 'outcome UI')

# ---------------------------------------------------------------------------
# Archive: current period readings should reopen as live period results, not as
# legacy JSON; interpretations should reopen without Gemini.
# ---------------------------------------------------------------------------
legacy_restore = """    if (item.kind === 'daily' || item.kind === 'outcome') {
      setLegacyArchiveOpen(item)
      setMainView('history')
      return
    }
"""
legacy_restore_new = """    const currentPeriodArchive = item.kind === 'daily' && item.request.archive_mode === 'period_fortune_v16'
    if ((item.kind === 'daily' && !currentPeriodArchive) || item.kind === 'outcome') {
      setLegacyArchiveOpen(item)
      setMainView('history')
      return
    }
    if (currentPeriodArchive) {
      setLegacyArchiveOpen(null)
      setQueryDate(item.periodStart)
      setPeriod(item.periodKey)
      setIntegratedCalendarYear(null)
      setSelectedTool(null)
      setIntegratedResult(item.result as unknown as IntegratedApiResponse)
      setIntegratedRequestSnapshot(item.request)
      setAiInterpretation(item.interpretation as unknown as AiInterpretationResponse || null)
      setAiCacheSource(item.interpretation ? 'local' : '')
      setMainView('home')
      return
    }
"""
app = replace_once(app, legacy_restore, legacy_restore_new, 'period archive restore')

# Existing integrated / relationship manual archive stores AI result too.
app = app.replace("      result: integratedResult as unknown as Record<string, unknown>,\n    })", "      result: integratedResult as unknown as Record<string, unknown>,\n      interpretation: aiInterpretation as unknown as Record<string,unknown> | undefined,\n    })", 1)
app = app.replace("      result: relationshipResult as unknown as Record<string, unknown>,\n    })", "      result: relationshipResult as unknown as Record<string, unknown>,\n      interpretation: relationshipAi as unknown as Record<string,unknown> | undefined,\n    })", 1)

# Restore AI interpretations from manual archives when present.
app = app.replace("      setIntegratedResult(item.result as unknown as IntegratedApiResponse)\n      setIntegratedRequestSnapshot(item.request)\n      setSelectedTool(item.kind)", "      setIntegratedResult(item.result as unknown as IntegratedApiResponse)\n      setIntegratedRequestSnapshot(item.request)\n      setAiInterpretation(item.interpretation as unknown as AiInterpretationResponse || null)\n      setAiCacheSource(item.interpretation ? 'local' : '')\n      setSelectedTool(item.kind)", 1)
app = app.replace("      setRelationshipAi(null)\n      setRelationshipAiError('')", "      setRelationshipAi(item.interpretation as unknown as RelationshipAiResponse || null)\n      setRelationshipAiCacheSource(item.interpretation ? 'local' : '')\n      setRelationshipAiError('')", 1)

# Current-period archive copy should use the normal calculated result format.
old_copy_legacy = """    if (item.kind === 'daily' || item.kind === 'outcome') {
      await handleCopy('이전 기록 전체복사', JSON.stringify(item.result, null, 2))
      return
    }
"""
new_copy_legacy = """    if (item.kind === 'daily' && item.request.archive_mode === 'period_fortune_v16') {
      await handleCopy('기간운세 전체복사', integratedResultText(item.result as unknown as IntegratedApiResponse))
      return
    }
    if (item.kind === 'daily' || item.kind === 'outcome') {
      await handleCopy('이전 기록 전체복사', JSON.stringify(item.result, null, 2))
      return
    }
"""
app = replace_once(app, old_copy_legacy, new_copy_legacy, 'period archive copy')

# History labels distinguish restored current period readings from legacy daily.
old_kind_label = "item.kind==='compatibility'?'궁합운':item.kind==='daily'?'이전 일일운세':'결과 기록'"
new_kind_label = "item.kind==='compatibility'?'궁합운':item.kind==='daily'?(item.request.archive_mode==='period_fortune_v16'?(item.periodKey==='today'?'오늘운세':item.periodKey==='week'?'주간운세':item.periodKey==='month'?'월간운세':'연간운세'):'이전 일일운세'):'결과 기록'"
if old_kind_label not in app:
    raise SystemExit('history kind label marker missing')
app = app.replace(old_kind_label, new_kind_label, 1)

# ---------------------------------------------------------------------------
# archive.ts: interpretation_json support + stable-ID upsert for auto-saved
# period/outcome records. Existing callers remain backward-compatible.
# ---------------------------------------------------------------------------
archive = replace_once(
    archive,
    "  result: Record<string, unknown>\n  createdAt: string",
    "  result: Record<string, unknown>\n  interpretation?: Record<string, unknown>\n  createdAt: string",
    'archive interpretation type',
)

archive = replace_once(
    archive,
    "    result: item.result,\n  }",
    "    result: item.result,\n    interpretation: item.interpretation ?? null,\n  }",
    'archive calculation json interpretation',
)

upload_pattern = re.compile(r"async function uploadLocalItem\(item: ArchiveItem, userId: string\): Promise<ArchiveItem> \{.*?\n\}\n\nexport async function saveArchive", re.S)
new_upload = r'''async function uploadLocalItem(item: ArchiveItem, userId: string): Promise<ArchiveItem> {
  const isFortune = item.kind === 'integrated' || item.kind === 'precision' || item.kind === 'daily' || item.kind === 'outcome'
  const table = isFortune ? 'readings' : 'relationship_readings'
  let cloudId = item.cloudId
  let cloudCreatedAt: string | undefined

  if (!cloudId) {
    const existing = await supabase
      .from(table)
      .select('id, created_at')
      .eq('user_id', userId)
      .contains('calculation_json', { archive_v: 1, local_id: item.id })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!existing.error && existing.data?.id) {
      cloudId = String(existing.data.id)
      cloudCreatedAt = String(existing.data.created_at ?? item.createdAt)
    }
  }

  const common = {
    period_start: item.periodStart,
    period_end: item.periodEnd,
    engine_version: item.engine,
    calculation_json: calculationJson(item),
    interpretation_json: { archive_v: 1, ai: item.interpretation ?? null },
    summary: item.title,
  }
  const payload = isFortune
    ? { user_id: userId, profile_id: null, reading_type: item.kind, ...common }
    : { user_id: userId, profile_id: null, counterpart_id: null, reading_type: item.kind, relationship_status: String(item.request.relationship_status ?? ''), ...common }

  const response = cloudId
    ? await supabase.from(table).update(payload).eq('id', cloudId).eq('user_id', userId).select('id, created_at').single()
    : await supabase.from(table).insert(payload).select('id, created_at').single()
  if (response.error) throw response.error
  if (!response.data?.id) throw new Error('Supabase 저장 결과가 비어 있어.')

  const synced: ArchiveItem = {
    ...item,
    cloudId: String(response.data.id),
    createdAt: String(response.data.created_at ?? cloudCreatedAt ?? item.createdAt),
    syncState: 'cloud',
  }
  upsertLocal(synced)
  return synced
}

export async function saveArchive'''
archive, count = upload_pattern.subn(new_upload, archive, count=1)
if count != 1:
    raise SystemExit(f'uploadLocalItem replacement count={count}')

save_pattern = re.compile(r"export async function saveArchive\(input: Omit<ArchiveItem, 'id' \| 'createdAt' \| 'syncState'>\): Promise<ArchiveSaveResult> \{.*?\n\}\n\nfunction cloudRowToItem", re.S)
new_save = r'''export async function saveArchive(input: Omit<ArchiveItem, 'id' | 'createdAt' | 'syncState'>, stableId?: string): Promise<ArchiveSaveResult> {
  const previous = stableId ? loadLocal().find((row)=>row.id === stableId) : undefined
  let item: ArchiveItem = {
    ...input,
    id: stableId ?? newId(),
    cloudId: previous?.cloudId,
    createdAt: previous?.createdAt ?? new Date().toISOString(),
    syncState: previous?.syncState ?? 'local',
  }
  upsertLocal(item)

  const auth = await ensureArchiveUser()
  if (!auth.userId) return { item, cloudSynced: false, cloudError: auth.error || undefined }

  try {
    item = await uploadLocalItem(item, auth.userId)
    return { item, cloudSynced: true }
  } catch (error) {
    return { item, cloudSynced: false, cloudError: error instanceof Error ? error.message : 'Supabase 동기화에 실패했어.' }
  }
}

function cloudRowToItem'''
archive, count = save_pattern.subn(new_save, archive, count=1)
if count != 1:
    raise SystemExit(f'saveArchive replacement count={count}')

archive = replace_once(
    archive,
    "  const result = calculation.result && typeof calculation.result === 'object'\n    ? calculation.result as Record<string, unknown>\n    : {}\n",
    "  const result = calculation.result && typeof calculation.result === 'object'\n    ? calculation.result as Record<string, unknown>\n    : {}\n  const interpretationEnvelope = row.interpretation_json && typeof row.interpretation_json === 'object' ? row.interpretation_json as Record<string,unknown> : {}\n  const interpretation = interpretationEnvelope.ai && typeof interpretationEnvelope.ai === 'object' ? interpretationEnvelope.ai as Record<string,unknown> : (calculation.interpretation && typeof calculation.interpretation === 'object' ? calculation.interpretation as Record<string,unknown> : undefined)\n",
    'cloud interpretation read',
)
archive = replace_once(archive, "    result,\n    createdAt:", "    result,\n    interpretation,\n    createdAt:", 'cloud item interpretation')
archive = archive.replace("const columns = 'id, reading_type, period_start, period_end, engine_version, calculation_json, summary, created_at'", "const columns = 'id, reading_type, period_start, period_end, engine_version, calculation_json, interpretation_json, summary, created_at'", 1)

# ---------------------------------------------------------------------------
# Guardrails: make sure no regression silently strips the restored contracts.
# ---------------------------------------------------------------------------
required_app = [
    "PeriodAiInterpretationPanel",
    "저장된 해설 즉시 조회 · 이번 Gemini API 재호출 0회",
    "상세 해설 보기",
    "실제 결과 기록 · 개인보정",
    "연락 받음",
    "relationshipAiCacheId",
    "fortuneCalculationCacheId",
    "archive_mode:'period_fortune_v16'",
    "if (selectedTool === null) void runAiInterpretation",
]
for token in required_app:
    if token not in app:
        raise SystemExit(f'missing restored app token: {token}')
for token in ["interpretation?: Record<string, unknown>", "stableId?: string", "interpretation_json: { archive_v: 1, ai:"]:
    if token not in archive:
        raise SystemExit(f'missing archive token: {token}')

APP.write_text(app, encoding='utf-8')
ARCHIVE.write_text(archive, encoding='utf-8')
