from pathlib import Path
import re

api_path = Path('api/main.py')
app_path = Path('web/src/AppNext.tsx')
main_path = Path('web/src/main.tsx')

# ---------- API ----------
s = api_path.read_text(encoding='utf-8')

if 'from ai_interpret_v1 import AI_DEFAULT_MODEL' not in s:
    anchor = 'from integrated_fortune_v1 import build_integrated_fortune\n'
    assert anchor in s, 'api import anchor missing'
    s = s.replace(anchor, anchor + 'from ai_interpret_v1 import AI_DEFAULT_MODEL, ai_status, interpret_integrated_fortune\n', 1)

s = s.replace('APP_VERSION = "api-fortune-v2"', 'APP_VERSION = "api-fortune-v3"', 1)

if 'class IntegratedInterpretRequest' not in s:
    anchor = '''class IntegratedFortuneRequest(BaseModel):
    profile: FortuneProfile
    start_date: date
    end_date: date
'''
    assert anchor in s, 'interpret request anchor missing'
    s = s.replace(anchor, anchor + '''

class IntegratedInterpretRequest(BaseModel):
    calculation: dict
    model: str = AI_DEFAULT_MODEL
''', 1)

if '"ai_interpretation": ai_status()' not in s:
    anchor = '        "calculation_engine_connected": True,\n'
    assert anchor in s, 'meta anchor missing'
    s = s.replace(anchor, anchor + '        "ai_interpretation": ai_status(),\n', 1)

if '"fortune/interpret"' not in s:
    anchor = '            "fortune/integrated",\n'
    assert anchor in s, 'live routes anchor missing'
    s = s.replace(anchor, anchor + '            "fortune/interpret",\n', 1)

if '@app.get("/v1/fortune/ai-meta")' not in s:
    anchor = '\n\n@app.post("/v1/relationship/western")\n'
    assert anchor in s, 'relationship route anchor missing'
    block = '''

@app.get("/v1/fortune/ai-meta")
def fortune_ai_meta() -> dict:
    return ai_status()


@app.post("/v1/fortune/interpret")
def fortune_interpret(request: IntegratedInterpretRequest) -> dict:
    if not isinstance(request.calculation, dict) or not request.calculation:
        raise HTTPException(status_code=422, detail="calculation result is required")
    return interpret_integrated_fortune(request.calculation, request.model)
'''
    s = s.replace(anchor, block + anchor, 1)

api_path.write_text(s, encoding='utf-8')

# ---------- FRONTEND ----------
s = app_path.read_text(encoding='utf-8')

if 'AI_MODEL_STORAGE_KEY' not in s:
    anchor = "const UI_SETTINGS_STORAGE_KEY = 'starlight-destiny.ui-settings.v1'\n"
    assert anchor in s, 'AI storage anchor missing'
    s = s.replace(anchor, anchor + "const AI_MODEL_STORAGE_KEY = 'starlight-destiny.ai-model.v1'\n", 1)

if 'type AiInterpretationResponse' not in s:
    anchor = '\nconst periods = [\n'
    assert anchor in s, 'AI type anchor missing'
    type_block = r'''

type AiTopicInterpretation = {
  verdict: string
  reason: string
  timing: string
  action: string
  avoid: string
  confidence: '높음' | '보통' | '낮음'
  confidence_reason: string
}

type AiInterpretationResponse = {
  ok: boolean
  missing_key?: boolean
  error?: string
  model?: string
  fallback_from?: string
  interpreter_version?: string
  usage?: { prompt_tokens?: number; candidate_tokens?: number; thought_tokens?: number; total_tokens?: number }
  data?: {
    headline: string
    overall: { summary: string; dominant_pattern: string; best_phase: string; caution_phase: string }
    clusters: { relationship: string; work_study: string; money_news: string; condition: string }
    systems: { western: string; saju: string; thai: string }
    priorities: string[]
    topic_analysis: Record<string, AiTopicInterpretation>
    limits: string
  }
}

function AiInterpretationPanel({ result, loading, error, onRetry }: {
  result: AiInterpretationResponse | null
  loading: boolean
  error: string
  onRetry: () => void
}) {
  if (loading) return <section className="ai-interpret-card is-loading"><LoaderCircle className="spin" size={20}/><div><span className="eyebrow">AI INTERPRETATION</span><strong>Gemini가 실계산 근거를 해석하는 중…</strong><p>숫자를 사건 확률로 바꾸지 않고 Western·사주·Thai를 분리해서 읽고 있어.</p></div></section>
  if (error) return <section className="ai-interpret-card is-error"><AlertTriangle size={20}/><div><span className="eyebrow">AI INTERPRETATION</span><strong>AI 해설을 아직 붙이지 못했어</strong><p>{error}</p><button type="button" onClick={onRetry}>AI 해설 다시 시도</button></div></section>
  if (!result?.ok || !result.data) return null
  const data = result.data
  return <section className="ai-interpret-card">
    <div className="ai-interpret-head"><span className="ai-orb"><Sparkles size={19}/></span><div><span className="eyebrow">GEMINI INTERPRETATION</span><h3>{data.headline || '통합 계산 해설'}</h3><small>{result.model || 'Gemini'} · 계산 후 해설층</small></div></div>
    <p className="ai-summary">{data.overall.summary}</p>
    {data.overall.dominant_pattern && <div className="ai-highlight"><strong>핵심 패턴</strong><span>{data.overall.dominant_pattern}</span></div>}
    <div className="ai-cluster-grid">
      {data.clusters.relationship && <div><strong>관계</strong><p>{data.clusters.relationship}</p></div>}
      {data.clusters.work_study && <div><strong>일 · 학업</strong><p>{data.clusters.work_study}</p></div>}
      {data.clusters.money_news && <div><strong>금전 · 소식</strong><p>{data.clusters.money_news}</p></div>}
      {data.clusters.condition && <div><strong>컨디션</strong><p>{data.clusters.condition}</p></div>}
    </div>
    {!!data.priorities?.length && <div className="ai-priorities"><strong>이 기간 우선순위</strong>{data.priorities.map((item, index)=><p key={`${index}-${item}`}>{index+1}. {item}</p>)}</div>}
    <details className="ai-details"><summary>분야별 정밀 해석 보기</summary><div className="ai-topic-list">{topicOrder.map((topic)=>{
      const item=data.topic_analysis?.[topic]
      if(!item) return null
      return <article key={topic}><div className="ai-topic-title"><strong>{topic}</strong><span>{item.confidence}</span></div><p className="ai-verdict">{item.verdict}</p>{item.reason&&<p><b>근거</b> {item.reason}</p>}{item.timing&&<p><b>시기</b> {item.timing}</p>}{item.action&&<p><b>행동</b> {item.action}</p>}{item.avoid&&<p><b>주의</b> {item.avoid}</p>}</article>
    })}</div></details>
    <div className="ai-system-note"><strong>체계별 해석</strong>{data.systems.western&&<p><b>Western</b> {data.systems.western}</p>}{data.systems.saju&&<p><b>사주</b> {data.systems.saju}</p>}{data.systems.thai&&<p><b>Thai</b> {data.systems.thai}</p>}</div>
    {data.limits && <p className="ai-limits">{data.limits}</p>}
  </section>
}
'''
    s = s.replace(anchor, type_block + anchor, 1)

if 'function loadAiModel()' not in s:
    anchor = '\nfunction loadStoredProfile(): BirthProfile {\n'
    assert anchor in s, 'load model anchor missing'
    helper = '''
function loadAiModel() {
  if (typeof window === 'undefined') return 'gemini-3.7-flash'
  const saved = window.localStorage.getItem(AI_MODEL_STORAGE_KEY)
  return saved === 'gemini-3.6-flash' ? saved : 'gemini-3.7-flash'
}
'''
    s = s.replace(anchor, '\n' + helper + anchor, 1)

if 'const [aiInterpretation, setAiInterpretation]' not in s:
    anchor = "  const [integratedResult, setIntegratedResult] = useState<IntegratedApiResponse | null>(null)\n"
    assert anchor in s, 'AI state anchor missing'
    states = '''  const [aiInterpretation, setAiInterpretation] = useState<AiInterpretationResponse | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null)
  const [aiModel, setAiModel] = useState(loadAiModel)
'''
    s = s.replace(anchor, anchor + states, 1)

if '/v1/fortune/ai-meta' not in s:
    anchor = "  useEffect(() => {\n    if (mainView === 'history' || mainView === 'settings') void refreshArchive()\n  }, [mainView])\n"
    assert anchor in s, 'AI meta effect anchor missing'
    effect = '''  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/v1/fortune/ai-meta`)
      .then((response)=>response.json().then((payload)=>({response,payload})))
      .then(({response,payload})=>{ if(!cancelled) setAiConfigured(Boolean(response.ok && payload?.configured)) })
      .catch(()=>{ if(!cancelled) setAiConfigured(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(AI_MODEL_STORAGE_KEY, aiModel)
  }, [aiModel])

'''
    s = s.replace(anchor, effect + anchor, 1)

if 'const runAiInterpretation = async' not in s:
    anchor = '  const runIntegrated = async () => {\n'
    assert anchor in s, 'run AI anchor missing'
    fn = '''  const runAiInterpretation = async (calculation: IntegratedApiResponse | null = integratedResult) => {
    if (!calculation) return
    setAiLoading(true); setAiError('')
    try {
      const response = await fetch(`${API_BASE}/v1/fortune/interpret`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ calculation, model: aiModel }),
      })
      const payload = await response.json() as AiInterpretationResponse
      if (!response.ok) throw new Error(payload?.error || 'AI 해설 요청에 실패했어.')
      if (!payload.ok || !payload.data) {
        if (payload.missing_key) setAiConfigured(false)
        throw new Error(payload.error || 'AI 해설 결과가 비어 있어.')
      }
      setAiInterpretation(payload); setAiConfigured(true)
    } catch (error) {
      setAiInterpretation(null)
      setAiError(error instanceof Error ? error.message : 'AI 해설 요청에 실패했어.')
    } finally {
      setAiLoading(false)
    }
  }

'''
    s = s.replace(anchor, fn + anchor, 1)

s = s.replace(
    "    setIntegratedError(''); setIntegratedResult(null); setIntegratedRequestSnapshot(null)\n",
    "    setIntegratedError(''); setIntegratedResult(null); setIntegratedRequestSnapshot(null); setAiInterpretation(null); setAiError('')\n",
    1,
)

if 'void runAiInterpretation(calculation)' not in s:
    pattern = re.compile(r"(?P<indent>\s*)setIntegratedResult\(payload as IntegratedApiResponse\)\n(?P=indent)setIntegratedRequestSnapshot\(body\)")
    match = pattern.search(s)
    assert match, 'integrated result setter anchor missing'
    indent = match.group('indent')
    repl = f"{indent}const calculation = payload as IntegratedApiResponse\n{indent}setIntegratedResult(calculation)\n{indent}setIntegratedRequestSnapshot(body)\n{indent}void runAiInterpretation(calculation)"
    s = pattern.sub(repl, s, count=1)

if '<AiInterpretationPanel result={aiInterpretation}' not in s:
    integrated_head = '<div className="result-headline"><CheckCircle2 size={20}/><div><strong>통합 계산 완료</strong><span>{integratedResult.engine} · {integratedResult.period.day_count}일 · {integratedResult.period.month_segments}개 월 구간</span></div></div>'
    assert integrated_head in s, 'integrated AI render anchor missing'
    s = s.replace(integrated_head, integrated_head + '\n              <AiInterpretationPanel result={aiInterpretation} loading={aiLoading} error={aiError} onRetry={()=>void runAiInterpretation()}/>', 1)

    home_head = '<div className="result-headline"><CheckCircle2 size={20}/><div><strong>실계산 리포트 준비 완료</strong><span>{integratedResult.engine} · {integratedResult.period.day_count}일 분석</span></div></div>'
    assert home_head in s, 'home AI render anchor missing'
    s = s.replace(home_head, home_head + '\n              <AiInterpretationPanel result={aiInterpretation} loading={aiLoading} error={aiError} onRetry={()=>void runAiInterpretation()}/>', 1)

if 'AI 해석 모델' not in s:
    anchor = '          <div className="subsection-title">앱 상태</div>\n'
    assert anchor in s, 'settings AI anchor missing'
    block = '''          <div className="subsection-title">AI 해석</div>
          <div className="ai-settings-card">
            <label><span><strong>AI 해석 모델</strong><small>실계산 뒤에 붙는 자연어 해설 모델</small></span><select value={aiModel} onChange={(e)=>setAiModel(e.target.value)}><option value="gemini-3.7-flash">Gemini 3.7 Flash · 정밀 우선</option><option value="gemini-3.6-flash">Gemini 3.6 Flash · 빠른 해설</option></select></label>
            <div className={`ai-api-state ${aiConfigured===true?'online':aiConfigured===false?'offline':'checking'}`}><Sparkles size={16}/><span><strong>Gemini API</strong><small>{aiConfigured===true?'서버 비밀키 연결됨 · 계산 후 자동 해설':aiConfigured===false?'미연결 · Render에 GEMINI_API_KEY 설정 필요':'연결 상태 확인 중'}</small></span></div>
          </div>

'''
    s = s.replace(anchor, block + anchor, 1)

if '<div><span>AI 해설</span>' not in s:
    anchor = "            <div><span>계산 서버</span><strong>{apiStatus==='online'?'연결됨':apiStatus==='warming'?'확인 중':'대기 중'}</strong><small>{apiVersion || 'API 상태 확인'}</small></div>\n"
    assert anchor in s, 'settings status AI anchor missing'
    s = s.replace(anchor, anchor + "            <div><span>AI 해설</span><strong>{aiConfigured===true?'연결됨':aiConfigured===false?'미연결':'확인 중'}</strong><small>{aiModel}</small></div>\n", 1)

app_path.write_text(s, encoding='utf-8')

# ---------- CSS IMPORT ----------
s = main_path.read_text(encoding='utf-8')
if "import './ai-interpret.css'" not in s:
    anchor = "import './settings.css'\n"
    assert anchor in s, 'main css import anchor missing'
    s = s.replace(anchor, anchor + "import './ai-interpret.css'\n", 1)
main_path.write_text(s, encoding='utf-8')

print('mobile AI patch applied')
