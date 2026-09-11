export const FORTUNE_PUBLIC_ERROR_SPECS = {
  METHOD_NOT_ALLOWED: { stage: 'request', error: '지원하지 않는 요청 방식이야.' },
  INVALID_JSON: { stage: 'request', error: 'JSON 요청이 필요해.' },
  CALCULATION_REQUIRED: { stage: 'request', error: 'calculation이 필요해.' },
  UNSUPPORTED_ACTION: { stage: 'request', error: '지원하지 않는 action이야.' },
  AUTH_REQUIRED: { stage: 'auth', error: '인증 세션이 필요해.' },
  PRECISION_CONTRACT_REQUIRED: { stage: 'precision_gate', error: '새 정밀도 계약으로 다시 계산해야 AI 해설을 사용할 수 있어.' },
  PROVISIONAL_SANITIZE_FAILED: { stage: 'provisional_sanitize', error: '잠정 계산을 안전하게 정리하지 못해 AI 경로를 차단했어.' },
  PROVISIONAL_INITIAL_AUDIT_FAILED: { stage: 'provisional_initial_audit', error: '잠정 계산 안전검사를 통과하지 못해 AI 경로를 차단했어.' },
  PROVISIONAL_PROMPT_BLOCKED: { stage: 'provisional_prompt', error: '잠정 프롬프트를 안전하게 만들지 못해 차단했어.' },
  PROVISIONAL_PACKET_AUDIT_FAILED: { stage: 'provisional_packet_audit', error: 'AI 패킷 안전검사를 통과하지 못해 차단했어.' },
  PROVISIONAL_FINAL_AUDIT_FAILED: { stage: 'provisional_final_audit', error: '잠정 해설 최종 안전검사를 통과하지 못해 저장을 차단했어.' },
  PROVISIONAL_DB_WRITE_FAILED: { stage: 'db_write', error: 'AI 해설 저장에 실패했어.' },
  PROVISIONAL_GENERATION_FAILED: { stage: 'provisional_generation', error: '잠정 AI 해설 생성에 실패했어.' },
  JOB_STATUS_READ_FAILED: { stage: 'db_read', error: 'AI 해설 상태를 불러오지 못했어.' },
  JOB_NOT_FOUND: { stage: 'status', error: '해설 작업을 찾지 못했어.' },
  JOB_TIMEOUT: { stage: 'generation', error: 'AI 해설 작업이 제한시간을 넘겨 자동 종료됐어.' },
  JOB_CANCELED: { stage: 'generation', error: 'AI 해설 생성이 사용자 요청으로 취소됐어.' },
  JOB_CANCEL_FAILED: { stage: 'db_write', error: 'AI 해설 취소 처리에 실패했어.' },
  JOB_CREATE_FAILED: { stage: 'db_write', error: 'AI 해설 작업을 시작하지 못했어.' },
  JOB_GENERATION_FAILED: { stage: 'generation', error: 'AI 해설 생성에 실패했어.' },
  UPSTREAM_NOT_CONFIGURED: { stage: 'upstream_config', error: 'AI 해설 서버 설정이 필요해.' },
  PROMPT_BUDGET_EXCEEDED: { stage: 'cost_guard', error: 'AI 입력 근거가 비용 안전 한도를 넘어서 호출을 차단했어.' },
  COST_GUARD_BLOCKED: { stage: 'cost_guard', error: 'AI 비용 보호 한도에 도달했어. 잠시 뒤 다시 시도해.' },
  COST_GUARD_CHECK_FAILED: { stage: 'cost_guard', error: 'AI 비용 보호 상태를 확인하지 못해 새 호출을 차단했어.' },
  UPSTREAM_FAILED: { stage: 'upstream', error: 'AI 해설 서버 요청에 실패했어.' },
  UPSTREAM_INVALID_RESPONSE: { stage: 'upstream', error: 'AI 해설 서버 응답을 안전하게 확인하지 못했어.' },
} as const

export type FortunePublicErrorCode = keyof typeof FORTUNE_PUBLIC_ERROR_SPECS

type SafeExtras = {
  missing_key?: boolean
  gemini_paid_call?: boolean
  configured?: boolean
  quality_guard_failed?: boolean
  cost_guard_blocked?: boolean
  rolling_job_guard?: boolean
  retry_after_seconds?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function isFortunePublicErrorCode(value: unknown): value is FortunePublicErrorCode {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(FORTUNE_PUBLIC_ERROR_SPECS, value)
}

function safeExtras(value: unknown): SafeExtras {
  if (!isRecord(value)) return {}
  const out: SafeExtras = {}
  for (const key of ['missing_key','gemini_paid_call','configured','quality_guard_failed','cost_guard_blocked','rolling_job_guard'] as const) {
    if (typeof value[key] === 'boolean') out[key] = value[key] as boolean
  }
  if (Number.isFinite(value.retry_after_seconds)) out.retry_after_seconds = Math.max(0, Math.min(86400, Number(value.retry_after_seconds)))
  return out
}

export function publicFortuneFailureFields(code: FortunePublicErrorCode) {
  const spec = FORTUNE_PUBLIC_ERROR_SPECS[code]
  return { error_code: code, stage: spec.stage, error: spec.error }
}

export function publicFortuneError(code: FortunePublicErrorCode, _internal?: unknown, extras?: SafeExtras) {
  return { ok: false, ...publicFortuneFailureFields(code), ...safeExtras(extras) }
}

export function storedFortuneJobError(code: 'JOB_TIMEOUT' | 'JOB_CANCELED' | 'JOB_GENERATION_FAILED') {
  return FORTUNE_PUBLIC_ERROR_SPECS[code].error
}

export function storedFortuneJobErrorCode(value: unknown): 'JOB_TIMEOUT' | 'JOB_CANCELED' | 'JOB_GENERATION_FAILED' {
  if (value === FORTUNE_PUBLIC_ERROR_SPECS.JOB_TIMEOUT.error) return 'JOB_TIMEOUT'
  if (value === FORTUNE_PUBLIC_ERROR_SPECS.JOB_CANCELED.error) return 'JOB_CANCELED'
  return 'JOB_GENERATION_FAILED'
}

export function publicFailedUsage(value: unknown) {
  if (!isRecord(value)) return undefined
  const out: Record<string, number | boolean> = {}
  for (const key of ['prompt_tokens','candidate_tokens','thought_tokens','total_tokens','attempt_count'] as const) {
    if (Number.isFinite(value[key])) out[key] = Math.max(0, Number(value[key]))
  }
  if (typeof value.gemini_paid_call === 'boolean') out.gemini_paid_call = value.gemini_paid_call
  return Object.keys(out).length ? out : undefined
}

export function publicCallTrace(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 2).map((entry) => {
    if (!isRecord(entry)) return {}
    const out: Record<string, unknown> = {}
    for (const key of ['call','prompt_bytes','elapsed_ms','http_status'] as const) {
      if (Number.isFinite(entry[key])) out[key] = Math.max(0, Number(entry[key]))
    }
    for (const key of ['model','kind'] as const) {
      if (typeof entry[key] === 'string' && /^[A-Za-z0-9._-]{1,80}$/.test(entry[key] as string)) out[key] = entry[key]
    }
    const usage = publicFailedUsage(entry.usage)
    if (usage) out.usage = usage
    return out
  })
}

// Fixed labels are produced by qualitySummary; never echo historical diagnostic names.
const QUALITY_STAGE_NAMES = ['구조 완전성','근거 추적성','의미 방향 검증','내부 일관성','깊이·실용성'] as const

export function publicQualityValidation(value: unknown) {
  if (!isRecord(value) || typeof value.version !== 'string'
    || value.version.length > 80 || !/^fortune-interpretation-quality-v[0-9]+(?:-[a-z]+)*$/.test(value.version)
    || !Number.isFinite(value.score) || Number(value.score) < 0 || Number(value.score) > 100
    || !Array.isArray(value.stages) || value.stages.length !== 5) return undefined
  const stages = []
  for (let i = 0; i < value.stages.length; i += 1) {
    const row = value.stages[i]
    // Reject malformed summaries as a whole: dropping a failed stage could forge a passed badge.
    if (!isRecord(row) || row.stage !== i + 1 || row.name !== QUALITY_STAGE_NAMES[i]
      || typeof row.passed !== 'boolean') return undefined
    stages.push({ stage: row.stage, name: row.name, passed: row.passed })
  }
  return { version: value.version, score: value.score as number, stages }
}

export function publicJobUsage(value: unknown) {
  if (!isRecord(value)) return undefined
  const out: Record<string, unknown> = {}
  for (const key of ['prompt_tokens','candidate_tokens','thought_tokens','total_tokens','attempt_count'] as const) {
    if (Number.isFinite(value[key])) out[key] = Math.max(0, Number(value[key]))
  }
  for (const key of ['gemini_paid_call','local_thai_scrub','degraded_quality','local_quality_fallback'] as const) {
    if (typeof value[key] === 'boolean') out[key] = value[key]
  }
  if (typeof value.cost_guard_version === 'string' && /^[A-Za-z0-9._-]{1,80}$/.test(value.cost_guard_version)) {
    out.cost_guard_version = value.cost_guard_version
  }
  if (isRecord(value.prompt_budget)) {
    const budget: Record<string, number> = {}
    for (const key of ['bytes','max_bytes','estimated_input_tokens'] as const) {
      if (Number.isFinite(value.prompt_budget[key])) budget[key] = Math.max(0, Number(value.prompt_budget[key]))
    }
    if (Object.keys(budget).length) out.prompt_budget = budget
  }
  out.call_trace = publicCallTrace(value.call_trace)
  const quality = publicQualityValidation(value.quality_validation)
  if (quality) out.quality_validation = quality
  return out
}

type ProxyAction = 'meta' | 'start' | 'status' | 'cancel' | 'prompt' | 'inspect'
const JOB_STATES = ['queued','running','done','failed']
function safeIdentifier(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9._-]{1,100}$/.test(value)
}
function jobMetadata(payload: Record<string, unknown>) {
  const out: Record<string, unknown> = { job_id: payload.job_id }
  for (const key of ['model','fallback_from','interpreter_version']) {
    if (payload[key] === null || safeIdentifier(payload[key])) out[key] = payload[key]
  }
  for (const key of ['created_at','updated_at','completed_at','period_start','period_end']) {
    const value = payload[key]
    if (value === null || (typeof value === 'string' && value.length <= 40
      && /^\d{4}-\d{2}-\d{2}(?:T[0-9:.+Z-]+)?$/.test(value))) out[key] = value
  }
  return out
}
function failedJobPayload(payload: Record<string, unknown>) {
  const code = isFortunePublicErrorCode(payload.error_code) && ['JOB_TIMEOUT','JOB_CANCELED','JOB_GENERATION_FAILED'].includes(payload.error_code)
    ? payload.error_code as 'JOB_TIMEOUT' | 'JOB_CANCELED' | 'JOB_GENERATION_FAILED'
    : storedFortuneJobErrorCode(payload.error)
  return { ok: true, ...jobMetadata(payload), status: 'failed',
    usage: publicFailedUsage(payload.usage), ...publicFortuneFailureFields(code) }
}

// Accept only the action's actual V21 envelope; opaque reading/prompt text remains intact.
function publicProxySuccess(payload: Record<string, unknown>, action: ProxyAction) {
  const out: Record<string, unknown> = {}
  const pick = (keys: string[], valid: (value: unknown) => boolean) => {
    for (const key of keys) if (valid(payload[key])) out[key] = payload[key]
  }
  const boolean = (x: unknown) => typeof x === 'boolean'
  const number = (x: unknown) => typeof x === 'number' && Number.isFinite(x) && x >= 0
  if (action === 'meta') {
    if (typeof payload.configured !== 'boolean') return null
    pick(['configured','background_jobs','payload_hash_cache','inflight_dedupe','five_stage_validation',
      'single_core_generation','deterministic_topic_analysis','rolling_job_guard','local_thai_scrub',
      'prompt_budget_guard','prompt_copy','safe_wording','local_quality_stabilizer','quality_failure_observability'], boolean)
    pick(['interpreter_version','packet_version','quality_version','thai_contract'], safeIdentifier)
    pick(['max_gemini_calls_per_job','max_job_ms','max_user_new_jobs_10m','max_user_new_jobs_24h',
      'max_global_new_jobs_10m','max_global_new_jobs_24h'], number)
    if (isRecord(payload.models)) {
      out.models = Object.fromEntries(Object.entries(payload.models).slice(0, 10).filter(([key, label]) =>
        /^gemini-[0-9.]+-(?:flash|pro)(?:-[a-z0-9-]+)?$/.test(key) && typeof label === 'string'
        && label.length <= 80 && /^Gemini [0-9.]+ (?:Flash|Pro) · [가-힣 ]+$/.test(label)))
    }
    if (payload.ok === true) out.ok = true
    return out
  }
  if (payload.ok !== true) return null
  if (['start','status','cancel'].includes(action)) {
    if (!safeIdentifier(payload.job_id)) return null
    if (action === 'cancel') {
      if (typeof payload.canceled !== 'boolean') return null
      return { ok: true, job_id: payload.job_id, canceled: payload.canceled }
    }
    if (typeof payload.status !== 'string' || !JOB_STATES.includes(payload.status)) return null
    if (action === 'start' && payload.status === 'failed') return null
    if (action === 'status' && payload.status === 'failed') return failedJobPayload(payload)
    if (action === 'status' && payload.status === 'done' && !isRecord(payload.data) && !isRecord(payload.result_json)) return null
    Object.assign(out, { ok: true, ...jobMetadata(payload), status: payload.status })
    if (action === 'start') {
      pick(['reused','inflight','gemini_paid_call'], boolean)
      const budget = publicJobUsage({ prompt_budget: payload.prompt_budget })?.prompt_budget
      if (budget) out.prompt_budget = budget
    } else {
      // V21 calls result_json "data". Preserve both supported success representations.
      if (payload.status === 'done') {
        if (isRecord(payload.data)) out.data = payload.data
        if (isRecord(payload.result_json)) out.result_json = payload.result_json
      } else if (payload.data === null) out.data = null
      out.error = null
      out.usage = publicJobUsage(payload.usage)
    }
    return out
  }
  if (action === 'prompt') {
    if (typeof payload.prompt !== 'string' || !payload.prompt.trim()) return null
    Object.assign(out, { ok: true, prompt: payload.prompt })
    pick(['prompt_bytes','estimated_input_tokens','prompt_budget_bytes'], number)
  } else if (action === 'inspect') {
    if (!number(payload.full_payload_bytes) || !number(payload.prompt_payload_bytes)
      || typeof payload.prompt_budget_ok !== 'boolean') return null
    out.ok = true
    pick(['full_payload_bytes','prompt_payload_bytes','prompt_budget_bytes','estimated_input_tokens',
      'max_gemini_calls_per_job','deterministic_topics','key_dates','evidence_ledger','prompt_evidence_ledger'], number)
    pick(['prompt_budget_ok'], boolean)
  } else return null
  pick(['interpreter_version'], safeIdentifier)
  return out
}

export function normalizeProxiedFortuneResponse(payload: unknown, status: number, action: unknown) {
  if (!isRecord(payload)) {
    return { status: status >= 400 ? status : 502, body: publicFortuneError('UPSTREAM_INVALID_RESPONSE') }
  }
  if (status >= 400 || payload.ok === false) {
    const code = isFortunePublicErrorCode(payload.error_code) ? payload.error_code : 'UPSTREAM_FAILED'
    return { status, body: publicFortuneError(code, undefined, safeExtras(payload)) }
  }
  const body = status >= 200 && status < 300 ? publicProxySuccess(payload, action as ProxyAction) : null
  return body ? { status, body } : { status: 502, body: publicFortuneError('UPSTREAM_INVALID_RESPONSE') }
}
