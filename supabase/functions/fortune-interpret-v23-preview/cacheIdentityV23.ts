export const DAY_WEEK_NARRATIVE_CACHE_VERSION = 'dw-period-distinct-v3'

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

export function exactV23JobKind(version: string, payload: any, hash: string): string {
  const hashPart = hash.slice(0, 32)
  return isDayWeek(payload)
    ? `${version}:${DAY_WEEK_NARRATIVE_CACHE_VERSION}:${hashPart}`
    : `${version}:${hashPart}`
}

export function provisionalV23JobKind(version: string, packet: any, hash: string): string {
  const hashPart = hash.slice(0, 32)
  const base = `${version}:v23-period-aware`
  return isDayWeek(packet)
    ? `${base}:${DAY_WEEK_NARRATIVE_CACHE_VERSION}:${hashPart}`
    : `${base}:${hashPart}`
}
