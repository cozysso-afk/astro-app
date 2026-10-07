import type { FortuneDailyEvidence, IntegratedApiResponse } from '../appTypes'

export type FortuneEvidenceDirection = 'supportive' | 'challenging' | 'mixed' | 'neutral'

export type FortuneToneAssessment = {
  direction: FortuneEvidenceDirection
  hasSupportiveEvidence: boolean
  hasChallengingEvidence: boolean
}

type CalculationSlice = Pick<IntegratedApiResponse, 'period' | 'western'>

function evidenceDirection(row: FortuneDailyEvidence) {
  if (row.direction === 'supportive') return 1
  if (row.direction === 'caution' || row.direction === 'challenging') return -1
  if (typeof row.polarity === 'number' && Number.isFinite(row.polarity)) return Math.sign(row.polarity)
  return 0
}

export function fortuneToneAssessment(calculation: CalculationSlice, topic: string): FortuneToneAssessment {
  const rows = (calculation.western.daily_scores ?? [])
    .filter(day => day.date >= calculation.period.start && day.date <= calculation.period.end)
    .flatMap(day => day.evidence ?? [])
    .filter(row => row.source_topics?.includes(topic))
  const hasSupportiveEvidence = rows.some(row => evidenceDirection(row) > 0)
  const hasChallengingEvidence = rows.some(row => evidenceDirection(row) < 0)
  const direction = hasSupportiveEvidence && hasChallengingEvidence
    ? 'mixed'
    : hasSupportiveEvidence
      ? 'supportive'
      : hasChallengingEvidence
        ? 'challenging'
        : 'neutral'
  return { direction, hasSupportiveEvidence, hasChallengingEvidence }
}

export function fortunePresentationTone(
  calculation: CalculationSlice,
  topic: string,
  average: number,
  band = '',
): 'good' | 'steady' | 'caution' {
  if (topic === '투자주의') return average >= 55 || /강|높/.test(band) ? 'caution' : 'steady'
  const { direction } = fortuneToneAssessment(calculation, topic)
  if (direction === 'supportive') return 'good'
  if (direction === 'challenging') return 'caution'
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
