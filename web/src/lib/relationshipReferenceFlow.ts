import type { IntegratedApiResponse } from '../appTypes'
import type { FortuneFlowCard, FortuneUserSummary } from './fortuneUserSummary'

function reconnectionCopy(summary: FortuneUserSummary) {
  const reference = summary.referenceTopics.find(item => item.topic === '재회')
  const focus = summary.focusTopics.find(item => item.topic === '재회')
  return [
    reference?.summary,
    reference?.detail?.conclusion,
    focus?.conclusion,
    summary.relationship?.reconnection,
  ].filter(Boolean).join(' ')
}

/**
 * Keep a reunion score visible when the interpretation guard suppresses it from
 * actionable favorable cards because actual contact is weak. The raw score is
 * not changed; only recommendation eligibility is separated from visibility.
 */
export function relationshipReferenceFlowCards(
  summary: FortuneUserSummary,
  calculation: IntegratedApiResponse,
): FortuneFlowCard[] {
  const stat = calculation.western.overall?.['재회']
  const score = stat?.average
  if (!Number.isFinite(score) || score! < 55) return []
  if (summary.favorableCards.some(item => item.topic === '재회')) return []
  if (summary.cautionCards.some(item => item.topic === '재회')) return []

  const copy = reconnectionCopy(summary)
  const suppressedForWeakContact = /실제 연락(?:\s*(?:움직임|전체 흐름|흐름))?[^.]{0,24}약|연락 전체 흐름[^.]{0,16}약/.test(copy)
  if (!suppressedForWeakContact) return []

  return [{
    topic: '재회',
    score: score!,
    band: stat?.band ?? '보통',
    meaning: '관계 회복 흐름은 있으나 실제 연락 흐름은 약함 · 행동 추천 보류',
  }]
}
