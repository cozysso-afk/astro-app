export type V23PeriodKind = 'day' | 'week' | 'month' | 'annual'

const LIMITS: Record<V23PeriodKind, { full: number; compact: number }> = {
  // Production telemetry on 2026-10-01/02 hit the old 4,000-token day ceiling:
  // visible candidate 3,466~3,515 + thinking 470~519 ~= 3,985 tokens.
  // The structured 31-section result is ~20k JSON chars, so keep a small completion margin
  // without expanding the annual ceiling.
  day: { full: 6200, compact: 5600 },
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
