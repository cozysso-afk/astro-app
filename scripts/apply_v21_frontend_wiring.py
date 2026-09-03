from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1):
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    if old not in s:
        raise SystemExit(f'anchor missing: {path}: {old[:120]!r}')
    s = s.replace(old, new, count)
    p.write_text(s, encoding='utf-8')


# Cache/job contracts: never reuse V20 AI output or pending jobs under V21.
replace('web/src/lib/readingCache.ts', "const FORTUNE_AI_CACHE_CONTRACT = 'release-contract-v20'", "const FORTUNE_AI_CACHE_CONTRACT = 'release-contract-v21-single-core-cost-guard'")
replace('web/src/lib/fortuneAiJob.ts', "export const FORTUNE_AI_JOB_CONTRACT = 'fortune-ai-job-release-v20'", "export const FORTUNE_AI_JOB_CONTRACT = 'fortune-ai-job-release-v21-single-core-cost-guard'")
replace('web/src/lib/fortuneAiJob.ts', "export const FORTUNE_AI_JOB_STORAGE_KEY = 'starlight-destiny.ai-job.v2'", "export const FORTUNE_AI_JOB_STORAGE_KEY = 'starlight-destiny.ai-job.v3'")

# Usage types expose V21's real call trace and prompt budget.
replace('web/src/appTypes.ts', "    quality_validation?: AiQualityValidation | null\n", "    quality_validation?: AiQualityValidation | null\n    prompt_budget?: { bytes?: number; max_bytes?: number; estimated_input_tokens?: number } | null\n    call_trace?: Array<{ call:number; model:string; kind:string; prompt_bytes:number; elapsed_ms:number; http_status:number; usage?: { prompt_tokens?:number; candidate_tokens?:number; thought_tokens?:number; total_tokens?:number }; error?:string }>\n    cost_guard_version?: string\n    local_thai_scrub?: boolean\n")

# V21 backend should persist local safety handling into usage metadata too.
replace(
    'supabase/functions/fortune-interpret-v21-preview/index.ts',
    'cost_guard_version:VERSION};',
    'cost_guard_version:VERSION,local_thai_scrub:Boolean(r.local_thai_scrub)};'
)

# App wiring.
p='web/src/AppNext.tsx'
s=Path(p).read_text(encoding='utf-8')

def r(old,new,count=1):
    global s
    if old not in s:
        raise SystemExit(f'AppNext anchor missing: {old[:160]!r}')
    s=s.replace(old,new,count)

r("const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\\/$/, '')\n", "const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\\/$/, '')\nconst FORTUNE_AI_FUNCTION = 'fortune-interpret-v21-preview'\n")
s=s.replace("supabase.functions.invoke('fortune-interpret-v6-preview'", "supabase.functions.invoke(FORTUNE_AI_FUNCTION")
r("  const aiPollRef = useRef<string | null>(null)\n", "  const aiPollRef = useRef<string | null>(null)\n  const [aiActiveJobId, setAiActiveJobId] = useState<string | null>(null)\n")

# Cancel old AI work when user changes a top-level period/tool. This cannot undo an already-sent call,
# but it prevents the V21 repair/fallback call from starting after the first call returns.
r("  const selectHomePeriod = (nextPeriod: PeriodKey, clearTool: boolean) => {\n    setPeriod(nextPeriod)\n", "  const selectHomePeriod = (nextPeriod: PeriodKey, clearTool: boolean) => {\n    if (aiLoading || aiActiveJobId || readLocalStorage(FORTUNE_AI_JOB_STORAGE_KEY)) void cancelAiInterpretation(true)\n    setPeriod(nextPeriod)\n")
r("  const selectHomeTool = (tool: ToolKey) => {\n    setSelectedTool(tool)\n", "  const selectHomeTool = (tool: ToolKey) => {\n    if (aiLoading || aiActiveJobId || readLocalStorage(FORTUNE_AI_JOB_STORAGE_KEY)) void cancelAiInterpretation(true)\n    setSelectedTool(tool)\n")

# Polling: track active job and preserve failed usage so cost is visible even on failure.
r("    aiPollRef.current = jobId\n    setAiLoading(true); setAiError('')\n", "    aiPollRef.current = jobId\n    setAiActiveJobId(jobId)\n    setAiLoading(true); setAiError('')\n")
r("          removeLocalStorage(FORTUNE_AI_JOB_STORAGE_KEY)\n          setAiConfigured(true)\n", "          removeLocalStorage(FORTUNE_AI_JOB_STORAGE_KEY)\n          setAiActiveJobId(null)\n          setAiConfigured(true)\n")
r("        if (data?.status === 'failed') {\n          removeLocalStorage(FORTUNE_AI_JOB_STORAGE_KEY)\n          throw new Error(data?.error || 'AI 해설 서버 작업이 실패했어.')\n        }\n", "        if (data?.status === 'failed') {\n          removeLocalStorage(FORTUNE_AI_JOB_STORAGE_KEY)\n          setAiActiveJobId(null)\n          const failedPayload: AiInterpretationResponse = { ok:false, model:data.model, fallback_from:data.fallback_from, interpreter_version:data.interpreter_version || 'unknown', usage:data.usage ?? undefined, error:data?.error || 'AI 해설 서버 작업이 실패했어.' }\n          setAiInterpretation(failedPayload)\n          throw new Error(failedPayload.error)\n        }\n")
r("      setAiLoading(false)\n      return\n    }\n    void pollAiInterpretationJob(saved.jobId", "      setAiLoading(false)\n      setAiActiveJobId(null)\n      return\n    }\n    setAiActiveJobId(saved.jobId)\n    void pollAiInterpretationJob(saved.jobId")

# Cached/start/error state.
r("        setAiCacheSource('local')\n        setAiLoading(false)\n", "        setAiCacheSource('local')\n        setAiLoading(false)\n        setAiActiveJobId(null)\n")
r("      const pending = { jobId: String(data.job_id), periodStart: calculation.period.start, periodEnd: calculation.period.end, cacheId, ttlDays, request: requestForCache }\n      const jobPersisted", "      const pending = { jobId: String(data.job_id), periodStart: calculation.period.start, periodEnd: calculation.period.end, cacheId, ttlDays, request: requestForCache }\n      setAiActiveJobId(pending.jobId)\n      const jobPersisted")
r("      setAiLoading(false)\n      aiRequestRef.current = ''\n      const message = error instanceof Error ? error.message : 'AI 해설 요청에 실패했어.'\n", "      setAiLoading(false)\n      setAiActiveJobId(null)\n      aiRequestRef.current = ''\n      const message = error instanceof Error ? error.message : 'AI 해설 요청에 실패했어.'\n")

# Starting a new calculation should also stop any stale AI job first.
r("  const runIntegrated = async () => {\n    setIntegratedError('');", "  const runIntegrated = async () => {\n    if (aiLoading || aiActiveJobId || readLocalStorage(FORTUNE_AI_JOB_STORAGE_KEY)) await cancelAiInterpretation(true)\n    setIntegratedError('');")

# Free prompt-copy path and explicit cancellation path.
anchor="""  async function handleCopy(label: string, text: string) {
    const ok = await copyToClipboard(text)
    setActionNotice(ok ? `${label} 완료` : '복사 권한을 사용할 수 없어. 브라우저에서 다시 시도해줘.')
    window.setTimeout(() => setActionNotice(''), 2200)
  }
"""
insert=anchor+"""

  async function copyAiInterpretationPrompt(calculation: IntegratedApiResponse | null = integratedResult) {
    if (!calculation) return
    try {
      await ensureSupabaseSession()
      const { data, error } = await supabase.functions.invoke(FORTUNE_AI_FUNCTION, { body: { action:'prompt', calculation } })
      if (error) throw error
      if (!data?.ok || !data?.prompt) throw new Error(data?.error || 'AI용 압축 프롬프트를 만들지 못했어.')
      const ok = await copyToClipboard(String(data.prompt))
      const estimated = Number(data.estimated_input_tokens ?? 0)
      setActionNotice(ok ? `AI용 압축 프롬프트 복사 완료${estimated > 0 ? ` · 예상 입력 약 ${estimated.toLocaleString()} tokens` : ''}` : '복사 권한을 사용할 수 없어. 브라우저에서 다시 시도해줘.')
      window.setTimeout(() => setActionNotice(''), 3200)
    } catch (error) {
      setActionNotice(error instanceof Error ? error.message : 'AI용 압축 프롬프트 복사에 실패했어.')
      window.setTimeout(() => setActionNotice(''), 3200)
    }
  }

  async function cancelAiInterpretation(silent = false) {
    const raw = readLocalStorage(FORTUNE_AI_JOB_STORAGE_KEY)
    const saved = raw ? decodePendingFortuneAiJob(raw) : null
    const jobId = aiActiveJobId || saved?.jobId || null
    if (!jobId) {
      if (!silent) {
        setActionNotice('취소할 AI 해설 작업이 없어.')
        window.setTimeout(() => setActionNotice(''), 2200)
      }
      return
    }
    try {
      await ensureSupabaseSession()
      const { error } = await supabase.functions.invoke(FORTUNE_AI_FUNCTION, { body:{ action:'cancel', job_id:jobId } })
      if (error) throw error
      removeLocalStorage(FORTUNE_AI_JOB_STORAGE_KEY)
      aiRequestRef.current = ''
      aiPollRef.current = null
      setAiActiveJobId(null)
      setAiLoading(false)
      if (!silent) {
        setAiError('AI 해설 생성을 취소했어. 계산 결과는 그대로 사용할 수 있어.')
        setActionNotice('AI 해설 생성 취소 완료 · 이미 전송된 1회 호출은 되돌릴 수 없지만 추가 수선 호출은 중단해.')
        window.setTimeout(() => setActionNotice(''), 3600)
      }
    } catch (error) {
      if (!silent) {
        setActionNotice(error instanceof Error ? `AI 해설 취소 확인 실패 · ${error.message}` : 'AI 해설 취소 확인에 실패했어.')
        window.setTimeout(() => setActionNotice(''), 3200)
      }
    }
  }
"""
r(anchor,insert)

# Date/year changes cancel stale work before switching targets.
r("            onQueryDateChange={setQueryDate}\n", "            onQueryDateChange={(value)=>{ if (aiLoading || aiActiveJobId || readLocalStorage(FORTUNE_AI_JOB_STORAGE_KEY)) void cancelAiInterpretation(true); setQueryDate(value) }}\n")
r("onChange={(e)=>setIntegratedCalendarYear(Number(e.target.value))}", "onChange={(e)=>{ if (aiLoading || aiActiveJobId || readLocalStorage(FORTUNE_AI_JOB_STORAGE_KEY)) void cancelAiInterpretation(true); setIntegratedCalendarYear(Number(e.target.value)) }}")

# Annual controls: prompt copy is always available after calculation; cancel is visible while active.
old="""              {!aiInterpretation&&!aiLoading&&!aiError&&<div className="relationship-ai-toolbar"><button type="button" onClick={()=>void runAiInterpretation()}><Sparkles size={17}/><span>Gemini(제미나이) 통합 정밀해설</span></button><small>원할 때만 AI 호출 · 계산 자체는 Gemini 크레딧 0원 · 완료 후 토큰/예상비용 표시</small></div>}
              <AiInterpretationPanel result={aiInterpretation} loading={aiLoading} error={aiError} onRetry={()=>void runAiInterpretation()} topics={topicOrder}/>
"""
new="""              <div className="relationship-ai-toolbar ai-cost-guard-toolbar">
                {!aiInterpretation&&!aiLoading&&!aiError&&<button type="button" onClick={()=>void runAiInterpretation()}><Sparkles size={17}/><span>Gemini(제미나이) 통합 정밀해설</span></button>}
                <button type="button" onClick={()=>void copyAiInterpretationPrompt(integratedResult)}><Copy size={15}/><span>AI용 압축 프롬프트 복사</span></button>
                {aiLoading&&aiActiveJobId&&<button type="button" onClick={()=>void cancelAiInterpretation(false)}><Trash2 size={15}/><span>AI 해설 생성 취소</span></button>}
                <small>계산 자체 Gemini 0회 · 해설 정상 경로 1회 · 품질 수선이 필요할 때만 최대 2회 · 약 2분 제한</small>
              </div>
              <AiInterpretationPanel result={aiInterpretation} loading={aiLoading} error={aiError} onRetry={()=>void runAiInterpretation()} onCopyPrompt={()=>void copyAiInterpretationPrompt(integratedResult)} onCancel={()=>void cancelAiInterpretation(false)} canCancel={Boolean(aiLoading&&aiActiveJobId)} topics={topicOrder}/>
"""
r(old,new)

# Period controls passed through results component.
r("              onRetryAi={()=>void runAiInterpretation(integratedResult, integratedRequestSnapshot)}\n", "              onRetryAi={()=>void runAiInterpretation(integratedResult, integratedRequestSnapshot)}\n              onCopyAiPrompt={()=>void copyAiInterpretationPrompt(integratedResult)}\n              onCancelAi={()=>void cancelAiInterpretation(false)}\n              aiCanCancel={Boolean(aiLoading&&aiActiveJobId)}\n")

Path(p).write_text(s,encoding='utf-8')

# Period result prop plumbing.
p='web/src/PeriodFortuneResults.tsx'; s=Path(p).read_text(encoding='utf-8')
def rr(old,new,count=1):
    global s
    if old not in s: raise SystemExit(f'PeriodFortuneResults anchor missing: {old[:120]!r}')
    s=s.replace(old,new,count)
rr("  onRetryAi: () => void\n", "  onRetryAi: () => void\n  onCopyAiPrompt: () => void\n  onCancelAi: () => void\n  aiCanCancel: boolean\n")
rr("  onRetryAi,\n", "  onRetryAi,\n  onCopyAiPrompt,\n  onCancelAi,\n  aiCanCancel,\n")
rr("    <PeriodAiInterpretationPanel result={aiInterpretation} loading={aiLoading} error={aiError} cacheSource={aiCacheSource} onRetry={onRetryAi}/>\n", "    <PeriodAiInterpretationPanel result={aiInterpretation} loading={aiLoading} error={aiError} cacheSource={aiCacheSource} onRetry={onRetryAi} onCopyPrompt={onCopyAiPrompt} onCancel={onCancelAi} canCancel={aiCanCancel}/>\n")
Path(p).write_text(s,encoding='utf-8')

# Annual AI panel: loading/error/success controls and V21 wording.
p='web/src/AiInterpretationPanel.tsx'; s=Path(p).read_text(encoding='utf-8')
def ra(old,new,count=1):
    global s
    if old not in s: raise SystemExit(f'AiInterpretationPanel anchor missing: {old[:140]!r}')
    s=s.replace(old,new,count)
ra("import { AlertTriangle, CheckCircle2, LoaderCircle, Sparkles } from 'lucide-react'", "import { AlertTriangle, CheckCircle2, CircleStop, Copy, LoaderCircle, Sparkles } from 'lucide-react'")
ra("export function AiInterpretationPanel({ result, loading, error, onRetry, topics }: {\n", "export function AiInterpretationPanel({ result, loading, error, onRetry, onCopyPrompt, onCancel, canCancel, topics }: {\n")
ra("  onRetry: () => void\n  topics: string[]\n", "  onRetry: () => void\n  onCopyPrompt: () => void\n  onCancel: () => void\n  canCancel: boolean\n  topics: string[]\n")
old_loading="  if (loading) return <section className=\"ai-interpret-card is-loading\"><LoaderCircle className=\"spin\" size={22}/><div><span className=\"eyebrow\">AI(인공지능) 해설</span><strong>Gemini가 서버에서 정밀해석 중…</strong><p>월별 변화와 핵심 날짜를 계산 근거에 다시 대조하고 있어. 앱을 닫아도 서버 작업은 계속돼.</p></div></section>\n"
new_loading="  if (loading) return <section className=\"ai-interpret-card is-loading\"><LoaderCircle className=\"spin\" size={22}/><div><span className=\"eyebrow\">AI(인공지능) 해설</span><strong>압축 계산근거로 맞춤 해설 생성 중…</strong><p>정상 경로는 Gemini 1회야. 구조 오류·시간초과·핵심 품질 수선이 필요한 경우에만 최대 2회까지 허용하고 약 2분이 지나면 종료해.</p><div className=\"ai-v21-controls\"><button type=\"button\" onClick={onCopyPrompt}><Copy size={15}/>AI용 프롬프트 복사</button>{canCancel&&<button type=\"button\" className=\"is-cancel\" onClick={onCancel}><CircleStop size={15}/>생성 취소</button>}</div></div></section>\n"
ra(old_loading,new_loading)
# Error branch gets actual failed usage when server recorded it.
ra("  if (error) {\n", "  const failedUsage = estimateGeminiUsage(result?.usage)\n  if (error) {\n")
old_err="    return <section className=\"ai-interpret-card is-error\"><AlertTriangle size={20}/><div><span className=\"eyebrow\">AI(인공지능) 해설</span><strong>{quotaLimited ? 'AI 해설 서버 한도를 확인해줘' : 'AI 해설을 아직 붙이지 못했어'}</strong><p>{message}</p><button type=\"button\" onClick={onRetry}>{quotaLimited ? '한도 복구 후 다시 시도' : 'AI 해설 다시 시도'}</button></div></section>\n"
new_err="    return <section className=\"ai-interpret-card is-error\"><AlertTriangle size={20}/><div><span className=\"eyebrow\">AI(인공지능) 해설</span><strong>{quotaLimited ? 'AI 해설 서버 한도를 확인해줘' : 'AI 해설을 아직 붙이지 못했어'}</strong><p>{message}</p>{failedUsage?.total_tokens ? <p className=\"ai-v21-failed-usage\">실패 전 실제 사용량 · 입력 {(failedUsage.prompt_tokens??0).toLocaleString()} · 출력 {(failedUsage.candidate_tokens??0).toLocaleString()} · 사고 {(failedUsage.thought_tokens??0).toLocaleString()} tokens · Gemini 호출 {failedUsage.attempt_count??1}회 · 약 {Math.round(failedUsage.estimated_krw??0).toLocaleString()}원</p> : null}<div className=\"ai-v21-controls\"><button type=\"button\" onClick={onRetry}>{quotaLimited ? '한도 복구 후 다시 시도' : 'AI 해설 다시 시도'}</button><button type=\"button\" onClick={onCopyPrompt}><Copy size={15}/>AI용 프롬프트 복사</button></div></div></section>\n"
ra(old_err,new_err)
# Replace stale retry wording in usage detail.
ra("{(usage.attempt_count??1)>1?`${usage.attempt_count}회 생성 시도 합산 · `:''}", "{`실제 Gemini 호출 ${usage.attempt_count??1}회 · 최대 2회 · `}")
# Add success controls before limits.
ra("    <details className=\"ai-system-note\"><summary>체계별 계산 근거</summary>", "    <div className=\"ai-v21-controls ai-v21-controls-success\"><button type=\"button\" onClick={onCopyPrompt}><Copy size={15}/>같은 압축 프롬프트 복사</button></div>\n    <details className=\"ai-system-note\"><summary>체계별 계산 근거</summary>")
Path(p).write_text(s,encoding='utf-8')

# Period AI panel controls + failed usage.
p='web/src/PeriodAiInterpretationPanel.tsx'; s=Path(p).read_text(encoding='utf-8')
def rp(old,new,count=1):
    global s
    if old not in s: raise SystemExit(f'PeriodAiInterpretationPanel anchor missing: {old[:140]!r}')
    s=s.replace(old,new,count)
rp("import { CheckCircle2, LoaderCircle, Sparkles } from 'lucide-react'", "import { CheckCircle2, CircleStop, Copy, LoaderCircle, Sparkles } from 'lucide-react'")
rp("export function PeriodAiInterpretationPanel({ result, loading, error, cacheSource, onRetry }: {\n", "export function PeriodAiInterpretationPanel({ result, loading, error, cacheSource, onRetry, onCopyPrompt, onCancel, canCancel }: {\n")
rp("  onRetry: () => void\n}) {\n", "  onRetry: () => void\n  onCopyPrompt: () => void\n  onCancel: () => void\n  canCancel: boolean\n}) {\n")
old_loading="  if (loading && !result) return <section className=\"period-ai-card is-loading\"><LoaderCircle className=\"spin\" size={21}/><div><span className=\"period-ai-kicker\">GEMINI PERIOD READING</span><h3>계산근거를 대조해 해설하는 중…</h3><p className=\"period-ai-summary\">점수·핵심 시기·사주·Thai 맥락을 확인하고 5단계 검증까지 통과한 결과만 보여줄게.</p></div></section>\n"
new_loading="  if (loading && !result) return <section className=\"period-ai-card is-loading\"><LoaderCircle className=\"spin\" size={21}/><div><span className=\"period-ai-kicker\">GEMINI PERIOD READING</span><h3>압축 계산근거로 맞춤 해설 생성 중…</h3><p className=\"period-ai-summary\">정상 경로 Gemini 1회, 필요한 품질 수선이 있을 때만 최대 2회야. 약 2분을 넘기지 않고 중단해.</p><div className=\"period-ai-v21-controls\"><button type=\"button\" onClick={onCopyPrompt}><Copy size={15}/>AI용 프롬프트 복사</button>{canCancel&&<button type=\"button\" className=\"is-cancel\" onClick={onCancel}><CircleStop size={15}/>생성 취소</button>}</div></div></section>\n"
rp(old_loading,new_loading)
rp("  if (error && !result) {\n", "  const failedUsage = estimateGeminiUsage(result?.usage)\n  if (error && !result?.data) {\n")
old_err="    return <section className=\"period-ai-card\"><span className=\"period-ai-kicker\">GEMINI PERIOD READING</span><h3>{quotaLimited ? 'AI 해설 서버 한도를 확인해줘' : '자연어 해설을 아직 불러오지 못했어'}</h3><p className=\"period-ai-summary\">{message}</p><button className=\"period-ai-retry\" type=\"button\" onClick={onRetry}>{quotaLimited ? '한도 복구 후 다시 확인' : '해설 다시 확인'}</button></section>\n"
new_err="    return <section className=\"period-ai-card\"><span className=\"period-ai-kicker\">GEMINI PERIOD READING</span><h3>{quotaLimited ? 'AI 해설 서버 한도를 확인해줘' : '자연어 해설을 아직 불러오지 못했어'}</h3><p className=\"period-ai-summary\">{message}</p>{failedUsage?.total_tokens ? <p className=\"period-ai-failed-usage\">실패 전 실제 사용량 · 입력 {(failedUsage.prompt_tokens??0).toLocaleString()} · 출력 {(failedUsage.candidate_tokens??0).toLocaleString()} · 사고 {(failedUsage.thought_tokens??0).toLocaleString()} tokens · 호출 {failedUsage.attempt_count??1}회 · 약 {Math.round(failedUsage.estimated_krw??0).toLocaleString()}원</p> : null}<div className=\"period-ai-v21-controls\"><button className=\"period-ai-retry\" type=\"button\" onClick={onRetry}>{quotaLimited ? '한도 복구 후 다시 확인' : '해설 다시 확인'}</button><button type=\"button\" onClick={onCopyPrompt}><Copy size={15}/>AI용 프롬프트 복사</button></div></section>\n"
rp(old_err,new_err)
rp("{(usage.attempt_count??1)>1?`${usage.attempt_count}회 생성 시도 합산 · `:''}", "{`실제 Gemini 호출 ${usage.attempt_count??1}회 · 최대 2회 · `}")
rp("    <div className=\"period-ai-cache-note\"><CheckCircle2 size={14}/><span>{cached ? '저장된 검증 해설 조회 · 이번 Gemini API 재호출 0회' : '최초 검증 해설 자동 저장 · 같은 계산값 재조회는 Gemini API 0회'}</span></div>\n", "    <div className=\"period-ai-cache-note\"><CheckCircle2 size={14}/><span>{cached ? '저장된 검증 해설 조회 · 이번 Gemini API 재호출 0회' : '최초 검증 해설 자동 저장 · 같은 계산값 재조회는 Gemini API 0회'}</span></div>\n    <div className=\"period-ai-v21-controls period-ai-v21-controls-success\"><button type=\"button\" onClick={onCopyPrompt}><Copy size={15}/>같은 압축 프롬프트 복사</button></div>\n")
Path(p).write_text(s,encoding='utf-8')

# Minimal visual treatment; no new design system needed.
with Path('web/src/ai-interpret-v2.css').open('a',encoding='utf-8') as f:
    f.write('''\n/* V21 AI cost guard controls */\n.ai-v21-controls{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.ai-v21-controls button{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(120,105,150,.22);border-radius:999px;padding:8px 11px;background:rgba(255,255,255,.72);font:inherit;cursor:pointer}.ai-v21-controls button.is-cancel{border-color:rgba(170,86,102,.28)}.ai-v21-controls-success{margin:14px 0 4px}.ai-v21-failed-usage{font-size:.82rem;opacity:.82}\n''')
with Path('web/src/period-ai-v18.css').open('a',encoding='utf-8') as f:
    f.write('''\n/* V21 single-call controls */\n.period-ai-v21-controls{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.period-ai-v21-controls button{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(120,105,150,.2);border-radius:999px;padding:8px 11px;background:rgba(255,255,255,.7);font:inherit;cursor:pointer}.period-ai-v21-controls button.is-cancel{border-color:rgba(170,86,102,.28)}.period-ai-v21-controls-success{margin-top:10px}.period-ai-failed-usage{font-size:.82rem;opacity:.82}.ai-cost-guard-toolbar{flex-wrap:wrap}\n''')

print('V21 frontend wiring patch applied')
