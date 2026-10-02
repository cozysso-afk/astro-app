import type { ReactNode } from 'react'
import type { AiInterpretationResponse, IntegratedApiResponse, PeriodKey } from './appTypes'
import type { FortuneField } from './lib/fortuneFields'
import type { LoveStatus } from './lib/loveReadingContext'
import { buildFortuneUserSummary } from './lib/fortuneUserSummary'
import { polishFortuneSummary } from './lib/fortuneNarrativePolish'
import { buildFortuneEditorialV3 } from './lib/fortuneEditorialV3'
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

function proseFingerprint(value: string) {
  return String(value ?? '').replace(/[\s.,!?·~→:;()\[\]-]+/g, '').trim()
}

const META_EDITORIAL_RE = /계산\s*근거|기간 전체 운영|선택 기간(?:의)?|상대지수|판정은|같은 기간 안에서|별도 경계 신호|흐름을 계산|흐름을 .*확인하는|확인 단계|평소 리듬|두드러지게 밀어줄 분야|특정 분야 하나로|전 섹터/
const RAW_PERIOD_GUIDANCE_RE = /(?:evidence_refs|applicability|threshold|스키마|클러스터|출력\s*형식)/i

export function editorialCopyUsable(value: string) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text.length >= 12 && !META_EDITORIAL_RE.test(text)
}

export function compactEditorialCopy(value: string) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (!editorialCopyUsable(text)) return ''
  const sentences = (text.match(/[^.!?]+[.!?]?/g) ?? []).map(sentence => sentence.trim()).filter(Boolean)
  if (sentences.length >= 3) return `${sentences[0]} ${sentences[2]}`.trim()
  return sentences.slice(0, 2).join(' ').trim() || text
}


export function focusEditorialParts(value: string) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (!editorialCopyUsable(text)) return null
  const sentences = (text.match(/[^.!?]+[.!?]?/g) ?? []).map(sentence => sentence.trim()).filter(Boolean)
  if (sentences.length < 4) return null
  return {
    conclusion: sentences[0],
    sceneAction: `${sentences[1]} ${sentences[2]}`.trim(),
    change: sentences.slice(3).join(' ').trim(),
  }
}

function overallFallback(summary: ReturnType<typeof polishFortuneSummary>) {
  const concrete = [...summary.favorableCards.slice(0, 1), ...summary.cautionCards.slice(0, 2)]
    .map(item => item.meaning)
    .filter(Boolean)
  const headline = summary.headline || concrete[0] || `${summary.when}은 중요한 한 가지부터 정리해.`
  const supporting = summary.summary || concrete.join(' ')
  return { headline, summary: supporting }
}

export function dedupeHeroSubtitle(summary: string, headline: string) {
  const text = String(summary ?? '').trim()
  const title = String(headline ?? '').trim()
  if (!text || !title) return text
  if (proseFingerprint(text) === proseFingerprint(title)) return ''
  const first = text.match(/^(.+?[.!?])(?:\s|$)/)?.[1]?.trim()
  if (first && proseFingerprint(first) === proseFingerprint(title)) {
    return text.slice(first.length).trim()
  }
  return text
}

function importantWindowStatus(kind?: 'favorable' | 'caution' | 'mixed') {
  if (kind === 'favorable') return '진행 후보'
  if (kind === 'caution') return '확인 필요'
  return '변동 확인'
}

function importantWindowCheck(kind?: 'favorable' | 'caution' | 'mixed') {
  if (kind === 'favorable') return '해볼 일을 하나 정하고 실제 일정·약속·조건이 구체화되는지 확인해.'
  if (kind === 'caution') return '결론부터 내리지 말고 일정·문서·상대 행동처럼 확인 가능한 조건을 다시 봐.'
  return '한 번의 반응보다 다음 행동이 이어지는지 확인해.'
}

export function periodGuidanceText(value: unknown) {
  return String(value ?? '')
    .replace(/\b(?:W|S|T):[^\s),]+/g, '')
    .replace(/\(\s*계산 근거\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function periodGuidanceUsable(value: unknown) {
  const text = periodGuidanceText(value)
  return Boolean(text) && !RAW_PERIOD_GUIDANCE_RE.test(text)
}

function crossCheckModeLabel(value: string) {
  if (value === '복수체계') return '여러 체계에서 함께 확인'
  if (value === '상반맥락') return '체계별 해석이 다름'
  return '서양점성술 단독 근거'
}

function crossCheckModeClass(value: string) {
  if (value === '복수체계') return 'is-multi'
  if (value === '상반맥락') return 'is-tension'
  return 'is-western-only'
}

export function PeriodFortuneNarrativeV2({
  loveStatus: _loveStatus,
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
          .map(window => ({ ...window, topics: (window.topics ?? []).filter(topic => field.topics.includes(topic)) })),
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
  const summary = polishFortuneSummary(base)
  const editorial = buildFortuneEditorialV3(data, calculation, summary, field)
  const fallbackHero = overallFallback(summary)
  const integratedHeroHeadline = verifiedNarrative && !field && editorialCopyUsable(editorial.heroHeadline) ? editorial.heroHeadline : ''
  const integratedHeroSummary = verifiedNarrative && !field && editorialCopyUsable(editorial.heroSummary) ? editorial.heroSummary : ''
  const heroHeadline = integratedHeroHeadline || fallbackHero.headline
  const heroSummary = integratedHeroSummary || fallbackHero.summary
  const heroSubtitle = dedupeHeroSubtitle(heroSummary, heroHeadline)
  const referenceFlowCards = relationshipReferenceFlowCards(summary, calculation)
  const visibleReferenceTopics = summary.referenceTopics.filter(item => !(item.topic === '투자주의' && /약/.test(item.band)))
  const structuredFieldTopics = verifiedNarrative && field
    ? field.topics
      .map(topic => ({ topic, text: editorial.topicEditorial[topic] ?? '' }))
      .filter(item => !['연애','대인관계','연락','재회','투자주의'].includes(item.topic) && editorialCopyUsable(item.text))
    : []
  const showLongPeriodNarrative = verifiedNarrative && !field && (period === 'month' || period === 'year')
  const longPeriodDecisions = showLongPeriodNarrative
    ? (data.decisions ?? []).map((item, index) => ({
        key: `${index}-${periodGuidanceText(item.action)}`,
        action: periodGuidanceUsable(item.action) ? periodGuidanceText(item.action) : '',
        timing: periodGuidanceUsable(item.timing) ? periodGuidanceText(item.timing) : '',
        reason: periodGuidanceUsable(item.reason) ? periodGuidanceText(item.reason) : '',
        watch: periodGuidanceUsable(item.watch) ? periodGuidanceText(item.watch) : '',
        avoid: periodGuidanceUsable(item.avoid) ? periodGuidanceText(item.avoid) : '',
      })).filter(item => Boolean(item.action))
    : []
  const yearPhaseRows = verifiedNarrative && !field && period === 'year'
    ? (data.year_phases ?? []).map((phase, index) => ({
        key: `${index}-${phase.start}-${phase.end}`,
        label: periodGuidanceText(phase.label),
        start: phase.start,
        end: phase.end,
        theme: periodGuidanceUsable(phase.theme) ? periodGuidanceText(phase.theme) : '',
        change: periodGuidanceUsable(phase.change) ? periodGuidanceText(phase.change) : '',
      })).filter(phase => Boolean(phase.label) && Boolean(phase.theme || phase.change))
    : []
  const longPeriodLimit = showLongPeriodNarrative && periodGuidanceUsable(data.limits)
    ? periodGuidanceText(data.limits)
    : ''
  const priorityRows = verifiedNarrative && !field
    ? [...new Set((data.priorities ?? [])
        .filter(periodGuidanceUsable)
        .map(periodGuidanceText))]
      .filter(text => !longPeriodDecisions.some(item => proseFingerprint(item.action) === proseFingerprint(text)))
      .slice(0, 3)
    : []
  const showPriorityRows = priorityRows.length > 0 && (!showLongPeriodNarrative || longPeriodDecisions.length === 0)
  const crossCheckRows = verifiedNarrative && !field
    ? (data.cross_checks ?? []).map((item, index) => ({
        key: `${index}-${item.start}-${item.end}-${item.label}`,
        label: periodGuidanceUsable(item.label) ? periodGuidanceText(item.label) : '같은 시기 교차 확인',
        start: item.start,
        end: item.end,
        modeLabel: crossCheckModeLabel(item.mode),
        modeClass: crossCheckModeClass(item.mode),
        western: periodGuidanceUsable(item.western) ? periodGuidanceText(item.western) : '',
        saju: periodGuidanceUsable(item.saju) ? periodGuidanceText(item.saju) : '',
        thai: periodGuidanceUsable(item.thai) ? periodGuidanceText(item.thai) : '',
        synthesis: periodGuidanceUsable(item.synthesis) ? periodGuidanceText(item.synthesis) : '',
      })).filter(item => Boolean(item.western || item.saju || item.thai || item.synthesis))
    : []
  const topicTone = (topic: string) => summary.cautionFlow.includes(topic)
    ? 'caution'
    : summary.bestFlow.includes(topic)
      ? 'favorable'
      : ['연애','연락','재회'].includes(topic) ? 'love' : 'system'
  const dedicatedRelationshipField = field?.id === 'love' || field?.id === 'social' || field?.id === 'contact'
  const showContactDirectionDetails = Boolean(editorial.contact)
    && !/동률권|같은 값|비교할 계산 정보가 충분하지 않아/.test(editorial.contact?.directionSummary ?? '')

  return <section className="period-ai-card period-ai-v18 period-ai-v2 period-ai-v3 period-ai-v4" data-reading-export-tone={field?.id === 'love' ? 'love' : undefined}>
    <div className="period-ai-head">
      <div>
        <span className="period-ai-kicker">{field?.label ?? '맞춤 운세 해설'} · {summary.when} 핵심</span>
        <span className="reading-period-date" data-reading-export-tone="date">{periodLabel(calculation.period.start, calculation.period.end)}</span>
        <h3 className="period-ai-hero-title-v4">{heroHeadline}</h3>
        {heroSubtitle && <p className="reading-hero-subtitle">{heroSubtitle}</p>}
      </div>
    </div>

    {!field && <div className="reading-flows">
      <h4 className="reading-section-heading">분야별 흐름</h4>
      {!!summary.favorableCards.length && <FortuneFlowCards title={summary.doTitle} items={summary.favorableCards}/>} 
      {!!referenceFlowCards.length && <FortuneFlowCards title="참고할 흐름" items={referenceFlowCards}/>} 
      <FortuneFlowCards title={summary.cautionTitle} items={summary.cautionCards} caution/>
    </div>}

    {field?.id === 'love' && editorial.loveContexts && <section className="love-context-grid-v3" data-reading-export-tone="love">
      <div className="period-ai-section-title"><span>내 상황에 맞춰 읽기</span><strong>애정운을 한 가지 관계 상태로 가정하지 않아</strong></div>
      {editorial.loveGeneral && <p className="love-context-general-v3">{editorial.loveGeneral}</p>}
      <div className="love-context-cards-v3">{editorial.loveContexts.map(item => <article className="love-context-card-v3" key={item.key}>
        <strong>{item.label}</strong><p>{item.text}</p>
      </article>)}</div>
    </section>}

    {field?.id === 'social' && editorial.interpersonal && <section className="interpersonal-reading-v3 interpersonal-reading-v4" data-reading-export-tone="system">
      <div className="period-ai-section-title"><span>대인관계</span><strong>친구·지인, 직장동료, 가족·가까운 사람을 따로 읽어</strong></div>
      <article className="editorial-focus-card-v3"><b>{editorial.interpersonal.summary}</b></article>
      {!!editorial.interpersonalContexts?.length && <div className="love-context-cards-v3 interpersonal-context-cards-v4">{editorial.interpersonalContexts.map(item => <article className="love-context-card-v3 interpersonal-context-card-v4" key={item.key}>
        <strong>{item.label}</strong><p>{item.text}</p>
      </article>)}</div>}
    </section>}

    {field?.id === 'contact' && editorial.contact && <section className="contact-reading-v3" data-reading-export-tone="date">
      <div className="period-ai-section-title"><span>연락·소식</span><strong>대화가 이어지는지와 누가 먼저 움직이는지를 따로 봐</strong></div>
      <article className="editorial-focus-card-v3 contact-activation-v3">
        <strong>연락이 오가는 흐름</strong><b>{editorial.contact.activation}</b><p>{editorial.contact.continuity}</p>
        {editorial.contact.timing && <time>주목 시기 · {editorial.contact.timing}</time>}
      </article>
      <article className="editorial-focus-card-v3 contact-direction-summary-v3"><strong>먼저 움직이는 쪽</strong><b>{editorial.contact.directionSummary}</b></article>
      {showContactDirectionDetails && <ReadingDirections rows={[
        { kind: 'incoming', label: '상대 → 나', band: summary.relationship?.incomingBand, text: editorial.contact.incoming, timing: summary.relationship?.incomingTiming },
        { kind: 'outgoing', label: '나 → 상대', band: summary.relationship?.outgoingBand, text: editorial.contact.outgoing, timing: summary.relationship?.outgoingTiming },
      ]}/>} 
    </section>}

    {!!structuredFieldTopics.length && <section className="period-ai-window-section period-ai-structured-field-v4">
      <div className="period-ai-section-title"><span>{field?.id === 'contact' ? '소식 해설' : '현실에서 더 깊게 보면'}</span><strong>현실 장면 · 행동 · 판단 변경조건</strong></div>
      <div className="period-ai-topic-list">{structuredFieldTopics.map(item => <article className="period-ai-topic period-ai-topic-editorial-v4" data-reading-export-tone={topicTone(item.topic)} key={`editorial-v4-${item.topic}`}>
        <strong>{item.topic}</strong><p>{item.text}</p>
      </article>)}</div>
    </section>}

    {!westernOnly && systemOverview}

    {showPriorityRows && <section className="ai-priorities period-ai-priorities-v4">
      <div className="period-ai-section-title"><span>이번 기간 우선순위</span><strong>먼저 챙길 것</strong></div>
      {priorityRows.map((item, index) => <p key={`priority-v4-${index}-${item}`}><b>{index + 1}</b> {item}</p>)}
    </section>}

    {!!crossCheckRows.length && <section className="ai-cross-check-section period-ai-cross-check-v4">
      <div className="period-ai-section-title"><span>세 체계 교차해설</span><strong>같은 시기를 서로 다른 계산 체계로 확인</strong></div>
      <p className="ai-cross-check-note">세 체계의 점수나 기준을 합산하거나 다수결하지 않고, 각 체계가 같은 시기를 어떻게 설명하는지 나란히 봐.</p>
      <div className="ai-cross-check-list">{crossCheckRows.map(item => <article className={`ai-cross-check ${item.modeClass}`} key={item.key}>
        <div className="ai-cross-check-head"><div><span>{periodLabel(item.start, item.end)}</span><strong>{item.label}</strong></div><b>{item.modeLabel}</b></div>
        <div className="ai-cross-system-lines">
          {item.western && <p><b>서양점성술</b><span>{item.western}</span></p>}
          {item.saju && <p><b>사주</b><span>{item.saju}</span></p>}
          {item.thai && <p><b>태국점성술</b><span>{item.thai}</span></p>}
        </div>
        {item.synthesis && <div className="ai-cross-synthesis"><strong>같이 보면</strong><p>{item.synthesis}</p></div>}
      </article>)}</div>
    </section>}

    {!!yearPhaseRows.length && <section className="ai-year-phase-section period-ai-year-phase-v4" data-reading-export-tone="date">
      <div className="period-ai-section-title"><span>연간 흐름 지도</span><strong>한 해 안에서 분위기가 바뀌는 구간</strong></div>
      <div className="ai-year-phase-list">{yearPhaseRows.map(phase => <article key={phase.key}>
        <div><b>{phase.label}</b><span>{periodLabel(phase.start, phase.end)}</span></div>
        {phase.theme && <strong>{phase.theme}</strong>}
        {phase.change && <p>{phase.change}</p>}
      </article>)}</div>
    </section>}

    {!!longPeriodDecisions.length && <section className="ai-decision-section period-ai-decision-v4">
      <div className="period-ai-section-title"><span>판단 기준</span><strong>이 기간에 실제로 결정할 일</strong></div>
      <div className="ai-decision-list">{longPeriodDecisions.map((item, index) => <article key={item.key}>
        <span className="ai-decision-index">{index + 1}</span><div>
          <strong>{item.action}</strong>
          {item.timing && <b>{item.timing}</b>}
          {item.watch && <div className="ai-decision-condition"><b>다시 볼 조건</b><span>{item.watch}</span></div>}
          {(item.reason || item.avoid) && <details className="ai-decision-more"><summary>이유 · 피할 것</summary>
            {item.reason && <p>{item.reason}</p>}
            {item.avoid && <div className="ai-decision-condition is-avoid"><b>피할 것</b><span>{item.avoid}</span></div>}
          </details>}
        </div>
      </article>)}</div>
    </section>}

    {longPeriodLimit && <section className="period-ai-window-section period-ai-limit-v4">
      <div className="period-ai-section-title"><span>해석 한계</span><strong>여기까지는 단정하지 않아</strong></div>
      <article className="period-ai-window"><p>{longPeriodLimit}</p></article>
    </section>}

    {!!summary.importantWindows.length && <section className="period-ai-quick-dates period-ai-user-windows" data-reading-export-tone="date">
      <div className="period-ai-section-title"><span>기억할 시기</span><strong>날짜별 행동·확인 기준</strong></div>
      <ReadingTimeline events={summary.importantWindows.map(window => ({
        date: window.date,
        kind: window.semantic ?? window.kind ?? 'mixed',
        label: `${window.guidance} ${importantWindowCheck(window.kind)}`.trim(),
        status: importantWindowStatus(window.kind),
      }))}/>
    </section>}

    {!dedicatedRelationshipField && summary.relationship && <section className="period-ai-window-section period-ai-relationship-section" data-reading-export-tone="love">
      <div className="period-ai-section-title"><span>연락 흐름</span></div>
      <article className="period-ai-window period-ai-relationship-summary"><p>{summary.relationship.summary}</p>
        <ReadingDirections rows={[
          { kind: 'incoming', label: '상대가 먼저 오는 흐름', band: summary.relationship.incomingBand, text: summary.relationship.incoming, timing: summary.relationship.incomingTiming },
          { kind: 'outgoing', label: '내가 먼저 연락하기', band: summary.relationship.outgoingBand, text: summary.relationship.outgoing, timing: summary.relationship.outgoingTiming },
          ...(summary.relationship.reconnection ? [{ kind: 'reconnection' as const, label: '과거 인연 재접점', band: summary.relationship.reconnectionBand, text: summary.relationship.reconnection, timing: summary.relationship.reconnectionTiming }] : []),
        ]}/>
      </article>
    </section>}

    {!dedicatedRelationshipField && !!summary.focusTopics.length && <section className="period-ai-window-section period-ai-user-focus">
      <div className="period-ai-section-title"><span>{summary.focusTitle}</span><strong>결론 · 지금 할 일</strong></div>
      <div className="period-ai-topic-list">{summary.focusTopics.map(item => {
        const deepEditorial = verifiedNarrative && !field ? focusEditorialParts(editorial.topicEditorial[item.topic] ?? '') : null
        return <article className="period-ai-topic" data-reading-export-tone={topicTone(item.topic)} key={`v4-${item.topic}`}>
          <strong>{item.topic}</strong>
          <b>{deepEditorial?.conclusion || item.conclusion}</b>
          {deepEditorial ? <>
            <p className="period-ai-topic-editorial-v4">{deepEditorial.sceneAction}</p>
            <p className="period-ai-topic-change-v9"><em>판단 바뀌는 조건</em> {deepEditorial.change}</p>
          </> : <>
            {item.action && <p><em>실제로는</em> {item.action}</p>}
            {item.observe && <p><em>확인할 것</em> {item.observe}</p>}
          </>}
          <details className="reading-topic-depth">
            <summary>왜 이렇게 보나</summary>
            <ReadingExplanation kind="reason">{item.reason}</ReadingExplanation>
            {item.timing && <ReadingExplanation kind="timing">{item.timing}</ReadingExplanation>}
            {item.caution && <ReadingExplanation kind="caution">{item.caution}</ReadingExplanation>}
          </details>
        </article>
      })}</div>
    </section>}

    {!dedicatedRelationshipField && !!visibleReferenceTopics.length && <details className="period-ai-topic-disclosure period-ai-topic-reference-disclosure period-ai-user-reference">
      <summary>다른 분야 보기</summary>
      <div className="period-ai-topic-list">{visibleReferenceTopics.map(item => <article className="period-ai-topic is-reference" data-reading-export-tone={topicTone(item.topic)} key={`v4-ref-${item.topic}`}>
        <strong>{item.topic} · {item.band}</strong><p>{item.detail?.conclusion || item.summary}</p>
      </article>)}</div>
    </details>}

    <details className="period-ai-details" data-reading-export-ignore="true">
      <summary>계산 근거 자세히 보기</summary>
      <div className="period-ai-detail-body">{technicalDetails}</div>
    </details>
  </section>
}