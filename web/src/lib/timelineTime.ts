export type IntradayWindowState = 'current' | 'upcoming' | 'past' | 'not-intraday'

type ParsedRange = { start: number; end: number }

function parseIntradayRange(value: string): ParsedRange | null {
  const match = String(value ?? '').trim().match(/^(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const startHour = Number(match[1])
  const startMinute = Number(match[2])
  const endHour = Number(match[3])
  const endMinute = Number(match[4])
  if (
    startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23 ||
    startMinute < 0 || startMinute > 59 || endMinute < 0 || endMinute > 59
  ) return null
  return { start: startHour * 60 + startMinute, end: endHour * 60 + endMinute }
}

function minutesNow(now: Date) {
  return now.getHours() * 60 + now.getMinutes()
}

export function intradayWindowState(value: string, now = new Date()): IntradayWindowState {
  const range = parseIntradayRange(value)
  if (!range) return 'not-intraday'
  const current = minutesNow(now)
  if (range.start <= range.end) {
    if (current < range.start) return 'upcoming'
    if (current <= range.end) return 'current'
    return 'past'
  }
  if (current >= range.start || current <= range.end) return 'current'
  return 'upcoming'
}

const STATE_RANK: Record<IntradayWindowState, number> = {
  current: 0,
  upcoming: 1,
  'not-intraday': 2,
  past: 3,
}

export function orderTimelineDates(values: string[], now = new Date()) {
  return [...values].sort((a, b) => {
    const aRange = parseIntradayRange(a)
    const bRange = parseIntradayRange(b)
    if (!aRange || !bRange) return a.localeCompare(b)
    const aState = intradayWindowState(a, now)
    const bState = intradayWindowState(b, now)
    const rank = STATE_RANK[aState] - STATE_RANK[bState]
    if (rank) return rank
    if (aState === 'past') return bRange.start - aRange.start
    return aRange.start - bRange.start
  })
}

export function timelineDisplayDate(value: string, now = new Date()) {
  return intradayWindowState(value, now) === 'past' ? `지난 · ${value}` : value
}
