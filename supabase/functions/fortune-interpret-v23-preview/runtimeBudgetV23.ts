export type V23PeriodKind = 'day' | 'week' | 'month' | 'annual'

const LIMITS: Record<V23PeriodKind, { full: number; compact: number }> = {
  // A compact retry reduces the requested structures, not the completion ceiling.
  // Lowering both at once reproduced MAX_TOKENS twice and consumed the paid-call budget.
  day: { full: 8200, compact: 8200 },
  week: { full: 9000, compact: 9000 },
  month: { full: 8000, compact: 8000 },
  annual: { full: 10000, compact: 10000 },
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

// Gemini counts thinking tokens against maxOutputTokens. Live V8 spent 7,871
// thinking tokens and returned only 311 candidate tokens, consuming the first
// of two paid calls before a quality-guided rewrite was possible.
export function v23ThinkingLevel() {
  return 'low' as const
}

export function v23FinishReason(raw: any) {
  const value = String(raw?.candidates?.[0]?.finishReason ?? '').trim()
  return /^[A-Z0-9_]{1,40}$/.test(value) ? value : ''
}
