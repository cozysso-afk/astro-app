import { CheckCircle2, LoaderCircle } from 'lucide-react'
import type { AiInterpretationResponse } from './appTypes'
import { estimateGeminiUsage } from './lib/aiUsage'

export function PeriodAiInterpretationPanel({ result, loading, error, cacheSource, onRetry }: {
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
    {usage?.total_tokens ? <div className="period-ai-cost"><span>해설 생성 누적 · 입력 {(usage.prompt_tokens??0).toLocaleString()} / 출력 {(usage.candidate_tokens??0).toLocaleString()} / 사고 {(usage.thought_tokens??0).toLocaleString()} tokens</span><b>${Number(usage.estimated_usd??0).toFixed(4)} ≈ {Math.round(usage.estimated_krw??0).toLocaleString()}원</b><small>{(usage.attempt_count??1)>1?`${usage.attempt_count}회 생성 시도 합산 · `:''}{usage.thai_safety_fallback?'Thai 안전 대체 결과 · ':usage.thai_safety_retry?'Thai 안전 재검증 통과 · ':''}저장본 재조회 비용 0원</small></div> : null}
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
