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

export type TimelineContext = { now?: Date; timeZone?: string; referenceDate?: string }

// A clock-only window belongs to the calculation date, not every day it is opened.
export function timelineWindowState(value: string, context: TimelineContext = {}): IntradayWindowState {
  const now = context.now ?? new Date()
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: context.timeZone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts(now)
  const part = (name: string) => parts.find(p => p.type === name)?.value ?? ''
  const today = `${part('year')}-${part('month')}-${part('day')}`
  const range = parseIntradayRange(value)
  if (range) {
    const date = context.referenceDate ?? today
    const minute = Number(part('hour')) * 60 + Number(part('minute'))
    const start = Date.parse(`${date}T00:00:00Z`) + range.start * 60000
    const end = Date.parse(`${date}T00:00:00Z`) + (range.end + (range.end < range.start ? 1440 : 0)) * 60000
    const current = Date.parse(`${today}T00:00:00Z`) + minute * 60000
    return current < start ? 'upcoming' : current > end ? 'past' : 'current'
  }
  const dates = value.match(/\d{4}-\d{2}-\d{2}/g)
  if (!dates?.length) return 'not-intraday'
  return today < dates[0] ? 'upcoming' : today > dates[dates.length - 1] ? 'past' : 'current'
}

export function timelinePresentation(value: string, kind: string, context: TimelineContext = {}) {
  const state = timelineWindowState(value, context)
  return {
    state,
    label: state === 'past' ? '지난 구간 · 회고' : state === 'current' ? '진행 중' : state === 'upcoming' ? '예정 구간' : '시점 확인 필요',
    detailLabel: state === 'past' ? '당시 계산 근거' : '이 시기를 읽는 이유',
    signalLabel: kind === 'favorable' ? '도움 근거' : kind === 'caution' ? '주의 근거' : '혼합 근거',
  }
}
