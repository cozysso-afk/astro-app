import type { Session } from '@supabase/supabase-js'
import { getSupabaseSession } from './supabase'

const DEFAULT_API_BASE = 'https://astro-app-api-f7fn.onrender.com'
export const PRIVATE_API_BASE = (import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/$/, '')

export type AppAccess = {
  allowed: boolean
  email?: string
  role?: string
}

let originalFetch: typeof window.fetch | null = null
let authenticatedFetchInstalled = false

function rawFetch(input: RequestInfo | URL, init?: RequestInit) {
  const fn = originalFetch ?? window.fetch.bind(window)
  return fn(input, init)
}

export async function checkAppAccess(session: Session): Promise<AppAccess> {
  const response = await rawFetch(`${PRIVATE_API_BASE}/v1/auth/me`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>
  if (response.status === 401) throw new Error('로그인 세션이 만료됐어. 다시 인증해줘.')
  if (response.status === 403) return { allowed: false }
  if (!response.ok || payload.allowed !== true) {
    throw new Error(typeof payload.detail === 'string' ? payload.detail : '앱 접근 권한을 확인하지 못했어.')
  }
  return {
    allowed: true,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    role: typeof payload.role === 'string' ? payload.role : undefined,
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
