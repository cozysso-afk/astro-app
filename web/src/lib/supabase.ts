import { createClient, type Session } from '@supabase/supabase-js'

const DEFAULT_SUPABASE_URL = 'https://dbynfabwfcakxayyggzi.supabase.co'
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_IEf9R9oJ5kbn513DdeqODQ_DwLeF35r'
const PENDING_ANONYMOUS_LINK_KEY = 'astro_private_pending_anonymous_link_v1'
const PENDING_ANONYMOUS_LINK_TTL_MS = 60 * 60 * 1000

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? DEFAULT_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? DEFAULT_SUPABASE_PUBLISHABLE_KEY

// Only the browser-safe publishable key is used here. Never put a secret/service-role key in Vite client code.
export const supabase = createClient(supabaseUrl, supabaseKey, {
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

function currentAppRedirectUrl(): string | undefined {
  if (typeof window === 'undefined') return undefined
  return `${window.location.origin}/`
}

// Existing anonymous sessions are intentionally preserved so the current device can
// link its email identity without changing user_id. New anonymous sessions are never created.
// Supabase's default email-change template contains a confirmation link, so custom SMTP
// or a custom six-digit OTP template is not required for this private-app flow.
// The first anonymous-email conversion still relies on Supabase Site URL because updateUser
// owns that confirmation redirect; post-conversion Magic Link sign-ins are pinned below.
export async function linkAnonymousSessionToEmail(email: string) {
  const session = await getSupabaseSession()
  if (!session?.user?.is_anonymous) throw new Error('연결할 기존 익명 세션이 없어.')
  const result = await supabase.auth.updateUser({ email: email.trim().toLowerCase() })
  if (result.error) throw result.error
  return result.data
}

// signInWithOtp sends the project's default Magic Link email when the template still
// uses {{ .ConfirmationURL }}. shouldCreateUser=false prevents arbitrary sign-up.
// Explicit emailRedirectTo prevents a stale/default Site URL from hijacking normal logins.
export async function requestEmailMagicLink(email: string) {
  const normalized = email.trim().toLowerCase()
  const emailRedirectTo = currentAppRedirectUrl()
  const result = await supabase.auth.signInWithOtp({
    email: normalized,
    options: {
      shouldCreateUser: false,
      ...(emailRedirectTo ? { emailRedirectTo } : {}),
    },
  })
  if (result.error) throw result.error
  return result.data
}

export async function signOutSupabase() {
  const result = await supabase.auth.signOut()
  if (result.error) throw result.error
}

export async function ensureSupabaseSession(): Promise<Session> {
  const session = await getSupabaseSession()
  if (!session) throw new Error('이메일 로그인이 필요해.')
  if (!isPermanentEmailSession(session)) throw new Error('이메일 인증을 완료해줘.')
  return session
}
