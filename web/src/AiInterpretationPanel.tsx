import { AlertTriangle, LoaderCircle, Sparkles } from 'lucide-react'
import type { AiInterpretationResponse } from './appTypes'
import { estimateGeminiUsage } from './lib/aiUsage'

export function AiInterpretationPanel({ result, loading, error, onRetry, topics }: {
  result: AiInterpretationResponse | null
  loading: boolean
  error: string
  onRetry: () => void
  topics: string[]
}) {
  if (loading) return <section className="ai-interpret-card is-loading"><LoaderCircle className="spin" size={22}/><div><span className="eyebrow">AI(인공지능) 해설</span><strong>Gemini가 서버에서 정밀해석 중…</strong><p>앱을 닫거나 다른 앱으로 이동해도 서버 작업은 계속돼. 돌아오면 완료된 리딩을 자동으로 이어받아.</p></div></section>
  if (error) return <section className="ai-interpret-card is-error"><AlertTriangle size={20}/><div><span className="eyebrow">AI(인공지능) 해설</span><strong>AI 해설을 아직 붙이지 못했어</strong><p>{error}</p><button type="button" onClick={onRetry}>AI 해설 다시 시도</button></div></section>
  if (!result?.ok || !result.data) return null
  const data = result.data
  const usage = estimateGeminiUsage(result.usage)
  return <section className="ai-interpret-card">
    <div className="ai-interpret-head"><span className="ai-orb"><Sparkles size={19}/></span><div><span className="eyebrow">Gemini(제미나이) 통합 해설</span><h3>{data.headline || '통합 계산 해설'}</h3><small>실계산 결과를 바탕으로 한 자연어 해설</small></div></div>
    {usage?.total_tokens ? <details className="ai-meta-details"><summary>해설 생성 정보</summary><div className="ai-usage-card"><strong>API(응용 프로그램 인터페이스) 사용량</strong><span>입력 {(usage?.prompt_tokens ?? 0).toLocaleString()} · 본문 출력 {(usage?.candidate_tokens ?? 0).toLocaleString()} · 사고 {(usage?.thought_tokens ?? 0).toLocaleString()} token(토큰)</span><b>누적 예상비용 ${Number(usage?.estimated_usd ?? 0).toFixed(4)} ≈ {Math.round(usage?.estimated_krw ?? 0).toLocaleString()}원</b><small>{(usage.attempt_count??1)>1?`${usage.attempt_count}회 생성 시도 합산 · `:''}{usage.thai_safety_fallback?'Thai 안전 대체 결과 적용 · ':usage.thai_safety_retry?'Thai 안전 재검증 통과 · ':''}저장 기록 재열람은 재호출이 없으면 0원</small></div></details> : null}
    <p className="ai-summary">{data.overall.summary}</p>
    {data.overall.dominant_pattern && <div className="ai-highlight"><strong>핵심 패턴</strong><span>{data.overall.dominant_pattern}</span></div>}
    <div className="ai-cluster-grid">
      {data.clusters.relationship && <div><strong>관계</strong><p>{data.clusters.relationship}</p></div>}
      {data.clusters.work_study && <div><strong>일 · 학업</strong><p>{data.clusters.work_study}</p></div>}
      {data.clusters.money_news && <div><strong>금전 · 소식</strong><p>{data.clusters.money_news}</p></div>}
      {data.clusters.investment && <div><strong>주식 · 투자</strong><p>{data.clusters.investment}</p></div>}
      {data.clusters.condition && <div><strong>컨디션</strong><p>{data.clusters.condition}</p></div>}
    </div>
    {data.contact_flow && (data.contact_flow.incoming || data.contact_flow.outgoing || data.contact_flow.reconnection) && <div className="ai-direction-grid"><article><strong>수신 · 상대 → 나</strong><p>{data.contact_flow.incoming || '뚜렷한 수신 근거가 없어.'}</p></article><article><strong>발신 · 나 → 상대</strong><p>{data.contact_flow.outgoing || '뚜렷한 발신 적합 근거가 없어.'}</p></article><article><strong>과거 인연 · 재접점</strong><p>{data.contact_flow.reconnection || '재접점 근거가 약해.'}</p></article></div>}
    {data.investment_reading && (data.investment_reading.psychology || data.investment_reading.realization || data.investment_reading.entry || data.investment_reading.risk) && <div className="ai-investment-grid"><article><strong>투자심리</strong><p>{data.investment_reading.psychology}</p></article><article><strong>수익실현</strong><p>{data.investment_reading.realization}</p></article><article><strong>신규진입</strong><p>{data.investment_reading.entry}</p></article><article className="is-risk"><strong>투자주의 · 높을수록 경계</strong><p>{data.investment_reading.risk}</p></article></div>}
    {!!data.priorities?.length && <div className="ai-priorities"><strong>이 기간 우선순위</strong>{data.priorities.map((item, index)=><p key={`${index}-${item}`}>{index+1}. {item}</p>)}</div>}
    <details className="ai-details" open><summary>분야별 정밀 해석</summary><div className="ai-topic-list">{topics.map((topic)=>{
      const item=data.topic_analysis?.[topic]
      if(!item) return null
      return <article key={topic}><div className="ai-topic-title"><strong>{topic}</strong><span>{item.confidence}</span></div><p className="ai-verdict">{item.verdict}</p>{item.reason&&<p><b>근거</b> {item.reason}</p>}{item.timing&&<p><b>시기</b> {item.timing}</p>}{item.action&&<p><b>행동</b> {item.action}</p>}{item.avoid&&<p><b>주의</b> {item.avoid}</p>}</article>
    })}</div></details>
    <details className="ai-system-note"><summary>체계별 계산 근거</summary>{data.systems.western&&<p><b>Western(서양점성술)</b> {data.systems.western}</p>}{data.systems.saju&&<p><b>사주</b> {data.systems.saju}</p>}{data.systems.thai&&<p><b>Thai(태국점성술)</b> {data.systems.thai}</p>}</details>
    {data.limits && <p className="ai-limits">{data.limits}</p>}
  </section>
}
