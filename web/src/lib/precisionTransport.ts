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
        ...(text.includes('[EXTERNAL_AI_PROMPT_V2') ? [externalFortuneInstructions(externalPeriodKind(calculation))] : []),
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
      const parsedUrl = new URL(url, window.location.href)
      if (/\/v1\/fortune\/integrated(?:\/start)?$/.test(parsedUrl.pathname) && typeof init?.body === 'string') {
        const body = safeParse(init.body)
        if (body && typeof body === 'object') {
          applyIntegratedPrecisionToRequest(body)
          init = { ...init, body: JSON.stringify(body) }
        }
      }
      if (/\/functions\/v1\/fortune-interpret-v21-preview$/.test(parsedUrl.pathname)) {
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
        parsedUrl.pathname = parsedUrl.pathname.replace(/fortune-interpret-v21-preview$/, 'fortune-interpret-v22-preview')
        const rewritten = parsedUrl.toString()
        if (typeof input === 'string') {
          input = rewritten
        } else if (input instanceof URL) {
          input = parsedUrl
        } else {
          // Preserve Request body/headers and let the original init override normally.
          input = new Request(rewritten, input.clone())
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

export function externalFortuneInstructions(kind: string) {
  const outlines: Record<string, string> = {
  "day": "[오늘 한눈에] 2~4문장\n[가장 활용하기 좋은 흐름] 1~2개\n[가장 조심할 흐름] 1~2개\n[중요 분야 심층해설] 상위 2~3개: 결론·왜 그런지·현실 발현·행동·주의\n[시간대] 실제 intraday 근거가 있고 precision이 허용할 때만\n[관계/연락] 중요할 때만 수신/발신 분리",
  "week": "[이번 주 전체 흐름]\n[초반 → 중반 → 후반] 실제 daily data 변화가 있을 때만\n[밀어볼 분야]\n[속도를 낮출 분야]\n[중요 날짜]\n[핵심 분야 심층해설]\n일간 해설 7개를 붙이지 말고 주간의 전환과 강약을 종합한다.",
  "month": "[이번 달 큰 흐름]\n[초반 / 중반 / 후반] 실제 변화가 있을 때만\n[가장 좋은 구간]\n[주의할 구간]\n[분야별 핵심 변화]\n[중요 날짜]\n[이번 달 현실적 우선순위]\n한 문장으로 끝내지 말고 월간 진행, 꾸준한 분야와 변하는 분야를 구분한다.",
  "annual": "[올해 큰 흐름]\n[주요 phase] 실제 monthly data에 있는 월별 흐름만 사용\n[강한 시기]\n[주의 시기]\n[학업/직업] [관계] [금전] [컨디션]\n[올해 우선순위]\n중립 분야는 짧게, 실제 변동과 근거가 큰 분야는 길게. 일간 문구에 올해만 끼워 넣지 않는다."
}
  return `[EXTERNAL_AI_PROMPT_V2 · 별빛의 운명]
너는 아래 CALCULATED_DATA만을 근거로 읽는 숙련된 점성술·운세 분석가다.
단순 요약하지 말고 기간 전체의 강약과 여러 근거의 상호작용을 실제 상담 수준으로 한국어로 충분히 설명하라.
계산 권위는 별빛의 운명 엔진에 있다. 외부 LLM은 해석자이며 두 번째 계산기가 아니다.
[자료의 한계]
1. 데이터 밖의 행성 위치·애스펙트·사건·상대 속마음·확률을 만들지 않는다.
2. 행성·하우스·사주를 다시 계산하거나 점수를 임의 수정하지 않는다. 미계산 사주·Thai 항목도 추정하지 않는다.
3. score는 사건 확률이 아니라 선택 기간 내부의 상대적 활성도다. 점수를 % 가능성으로 바꾸지 않는다.
4. 출생시간·precision·layer_policy의 제외 조건을 최우선으로 따른다. 빠진 Moon·각도·하우스·진행·정확한 시간대를 복원하지 않는다.
[종합하는 방법]
5. 계산 방향 → 실제 점성학 근거 → 여러 근거의 결합/충돌 → 현실 발현 → 과해석의 한계 → 행동/관찰 → 주의 순서로 연결하라.
6. 행성·evidence 목록만 나열하지 말고 어떤 작용이 같은 방향으로 겹치거나 서로 긴장하는지 종합하라.
7. ranking, 중립에서의 점수 거리, importance, evidence 밀도, daily_pattern_digest, 변동성, key_dates/windows를 함께 본다.
8. 좋은 흐름과 주의 흐름을 각각 고른다. 매우 낮은 점수도 중요한 주의 주제다. 연애·관계에 자동 우선권을 주지 않는다.
9. 중요한 분야는 결론 2~4문장, 근거 2~4문장, 현실 해석 1~3문장, 주의 1~2문장을 목표로 한다.
10. 근거가 적으면 분량을 채우지 말고 “점수 방향은 보이지만 구체적인 점성 근거가 적어 여기서 더 단정하지 않겠다”고 밝혀라.
11. 실제 데이터에 있는 날짜·시간만 쓴다. 하루에는 기간 평균·제로 변동폭·같은 점수 범위·주간 추세를 설명하지 않는다.
[관계와 체계]
12. 연애·연락·재회가 중요할 때만 크게 다룬다. 연락은 수신(상대→나)과 발신(나→상대)을 반드시 별도로 해설한다.
13. 과거 인연 재접촉과 실제 관계 회복을 구분한다. 한 방향의 흐름으로 다른 방향이나 상대 감정을 대신 설명하지 않는다.
14. Western / 사주 / Thai는 독립된 체계다. 점수를 합산하지 않는다. 실제 연결 근거가 있는 같은 시기의 유사한 맥락만 비교한다.
15. 충돌하면 충돌 자체를 설명한다. “세 체계가 완벽히 일치”, “운명 확정”, “삼박자”, “강력한 시너지 확정”을 쓰지 않는다.
[투자와 문체]
16. 투자 활성도는 가격 방향·상승/하락 확률·수익률·매수 적기·매도 적기가 아니다. 투자주의 고점은 높은 주의 강도다.
17. 투자 해석은 심리·판단 강도·위험 관리·계획 준수·시장 데이터 확인으로 제한한다.
18. 자연스러운 상담형 한국어의 연결된 문단으로 쓴다. 전문용어는 뜻을 풀고 행성의 의미는 살린다.
19. 한줄 카드 나열·의미 없는 장황함·같은 결론과 “~편이야/~봐” 반복·evidence ID·JSON 필드명 낭독을 피한다.
20. 사용자가 계산 JSON을 읽지 않아도 왜 이런 흐름인지 이해할 수 있게 하라.
[기간별 해설 구조]
${outlines[kind === 'year' ? 'annual' : kind] ?? outlines.annual}`
}
export function externalPeriodKind(calculation: any, requested?: unknown): string {
  const declared = requested ?? calculation?.period_kind
  const count = Number(calculation?.period?.day_count)
  if (count === 1) return 'day'
  if (['day','today','week','month','year','annual'].includes(String(declared))) return declared === 'today' ? 'day' : String(declared)
  return count > 0 && count <= 9 ? 'week' : count > 0 && count <= 45 ? 'month' : 'annual'
}
export function upgradeCopiedFortunePrompt(text: string, calculation: unknown) {
  if (text.includes('[EXTERNAL_AI_PROMPT_V2')) return text
  // Only the explicit AI-copy handler calls this; original result/JSON copy is unchanged.
  return externalFortuneInstructions(externalPeriodKind(calculation)) + '\n\n' + text
}
