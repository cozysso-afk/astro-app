import type { Session } from '@supabase/supabase-js'
import { getSupabaseSession, supabase } from './supabase'

const DEFAULT_API_BASE = 'https://astro-app-api-f7fn.onrender.com'
export const PRIVATE_API_BASE = (import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/$/, '')

export type AppAccess = {
  allowed: boolean
  email?: string
  role?: string
}

let originalFetch: typeof window.fetch | null = null
let authenticatedFetchInstalled = false

export async function checkAppAccess(session: Session): Promise<AppAccess> {
  const email = (session.user.email ?? '').trim().toLowerCase()
  if (!email || session.user.is_anonymous === true) return { allowed: false }

  // Login must not depend on the Render calculation API being awake or reachable.
  // app_access has RLS that only exposes an enabled row for the authenticated
  // email and, when bound, the exact auth.uid(). The calculation API still
  // performs the same allowlist check on every /v1 request after login.
  const { data, error } = await supabase
    .from('app_access')
    .select('email,role,user_id')
    .eq('enabled', true)
    .eq('email', email)
    .maybeSingle()

  if (error) {
    throw new Error('로그인 권한을 확인하는 중 연결이 끊겼어. 네트워크를 확인하고 다시 눌러줘.')
  }
  if (!data) return { allowed: false }

  const boundUserId = typeof data.user_id === 'string' ? data.user_id : ''
  if (boundUserId && boundUserId !== session.user.id) return { allowed: false }

  return {
    allowed: true,
    email: typeof data.email === 'string' ? data.email : email,
    role: typeof data.role === 'string' ? data.role : undefined,
  }
}

export function installAuthenticatedApiFetch() {
  if (authenticatedFetchInstalled || typeof window === 'undefined') return
  originalFetch = window.fetch.bind(window)
  const base = PRIVATE_API_BASE

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url

    if (!url.startsWith(base)) return originalFetch!(input, init)

    const session = await getSupabaseSession()
    if (!session?.access_token) {
      return new Response(JSON.stringify({ detail: '이메일 로그인이 필요해.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const headers = new Headers(input instanceof Request ? input.headers : undefined)
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value))
    headers.set('Authorization', `Bearer ${session.access_token}`)

    if (input instanceof Request) {
      return originalFetch!(new Request(input, { ...init, headers }))
    }
    return originalFetch!(input, { ...init, headers })
  }) as typeof window.fetch

  authenticatedFetchInstalled = true
}
