export const FORTUNE_AI_START_ERROR_FALLBACK = 'AI 해설 서버에서 오류가 발생했어. 설정의 AI 해설 연결 상태를 확인해줘.'
export const FORTUNE_AI_STATUS_ERROR_FALLBACK = 'AI 해설 상태 확인이 잠시 끊겼어. 앱을 다시 열면 이어서 확인해.'
export const FORTUNE_AI_FAILED_JOB_FALLBACK = 'AI 해설 서버 작업이 실패했어.'

const PUBLIC_MESSAGES: Record<string, string> = {
  METHOD_NOT_ALLOWED: '지원하지 않는 요청 방식이야.',
  INVALID_JSON: 'JSON 요청이 필요해.',
  CALCULATION_REQUIRED: 'calculation이 필요해.',
  UNSUPPORTED_ACTION: '지원하지 않는 action이야.',
  AUTH_REQUIRED: '인증 세션이 필요해.',
  PRECISION_CONTRACT_REQUIRED: '새 정밀도 계약으로 다시 계산해야 AI 해설을 사용할 수 있어.',
  PROVISIONAL_SANITIZE_FAILED: '잠정 계산을 안전하게 정리하지 못해 AI 경로를 차단했어.',
  PROVISIONAL_INITIAL_AUDIT_FAILED: '잠정 계산 안전검사를 통과하지 못해 AI 경로를 차단했어.',
  PROVISIONAL_PROMPT_BLOCKED: '잠정 프롬프트를 안전하게 만들지 못해 차단했어.',
  PROVISIONAL_PACKET_AUDIT_FAILED: 'AI 패킷 안전검사를 통과하지 못해 차단했어.',
  PROVISIONAL_FINAL_AUDIT_FAILED: '잠정 해설 최종 안전검사를 통과하지 못해 저장을 차단했어.',
  PROVISIONAL_DB_WRITE_FAILED: 'AI 해설 저장에 실패했어.',
  PROVISIONAL_GENERATION_FAILED: '잠정 AI 해설 생성에 실패했어.',
  JOB_STATUS_READ_FAILED: 'AI 해설 상태를 불러오지 못했어.',
  JOB_NOT_FOUND: '해설 작업을 찾지 못했어.',
  JOB_TIMEOUT: 'AI 해설 작업이 제한시간을 넘겨 자동 종료됐어.',
  JOB_CANCELED: 'AI 해설 생성이 사용자 요청으로 취소됐어.',
  JOB_CANCEL_FAILED: 'AI 해설 취소 처리에 실패했어.',
  JOB_CREATE_FAILED: 'AI 해설 작업을 시작하지 못했어.',
  JOB_GENERATION_FAILED: 'AI 해설 생성에 실패했어.',
  UPSTREAM_NOT_CONFIGURED: 'AI 해설 서버 설정이 필요해.',
  PROMPT_BUDGET_EXCEEDED: 'AI 입력 근거가 비용 안전 한도를 넘어서 호출을 차단했어.',
  COST_GUARD_BLOCKED: 'AI 비용 보호 한도에 도달했어. 잠시 뒤 다시 시도해.',
  COST_GUARD_CHECK_FAILED: 'AI 비용 보호 상태를 확인하지 못해 새 호출을 차단했어.',
  UPSTREAM_FAILED: 'AI 해설 서버 요청에 실패했어.',
  UPSTREAM_INVALID_RESPONSE: 'AI 해설 서버 응답을 안전하게 확인하지 못했어.',
}

function decodeEscapesOnce(value: string) {
  let decoded = value.replace(/(?:%[0-9A-Fa-f]{2})+/g, (encoded) => {
    try { return decodeURIComponent(encoded) } catch { return encoded }
  })
  decoded = decoded
    .replace(/\\u\{([0-9a-f]{1,6})\}/gi, (_, hex) => {
      try { return String.fromCodePoint(Number.parseInt(hex, 16)) } catch { return '' }
    })
    .replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\x([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\(["'\\])/g, '$1')
  return decoded.normalize('NFKC').replace(/\p{Cf}/gu, '')
}

function classificationText(text: string) {
  let normalized = text
  for (let round = 0; round < 2; round += 1) normalized = decodeEscapesOnce(normalized)
  return normalized
}

export function fortuneAiErrorLooksUnsafe(text: string) {
  if (text.length > 4096) return true
  const normalized = classificationText(text)
  const credentialKey = /(?:^|[?&\s"'“”‘’[{,(])(?:authorization|access[_-]?token|refresh[_-]?token|id[_-]?token|api[\s_-]?key|x-api-key|apikey|client[_-]?secret|password|passwd|cookie|set-cookie|service[-_ ]?role|(?:request[_ -]?)?headers?)\s*["'“”‘’]?\s*[:=]\s*["'“”‘’]?\s*\S/i
  const authorizationValue = /\b(?:bearer|basic)\s+(?!auth(?:entication)?\b)[a-z0-9._~+\/-]{4,}={0,2}/i
  const jwt = /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/
  const uuid = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i
  const credentialPrefix = /\b(?:sk-|sb_secret_|sb_publishable_)[A-Za-z0-9_-]+/i
  const secretQuery = /https?:\/\/[^\s"'<>]*(?:[?&])[^#\s"'&=]*(?:token|key|secret|password|passwd|signature|credential|code)[^#\s"'&=]*=/i
  return credentialKey.test(normalized)
    || authorizationValue.test(normalized)
    || jwt.test(normalized)
    || uuid.test(normalized)
    || credentialPrefix.test(normalized)
    || secretQuery.test(normalized)
}

function recordFromUnknown(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function safeLegacyMessage(value: unknown) {
  if (typeof value !== 'string') return ''
  const text = value.trim()
  return text && !fortuneAiErrorLooksUnsafe(text) ? text : ''
}

export function fortuneAiPublicErrorMessage(payload: unknown, fallback: string) {
  const data = recordFromUnknown(payload)
  if (!data) return fallback
  const code = typeof data.error_code === 'string' ? data.error_code : ''
  if (PUBLIC_MESSAGES[code]) return PUBLIC_MESSAGES[code]
  return safeLegacyMessage(data.error) || fallback
}

function functionsHttpContext(error: unknown) {
  if (!error || typeof error !== 'object' || !('context' in error)) return undefined
  return (error as { context?: unknown }).context
}

function isFunctionsResponseContext(context: unknown): context is Response {
  if (typeof Response !== 'undefined' && context instanceof Response) return true
  if (!context || typeof context !== 'object') return false
  const value = context as Partial<Response>
  return typeof value.clone === 'function' && typeof value.json === 'function' && typeof value.status === 'number'
}

async function readFunctionsResponseJson(context: unknown) {
  if (!isFunctionsResponseContext(context) || context.bodyUsed) return null
  try { return recordFromUnknown(await context.clone().json()) } catch { return null }
}

async function functionsHttpMessage(error: unknown, invokeData: unknown, fallback: string) {
  const context = functionsHttpContext(error)
  const json = recordFromUnknown(invokeData) ?? await readFunctionsResponseJson(context)
  return fortuneAiPublicErrorMessage(json, fallback)
}

export async function fortuneAiStartErrorMessage(error: unknown, invokeData: unknown) {
  if (error instanceof Error && error.name === 'FunctionsHttpError') {
    return functionsHttpMessage(error, invokeData, FORTUNE_AI_START_ERROR_FALLBACK)
  }
  const message = error instanceof Error ? error.message : 'AI 해설 요청에 실패했어.'
  return safeLegacyMessage(message) || FORTUNE_AI_START_ERROR_FALLBACK
}

export function fortuneAiFailedJobMessage(payload: unknown) {
  return fortuneAiPublicErrorMessage(payload, FORTUNE_AI_FAILED_JOB_FALLBACK)
}

export async function fortuneAiStatusErrorMessage(error: unknown, invokeData: unknown = null) {
  if (error instanceof Error && error.name === 'FunctionsHttpError') {
    return functionsHttpMessage(error, invokeData, FORTUNE_AI_STATUS_ERROR_FALLBACK)
  }
  if (error instanceof Error && (error.name === 'FunctionsFetchError' || error.name === 'FunctionsRelayError')) {
    return FORTUNE_AI_STATUS_ERROR_FALLBACK
  }
  const message = error instanceof Error ? error.message : 'AI 해설 상태 확인에 실패했어.'
  return safeLegacyMessage(message) || FORTUNE_AI_STATUS_ERROR_FALLBACK
}
