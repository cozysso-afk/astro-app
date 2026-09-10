export const INTEGRATED_PRECISION_CONTRACT = 'integrated-precision-v2'
export type PrecisionMode = 'exact' | 'provisional'

type BirthReliabilitySnapshot = {
  birthDate: string
  birthTime: string
  placeKey: string
  latitude: string
  longitude: string
  timeSource: string
  timeConfidence: string
  rectifiedWindowStart: string
  rectifiedWindowEnd: string
  updatedAt: number
}

const LIVE_KEY = 'starlight-destiny.birth-reliability-live.v2'
const PROFILE_KEY = 'starlight-destiny.birth-profile.v1'
const INSTALL_KEY = '__starlightIntegratedPrecisionFetchV2__'

function safeParse(raw: string | null): any {
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

function normalizeNumber(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? String(n) : ''
}

function snapshotKey(value: Partial<BirthReliabilitySnapshot>) {
  return [value.birthDate ?? '', value.birthTime ?? '', value.placeKey ?? '', normalizeNumber(value.latitude), normalizeNumber(value.longitude)].join('|')
}

function readLive(): BirthReliabilitySnapshot[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const value = safeParse(localStorage.getItem(LIVE_KEY))
    return Array.isArray(value) ? value.filter((x)=>x && typeof x === 'object') : []
  } catch { return [] }
}

function savedSnapshot(): BirthReliabilitySnapshot | null {
  if (typeof localStorage === 'undefined') return null
  let p: any = null
  try { p = safeParse(localStorage.getItem(PROFILE_KEY)) } catch { return null }
  if (!p || typeof p !== 'object') return null
  return {
    birthDate: String(p.birthDate ?? ''), birthTime: String(p.birthTime ?? ''), placeKey: String(p.placeKey ?? ''),
    latitude: String(p.latitude ?? ''), longitude: String(p.longitude ?? ''),
    timeSource: String(p.timeSource ?? 'unknown'), timeConfidence: String(p.timeConfidence ?? 'unknown'),
    rectifiedWindowStart: String(p.rectifiedWindowStart ?? ''), rectifiedWindowEnd: String(p.rectifiedWindowEnd ?? ''),
    updatedAt: 0,
  }
}

export function rememberBirthTimeReliability(profile: any) {
  if (typeof localStorage === 'undefined' || !profile || typeof profile !== 'object') return
  const row: BirthReliabilitySnapshot = {
    birthDate: String(profile.birthDate ?? ''), birthTime: String(profile.birthTime ?? ''), placeKey: String(profile.placeKey ?? ''),
    latitude: String(profile.latitude ?? ''), longitude: String(profile.longitude ?? ''),
    timeSource: String(profile.timeSource ?? 'unknown'), timeConfidence: String(profile.timeConfidence ?? 'unknown'),
    rectifiedWindowStart: String(profile.rectifiedWindowStart ?? ''), rectifiedWindowEnd: String(profile.rectifiedWindowEnd ?? ''),
    updatedAt: Date.now(),
  }
  const key = snapshotKey(row)
  const next = [row, ...readLive().filter((x)=>snapshotKey(x) !== key)].slice(0, 12)
  try { localStorage.setItem(LIVE_KEY, JSON.stringify(next)) } catch { /* best effort */ }
}

function requestSnapshot(profile: Record<string, unknown>): BirthReliabilitySnapshot | null {
  const needle = snapshotKey({
    birthDate: String(profile.birth_date ?? ''), birthTime: String(profile.birth_time ?? ''), placeKey: String(profile.place_key ?? ''),
    latitude: String(profile.latitude ?? ''), longitude: String(profile.longitude ?? ''),
  })
  const live = readLive().find((x)=>snapshotKey(x) === needle)
  if (live) return live
  const saved = savedSnapshot()
  return saved && snapshotKey(saved) === needle ? saved : null
}

export function precisionModeFromProvenance(source: unknown, confidence: unknown, timeKnown: unknown, birthTime: unknown): PrecisionMode | null {
  const available = Boolean(timeKnown && birthTime)
  if (!available) return null
  return confidence === 'exact' && (source === 'official_record' || source === 'rectified') ? 'exact' : 'provisional'
}

export function applyIntegratedPrecisionToRequest<T extends Record<string, unknown>>(request: T): T {
  const profile = request?.profile
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return request
  const p = profile as Record<string, unknown>
  const snapshot = requestSnapshot(p)
  const birthTime = String(p.birth_time ?? '')
  const timeKnown = Boolean(birthTime)
  const source = snapshot?.timeSource || 'unknown'
  const confidence = snapshot?.timeConfidence || 'unknown'
  p.time_known = timeKnown
  p.time_source = source
  p.time_confidence = confidence
  p.rectified_window = source === 'rectified' && snapshot && (snapshot.rectifiedWindowStart || snapshot.rectifiedWindowEnd)
    ? { start: snapshot.rectifiedWindowStart || null, end: snapshot.rectifiedWindowEnd || null }
    : null
  return request
}

export type PrecisionReadiness = { ok: boolean; mode: PrecisionMode | 'invalid'; reason: string }

export function fortuneAiPrecisionReadiness(calculation: any): PrecisionReadiness {
  const p = calculation?.precision
  if (!p || typeof p !== 'object') return { ok:false, mode:'invalid', reason:'legacy_or_missing_precision_contract' }
  if (p.contract_version !== INTEGRATED_PRECISION_CONTRACT) return { ok:false, mode:'invalid', reason:'unsupported_precision_contract' }
  const validSources = new Set(['official_record','family_memory','user_estimate','arbitrary_input','rectified','unknown'])
  const validConfidence = new Set(['exact','high','medium','low','unknown'])
  if (!validSources.has(String(p.time_source ?? '')) || !validConfidence.has(String(p.time_confidence ?? ''))) {
    return { ok:false, mode:'invalid', reason:'invalid_precision_provenance' }
  }
  const policy = p.layer_policy
  const policyShape = (expected: 'allow' | 'exclude') => policy && typeof policy === 'object'
    && policy.natal_moon === expected && policy.angles_houses === expected && policy.house_ruler_bonus === expected
    && policy.intraday_timing === expected && policy.saju_ai === expected && policy.thai_ai === expected
  const sourceCanBeExact = p.time_source === 'official_record' || p.time_source === 'rectified'
  const exactProvenance = sourceCanBeExact && p.time_confidence === 'exact'
  const exactShape = p.status === 'exact' && p.time_available === true && p.time_exact === true && exactProvenance && p.scoring_mode === 'full_exact'
    && p.allow_natal_moon_scoring === true && p.allow_angles_houses_scoring === true && p.allow_house_ruler_bonus === true
    && p.allow_intraday_timing === true && p.allow_saju_ai === true && p.allow_thai_ai === true && policyShape('allow')
  if (exactShape) return { ok:true, mode:'exact', reason:'' }
  const provisionalShape = p.status === 'provisional' && p.time_available === true && p.time_exact === false && !exactProvenance && p.scoring_mode === 'planet_only_provisional'
    && p.allow_natal_moon_scoring === false && p.allow_angles_houses_scoring === false && p.allow_house_ruler_bonus === false
    && p.allow_intraday_timing === false && p.allow_saju_ai === false && p.allow_thai_ai === false && policyShape('exclude')
  if (provisionalShape) return { ok:true, mode:'provisional', reason:'' }
  return { ok:false, mode:'invalid', reason:'internally_inconsistent_precision_contract' }
}

function sanitizeEvidence(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((row:any)=>{
    if (!row || typeof row !== 'object') return false
    if (row.kind === 'house' || row.whole_house != null || row.quadrant_house != null || row.placidus_house != null) return false
    if (['Moon','ASC','MC'].includes(String(row.target ?? ''))) return false
    return true
  }).map((row:any)=>{
    const copy = { ...row }
    delete copy.sample_time; delete copy.whole_house; delete copy.quadrant_house; delete copy.quadrant_system; delete copy.placidus_house
    return copy
  })
}

export function sanitizeCalculationForExternalAi(calculation: any) {
  const ready = fortuneAiPrecisionReadiness(calculation)
  if (!ready.ok || ready.mode !== 'provisional') return calculation
  const clone = typeof structuredClone === 'function' ? structuredClone(calculation) : JSON.parse(JSON.stringify(calculation))
  clone.saju = { ok:false, provisional_excluded_from_ai:true }
  clone.thai = { ok:false, provisional_excluded_from_ai:true }
  if (clone.western) {
    clone.western.natal = { asc:null, mc:null, house_system:null, precision_note:'provisional: birth-time-sensitive natal layers excluded from AI' }
    clone.western.detail_days = []
    if (Array.isArray(clone.western.daily_scores)) {
      clone.western.daily_scores = clone.western.daily_scores.map((day:any)=>({ ...day, evidence:sanitizeEvidence(day?.evidence) }))
    }
    if (Array.isArray(clone.western.key_dates)) clone.western.key_dates = []
  }
  clone.consensus_policy = { western:'Western planet-only provisional evidence only; no exact HH:MM timing', saju:'excluded from AI', thai:'excluded from AI' }
  return clone
}

function extractTrailingJson(text: string, marker: string) {
  const index = text.lastIndexOf(marker)
  if (index < 0) return null
  const raw = text.slice(index + marker.length).trim()
  try { return JSON.parse(raw) } catch { return null }
}

export function sanitizeExternalFortuneText(text: string) {
  const markers = ['[CALCULATED_DATA · 원본 계산 JSON]', '[원본 계산 JSON]']
  for (const marker of markers) {
    const calculation = extractTrailingJson(text, marker)
    const ready = fortuneAiPrecisionReadiness(calculation)
    if (ready.ok && ready.mode === 'provisional') {
      const safe = sanitizeCalculationForExternalAi(calculation)
      return [
        '[별빛의 운명 · PROVISIONAL 외부 AI 안전복사]',
        '출생시간이 검증된 exact가 아니므로 Western planet-only 근거만 사용해.',
        '출생 Moon·ASC/MC·하우스·하우스 룰러 보너스·정확 HH:MM 시기·사주·Thai 근거는 해석하거나 복원하지 마.',
        '점수는 사건 확률이 아니라 상대활성도야.',
        '',
        '[CALCULATED_DATA · Western-only]',
        JSON.stringify(safe, null, 2),
      ].join('\n')
    }
  }
  // If a provisional marker is visible but the payload cannot be parsed, fail closed
  // instead of copying the original mixed-system text.
  if (text.includes('"contract_version": "integrated-precision-v2"') && text.includes('"status": "provisional"')) {
    return '[별빛의 운명] provisional 계산의 외부 AI 복사 데이터를 안전하게 정리하지 못해 원본 복사를 차단했어.'
  }
  return text
}

export function installIntegratedPrecisionFetch() {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return
  const w = window as any
  if (w[INSTALL_KEY]) return
  w[INSTALL_KEY] = true
  const original = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let rawUrl = ''
    try {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      rawUrl = url
      if (/\/v1\/fortune\/integrated(?:\/start)?$/.test(new URL(url, window.location.href).pathname) && typeof init?.body === 'string') {
        const body = safeParse(init.body)
        if (body && typeof body === 'object') {
          applyIntegratedPrecisionToRequest(body)
          init = { ...init, body: JSON.stringify(body) }
        }
      }
      if (/\/functions\/v1\/fortune-interpret-v21-preview$/.test(new URL(url, window.location.href).pathname)) {
        if (typeof init?.body === 'string') {
          const body = safeParse(init.body)
          if (body?.calculation && ['start','prompt','inspect'].includes(String(body?.action ?? ''))) {
            const ready = fortuneAiPrecisionReadiness(body.calculation)
            if (!ready.ok) {
              return new Response(JSON.stringify({ ok:false, error:'새 정밀도 계약으로 다시 계산해야 AI 해설을 시작할 수 있어.', gemini_paid_call:false }), {
                status:409, headers:{'Content-Type':'application/json; charset=utf-8'},
              })
            }
          }
        }
        const rewritten = url.replace(/fortune-interpret-v21-preview$/, 'fortune-interpret-v22-preview')
        if (typeof input === 'string') {
          input = rewritten
        } else if (input instanceof URL) {
          input = new URL(rewritten)
        } else {
          const source = input.clone()
          input = new Request(rewritten, {
            method: source.method,
            headers: source.headers,
            body: source.method === 'GET' || source.method === 'HEAD' ? undefined : source.body,
            mode: source.mode,
            credentials: source.credentials,
            cache: source.cache,
            redirect: source.redirect,
            referrer: source.referrer,
            referrerPolicy: source.referrerPolicy,
            integrity: source.integrity,
            keepalive: source.keepalive,
            signal: source.signal,
          })
        }
      }
    } catch {
      if (/\/functions\/v1\/fortune-interpret-v21-preview(?:$|[?#])/.test(rawUrl)) {
        return new Response(JSON.stringify({ ok:false, error:'정밀도 AI 게이트 전송을 안전하게 구성하지 못해 호출을 차단했어.', gemini_paid_call:false }), {
          status:409, headers:{'Content-Type':'application/json; charset=utf-8'},
        })
      }
      // Non-AI transport failures are allowed to reach the API, whose provenance gate fails closed.
    }
    return original(input, init)
  }
}
