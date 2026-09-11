export const FORTUNE_AI_START_ERROR_FALLBACK = 'AI 해설 서버에서 오류가 발생했어. 설정의 AI 해설 연결 상태를 확인해줘.'

function normalizedSecurityText(text: string) {
  return text
    .replace(/\\u0022/gi, '"')
    .replace(/\\"/g, '"')
    .replace(/\\u003a/gi, ':')
    .replace(/\\u003d/gi, '=')
    .replace(/\\u0026/gi, '&')
    .replace(/\\u003f/gi, '?')
}

export function fortuneAiErrorLooksUnsafe(text: string) {
  const normalized = normalizedSecurityText(text)
  const credentialKey = /(?:^|[\s"'[{,(])(?:authorization|access[_-]?token|refresh[_-]?token|id[_-]?token|api[\s_-]?key|x-api-key|apikey|client[_-]?secret|password|passwd|cookie|set-cookie|service[-_ ]?role|(?:request[_ -]?)?headers?)\s*["']?\s*[:=]/i
  const authorizationValue = /\b(?:bearer|basic)\s+\S+/i
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

function safeFortuneAiErrorString(value: unknown) {
  if (typeof value !== 'string') return ''
  const text = value.trim()
  return text && !fortuneAiErrorLooksUnsafe(text) ? text : ''
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

function functionsErrorStatus(context: unknown) {
  if (!context || typeof context !== 'object') return null
  const status = Number((context as { status?: unknown }).status)
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : null
}

function recordFromUnknown(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

async function readFunctionsResponseJson(context: unknown) {
  if (!isFunctionsResponseContext(context) || context.bodyUsed) return null
  try {
    const parsed = await context.clone().json()
    return recordFromUnknown(parsed)
  } catch {
    return null
  }
}

export async function fortuneAiStartErrorMessage(error: unknown, invokeData: unknown) {
  const fallback = FORTUNE_AI_START_ERROR_FALLBACK
  const isHttpError = error instanceof Error && error.name === 'FunctionsHttpError'
  if (!isHttpError) {
    const message = error instanceof Error ? error.message : 'AI 해설 요청에 실패했어.'
    return fortuneAiErrorLooksUnsafe(message) ? fallback : message
  }

  const context = functionsHttpContext(error)
  const status = functionsErrorStatus(context)
  const json = recordFromUnknown(invokeData) ?? await readFunctionsResponseJson(context)
  if (json) {
    const safe = safeFortuneAiErrorString(json.error)
    if (safe) return safe
    if (typeof json.error === 'string') return fallback
    return status ? 'HTTP ' + status + ' · ' + fallback : fallback
  }
  return fallback
}
