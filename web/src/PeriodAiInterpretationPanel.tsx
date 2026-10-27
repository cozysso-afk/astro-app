import type { ReactNode } from 'react'
import { CircleStop, LoaderCircle, Sparkles } from 'lucide-react'
import type { AiInterpretationResponse, IntegratedApiResponse, PeriodKey } from './appTypes'
import type { LoveStatus } from './lib/loveReadingContext'
import type { FortuneField } from './lib/fortuneFields'
import type { ExternalCopyMode } from './lib/compactDeepPrompt'
import { estimateGeminiUsage } from './lib/aiUsage'
import { periodAiCostPreview } from './lib/aiCostPreview'
import { ExternalPromptCopy } from './ExternalPromptCopy'
import { PeriodFortuneNarrativeV2 } from './PeriodFortuneNarrativeV2'

export function visibleTopicDepth(conclusion: string, observe?: string) {
  const base = String(conclusion ?? '').trim()
  const detail = String(observe ?? '').trim()
  if (!detail || detail === base) return ''
  const sentenceCount = (base.match(/[.!?](?=\s|$)/g) ?? []).length
  return base.length < 120 && sentenceCount < 2 ? detail : ''
}

export function PeriodAiInterpretationPanel({
  loveStatus,
  systemOverview,
  systemSummary,
  westernOnly = false,
  field,
  period,
  calculation,
  result,
  loading,
  error,
  onRetry,
  onCopyPrompt,
  onCancel,
  canCancel,
  technicalDetails,
}: {
  loveStatus?: LoveStatus
  systemOverview?: ReactNode
  systemSummary?: string
  westernOnly?: boolean
  field?: FortuneField
  technicalDetails?: ReactNode
  period: PeriodKey
  calculation: IntegratedApiResponse
  result: AiInterpretationResponse | null
  loading: boolean
  error: string
  cacheSource: 'local' | 'server' | 'fresh' | ''
  onRetry: () => void
  onCopyPrompt: (mode?: ExternalCopyMode) => void
  onCancel: () => void
  canCancel: boolean
}) {
  const costPreview = periodAiCostPreview(period)
  const technicalFallback = technicalDetails
    ? <details className="period-ai-details"><summary>계산 근거 자세히 보기</summary>{technicalDetails}</details>
    : null

  if (!loading && !error && (!result || !result.data)) {
    return <>
      <section className="period-ai-card period-ai-ready">
        <div className="period-ai-head"><span className="period-ai-orb"><Sparkles size={18}/></span><div><span className="period-ai-kicker">운세 해설</span><h3>자연어 해설 준비됨</h3></div></div>
        <p className="period-ai-summary">계산은 끝났어. 검증된 Gemini 해설이 저장되어 있지 않으면 여기서 불러올 수 있어.</p>
        <p className="ai-preflight-cost">{costPreview}</p>
        <div className="period-ai-v21-controls period-ai-ready-controls"><button className="period-ai-generate" type="button" onClick={onRetry}><Sparkles size={15}/>해설 생성</button><ExternalPromptCopy onCopy={onCopyPrompt}/></div>
      </section>
      {technicalFallback}
    </>
  }

  if (loading && !result) {
    return <>
      <section className="period-ai-card is-loading"><LoaderCircle className="spin" size={21}/><div><span className="period-ai-kicker">운세 해설</span><h3>운세 흐름을 정리하고 있어…</h3><p className="period-ai-summary">잠시만 기다려줘. 오래 걸리면 자동으로 중단하고 다시 시도할 수 있게 알려줄게.</p><p className="ai-preflight-cost">{costPreview}</p><div className="period-ai-v21-controls"><ExternalPromptCopy onCopy={onCopyPrompt}/>{canCancel && <button type="button" className="is-cancel" onClick={onCancel}><CircleStop size={15}/>생성 취소</button>}</div></div></section>
      {technicalFallback}
    </>
  }

  if (error && !result?.data) {
    const failedUsage = estimateGeminiUsage(result?.usage)
    const quotaLimited = /Gemini HTTP 429|RESOURCE_EXHAUSTED/i.test(error)
    const message = quotaLimited
      ? '운세 계산은 정상 완료됐어. 지금은 해설 서버의 사용 한도가 소진돼 자연어 해설만 잠시 만들 수 없어. 한도가 복구된 뒤 다시 불러오면 계산 결과는 그대로 이어서 해설할 수 있어.'
      : error
    return <>
      <section className="period-ai-card"><span className="period-ai-kicker">운세 해설</span><h3>{quotaLimited ? '해설 서버 한도를 확인해줘' : '자연어 해설을 아직 불러오지 못했어'}</h3><p className="period-ai-summary">{message}</p>{failedUsage?.total_tokens ? <p className="period-ai-failed-usage">실패 전 실제 사용량 · 입력 {(failedUsage.prompt_tokens ?? 0).toLocaleString()} · 출력 {(failedUsage.candidate_tokens ?? 0).toLocaleString()} · 사고 {(failedUsage.thought_tokens ?? 0).toLocaleString()} tokens · 호출 {failedUsage.attempt_count ?? 1}회 · 약 {Math.round(failedUsage.estimated_krw ?? 0).toLocaleString()}원</p> : null}<div className="period-ai-v21-controls"><button className="period-ai-retry" type="button" onClick={onRetry}>{quotaLimited ? '한도 복구 후 다시 확인' : '해설 다시 확인'}</button><ExternalPromptCopy onCopy={onCopyPrompt}/></div></section>
      {technicalFallback}
    </>
  }

  if (!result?.ok || !result.data) return technicalFallback

  return <PeriodFortuneNarrativeV2
    loveStatus={loveStatus}
    systemOverview={systemOverview}
    systemSummary={systemSummary}
    westernOnly={westernOnly}
    field={field}
    period={period}
    calculation={calculation}
    result={result}
    technicalDetails={technicalDetails}
  />
}
