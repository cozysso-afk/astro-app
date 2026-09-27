import type { ReactNode } from 'react'
import type { AiInterpretationResponse, IntegratedApiResponse, PeriodKey } from './appTypes'
import type { FortuneField } from './lib/fortuneFields'
import { applyLoveContext, singleLoveScenarios, type LoveStatus } from './lib/loveReadingContext'
import { buildFortuneUserSummary } from './lib/fortuneUserSummary'
import { polishFortuneSummary } from './lib/fortuneNarrativePolish'
import { normalizeTopicEntries, interpretationHeroEligible } from './lib/interpretationTopics'
import { fortuneAiPrecisionReadiness } from './lib/precisionTransport'
import { topicOrder } from './lib/fortuneTopics'
import { FortuneFlowCards } from './FortuneFlowCards'
import { ReadingDirections, ReadingTimeline } from './ReadingSignals'
import { ReadingExplanation } from './ReadingExplanation'
import { relationshipReferenceFlowCards } from './lib/relationshipReferenceFlow'

function periodLabel(start: string, end: string) {
  if (!start && !end) return ''
  if (!end || start === end) return start
  return `${start} → ${end}`
}

export function PeriodFortuneNarrativeV2({
  loveStatus,
  systemOverview,
  westernOnly = false,
  field,
  period,
  calculation,
  result,
  technicalDetails,
}: {
  loveStatus?: LoveStatus
  systemOverview?: ReactNode
  systemSummary?: string
  westernOnly?: boolean
  field?: FortuneField
  period: PeriodKey
  calculation: IntegratedApiResponse
  result: AiInterpretationResponse
  technicalDetails?: ReactNode
}) {
  if (!result.ok || !result.data) return null

  const data = westernOnly
    ? { ...result.data, cross_checks: [], systems: { western: result.data.systems?.western, saju: '', thai: '' } }
    : result.data
  const importanceRank = (value?: string) => value === '핵심' ? 0 : value === '주목' ? 1 : 2
  const topicEntries = normalizeTopicEntries(data.topic_analysis, topicOrder)
    .filter(([topic]) => !field || field.topics.includes(topic))
    .sort((a, b) => importanceRank(a[1]?.importance) - importanceRank(b[1]?.importance))
  const readiness = fortuneAiPrecisionReadiness(calculation)
  const verifiedNarrative = !westernOnly
    && result.model !== 'deterministic-provisional-v2'
    && !result.usage?.local_quality_fallback
    && interpretationHeroEligible(result.usage?.quality_validation, result.usage)
  const scopedData = field
    ? {
        ...data,
        key_windows: data.key_windows?.filter(window => window.topics?.some(topic => field.topics.includes(topic)))
          .map(window => ({ ...window, topics: window.topics.filter(topic => field.topics.includes(topic)) })),
      }
    : data
  const base = buildFortuneUserSummary(scopedData, {
    verifiedNarrative,
    focusTopics: field?.topics,
    period,
    calculation,
    topicEntries,
    allowIntraday: readiness.ok && readiness.mode === 'exact',
  })
  const contextual = field?.id === 'love' ? applyLoveContext(base, calculation, loveStatus ?? 'single') : base
  const summary = polishFortuneSummary(contextual)
  const referenceFlowCards = relationshipReferenceFlowCards(summary, calculation)

  return <section className="period-ai-card period-ai-v18 period-ai-v2" data-reading-export-tone={field?.id === 'love' ? 'love' : undefined}>
    <div className="period-ai-head">
      <div>
        <span className="period-ai-kicker">{field?.label ?? '맞춤 운세 해설'} · {summary.when} 핵심</span>
        <span className="reading-period-date" data-reading-export-tone="date">{periodLabel(calculation.period.start, calculation.period.end)}</span>
        <h3>{summary.headline}</h3>
        {summary.summary && <p className="reading-hero-subtitle">{summary.summary}</p>}
      </div>
    </div>

    <div className="reading-flows">
      <h4 className="reading-section-heading">한눈에 보는 흐름</h4>
      <FortuneFlowCards title={summary.doTitle} items={summary.favorableCards}/>
      {!!referenceFlowCards.length && <FortuneFlowCards title="참고할 흐름" items={referenceFlowCards}/>} 
      <FortuneFlowCards title={summary.cautionTitle} items={summary.cautionCards} caution/>
    </div>

    {field?.id === 'love' && (loveStatus ?? 'single') === 'single' && <section className="single-love-scenarios" data-reading-export-tone="love">
      <h4>내 상황에 맞춰 읽기</h4>
      <p>특정 상대가 있다고 가정하지 않아. 내 상황에 해당하는 항목만 보면 돼.</p>
      {singleLoveScenarios(calculation).map(item => <details key={item.title}><summary>{item.title}</summary><p>{item.text}</p></details>)}
    </section>}

    {!westernOnly && systemOverview}

    {!!summary.importantWindows.length && <section className="period-ai-quick-dates period-ai-user-windows" data-reading-export-tone="date">
      <div className="period-ai-section-title"><span>기억할 시기</span><strong>활용·주의 구간</strong></div>
      <ReadingTimeline events={summary.importantWindows.map(window => ({
        date: window.date,
        kind: window.semantic ?? window.kind ?? 'mixed',
        label: window.guidance,
        status: window.kind === 'caution' ? '주의' : window.kind === 'favorable' ? '활용' : '혼합',
      }))}/>
    </section>}

    {summary.relationship && <section className="period-ai-window-section period-ai-relationship-section" data-reading-export-tone="love">
      <div className="period-ai-section-title"><span>연락 흐름</span></div>
      <article className="period-ai-window period-ai-relationship-summary"><p>{summary.relationship.summary}</p>
        <ReadingDirections rows={[
          { kind: 'incoming', label: '상대가 먼저 오는 흐름', band: summary.relationship.incomingBand, text: summary.relationship.incoming, timing: summary.relationship.incomingTiming },
          { kind: 'outgoing', label: '내가 먼저 연락하기', band: summary.relationship.outgoingBand, text: summary.relationship.outgoing, timing: summary.relationship.outgoingTiming },
          ...(summary.relationship.reconnection ? [{ kind: 'reconnection' as const, label: '과거 인연 재접점', band: summary.relationship.reconnectionBand, text: summary.relationship.reconnection, timing: summary.relationship.reconnectionTiming }] : []),
        ]}/>
      </article>
    </section>}

    {!!summary.focusTopics.length && <section className="period-ai-window-section period-ai-user-focus">
      <div className="period-ai-section-title"><span>{summary.focusTitle}</span><strong>분야별로 한 번씩만</strong></div>
      <div className="period-ai-topic-list">{summary.focusTopics.map(item => <article className="period-ai-topic" key={`v2-${item.topic}`}>
        <strong>{item.topic}</strong>
        <b>{item.conclusion}</b>
        {item.action && <p><em>실제로는</em> {item.action}</p>}
        {item.observe && <p><em>확인할 것</em> {item.observe}</p>}
        <details className="reading-topic-depth">
          <summary>왜 이렇게 보나</summary>
          <ReadingExplanation kind="reason">{item.reason}</ReadingExplanation>
          {item.timing && <ReadingExplanation kind="timing">{item.timing}</ReadingExplanation>}
          {item.caution && <ReadingExplanation kind="caution">{item.caution}</ReadingExplanation>}
        </details>
      </article>)}</div>
    </section>}

    {!!summary.referenceTopics.length && <details className="period-ai-topic-disclosure period-ai-topic-reference-disclosure period-ai-user-reference">
      <summary>다른 분야 보기</summary>
      <div className="period-ai-topic-list">{summary.referenceTopics.map(item => <article className="period-ai-topic is-reference" key={`v2-ref-${item.topic}`}>
        <strong>{item.topic} · {item.band}</strong><p>{item.detail?.conclusion ?? item.summary}</p>
      </article>)}</div>
    </details>}

    <details className="period-ai-details" data-reading-export-ignore="true">
      <summary>계산 근거 자세히 보기</summary>
      <div className="period-ai-detail-body">{technicalDetails}</div>
    </details>
  </section>
}
