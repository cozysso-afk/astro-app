import { createClient, type Session } from '@supabase/supabase-js'

const DEFAULT_SUPABASE_URL = 'https://dbynfabwfcakxayyggzi.supabase.co'
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_IEf9R9oJ5kbn513DdeqODQ_DwLeF35r'
const PENDING_ANONYMOUS_LINK_KEY = 'astro_private_pending_anonymous_link_v1'
const PENDING_ANONYMOUS_LINK_TTL_MS = 60 * 60 * 1000

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? DEFAULT_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? DEFAULT_SUPABASE_PUBLISHABLE_KEY

// Resolve the browser fetch at invocation time so the narrow precision transport
// guard installed before React render also applies to Supabase Edge calls.
const dynamicFetch: typeof fetch = (input, init) => globalThis.fetch(input, init)

// Only the browser-safe publishable key is used here. Never put a secret/service-role key in Vite client code.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { fetch: dynamicFetch },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export type PendingAnonymousLink = {
  userId: string
  email: string
  startedAt: number
}

export async function getSupabaseSession(): Promise<Session | null> {
  const current = await supabase.auth.getSession()
  if (current.error) throw current.error
  return current.data.session ?? null
}

export function isPermanentEmailSession(session: Session | null): boolean {
  return Boolean(session?.user?.email && session?.user?.is_anonymous !== true)
}

export function rememberPendingAnonymousLink(userId: string, email: string) {
  if (typeof window === 'undefined') return
  const payload: PendingAnonymousLink = {
    userId,
    email: email.trim().toLowerCase(),
    startedAt: Date.now(),
  }
  window.localStorage.setItem(PENDING_ANONYMOUS_LINK_KEY, JSON.stringify(payload))
}

export function readPendingAnonymousLink(): PendingAnonymousLink | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(PENDING_ANONYMOUS_LINK_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<PendingAnonymousLink>
    if (!parsed.userId || !parsed.email || typeof parsed.startedAt !== 'number') {
      window.localStorage.removeItem(PENDING_ANONYMOUS_LINK_KEY)
      return null
    }
    if (Date.now() - parsed.startedAt > PENDING_ANONYMOUS_LINK_TTL_MS) {
      window.localStorage.removeItem(PENDING_ANONYMOUS_LINK_KEY)
      return null
    }
    return {
      userId: String(parsed.userId),
      email: String(parsed.email).trim().toLowerCase(),
      startedAt: parsed.startedAt,
    }
  } catch {
    window.localStorage.removeItem(PENDING_ANONYMOUS_LINK_KEY)
    return null
  }
}

export function clearPendingAnonymousLink() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(PENDING_ANONYMOUS_LINK_KEY)
}

export function getAuthRedirectError(): string | null {
  if (typeof window === 'undefined' || !window.location.hash) return null
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const code = params.get('error_code')
  const description = params.get('error_description')
  if (!code && !description) return null
  return description ? description.replace(/\+/g, ' ') : `인증 링크 오류 (${code})`
}

export async function countCurrentCloudRecords(): Promise<number> {
  const session = await getSupabaseSession()
  if (!session) return 0

  const [readingResult, relationshipResult] = await Promise.all([
    supabase.from('readings').select('id', { count: 'exact', head: true }),
    supabase.from('relationship_readings').select('id', { count: 'exact', head: true }),
  ])
  if (readingResult.error) throw readingResult.error
  if (relationshipResult.error) throw relationshipResult.error
  return Number(readingResult.count ?? 0) + Number(relationshipResult.count ?? 0)
}

// Existing anonymous sessions are intentionally preserved so the current device can
// link its email identity without changing user_id. New anonymous sessions are never created.
// The Change Email template also includes {{ .Token }} for in-app verification.
export async function linkAnonymousSessionToEmail(email: string) {
  const session = await getSupabaseSession()
  if (!session?.user?.is_anonymous) throw new Error('연결할 기존 익명 세션이 없어.')
  const result = await supabase.auth.updateUser({ email: email.trim().toLowerCase() })
  if (result.error) throw result.error
  return result.data
}

// OTP delivery uses the project's Magic Link template containing {{ .Token }}.
// No redirect is used: verification creates the session in this app context.
export async function requestEmailCode(email: string) {
  const result = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(), options: { shouldCreateUser: false },
  })
  if (result.error) throw result.error
  return result.data
}

export async function signOutSupabase() {
  const result = await supabase.auth.signOut()
  if (result.error) throw result.error
}

export async function verifyEmailCode(email: string, token: string) {
  const normalized = email.trim().toLowerCase()
  const code = token.trim()
  if (!/^\d{6,10}$/.test(code)) throw new Error('메일에 적힌 숫자 인증번호를 확인해줘.')
  const pending = readPendingAnonymousLink()
  if (pending && pending.email !== normalized) throw new Error('이메일 연결을 시작한 주소와 달라. 원래 주소를 확인해줘.')
  const result = await supabase.auth.verifyOtp({
    email: normalized, token: code, type: pending ? 'email_change' : 'email',
  })
  if (result.error) {
    const status = result.error.status
    if (status === 429) throw new Error('인증을 너무 자주 시도했어. 잠시 후 다시 입력해줘.')
    throw new Error('인증번호가 맞지 않거나 만료됐어. 가장 최근 메일의 번호를 확인해줘.')
  }
  const session = result.data.session ?? await getSupabaseSession()
  if (!session || !isPermanentEmailSession(session)) throw new Error('이메일 확인이 더 필요해. 가장 최근 메일의 번호를 확인해줘.')
  if ((session.user.email ?? '').trim().toLowerCase() !== normalized || (pending && session.user.id !== pending.userId)) {
    await signOutSupabase()
    throw new Error('인증된 계정이 기존 기록 계정과 달라 로그인을 중단했어.')
  }
  return session
}

export async function ensureSupabaseSession(): Promise<Session> {
  const session = await getSupabaseSession()
  if (!session) throw new Error('이메일 로그인이 필요해.')
  if (!isPermanentEmailSession(session)) throw new Error('이메일 인증을 완료해줘.')
  return session
}
