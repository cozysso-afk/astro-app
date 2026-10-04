export type V23PeriodKind = 'day' | 'week' | 'month' | 'annual'

const LIMITS: Record<V23PeriodKind, { full: number; compact: number }> = {
  // Production telemetry on 2026-10-04 still exhausted the first headroom bump:
  // full: candidate 5,383 + thinking 802 = 6,185 at a 6,200 ceiling.
  // compact fallback: candidate 5,585 at a 5,600 ceiling.
  // Earlier 7,200 daily canary telemetry also finished by MAX_TOKENS, so give day
  // only the next small safety step while leaving week/month/annual unchanged.
  day: { full: 8200, compact: 7000 },
  week: { full: 7000, compact: 6200 },
  month: { full: 8000, compact: 7000 },
  annual: { full: 10000, compact: 8200 },
}

function normalizeKind(value: unknown): V23PeriodKind {
  const kind = String(value ?? '').toLowerCase()
  if (kind === 'day' || kind === 'today' || kind === 'daily') return 'day'
  if (kind === 'week' || kind === 'weekly') return 'week'
  if (kind === 'month' || kind === 'monthly') return 'month'
  return 'annual'
}

export function v23OutputTokenLimit(kind: unknown, compact = false) {
  const row = LIMITS[normalizeKind(kind)]
  return compact ? row.compact : row.full
}

export function v23FinishReason(raw: any) {
  const value = String(raw?.candidates?.[0]?.finishReason ?? '').trim()
  return /^[A-Z0-9_]{1,40}$/.test(value) ? value : ''
}
