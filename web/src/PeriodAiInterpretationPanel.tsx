import { CheckCircle2, LoaderCircle, Sparkles } from 'lucide-react'
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

export function PeriodAiInterpretationPanel({ result, loading, error, cacheSource, onRetry }: {
  result: AiInterpretationResponse | null
  loading: boolean
  error: string
  cacheSource: 'local' | 'server' | 'fresh' | ''
  onRetry: () => void
}) {
  if (loading && !result) return <section className="period-ai-card is-loading"><LoaderCircle className="spin" size={21}/><div><span className="period-ai-kicker">GEMINI PERIOD READING</span><h3>계산근거를 대조해 해설하는 중…</h3><p className="period-ai-summary">점수·핵심 시기·사주·Thai 맥락을 확인하고 5단계 검증까지 통과한 결과만 보여줄게.</p></div></section>
  if (error && !result) return <section className="period-ai-card"><span className="period-ai-kicker">GEMINI PERIOD READING</span><h3>자연어 해설을 아직 불러오지 못했어</h3><p className="period-ai-summary">{error}</p><button className="period-ai-retry" type="button" onClick={onRetry}>해설 다시 확인</button></section>
  if (!result?.ok || !result.data) return null

  const data = result.data
  const usage = estimateGeminiUsage(result.usage)
  const cached = cacheSource === 'local' || cacheSource === 'server'
  const validation = result.usage?.quality_validation
  const validationPassed = validation?.score === 100 || (!!validation?.stages?.length && validation.stages.every((stage)=>stage.passed))
  const decisions = data.decisions ?? []
  const keyWindows = data.key_windows ?? []
  const crossChecks = data.cross_checks ?? []
  const importanceRank = (value?: string) => value === '핵심' ? 0 : value === '주목' ? 1 : 2
  const topicEntries = Object.entries(data.topic_analysis ?? {}).sort((a,b)=>importanceRank(a[1]?.importance)-importanceRank(b[1]?.importance))
  const showRelationshipFocus = ['연애','연락','재회'].some((topic)=>['핵심','주목'].includes(data.topic_analysis?.[topic]?.importance ?? ''))
  const relationshipReading = data.relationship_reading

  return <section className="period-ai-card period-ai-v18">
    <div className="period-ai-head"><span className="period-ai-orb"><Sparkles size={18}/></span><div><span className="period-ai-kicker">GEMINI PERIOD READING</span><h3>{data.headline || '기간 흐름 요약'}</h3></div></div>
    <p className="period-ai-summary">{data.overall.summary}</p>

    {validation?.stages?.length ? <div className={`period-ai-validation ${validationPassed ? 'is-passed' : 'is-partial'}`}><CheckCircle2 size={15}/><strong>{validationPassed ? '5단계 검증 통과' : '해설 검증 결과'}</strong><span>{validation.score ?? 0}/100</span></div> : null}

    {showRelationshipFocus && relationshipReading ? <section className="period-ai-window-section"><div className="period-ai-section-title"><span>관계 · 연락 · 재회</span><strong>관계 흐름을 먼저 보면</strong></div><article className="period-ai-window is-mixed"><p>{relationshipReading.context}</p><div className="period-ai-window-line"><b>이어지는 흐름</b><span>{relationshipReading.flow}</span></div><div className="period-ai-window-line"><b>주목 시기</b><span>{relationshipReading.focus_timing}</span></div><div className="period-ai-window-line"><b>현실에서 확인</b><span>{relationshipReading.watch}</span></div><div className="period-ai-window-line is-avoid"><b>과대해석 주의</b><span>{relationshipReading.avoid}</span></div>{data.contact_flow ? <><div className="period-ai-window-line"><b>상대 → 나</b><span>{data.contact_flow.incoming}</span></div><div className="period-ai-window-line"><b>나 → 상대</b><span>{data.contact_flow.outgoing}</span></div><div className="period-ai-window-line"><b>과거 인연</b><span>{data.contact_flow.reconnection}</span></div></> : null}</article></section> : null}

    {!!decisions.length && <section className="period-ai-action-section">
      <div className="period-ai-section-title"><span>먼저 이것부터</span><strong>이 기간에 실제로 할 일</strong></div>
      <div className="period-ai-actions">{decisions.slice(0,4).map((item,index)=><article key={`${index}-${item.action}`}>
        <span className="period-ai-action-index">{index+1}</span>
        <div><strong>{item.action}</strong>{item.timing&&<b className="period-ai-action-time">{item.timing}</b>}<p>{item.reason}</p>{item.watch&&<p className="period-ai-condition"><b>확인</b><span>{item.watch}</span></p>}{item.avoid&&<p className="period-ai-condition is-avoid"><b>피할 것</b><span>{item.avoid}</span></p>}</div>
      </article>)}</div>
    </section>}

    {!!keyWindows.length ? <section className="period-ai-window-section">
      <div className="period-ai-section-title"><span>중요 시기</span><strong>눈여겨볼 날짜 · 구간</strong></div>
      <div className="period-ai-windows">{keyWindows.slice(0,6).map((item,index)=><article className={`period-ai-window ${signalClass(item.signal)}`} key={`${item.start}-${item.end}-${index}`}>
        <div className="period-ai-window-head"><div><b>{periodLabel(item.start,item.end)}</b><strong>{item.label}</strong></div><span>{item.signal}</span></div>
        {!!item.topics?.length && <div className="period-ai-window-topics">{item.topics.map((topic)=><span key={topic}>{topic}</span>)}</div>}
        <p>{item.summary}</p>
        {item.action&&<div className="period-ai-window-line"><b>이때</b><span>{item.action}</span></div>}
        {item.avoid&&<div className="period-ai-window-line is-avoid"><b>피할 것</b><span>{item.avoid}</span></div>}
      </article>)}</div>
    </section> : <div className="period-ai-chips">
      {data.overall.best_phase && <span className="period-ai-chip">활용 흐름 · {data.overall.best_phase}</span>}
      {data.overall.caution_phase && <span className="period-ai-chip">주의 흐름 · {data.overall.caution_phase}</span>}
    </div>}

    <div className="period-ai-cache-note"><CheckCircle2 size={14}/><span>{cached ? '저장된 검증 해설 조회 · 이번 Gemini API 재호출 0회' : '최초 검증 해설 자동 저장 · 같은 계산값 재조회는 Gemini API 0회'}</span></div>

    <details className="period-ai-details">
      <summary>분야별 · 체계별 상세 해설 보기</summary>
      <div className="period-ai-detail-body">
        {data.overall.dominant_pattern && <div className="period-ai-section"><strong>기간을 관통하는 패턴</strong><p>{data.overall.dominant_pattern}</p></div>}
        <div className="period-ai-section"><strong>분야별 종합</strong><p>{[data.clusters.relationship&&`관계 · ${data.clusters.relationship}`,data.clusters.work_study&&`일·학업 · ${data.clusters.work_study}`,data.clusters.money_news&&`돈·소식 · ${data.clusters.money_news}`,data.clusters.investment&&`투자 · ${data.clusters.investment}`,data.clusters.condition&&`컨디션 · ${data.clusters.condition}`].filter(Boolean).join('\n\n')}</p></div>
        {!!data.priorities?.length && <div className="period-ai-section"><strong>우선순위</strong><p>{data.priorities.map((item,index)=>`${index+1}. ${item}`).join('\n')}</p></div>}

        {!!crossChecks.length && <div className="period-ai-section period-ai-cross-section"><strong>체계 교차검증</strong><p className="period-ai-cross-note">세 체계를 합산하거나 다수결하지 않고 같은 시기의 독립 근거를 비교해.</p><div className="period-ai-cross-list">{crossChecks.map((item,index)=><article key={`${item.start}-${item.label}-${index}`}><div><b>{periodLabel(item.start,item.end)}</b><span>{item.mode}</span></div><strong>{item.label}</strong><p><b>Western</b> {item.western}</p><p><b>사주</b> {item.saju}</p><p><b>Thai</b> {item.thai}</p><p className="period-ai-cross-synthesis"><b>그래서</b> {item.synthesis}</p></article>)}</div></div>}

        <details className="period-ai-topic-disclosure"><summary>15개 분야별 해석 펼치기 · 중요도순</summary><div className="period-ai-topic-list">{topicEntries.map(([topic,item])=><article className="period-ai-topic" key={topic}><strong>{topic} · {item.importance}</strong><b>{item.verdict}</b>{item.reason&&<p>근거 · {item.reason}</p>}{item.timing&&<p>시기 · {item.timing}</p>}{item.action&&<p>활용 · {item.action}</p>}{item.avoid&&<p>피할 것 · {item.avoid}</p>}<p>확신도 · {item.confidence}{item.confidence_reason?` · ${item.confidence_reason}`:''}</p></article>)}</div></details>

        <div className="period-ai-section"><strong>체계별 계산 해설</strong><p>{[data.systems?.western&&`서양점성술 · ${data.systems.western}`,data.systems?.saju&&`사주 · ${data.systems.saju}`,data.systems?.thai&&`태국점성술 · ${data.systems.thai}`].filter(Boolean).join('\n\n')}</p></div>
        {data.limits && <div className="period-ai-section"><strong>해설 한계</strong><p>{data.limits}</p></div>}
      </div>
    </details>

    {usage?.total_tokens ? <details className="period-ai-meta"><summary>해설 생성 정보 · 비용</summary><div className="period-ai-cost"><span>입력 {(usage.prompt_tokens??0).toLocaleString()} · 출력 {(usage.candidate_tokens??0).toLocaleString()} · 사고 {(usage.thought_tokens??0).toLocaleString()} tokens</span><b>${Number(usage.estimated_usd??0).toFixed(4)} ≈ {Math.round(usage.estimated_krw??0).toLocaleString()}원</b><small>{(usage.attempt_count??1)>1?`${usage.attempt_count}회 생성 시도 합산 · `:''}{usage.thai_safety_fallback?'Thai 안전 대체 결과 · ':usage.thai_safety_retry?'Thai 안전 재검증 통과 · ':''}저장본 재조회 비용 0원</small></div></details> : null}
  </section>
}
