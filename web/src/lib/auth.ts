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

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

function jsonResponse(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function runAsyncReunionRelationship(
  fetcher: typeof window.fetch,
  base: string,
  init: RequestInit,
  headers: Headers,
): Promise<Response> {
  const body = init.body
  if (typeof body !== 'string') return fetcher(`${base}/v1/relationship/western`, { ...init, headers })

  const deadline = Date.now() + 120_000
  let lastDetail = '재회운 계산 시간이 너무 길어졌어. 잠시 후 다시 시도해줘.'

  for (let launch = 0; launch < 2; launch += 1) {
    if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    const startResponse = await fetcher(`${base}/v1/relationship/western/start`, {
      ...init,
      method: 'POST',
      headers,
      body,
    })
    if (!startResponse.ok) return startResponse

    const started = await startResponse.json().catch(() => ({})) as { job_id?: string; status?: string }
    if (!started.job_id) return jsonResponse({ detail: '재회운 계산 작업을 시작하지 못했어.' }, 502)

    let lostJob = false
    let transientFailures = 0

    while (Date.now() < deadline) {
      if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      await sleep(launch === 0 && transientFailures === 0 ? 1000 : 1500)

      let pollResponse: Response
      try {
        pollResponse = await fetcher(
          `${base}/v1/relationship/western/jobs/${encodeURIComponent(started.job_id)}`,
          { method: 'GET', headers, signal: init.signal },
        )
      } catch (error) {
        transientFailures += 1
        if (transientFailures <= 3) continue
        throw error
      }

      const job = await pollResponse.json().catch(() => ({})) as {
        status?: string
        status_code?: number
        error?: string
        result_ready?: boolean
      }

      if (pollResponse.status === 404) {
        lostJob = true
        lastDetail = typeof job.error === 'string' ? job.error : '계산 중 서버가 재시작되어 작업이 사라졌어.'
        break
      }
      if (!pollResponse.ok) {
        if ([502, 503, 504].includes(pollResponse.status) && transientFailures < 3) {
          transientFailures += 1
          continue
        }
        return jsonResponse({ detail: job.error || '재회운 계산 상태를 확인하지 못했어.' }, pollResponse.status)
      }

      transientFailures = 0
      if (job.status === 'done') {
        const resultResponse = await fetcher(
          `${base}/v1/relationship/western/jobs/${encodeURIComponent(started.job_id)}/result`,
          { method: 'GET', headers, signal: init.signal },
        )
        return resultResponse
      }
      if (job.status === 'failed') {
        return jsonResponse({ detail: job.error || '재회운 계산이 실패했어.' }, job.status_code || 500)
      }
    }

    if (!lostJob) break
  }

  return jsonResponse({ detail: lastDetail }, 504)
}

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

    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    const isRelationshipPost = url === `${base}/v1/relationship/western` && method === 'POST'
    let reunionRequest = false
    if (isRelationshipPost && typeof init?.body === 'string') {
      try {
        reunionRequest = JSON.parse(init.body)?.analysis_mode === 'reunion'
      } catch {
        reunionRequest = false
      }
    }

    if (reunionRequest && !(input instanceof Request)) {
      return runAsyncReunionRelationship(originalFetch!, base, init ?? {}, headers)
    }

    if (input instanceof Request) {
      return originalFetch!(new Request(input, { ...init, headers }))
    }
    return originalFetch!(input, { ...init, headers })
  }) as typeof window.fetch

  authenticatedFetchInstalled = true
}
