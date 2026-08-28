from pathlib import Path

app = Path('web/src/AppNext.tsx')
s = app.read_text(encoding='utf-8')

s = s.replace("import { useEffect, useMemo, useState } from 'react'", "import { useEffect, useMemo, useRef, useState } from 'react'", 1)
s = s.replace("const AI_MODEL_STORAGE_KEY = 'starlight-destiny.ai-model.v1'\n", "const AI_MODEL_STORAGE_KEY = 'starlight-destiny.ai-model.v1'\nconst AI_JOB_STORAGE_KEY = 'starlight-destiny.ai-job.v1'\n", 1)

state_anchor = "  const [aiError, setAiError] = useState('')\n"
assert state_anchor in s
if 'aiPollRef' not in s:
    s = s.replace(state_anchor, state_anchor + "  const aiPollRef = useRef<string | null>(null)\n", 1)

old_loading = "if (loading) return <section className=\"ai-interpret-card is-loading\"><LoaderCircle className=\"spin\" size={20}/><div><span className=\"eyebrow\">AI INTERPRETATION</span><strong>Gemini가 실계산 근거를 해석하는 중…</strong><p>숫자를 사건 확률로 바꾸지 않고 Western·사주·Thai를 분리해서 읽고 있어.</p></div></section>"
new_loading = "if (loading) return <section className=\"ai-interpret-card is-loading\"><LoaderCircle className=\"spin\" size={22}/><div><span className=\"eyebrow\">AI INTERPRETATION</span><strong>Gemini가 서버에서 실계산 근거를 해석하는 중…</strong><p>앱을 잠깐 나가도 서버 작업은 계속돼. 돌아오면 완료된 리딩을 자동으로 다시 확인해.</p></div></section>"
assert old_loading in s
s = s.replace(old_loading, new_loading, 1)

old_func = '''  const runAiInterpretation = async (calculation: IntegratedApiResponse | null = integratedResult) => {
  if (!calculation) return
  setAiLoading(true); setAiError('')
  try {
    await ensureSupabaseSession()
    const { data, error } = await supabase.functions.invoke('fortune-interpret', {
      body: { calculation, model: aiModel },
    })
    if (error) throw error
    const payload = data as AiInterpretationResponse
    if (!payload?.ok || !payload.data) {
      if (payload?.missing_key) setAiConfigured(false)
      throw new Error(payload?.error || 'AI 해설 결과가 비어 있어.')
    }
    setAiInterpretation(payload)
    setAiConfigured(true)
  } catch (error) {
    setAiInterpretation(null)
    const message = error instanceof Error ? error.message : 'AI 해설 요청에 실패했어.'
    setAiError(message.includes('non-2xx') ? 'Supabase AI 해설 서버에서 오류가 발생했어. 설정의 Gemini 연결 상태를 확인해줘.' : message)
  } finally { setAiLoading(false) }
}
'''
assert old_func in s, 'old AI function not found'
new_func = '''  const pollAiInterpretationJob = async (jobId: string, periodStart?: string, periodEndValue?: string) => {
    if (!jobId || aiPollRef.current === jobId) return
    aiPollRef.current = jobId
    setAiLoading(true); setAiError('')
    try {
      await ensureSupabaseSession()
      for (let attempt = 0; attempt < 180; attempt++) {
        if (document.visibilityState === 'hidden') return
        const { data, error } = await supabase.functions.invoke('fortune-interpret', {
          body: { action: 'status', job_id: jobId },
        })
        if (error) throw error
        if (data?.status === 'done') {
          const payload: AiInterpretationResponse = {
            ok: true,
            model: data.model,
            fallback_from: data.fallback_from,
            interpreter_version: 'supabase-ai-v2-background-jobs',
            usage: data.usage ?? undefined,
            data: data.data ?? undefined,
          }
          if (!payload.data) throw new Error('완료된 AI 해설 결과가 비어 있어.')
          const currentEnd = periodEnd(queryDate, period)
          if (!periodStart || (queryDate === periodStart && currentEnd === periodEndValue)) {
            setAiInterpretation(payload)
          }
          window.localStorage.removeItem(AI_JOB_STORAGE_KEY)
          setAiConfigured(true)
          return
        }
        if (data?.status === 'failed') {
          window.localStorage.removeItem(AI_JOB_STORAGE_KEY)
          throw new Error(data?.error || 'AI 해설 서버 작업이 실패했어.')
        }
        await new Promise((resolve) => window.setTimeout(resolve, 2500))
      }
      setAiError('AI 해석은 서버에서 계속 진행 중이야. 앱을 다시 열면 자동으로 완료 여부를 확인해.')
    } catch (error) {
      if (document.visibilityState === 'hidden') return
      const message = error instanceof Error ? error.message : 'AI 해설 상태 확인에 실패했어.'
      setAiError(message.includes('non-2xx') ? 'AI 해설 상태 확인이 잠시 끊겼어. 앱을 다시 열면 이어서 확인해.' : message)
    } finally {
      aiPollRef.current = null
      setAiLoading(Boolean(window.localStorage.getItem(AI_JOB_STORAGE_KEY)))
    }
  }

  const resumeAiInterpretationJob = () => {
    if (document.visibilityState === 'hidden') return
    const raw = window.localStorage.getItem(AI_JOB_STORAGE_KEY)
    if (!raw) return
    try {
      const saved = JSON.parse(raw) as { jobId?: string; periodStart?: string; periodEnd?: string }
      if (saved.jobId) void pollAiInterpretationJob(saved.jobId, saved.periodStart, saved.periodEnd)
    } catch {
      window.localStorage.removeItem(AI_JOB_STORAGE_KEY)
      setAiLoading(false)
    }
  }

  const runAiInterpretation = async (calculation: IntegratedApiResponse | null = integratedResult) => {
    if (!calculation) return
    setAiLoading(true); setAiError(''); setAiInterpretation(null)
    try {
      await ensureSupabaseSession()
      const { data, error } = await supabase.functions.invoke('fortune-interpret', {
        body: { action: 'start', calculation, model: aiModel },
      })
      if (error) throw error
      if (!data?.ok || !data?.job_id) {
        if (data?.missing_key) setAiConfigured(false)
        throw new Error(data?.error || 'AI 해설 서버 작업을 시작하지 못했어.')
      }
      const pending = { jobId: String(data.job_id), periodStart: calculation.period.start, periodEnd: calculation.period.end }
      window.localStorage.setItem(AI_JOB_STORAGE_KEY, JSON.stringify(pending))
      setAiConfigured(true)
      void pollAiInterpretationJob(pending.jobId, pending.periodStart, pending.periodEnd)
    } catch (error) {
      window.localStorage.removeItem(AI_JOB_STORAGE_KEY)
      setAiLoading(false)
      const message = error instanceof Error ? error.message : 'AI 해설 요청에 실패했어.'
      setAiError(message.includes('non-2xx') ? 'Supabase AI 해설 서버에서 오류가 발생했어. 설정의 Gemini 연결 상태를 확인해줘.' : message)
    }
  }
'''
s = s.replace(old_func, new_func, 1)

# Resume polling after iOS PWA returns to foreground / pageshow.
effect_anchor = "  useEffect(() => {\n    window.localStorage.setItem(AI_MODEL_STORAGE_KEY, aiModel)\n  }, [aiModel])\n"
assert effect_anchor in s
resume_effect = effect_anchor + '''\n  useEffect(() => {\n    const resume = () => { if (document.visibilityState !== 'hidden') resumeAiInterpretationJob() }\n    document.addEventListener('visibilitychange', resume)\n    window.addEventListener('pageshow', resume)\n    resume()\n    return () => {\n      document.removeEventListener('visibilitychange', resume)\n      window.removeEventListener('pageshow', resume)\n    }\n  }, [])\n'''
s = s.replace(effect_anchor, resume_effect, 1)

app.write_text(s, encoding='utf-8')

main = Path('web/src/main.tsx')
ms = main.read_text(encoding='utf-8')
if "./readability-v3.css" not in ms:
    ms = ms.replace("import './relationship-analysis.css'\n", "import './relationship-analysis.css'\nimport './readability-v3.css'\n")
main.write_text(ms, encoding='utf-8')

Path('web/src/readability-v3.css').write_text(r'''
/* iPhone readability pass: timing rows, day highlights, AI progress */
.result-card-title strong { font-size: 1.22rem; line-height: 1.3; letter-spacing: -.025em; }
.result-card-title span { font-size: .78rem; letter-spacing: .12em; }

.tight-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  min-height: 52px;
  padding: 11px 2px;
  border-bottom: 1px dashed rgba(112, 92, 124, .14);
}
.tight-row:last-of-type { border-bottom: 0; }
.tight-row > span { font-size: 1rem !important; line-height: 1.5; color: #665866; font-weight: 650; }
.tight-row > b { font-size: 1.12rem !important; line-height: 1; color: #8a6548; font-variant-numeric: tabular-nums; }
.result-note { font-size: .92rem !important; line-height: 1.65 !important; color: #887982 !important; }

.time-detail-list { gap: 15px !important; }
.time-detail-list details {
  border: 1px solid rgba(122, 108, 152, .18) !important;
  border-radius: 22px !important;
  padding: 15px 16px 17px !important;
  background: linear-gradient(145deg, rgba(255,255,255,.9), rgba(247,244,252,.88)) !important;
  box-shadow: 0 8px 24px rgba(79, 61, 99, .045);
}
.time-detail-list summary {
  min-height: 34px;
  font-size: 1.12rem !important;
  line-height: 1.35;
  font-weight: 900 !important;
  color: #4f4058 !important;
  letter-spacing: -.02em;
}
.time-topic-list { gap: 13px !important; margin-top: 14px !important; }
.time-topic {
  gap: 8px !important;
  padding: 15px 16px !important;
  border-radius: 18px !important;
  background: rgba(249, 246, 252, .94) !important;
  border: 1px solid rgba(135, 114, 153, .08);
}
.time-topic strong { font-size: 1.08rem !important; line-height: 1.3; color: #514057 !important; }
.time-topic span { font-size: .98rem !important; line-height: 1.58 !important; color: #706373 !important; font-variant-numeric: tabular-nums; }
.time-topic span:first-of-type { color: #5f586d !important; font-weight: 760; }
.time-topic span:nth-of-type(2) { color: #806b71 !important; font-weight: 720; }
.time-topic small {
  display: block;
  margin-top: 2px;
  padding-top: 9px;
  border-top: 1px solid rgba(126, 108, 143, .10);
  font-size: .89rem !important;
  line-height: 1.62 !important;
  color: #897b8d !important;
  overflow-wrap: anywhere;
}

.ai-interpret-card.is-loading strong { font-size: 1.12rem; line-height: 1.4; }
.ai-interpret-card.is-loading p { font-size: .94rem; line-height: 1.65; }

@media (max-width: 430px) {
  .tight-row { gap: 10px; padding: 12px 0; }
  .tight-row > span { font-size: .98rem !important; }
  .tight-row > b { font-size: 1.14rem !important; }
  .time-detail-list details { padding: 14px 13px 16px !important; border-radius: 20px !important; }
  .time-detail-list summary { font-size: 1.08rem !important; }
  .time-topic { padding: 14px 13px !important; }
  .time-topic strong { font-size: 1.06rem !important; }
  .time-topic span { font-size: .96rem !important; }
  .time-topic small { font-size: .87rem !important; }
}
''', encoding='utf-8')

print('patched AI resume + readability v3')
