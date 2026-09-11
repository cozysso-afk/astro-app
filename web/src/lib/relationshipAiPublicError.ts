import { FunctionsHttpError, FunctionsFetchError, FunctionsRelayError } from '@supabase/supabase-js'
import { publicRelationshipResult } from '../../../supabase/functions/relationship-interpret-v9-preview/publicError'
import type { RelationshipAiResponse } from '../appTypes'

export const RELATIONSHIP_ERROR_FALLBACK = '관계 AI 해설을 불러오지 못했어. 잠시 뒤 다시 시도해줘.'
export const RELATIONSHIP_CONNECTION_FALLBACK = '관계 AI 해설 서버에 연결하지 못했어. 연결 상태를 확인해줘.'
export const RELATIONSHIP_RELAY_FALLBACK = '관계 AI 해설 서버 연결이 잠시 불안정해. 잠시 뒤 다시 시도해줘.'
const PUBLIC_MESSAGES: Record<string,string> = {
  REL_METHOD_NOT_ALLOWED: '지원하지 않는 요청 방식이야.',
  REL_INVALID_REQUEST: '관계 AI 해설 요청을 확인해줘.',
  REL_AUTH_REQUIRED: '인증이 필요해.',
  REL_UPSTREAM_NOT_CONFIGURED: '관계 AI 해설 서버 설정이 필요해.',
  REL_COST_GUARD_BLOCKED: '관계 AI 비용 보호 한도에 도달했어. 잠시 뒤 다시 시도해.',
  REL_CACHE_READ_FAILED: '관계 AI 해설 저장 상태를 확인하지 못했어.',
  REL_JOB_CREATE_FAILED: '관계 AI 해설 작업을 시작하지 못했어.',
  REL_GENERATION_TIMEOUT: '관계 AI 해설 시간이 초과됐어.',
  REL_GENERATION_FAILED: '관계 AI 해설 생성에 실패했어.',
  REL_RESULT_INVALID: '관계 AI 해설 결과를 안전하게 확인하지 못했어.',
  REL_JOB_FINALIZE_FAILED: '관계 AI 해설 저장을 완료하지 못했어.',
  REL_CACHED_RESULT_INVALID: '저장된 관계 AI 해설을 안전하게 확인하지 못했어.',
}

// Classification primitives copied from PR #100; Fortune behavior is untouched.
function decodeEscapesOnce(value: string) {
  let decoded = value.replace(/(?:%[0-9A-Fa-f]{2})+/g, (encoded) => {
    try { return decodeURIComponent(encoded) } catch {
      // Invalid UTF bytes must not poison neighboring ASCII credential keys.
      return encoded.replace(/%[0-7][0-9a-f]|(?:%[89a-f][0-9a-f])+/gi, (bytes) => {
        // Keep valid UTF runs (including Cf) classifiable; invalid runs are separators.
        try { return decodeURIComponent(bytes) } catch { return ' ' }
      })
    }
  })
  decoded = decoded
    .replace(/\\u\{([0-9a-f]{1,6})\}/gi, (_, hex) => {
      try { return String.fromCodePoint(Number.parseInt(hex, 16)) } catch { return '' }
    })
    .replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\x([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\(["'\\])/g, '$1')
  // A malformed percent fragment is a separator, not part of the next key.
  return decoded.replace(/%(?![0-9a-f]{2})[a-z0-9]{0,2}/gi, ' ').normalize('NFKC').replace(/\p{Cf}/gu, '')
}

function classificationText(text: string) {
  let normalized = text
  for (let round = 0; round < 2; round += 1) normalized = decodeEscapesOnce(normalized)
  return normalized
}

export function relationshipAiErrorLooksUnsafe(text: string) {
  if (text.length > 4096) return true
  const normalized = classificationText(text)
  const credentialKey = /(?:^|[?&#;\s"'“”‘’[{,(])(?:authorization|access[_-]?token|refresh[_-]?token|id[_-]?token|api[\s_-]?key|x-api-key|apikey|client[_-]?secret|password|passwd|cookie|set-cookie|service[-_ ]?role|(?:request[_ -]?)?headers?)\s*["'“”‘’]?\s*[:=]\s*["'“”‘’]?\s*\S/i
  const authorizationValue = /\b(?:bearer|basic)\s+(?!auth(?:entication)?\b)[a-z0-9._~+\/-]{4,}={0,2}/i
  const jwt = /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/
  const uuid = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i
  const credentialPrefix = /\b(?:sk-|sb_secret_|sb_publishable_)[A-Za-z0-9_-]+/i
  const secretQuery = /https?:\/\/[^\s"'<>]*(?:[?&#])[^#\s"'&=]*(?:token|key|secret|password|passwd|signature|credential|code)[^#\s"'&=]*=/i
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
  return text && !relationshipAiErrorLooksUnsafe(text) ? text : ''
}


export function relationshipAiPublicErrorMessage(value:unknown) {
  const r=recordFromUnknown(value)
  if(!r)return RELATIONSHIP_ERROR_FALLBACK
  const code=typeof r.error_code==='string'?r.error_code:''
  if(Object.prototype.hasOwnProperty.call(PUBLIC_MESSAGES,code))return PUBLIC_MESSAGES[code]
  return safeLegacyMessage(r.error)||RELATIONSHIP_ERROR_FALLBACK
}
export async function relationshipAiInvokeErrorMessage(error:unknown) {
  if(error instanceof FunctionsFetchError)return RELATIONSHIP_CONNECTION_FALLBACK
  if(error instanceof FunctionsRelayError)return RELATIONSHIP_RELAY_FALLBACK
  if(error instanceof FunctionsHttpError){
    const response=error.context
    if(response instanceof Response&&!response.bodyUsed){
      try{return relationshipAiPublicErrorMessage(await response.clone().json())}catch{/* fixed fallback */}
    }
  }
  return RELATIONSHIP_ERROR_FALLBACK
}
// Only values passing the explicit boundary are carried through the final catch.
export class RelationshipAiPublicError extends Error {
  constructor(payload:unknown){super(relationshipAiPublicErrorMessage(payload))}
}
export function relationshipAiCatchMessage(error:unknown) {
  return error instanceof RelationshipAiPublicError?error.message:RELATIONSHIP_ERROR_FALLBACK
}
export function relationshipAiSuccess(value:unknown):RelationshipAiResponse|null {
  return publicRelationshipResult(value) as RelationshipAiResponse|null
}
