import { AlertTriangle, CheckCircle2, LoaderCircle, Sparkles } from 'lucide-react'
import type { AiInterpretationResponse } from './appTypes'
import { estimateGeminiUsage } from './lib/aiUsage'

function periodLabel(start: string, end: string) {
  if (!start && !end) return ''
  if (!end || start === end) return start
  return `${start} → ${end}`
}

function signalClass(signal: string) {
  if (signal === '활용') return 'is-use'
  if (signal === '주의') return 'is-caution'
  if (signal === '배경') return 'is-background'
  return 'is-mixed'
}

export function AiInterpretationPanel({ result, loading, error, onRetry, topics }: {
  result: AiInterpretationResponse | null
  loading: boolean
  error: string
  onRetry: () => void
  topics: string[]
}) {
  if (loading) return <section className="ai-interpret-card is-loading"><LoaderCircle className="spin" size={22}/><div><span className="eyebrow">AI(인공지능) 해설</span><strong>Gemini가 서버에서 정밀해석 중…</strong><p>월별 변화와 핵심 날짜를 계산 근거에 다시 대조하고 있어. 앱을 닫아도 서버 작업은 계속돼.</p></div></section>
  if (error) return <section className="ai-interpret-card is-error"><AlertTriangle size={20}/><div><span className="eyebrow">AI(인공지능) 해설</span><strong>AI 해설을 아직 붙이지 못했어</strong><p>{error}</p><button type="button" onClick={onRetry}>AI 해설 다시 시도</button></div></section>
  if (!result?.ok || !result.data) return null
  const data = result.data
  const usage = estimateGeminiUsage(result.usage)
  const validation = result.usage?.quality_validation
  const validationPassed = validation?.score === 100 || (!!validation?.stages?.length && validation.stages.every((stage)=>stage.passed))
  const hasDecisions = !!data.decisions?.length
  const hasKeyWindows = !!data.key_windows?.length
  const hasYearPhases = !!data.year_phases?.length

  return <section className="ai-interpret-card">
    <div className="ai-interpret-head"><span className="ai-orb"><Sparkles size={19}/></span><div><span className="eyebrow">Gemini(제미나이) 통합 해설</span><h3>{data.headline || '통합 계산 해설'}</h3><small>실계산 결과 · 월별 변화 · 핵심 날짜를 함께 읽는 해설</small></div></div>

    {validation?.stages?.length ? <div className={`ai-validation-badge ${validationPassed ? 'is-passed' : 'is-partial'}`}><CheckCircle2 size={16}/><strong>{validationPassed ? '5단계 검증 통과' : '해설 검증 결과'}</strong><span>{validation.score ?? 0}/100 · {validation.stages.filter((stage)=>stage.passed).length}/5 단계</span></div> : null}

    {usage?.total_tokens ? <details className="ai-meta-details"><summary>해설 생성 정보</summary><div className="ai-usage-card"><strong>API(응용 프로그램 인터페이스) 사용량</strong><span>입력 {(usage?.prompt_tokens ?? 0).toLocaleString()} · 본문 출력 {(usage?.candidate_tokens ?? 0).toLocaleString()} · 사고 {(usage?.thought_tokens ?? 0).toLocaleString()} token(토큰)</span><b>누적 예상비용 ${Number(usage?.estimated_usd ?? 0).toFixed(4)} ≈ {Math.round(usage?.estimated_krw ?? 0).toLocaleString()}원</b><small>{(usage.attempt_count??1)>1?`${usage.attempt_count}회 생성 시도 합산 · `:''}{usage.thai_safety_fallback?'Thai 안전 대체 결과 적용 · ':usage.thai_safety_retry?'Thai 안전 재검증 통과 · ':''}저장 기록 재열람은 재호출이 없으면 0원</small></div></details> : null}

    <div className="ai-overall-block"><span className="ai-section-kicker">전체 결론</span><p className="ai-summary">{data.overall.summary}</p></div>

    {hasDecisions && <section className="ai-decision-section"><div className="ai-section-heading"><span>먼저 이것부터</span><strong>이 기간에 실제로 할 일</strong></div><div className="ai-decision-list">{data.decisions!.map((item,index)=><article key={`${index}-${item.action}`}><span className="ai-decision-index">{index+1}</span><div><strong>{item.action}</strong>{item.timing&&<b>{item.timing}</b>}<p>{item.reason}</p><small>계산 근거 {item.evidence_refs?.length ?? 0}개 연결</small></div></article>)}</div></section>}

    {hasKeyWindows && <section className="ai-key-window-section"><div className="ai-section-heading"><span>중요 날짜 · 시기</span><strong>눈여겨볼 핵심 구간</strong></div><div className="ai-key-window-list">{data.key_windows!.map((item,index)=><article className={`ai-key-window ${signalClass(item.signal)}`} key={`${item.start}-${item.end}-${index}`}><div className="ai-key-window-top"><div><span className="ai-window-date">{periodLabel(item.start,item.end)}</span><strong>{item.label}</strong></div><b>{item.signal}</b></div>{item.topics?.length?<div className="ai-window-topics">{item.topics.map((topic)=><span key={topic}>{topic}</span>)}</div>:null}<p>{item.summary}</p><div className="ai-window-action"><strong>이때</strong><span>{item.action}</span></div>{item.avoid&&<div className="ai-window-avoid"><strong>피할 것</strong><span>{item.avoid}</span></div>}<small>계산 근거 {item.evidence_refs?.length ?? 0}개 검증</small></article>)}</div></section>}

    {hasYearPhases && <section className="ai-year-phase-section"><div className="ai-section-heading"><span>연간 흐름 지도</span><strong>한 해를 4구간으로 보면</strong></div><div className="ai-year-phase-list">{data.year_phases!.map((phase,index)=><article key={`${phase.label}-${index}`}><div><b>{phase.label}</b><span>{periodLabel(phase.start,phase.end)}</span></div><strong>{phase.theme}</strong><p>{phase.change}</p></article>)}</div></section>}

    {data.overall.dominant_pattern && <div className="ai-highlight"><strong>핵심 패턴</strong><span>{data.overall.dominant_pattern}</span></div>}
    {!hasKeyWindows && (data.overall.best_phase || data.overall.caution_phase) ? <div className="ai-phase-fallback"><article><strong>활용 구간</strong><p>{data.overall.best_phase}</p></article><article><strong>주의 구간</strong><p>{data.overall.caution_phase}</p></article></div> : null}

    <div className="ai-cluster-grid">
      {data.clusters.relationship && <div><strong>관계</strong><p>{data.clusters.relationship}</p></div>}
      {data.clusters.work_study && <div><strong>일 · 학업</strong><p>{data.clusters.work_study}</p></div>}
      {data.clusters.money_news && <div><strong>금전 · 소식</strong><p>{data.clusters.money_news}</p></div>}
      {data.clusters.investment && <div><strong>주식 · 투자</strong><p>{data.clusters.investment}</p></div>}
      {data.clusters.condition && <div><strong>컨디션</strong><p>{data.clusters.condition}</p></div>}
    </div>

    {data.contact_flow && (data.contact_flow.incoming || data.contact_flow.outgoing || data.contact_flow.reconnection) && <div className="ai-direction-grid"><article><strong>수신 · 상대 → 나</strong><p>{data.contact_flow.incoming || '뚜렷한 수신 근거가 없어.'}</p></article><article><strong>발신 · 나 → 상대</strong><p>{data.contact_flow.outgoing || '뚜렷한 발신 적합 근거가 없어.'}</p></article><article><strong>과거 인연 · 재접점</strong><p>{data.contact_flow.reconnection || '재접점 근거가 약해.'}</p></article></div>}
    {data.investment_reading && (data.investment_reading.psychology || data.investment_reading.realization || data.investment_reading.entry || data.investment_reading.risk) && <div className="ai-investment-grid"><article><strong>투자심리</strong><p>{data.investment_reading.psychology}</p></article><article><strong>수익실현</strong><p>{data.investment_reading.realization}</p></article><article><strong>신규진입</strong><p>{data.investment_reading.entry}</p></article><article className="is-risk"><strong>투자주의 · 높을수록 경계</strong><p>{data.investment_reading.risk}</p></article></div>}

    {!hasDecisions && !!data.priorities?.length && <div className="ai-priorities"><strong>이 기간 우선순위</strong>{data.priorities.map((item, index)=><p key={`${index}-${item}`}>{index+1}. {item}</p>)}</div>}

    <details className="ai-details"><summary>15개 분야별 정밀 해석 보기</summary><div className="ai-topic-list">{topics.map((topic)=>{
      const item=data.topic_analysis?.[topic]
      if(!item) return null
      return <article key={topic}><div className="ai-topic-title"><strong>{topic}</strong><span>{item.confidence}</span></div><p className="ai-verdict">{item.verdict}</p>{item.reason&&<p><b>근거</b> {item.reason}</p>}{item.timing&&<p><b>시기</b> {item.timing}</p>}{item.action&&<p><b>행동</b> {item.action}</p>}{item.avoid&&<p><b>주의</b> {item.avoid}</p>}{item.evidence_refs?.length?<small className="ai-topic-evidence">검증 근거 {item.evidence_refs.length}개</small>:null}</article>
    })}</div></details>

    <details className="ai-system-note"><summary>체계별 계산 근거</summary>{data.systems.western&&<p><b>Western(서양점성술)</b> {data.systems.western}</p>}{data.systems.saju&&<p><b>사주</b> {data.systems.saju}</p>}{data.systems.thai&&<p><b>Thai(태국점성술)</b> {data.systems.thai}</p>}</details>
    {data.limits && <p className="ai-limits">{data.limits}</p>}
  </section>
}