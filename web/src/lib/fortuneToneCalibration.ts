import type { FortuneDailyEvidence, IntegratedApiResponse } from '../appTypes'

export type FortuneEvidenceDirection = 'supportive' | 'challenging' | 'mixed' | 'neutral'

export type FortuneToneAssessment = {
  direction: FortuneEvidenceDirection
  hasSupportiveEvidence: boolean
  hasChallengingEvidence: boolean
  supportiveWeight: number
  challengingWeight: number
  dominantDirection: 'supportive' | 'challenging' | 'balanced' | 'neutral'
}

type CalculationSlice = Pick<IntegratedApiResponse, 'period' | 'western'>

export function evidenceDirection(row: FortuneDailyEvidence) {
  if (row.direction === 'supportive') return 1
  if (row.direction === 'caution' || row.direction === 'challenging') return -1
  if (typeof row.polarity === 'number' && Number.isFinite(row.polarity)) return Math.sign(row.polarity)
  return 0
}

/**
 * Aggregate one physical transit/aspect once for a requested topic. The same
 * slow aspect can be sampled every day, but those samples are not independent
 * evidence. 'direction' in the raw ephemeris is motion (순행/역행), not valence;
 * only polarity (or an explicit supportive/challenging label) sets the sign.
 */

const PLANET_LABEL: Record<string, string> = {
  Sun:'태양', Moon:'달', Mercury:'수성', Venus:'금성', Mars:'화성',
  Jupiter:'목성', Saturn:'토성', Uranus:'천왕성', Neptune:'해왕성', Pluto:'명왕성',
}
const ASPECT_LABEL: Record<string, string> = {
  trine:'삼분위', sextile:'육십분위', square:'사분위',
  opposition:'충', conjunction:'합',
}

export type FortuneEvidenceSnapshot = {
  support?: string
  challenge?: string
  neutral?: string
  dominantDirection: FortuneToneAssessment['dominantDirection']
}

/** Reader-facing evidence with observed dates. Do not claim an actual event happened. */
export function fortuneEvidenceSnapshot(calculation: CalculationSlice, topic: string): FortuneEvidenceSnapshot {
  const leads: Array<{ sign: number; weight: number; date: string; row: FortuneDailyEvidence }> = []
  const seen = new Map<string, number>()
  for (const day of calculation.western.daily_scores ?? []) {
    if (day.date < calculation.period.start || day.date > calculation.period.end) continue
    for (const row of day.evidence ?? []) {
      if (!row.source_topics?.includes(topic) || !row.transit || !row.target || !row.aspect) continue
      const contribution = Number(row.contribution ?? 0)
      if (!Number.isFinite(contribution) || contribution <= 0) continue
      const pol = Number(row.polarity)
      const weight = contribution * (Number.isFinite(pol) ? Math.abs(pol) : 1)
      const sign = evidenceDirection(row)
      const key = [row.transit, row.target, row.aspect, sign].join('|')
      const existing = seen.get(key)
      if (existing !== undefined && leads[existing].weight >= weight) continue
      const record = { sign, weight, date: day.date, row }
      if (existing === undefined) { seen.set(key, leads.length); leads.push(record) }
      else leads[existing] = record
    }
  }
  const display = (entry?: typeof leads[number]) => {
    if (!entry) return undefined
    const {row, date} = entry
    const transit = PLANET_LABEL[row.transit ?? ''] ?? row.transit
    const target = PLANET_LABEL[row.target ?? ''] ?? row.target
    const aspect = ASPECT_LABEL[row.aspect ?? ''] ?? row.aspect
    const phase = /Applying|적용/.test(row.motion ?? '') ? '접근 중'
      : /Separating|분리/.test(row.motion ?? '') ? '분리 중' : ''
    return [transit + '–출생 ' + target + ' ' + aspect, date, phase].filter(Boolean).join(' · ')
  }
  const ranked = leads.sort((a,b)=>b.weight-a.weight)
  const balance = fortuneEvidenceBalance(calculation,topic)
  return {
    support: display(ranked.find(item => item.sign > 0)),
    challenge: display(ranked.find(item => item.sign < 0)),
    neutral: display(ranked.find(item => item.sign === 0)),
    dominantDirection: balance.dominantDirection,
  }
}

export function fortuneEvidenceBalance(calculation: CalculationSlice, topic: string): FortuneToneAssessment {
  const grouped = new Map<string, {support: number; challenge: number}>()
  for (const day of calculation.western.daily_scores ?? []) {
    if (day.date < calculation.period.start || day.date > calculation.period.end) continue
    for (const row of day.evidence ?? []) {
      if (!row.source_topics?.includes(topic)) continue
      const sign = evidenceDirection(row)
      if (!sign) continue
      const amount = Math.abs(Number(row.contribution ?? 0))
      if (!Number.isFinite(amount) || amount <= 0) continue
      const polarity = Number(row.polarity)
      const weight = amount * (Number.isFinite(polarity) ? Math.abs(polarity) : 1)
      if (!weight) continue
      const key = row.transit && row.target && row.aspect
        ? [row.transit, row.target, row.aspect, row.whole_house ?? ''].join('|')
        : [row.text ?? '', day.date].join('|')
      const current = grouped.get(key) ?? {support: 0, challenge: 0}
      if (sign > 0) current.support = Math.max(current.support, weight)
      else current.challenge = Math.max(current.challenge, weight)
      grouped.set(key, current)
    }
  }
  const supportiveWeight = [...grouped.values()].reduce((sum, entry) => sum + entry.support, 0)
  const challengingWeight = [...grouped.values()].reduce((sum, entry) => sum + entry.challenge, 0)
  const hasSupportiveEvidence = supportiveWeight > 0
  const hasChallengingEvidence = challengingWeight > 0
  const direction: FortuneEvidenceDirection = hasSupportiveEvidence && hasChallengingEvidence
    ? 'mixed' : hasSupportiveEvidence ? 'supportive' : hasChallengingEvidence ? 'challenging' : 'neutral'
  // Require a meaningful proportional gap. A mixed configuration is NOT
  // neutral merely because it contains both positive and negative evidence.
  const total = supportiveWeight + challengingWeight
  const tilt = total > 0 ? (supportiveWeight - challengingWeight) / total : 0
  const dominantDirection = !total ? 'neutral'
    : tilt >= 0.25 ? 'supportive'
      : tilt <= -0.25 ? 'challenging'
        : 'balanced'
  return {direction, hasSupportiveEvidence, hasChallengingEvidence, supportiveWeight, challengingWeight, dominantDirection}
}

export function fortuneToneAssessment(calculation: CalculationSlice, topic: string): FortuneToneAssessment {
  return fortuneEvidenceBalance(calculation, topic)
}

export function fortunePresentationTone(
  calculation: CalculationSlice,
  topic: string,
  average: number,
  band = '',
): 'good' | 'steady' | 'caution' {
  if (topic === '투자주의') return average >= 55 || /강|높/.test(band) ? 'caution' : 'steady'
  const { direction, dominantDirection } = fortuneToneAssessment(calculation, topic)
  if (direction === 'supportive' || (direction === 'mixed' && dominantDirection === 'supportive')) return 'good'
  if (direction === 'challenging' || (direction === 'mixed' && dominantDirection === 'challenging')) return 'caution'
  return 'steady'
}

type ToneCopyRow = { topic: string; conclusion?: string; action?: string; change_condition?: string }

function copyKey(value: unknown) {
  return String(value ?? '').replace(/[\s.,!?·~→:;()\[\]-]+/g, '').trim()
}

function tokenOverlap(a: unknown, b: unknown) {
  const left = new Set(String(a ?? '').replace(/[^0-9a-z가-힣]+/gi, ' ').split(' ').filter(token => token.length >= 2))
  const right = new Set(String(b ?? '').replace(/[^0-9a-z가-힣]+/gi, ' ').split(' ').filter(token => token.length >= 2))
  if (!left.size || !right.size) return 0
  return [...left].filter(token => right.has(token)).length / Math.min(left.size, right.size)
}

export function inspectFortuneToneRepetition(rows: ToneCopyRow[]) {
  const issues: string[] = []
  const fields = rows.flatMap(row => [row.conclusion, row.action, row.change_condition].filter((value): value is string => Boolean(value?.trim())))
  const exact = new Map<string, Set<string>>()
  for (const row of rows) for (const value of [row.conclusion, row.action]) {
    const key = copyKey(value)
    if (!key) continue
    exact.set(key, new Set([...(exact.get(key) ?? []), row.topic]))
  }
  if ([...exact.values()].some(topics => topics.size > 1)) issues.push('cross-topic exact duplicate')
  if (fields.filter(value => /확인해[.!]?$/.test(value.trim())).length > 2) issues.push('excessive 확인해 endings')
  if (fields.filter(value => /하지 마[.!]?$/.test(value.trim())).length > 2) issues.push('excessive 하지 마 endings')
  if (rows.length >= 3 && rows.filter(row => /관망/.test(`${row.conclusion ?? ''} ${row.action ?? ''}`)).length === rows.length) issues.push('all topics converge on 관망')
  for (const row of rows) {
    const values = [row.conclusion, row.action, row.change_condition].filter((value): value is string => Boolean(value?.trim()))
    for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) {
      if (copyKey(values[i]) === copyKey(values[j]) || tokenOverlap(values[i], values[j]) >= 0.82) issues.push(`${row.topic}: semantic duplicate fields`)
    }
  }
  return [...new Set(issues)]
}
