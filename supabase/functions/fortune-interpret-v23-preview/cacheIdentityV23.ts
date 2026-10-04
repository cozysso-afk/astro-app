import { V23_PROMPT_VERSION } from './promptV23.ts'
import { PERIOD_NARRATIVE_VERSION } from './periodNarrativeV23.ts'

export const DAY_WEEK_NARRATIVE_CACHE_VERSION = 'dw-period-distinct-v4-human-scene'
export const DAILY_OUTPUT_CACHE_VERSION = 'daily-output-headroom-v2'
export const WEEKLY_OUTPUT_CACHE_VERSION = 'weekly-output-headroom-v2'
// Cache identity follows the actual prompt + narrative contracts so an editorial
// release cannot silently reuse an older completed Gemini result.
export const EDITORIAL_CACHE_VERSION = `editorial-runtime:${V23_PROMPT_VERSION}:${PERIOD_NARRATIVE_VERSION}`

function periodKind(source: any): string {
  const raw = String(source?.period_kind ?? source?.period?.kind ?? source?.kind ?? '').trim().toLowerCase()
  const aliases: Record<string,string> = { today:'day', daily:'day', day:'day', weekly:'week', week:'week', monthly:'month', month:'month', yearly:'annual', year:'annual', annual:'annual' }
  if (aliases[raw]) return aliases[raw]
  const start = String(source?.period?.start ?? '')
  const end = String(source?.period?.end ?? '')
  const a = Date.parse(`${start}T00:00:00Z`)
  const b = Date.parse(`${end}T00:00:00Z`)
  if (Number.isFinite(a) && Number.isFinite(b) && b >= a) {
    const days = Math.floor((b-a)/86400000)+1
    if (days <= 1) return 'day'
    if (days <= 9) return 'week'
    if (days <= 45) return 'month'
    return 'annual'
  }
  return raw
}

function isDayWeek(source: any): boolean {
  const kind = periodKind(source)
  return kind === 'day' || kind === 'week'
}

function outputMarker(source: any): string {
  const kind = periodKind(source)
  if (kind === 'day') return `:${DAILY_OUTPUT_CACHE_VERSION}`
  if (kind === 'week') return `:${WEEKLY_OUTPUT_CACHE_VERSION}`
  return ''
}

export function exactV23JobKind(version: string, payload: any, hash: string): string {
  const hashPart = hash.slice(0, 32)
  const narrative = isDayWeek(payload) ? `:${DAY_WEEK_NARRATIVE_CACHE_VERSION}` : ''
  return `${version}:${EDITORIAL_CACHE_VERSION}${narrative}${outputMarker(payload)}:${hashPart}`
}

export function provisionalV23JobKind(version: string, packet: any, hash: string): string {
  const hashPart = hash.slice(0, 32)
  const base = `${version}:v23-period-aware:${EDITORIAL_CACHE_VERSION}`
  const marker = outputMarker(packet)
  return isDayWeek(packet)
    ? `${base}:${DAY_WEEK_NARRATIVE_CACHE_VERSION}${marker}:${hashPart}`
    : `${base}:${hashPart}`
}
