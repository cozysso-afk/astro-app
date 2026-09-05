import { createClient, type Session } from '@supabase/supabase-js'

const DEFAULT_SUPABASE_URL = 'https://dbynfabwfcakxayyggzi.supabase.co'
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_IEf9R9oJ5kbn513DdeqODQ_DwLeF35r'

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

export async function getSupabaseSession(): Promise<Session | null> {
  const current = await supabase.auth.getSession()
  if (current.error) throw current.error
  return current.data.session ?? null
}

export function isPermanentEmailSession(session: Session | null): boolean {
  return Boolean(session?.user?.email && session?.user?.is_anonymous !== true)
}

// Existing anonymous sessions are intentionally preserved so the current device can
// link its email identity without changing user_id. New anonymous sessions are never created.
export async function linkAnonymousSessionToEmail(email: string) {
  const session = await getSupabaseSession()
  if (!session?.user?.is_anonymous) throw new Error('연결할 기존 익명 세션이 없어.')
  const result = await supabase.auth.updateUser({ email: email.trim().toLowerCase() })
  if (result.error) throw result.error
  return result.data
}

export async function requestEmailOtp(email: string) {
  const normalized = email.trim().toLowerCase()
  const result = await supabase.auth.signInWithOtp({
    email: normalized,
    options: { shouldCreateUser: false },
  })
  if (result.error) throw result.error
  return result.data
}

export async function verifyEmailOtp(email: string, token: string) {
  const result = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: 'email',
  })
  if (result.error) throw result.error
  return result.data.session ?? null
}

export async function verifyEmailChangeOtp(email: string, token: string) {
  const result = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: 'email_change',
  })
  if (result.error) throw result.error
  return result.data.session ?? (await getSupabaseSession())
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
