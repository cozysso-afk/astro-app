import { AlertTriangle, CheckCircle2, CircleStop, Copy, LoaderCircle, Sparkles } from 'lucide-react'
import type { AiInterpretationResponse } from './appTypes'
import { ANNUAL_SCORE_FOCUS_EVENT } from './AnnualDailyScoresPanel'
import { estimateGeminiUsage } from './lib/aiUsage'
import { buildInterpretationBrief } from './lib/interpretationSummary'

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

function inspectAnnualScore(date: string, topic?: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(ANNUAL_SCORE_FOCUS_EVENT, { detail: { date, topic } }))
}

export function AiInterpretationPanel({ result, loading, error, onRetry, onCopyPrompt, onCancel, canCancel, topics }: {
  result: AiInterpretationResponse | null
  loading: boolean
  error: string
  onRetry: () => void
  onCopyPrompt: () => void
  onCancel: () => void
  canCancel: boolean
  topics: string[]
}) {
  if (loading) return <section className="ai-interpret-card is-loading"><LoaderCircle className="spin" size={22}/><div><span className="eyebrow">AI(인공지능) 해설</span><strong>압축 계산근거로 맞춤 해설 생성 중…</strong><p>정상 경로는 Gemini 1회야. 구조 오류·시간초과·핵심 품질 수선이 필요한 경우에만 최대 2회까지 허용하고 약 2분이 지나면 종료해.</p><div className="ai-v21-controls"><button type="button" onClick={onCopyPrompt}><Copy size={15}/>AI용 프롬프트 복사</button>{canCancel&&<button type="button" className="is-cancel" onClick={onCancel}><CircleStop size={15}/>생성 취소</button>}</div></div></section>
  const failedUsage = estimateGeminiUsage(result?.usage)
  if (error) {
    const quotaLimited = /Gemini HTTP 429|RESOURCE_EXHAUSTED/i.test(error)
    const message = quotaLimited
      ? '운세 계산은 정상 완료됐어. 지금은 Gemini 해설 서버의 크레딧 또는 사용 한도가 소진돼 자연어 해설만 잠시 만들 수 없어. 크레딧이나 한도가 복구된 뒤 다시 시도하면 돼.'
      : error
    return <section className="ai-interpret-card is-error"><AlertTriangle size={20}/><div><span className="eyebrow">AI(인공지능) 해설</span><strong>{quotaLimited ? 'AI 해설 서버 한도를 확인해줘' : 'AI 해설을 아직 붙이지 못했어'}</strong><p>{message}</p>{failedUsage?.total_tokens ? <p className="ai-v21-failed-usage">실패 전 실제 사용량 · 입력 {(failedUsage.prompt_tokens??0).toLocaleString()} · 출력 {(failedUsage.candidate_tokens??0).toLocaleString()} · 사고 {(failedUsage.thought_tokens??0).toLocaleString()} tokens · Gemini 호출 {failedUsage.attempt_count??1}회 · 약 {Math.round(failedUsage.estimated_krw??0).toLocaleString()}원</p> : null}<div className="ai-v21-controls"><button type="button" onClick={onRetry}>{quotaLimited ? '한도 복구 후 다시 시도' : 'AI 해설 다시 시도'}</button><button type="button" onClick={onCopyPrompt}><Copy size={15}/>AI용 프롬프트 복사</button></div></div></section>
  }
  if (!result?.ok || !result.data) return null
  const data = result.data
  const usage = estimateGeminiUsage(result.usage)
  const validation = result.usage?.quality_validation
  const validationPassed = validation?.score === 100 || (!!validation?.stages?.length && validation.stages.every((stage)=>stage.passed))
  const hasDecisions = !!data.decisions?.length
  const hasKeyWindows = !!data.key_windows?.length
  const hasYearPhases = !!data.year_phases?.length
  const hasCrossChecks = !!data.cross_checks?.length
  const importanceRank = (value?: string) => value === '핵심' ? 0 : value === '주목' ? 1 : 2
  const orderedTopics = [...topics].sort((a,b)=>importanceRank(data.topic_analysis?.[a]?.importance)-importanceRank(data.topic_analysis?.[b]?.importance))
  const showRelationshipFocus = ['연애','연락','재회'].some((topic)=>['핵심','주목'].includes(data.topic_analysis?.[topic]?.importance ?? ''))
  const showInvestmentFocus = ['투자심리','수익실현','신규진입','투자주의'].some((topic)=>['핵심','주목'].includes(data.topic_analysis?.[topic]?.importance ?? ''))
  const relationshipReading = data.relationship_reading
  const brief = buildInterpretationBrief(data)

  return <section className="ai-interpret-card">
    <div className="ai-interpret-head"><span className="ai-orb"><Sparkles size={19}/></span><div><span className="eyebrow">Gemini(제미나이) 통합 해설</span><h3>{data.headline || '통합 계산 해설'}</h3><small>실계산 결과 · 월별 변화 · 핵심 날짜를 함께 읽는 해설</small></div></div>

    {validation?.stages?.length ? <div className={`ai-validation-badge ${validationPassed ? 'is-passed' : 'is-partial'}`}><CheckCircle2 size={16}/><strong>{validationPassed ? '5단계 검증 통과' : '해설 검증 결과'}</strong><span>{validation.score ?? 0}/100 · {validation.stages.filter((stage)=>stage.passed).length}/5 단계</span></div> : null}

    {usage?.total_tokens ? <details className="ai-meta-details"><summary>해설 생성 정보</summary><div className="ai-usage-card"><strong>API(응용 프로그램 인터페이스) 사용량</strong><span>입력 {(usage?.prompt_tokens ?? 0).toLocaleString()} · 본문 출력 {(usage?.candidate_tokens ?? 0).toLocaleString()} · 사고 {(usage?.thought_tokens ?? 0).toLocaleString()} token(토큰)</span><b>누적 예상비용 ${Number(usage?.estimated_usd ?? 0).toFixed(4)} ≈ {Math.round(usage?.estimated_krw ?? 0).toLocaleString()}원</b><small>{`실제 Gemini 호출 ${usage.attempt_count??1}회 · 최대 2회 · `}{usage.thai_safety_fallback?'Thai 안전 대체 결과 적용 · ':usage.thai_safety_retry?'Thai 안전 재검증 통과 · ':''}저장 기록 재열람은 재호출이 없으면 0원</small></div></details> : null}

    <div className="ai-overall-block"><span className="ai-section-kicker">한눈에 결론</span><div className="ai-overall-brief"><p><b>핵심 흐름</b><span>{brief.flow}</span></p>{brief.remember&&<p><b>먼저 기억할 것</b><span>{brief.remember}</span></p>}</div></div>

    {hasKeyWindows && <section className="ai-quick-dates"><div className="ai-section-heading"><span>가장 먼저 볼 날짜</span><strong>핵심 시기 TOP 3</strong></div><div className="ai-quick-date-list">{data.key_windows!.slice(0,3).map((item,index)=><button type="button" className={`ai-quick-date ${signalClass(item.signal)}`} key={`quick-${item.start}-${index}`} onClick={()=>inspectAnnualScore(item.start,item.topics?.[0])}><b>{periodLabel(item.start,item.end)}</b><span><strong>{item.label}</strong>{item.topics?.length?<small>{item.topics.slice(0,3).join(' · ')}</small>:null}</span><em>{item.signal}</em></button>)}</div></section>}

    {hasDecisions && <section className="ai-decision-section"><div className="ai-section-heading"><span>먼저 이것부터</span><strong>이 기간에 실제로 할 일</strong></div><div className="ai-decision-list">{data.decisions!.map((item,index)=><article key={`${index}-${item.action}`}><span className="ai-decision-index">{index+1}</span><div><strong>{item.action}</strong>{item.timing&&<b>{item.timing}</b>}{item.watch&&<div className="ai-decision-condition"><b>확인</b><span>{item.watch}</span></div>}<details className="ai-decision-more"><summary>근거 · 주의 보기</summary>{item.reason&&<p>{item.reason}</p>}{item.avoid&&<div className="ai-decision-condition is-avoid"><b>피할 것</b><span>{item.avoid}</span></div>}<small>계산 근거 {item.evidence_refs?.length ?? 0}개 연결</small></details></div></article>)}</div></section>}

    {hasKeyWindows && <section className="ai-key-window-section"><div className="ai-section-heading"><span>중요 날짜 · 시기</span><strong>눈여겨볼 핵심 구간</strong></div><div className="ai-key-window-list">{data.key_windows!.map((item,index)=><article className={`ai-key-window ${signalClass(item.signal)}`} key={`${item.start}-${item.end}-${index}`}><div className="ai-key-window-top"><div><span className="ai-window-date">{periodLabel(item.start,item.end)}</span><strong>{item.label}</strong></div><b>{item.signal}</b></div>{item.topics?.length?<div className="ai-window-topics">{item.topics.map((topic)=><span key={topic}>{topic}</span>)}</div>:null}<p>{item.summary}</p>{!hasDecisions&&item.action&&<div className="ai-window-action"><strong>이때</strong><span>{item.action}</span></div>}{item.avoid&&<div className="ai-window-avoid"><strong>피할 것</strong><span>{item.avoid}</span></div>}<div className="ai-window-footer"><small>계산 근거 {item.evidence_refs?.length ?? 0}개 검증</small><button type="button" onClick={()=>inspectAnnualScore(item.start,item.topics?.[0])}>날짜 점수에서 확인</button></div></article>)}</div></section>}

    {showRelationshipFocus && relationshipReading ? <section className="ai-relationship-section"><div className="ai-section-heading"><span>관계 · 연락 · 재회</span><strong>세 방향을 따로 보면</strong></div><div className="ai-highlight ai-relationship-highlight"><strong>관계 방향 요약</strong><span>{relationshipReading.flow}</span></div>{data.contact_flow && (data.contact_flow.incoming || data.contact_flow.outgoing || data.contact_flow.reconnection) ? <div className="ai-direction-grid ai-relationship-direction"><article><strong>상대 → 나</strong><p>{data.contact_flow.incoming || '뚜렷한 수신 근거가 없어.'}</p></article><article><strong>나 → 상대</strong><p>{data.contact_flow.outgoing || '뚜렷한 발신 적합 근거가 없어.'}</p></article><article><strong>과거 인연 재접점</strong><p>{data.contact_flow.reconnection || '재접점 근거가 약해.'}</p></article></div> : null}<div className="ai-relationship-timing"><b>주목 시기</b><span>{relationshipReading.focus_timing}</span></div><details className="ai-relationship-more"><summary>판단 기준 · 주의 보기</summary><p><b>세 축 기준</b> {relationshipReading.context}</p><p><b>현실에서 확인</b> {relationshipReading.watch}</p><p><b>과대해석 주의</b> {relationshipReading.avoid}</p></details></section> : null}

    {hasYearPhases && <section className="ai-year-phase-section"><div className="ai-section-heading"><span>연간 흐름 지도</span><strong>한 해를 4구간으로 보면</strong></div><div className="ai-year-phase-list">{data.year_phases!.map((phase,index)=><article key={`${phase.label}-${index}`}><div><b>{phase.label}</b><span>{periodLabel(phase.start,phase.end)}</span></div><strong>{phase.theme}</strong><p>{phase.change}</p></article>)}</div></section>}

    {hasCrossChecks && <section className="ai-cross-check-section"><div className="ai-section-heading"><span>체계 교차검증</span><strong>같은 시기를 세 체계가 어떻게 다르게 말하는지</strong></div><p className="ai-cross-check-note">점수를 합산하거나 다수결하지 않고, Western(서양점성술)·사주·Thai(태국점성술)의 독립 근거를 나란히 비교해.</p><div className="ai-cross-check-list">{data.cross_checks!.map((item,index)=><article className={`ai-cross-check ${item.mode==='상반맥락'?'is-tension':item.mode==='Western단독'?'is-western-only':'is-multi'}`} key={`${item.start}-${item.label}-${index}`}><div className="ai-cross-check-head"><div><span>{periodLabel(item.start,item.end)}</span><strong>{item.label}</strong></div><b>{item.mode}</b></div><div className="ai-cross-system-lines"><p><b>Western</b><span>{item.western}</span></p><p><b>사주</b><span>{item.saju}</span></p><p><b>Thai</b><span>{item.thai}</span></p></div><div className="ai-cross-synthesis"><strong>그래서</strong><p>{item.synthesis}</p></div><small>독립 계산 근거 {item.evidence_refs?.length ?? 0}개 연결</small></article>)}</div></section>}

    {!hasKeyWindows && (data.overall.best_phase || data.overall.caution_phase) ? <div className="ai-phase-fallback"><article><strong>활용 구간</strong><p>{data.overall.best_phase}</p></article><article><strong>주의 구간</strong><p>{data.overall.caution_phase}</p></article></div> : null}

    <div className="ai-cluster-grid">
      {!showRelationshipFocus && data.clusters.relationship && <div><strong>관계</strong><p>{data.clusters.relationship}</p></div>}
      {data.clusters.work_study && <div><strong>일 · 학업</strong><p>{data.clusters.work_study}</p></div>}
      {data.clusters.money_news && <div><strong>금전 · 소식</strong><p>{data.clusters.money_news}</p></div>}
      {data.clusters.investment && <div><strong>주식 · 투자</strong><p>{data.clusters.investment}</p></div>}
      {data.clusters.condition && <div><strong>컨디션</strong><p>{data.clusters.condition}</p></div>}
    </div>

    {showInvestmentFocus && data.investment_reading && (data.investment_reading.psychology || data.investment_reading.realization || data.investment_reading.entry || data.investment_reading.risk) && <div className="ai-investment-grid"><article><strong>투자심리</strong><p>{data.investment_reading.psychology}</p></article><article><strong>수익실현</strong><p>{data.investment_reading.realization}</p></article><article><strong>신규진입</strong><p>{data.investment_reading.entry}</p></article><article className="is-risk"><strong>투자주의 · 높을수록 경계</strong><p>{data.investment_reading.risk}</p></article></div>}

    {!hasDecisions && !!data.priorities?.length && <div className="ai-priorities"><strong>이 기간 우선순위</strong>{data.priorities.map((item, index)=><p key={`${index}-${item}`}>{index+1}. {item}</p>)}</div>}

    <details className="ai-overall-raw-details"><summary>수치 포함 전체 계산 요약 보기</summary><p>{data.overall.summary}</p></details>

    <details className="ai-details"><summary>15개 분야별 정밀 해석 보기 · 중요도순</summary><div className="ai-topic-list">{orderedTopics.map((topic)=>{
      const item=data.topic_analysis?.[topic]
      if(!item) return null
      return <article key={topic}><div className="ai-topic-title"><strong>{topic}</strong><span>{item.importance} · {item.confidence}</span></div><p className="ai-verdict">{item.verdict}</p>{item.reason&&<p><b>근거</b> {item.reason}</p>}{item.timing&&<p><b>시기</b> {item.timing}</p>}{item.action&&<p><b>행동</b> {item.action}</p>}{item.avoid&&<p><b>주의</b> {item.avoid}</p>}{item.evidence_refs?.length?<small className="ai-topic-evidence">검증 근거 {item.evidence_refs.length}개</small>:null}</article>
    })}</div></details>

    <div className="ai-v21-controls ai-v21-controls-success"><button type="button" onClick={onCopyPrompt}><Copy size={15}/>같은 압축 프롬프트 복사</button></div>
    <details className="ai-system-note"><summary>체계별 계산 근거</summary>{data.systems.western&&<p><b>Western(서양점성술)</b> {data.systems.western}</p>}{data.systems.saju&&<p><b>사주</b> {data.systems.saju}</p>}{data.systems.thai&&<p><b>Thai(태국점성술)</b> {data.systems.thai}</p>}</details>
    {data.limits && <p className="ai-limits">{data.limits}</p>}
  </section>
}
