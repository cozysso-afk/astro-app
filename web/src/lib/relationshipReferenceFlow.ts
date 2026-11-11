import { finiteLevel } from './fortuneUserSummary'
import type { IntegratedApiResponse } from '../appTypes'
import type { FortuneFlowCard, FortuneUserSummary } from './fortuneUserSummary'

export function reunionContactReference(calculation: IntegratedApiResponse): string | undefined {
  const overall = calculation.western.overall
  const reunion = overall?.['재회']
  if (!reunion || !Number.isFinite(reunion.average) || reunion.average < 55) return
  const contact = overall?.['연락']
  const signals = calculation.western.relationship_signals
  const incoming = signals?.['수신신호']
  const outgoing = signals?.['발신적합']
  let contactText: string
  if (contact && finiteLevel(contact) === 'low') {
    contactText = `연락 지표는 ${contact.average}점으로 약해.`
  } else if (incoming && outgoing && finiteLevel(incoming) === 'low' && finiteLevel(outgoing) === 'low') {
    contactText = `연락을 받을 흐름은 ${incoming.average}점, 먼저 연락할 흐름은 ${outgoing.average}점으로 둘 다 약해.`
  } else {
    return
  }
  return `과거 인연과 다시 연결될 조건은 ${reunion.average}점이야. ${contactText} 이미 연락이 닿았다면 그 뒤에도 서로 대화를 이어가는지 살펴봐. 연락이 끊긴 상태라면 이 점수만 보고 먼저 연락할 이유는 없어.`
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

  if (!reunionContactReference(calculation)) return []

  return [{
    topic: '재회',
    score: score!,
    band: stat?.band ?? '보통',
    meaning: '관계 회복 흐름은 있으나 실제 연락 흐름은 약함 · 행동 추천 보류',
  }]
}
