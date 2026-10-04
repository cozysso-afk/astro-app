export type V23PeriodKind = 'day' | 'week' | 'month' | 'annual'

const LIMITS: Record<V23PeriodKind, { full: number; compact: number }> = {
  // Production telemetry on 2026-10-04 showed both day and week structured output
  // finishing at their token ceilings. Keep changes period-scoped and leave month/annual
  // unchanged until production telemetry proves they also need more room.
  day: { full: 8200, compact: 7000 },
  // Weekly production: full candidate 6,379 + thinking 606 = 6,985 at 7,000;
  // compact candidate 6,185 at 6,200. Give only the next safe completion margin.
  week: { full: 9000, compact: 8000 },
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
