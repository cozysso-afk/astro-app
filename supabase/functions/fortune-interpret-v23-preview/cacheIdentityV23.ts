export const DAY_WEEK_NARRATIVE_CACHE_VERSION = 'dw-period-distinct-v2'

function periodKind(source: any): string {
  return String(source?.period_kind ?? source?.period?.kind ?? source?.kind ?? '').trim().toLowerCase()
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
