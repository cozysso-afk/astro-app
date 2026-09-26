import type { Session } from '@supabase/supabase-js'
import { getSupabaseSession, supabase } from './supabase'

const DEFAULT_API_BASE = 'https://astro-app-api-f7fn.onrender.com'
export const PRIVATE_API_BASE = (import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/$/, '')
const AUTH_SESSION_TIMEOUT_MS = 5_000
const AUTH_SESSION_MIN_VALIDITY_MS = 30_000
const REUNION_JOB_MAX_AGE_MS = 29 * 60_000
const REUNION_POLL_INTERVAL_MS = 1_500
const REUNION_PENDING_STORAGE_PREFIX = 'astro.reunion.pending-job.v1'

export type AppAccess = {
  allowed: boolean
  email?: string
  role?: string
}

type PendingReunionJob = {
  jobId: string
  requestFingerprint: string
  createdAt: number
}

let originalFetch: typeof window.fetch | null = null
let authenticatedFetchInstalled = false
let authRefreshSubscriptionInstalled = false
let authorizedApiSession: Session | null = null

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

function jsonResponse(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function sessionHasUsableToken(session: Session | null): session is Session {
  if (!session?.access_token) return false
  const expiresAtMs = Number(session.expires_at ?? 0) * 1000
  return !expiresAtMs || expiresAtMs - Date.now() > AUTH_SESSION_MIN_VALIDITY_MS
}

function reunionRequestFingerprint(body: string): string {
  let hash = 2166136261
  for (let index = 0; index < body.length; index += 1) {
    hash ^= body.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `${body.length}:${(hash >>> 0).toString(16)}`
}

function reunionStorageKey(): string {
  return `${REUNION_PENDING_STORAGE_PREFIX}:${authorizedApiSession?.user.id ?? 'anonymous'}`
}

function readPendingReunionJob(body: string): PendingReunionJob | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(reunionStorageKey())
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PendingReunionJob>
    const valid = typeof parsed.jobId === 'string'
      && parsed.jobId.length > 0
      && parsed.requestFingerprint === reunionRequestFingerprint(body)
      && typeof parsed.createdAt === 'number'
      && Date.now() - parsed.createdAt < REUNION_JOB_MAX_AGE_MS
    if (!valid) {
      window.localStorage.removeItem(reunionStorageKey())
      return null
    }
    return parsed as PendingReunionJob
  } catch {
    return null
  }
}

function writePendingReunionJob(jobId: string, body: string): PendingReunionJob {
  const pending: PendingReunionJob = {
    jobId,
    requestFingerprint: reunionRequestFingerprint(body),
    createdAt: Date.now(),
  }
  try {
    window.localStorage.setItem(reunionStorageKey(), JSON.stringify(pending))
  } catch {
    // localStorage can be unavailable in private/broken WebView contexts; the active page can still poll.
  }
  return pending
}

function clearPendingReunionJob(jobId?: string) {
  if (typeof window === 'undefined') return
  try {
    if (!jobId) {
      window.localStorage.removeItem(reunionStorageKey())
      return
    }
    const raw = window.localStorage.getItem(reunionStorageKey())
    if (!raw) return
    const parsed = JSON.parse(raw) as Partial<PendingReunionJob>
    if (parsed.jobId === jobId) window.localStorage.removeItem(reunionStorageKey())
  } catch {
    // Best-effort cleanup only.
  }
}

export function getAuthorizedSessionSnapshot(): Session | null {
  return authorizedApiSession
}

export async function fetchAuthorizedReunionRelationship(init: RequestInit): Promise<Response> {
  const session = authorizedApiSession
  if (!sessionHasUsableToken(session)) {
    return jsonResponse({ detail: '로그인 세션을 다시 확인해야 해. 앱을 다시 열어줘.' }, 401)
  }
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${session.access_token}`)
  const fetcher = originalFetch ?? window.fetch.bind(window)
  return runAsyncReunionRelationship(fetcher, PRIVATE_API_BASE, init, headers)
}

async function getAuthorizedApiSession(): Promise<Session | null> {
  if (sessionHasUsableToken(authorizedApiSession)) return authorizedApiSession

  let timer: number | undefined
  try {
    const fresh = await Promise.race([
      getSupabaseSession(),
      new Promise<never>((_, reject) => {
        timer = window.setTimeout(
          () => reject(new Error('로그인 세션 확인이 지연되고 있어. 네트워크를 확인하고 다시 시도해줘.')),
          AUTH_SESSION_TIMEOUT_MS,
        )
      }),
    ])
    if (sessionHasUsableToken(fresh)) authorizedApiSession = fresh
    return fresh
  } finally {
    if (timer !== undefined) window.clearTimeout(timer)
  }
}

async function pollReunionJob(
  fetcher: typeof window.fetch,
  base: string,
  init: RequestInit,
  headers: Headers,
  pending: PendingReunionJob,
): Promise<Response | 'lost'> {
  let transientFailures = 0
  while (Date.now() - pending.createdAt < REUNION_JOB_MAX_AGE_MS) {
    if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    let pollResponse: Response
    try {
      pollResponse = await fetcher(
        `${base}/v1/relationship/western/jobs/${encodeURIComponent(pending.jobId)}`,
        { method: 'GET', headers, signal: init.signal },
      )
    } catch (error) {
      transientFailures += 1
      if (transientFailures <= 4) {
        await sleep(REUNION_POLL_INTERVAL_MS)
        continue
      }
      throw error
    }

    const job = await pollResponse.json().catch(() => ({})) as {
      status?: string
      status_code?: number
      error?: string
      detail?: string
      progress?: { phase?: string; percent?: number; detail?: string }
    }

    if (pollResponse.status === 404) {
      clearPendingReunionJob(pending.jobId)
      return 'lost'
    }
    if (!pollResponse.ok) {
      if ([502, 503, 504].includes(pollResponse.status) && transientFailures < 4) {
        transientFailures += 1
        await sleep(REUNION_POLL_INTERVAL_MS)
        continue
      }
      clearPendingReunionJob(pending.jobId)
      return jsonResponse({ detail: job.error || job.detail || '재회운 계산 상태를 확인하지 못했어.' }, pollResponse.status)
    }

    transientFailures = 0
    if (job.status === 'done') {
      const resultResponse = await fetcher(
        `${base}/v1/relationship/western/jobs/${encodeURIComponent(pending.jobId)}/result`,
        { method: 'GET', headers, signal: init.signal },
      )
      if (resultResponse.ok) clearPendingReunionJob(pending.jobId)
      return resultResponse
    }
    if (job.status === 'failed') {
      clearPendingReunionJob(pending.jobId)
      return jsonResponse({ detail: job.error || job.detail || '재회운 계산이 실패했어.' }, job.status_code || 500)
    }

    // iOS may suspend this timer while the PWA is backgrounded. That is intentional:
    // the server job keeps running, and this loop resumes with an immediate status check
    // when WebKit wakes the page again.
    await sleep(REUNION_POLL_INTERVAL_MS)
  }

  clearPendingReunionJob(pending.jobId)
  return jsonResponse({ detail: '재회운 계산 작업 보관 시간이 지나 종료됐어. 다시 계산해줘.' }, 504)
}

async function runAsyncReunionRelationship(
  fetcher: typeof window.fetch,
  base: string,
  init: RequestInit,
  headers: Headers,
): Promise<Response> {
  const body = init.body
  if (typeof body !== 'string') return fetcher(`${base}/v1/relationship/western`, { ...init, headers })

  let pending = readPendingReunionJob(body)
  for (let launch = 0; launch < 2; launch += 1) {
    if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    if (!pending) {
      const startResponse = await fetcher(`${base}/v1/relationship/western/start`, {
        ...init,
        method: 'POST',
        headers,
        body,
      })
      if (!startResponse.ok) return startResponse

      const started = await startResponse.json().catch(() => ({})) as { job_id?: string; status?: string }
      if (!started.job_id) return jsonResponse({ detail: '재회운 계산 작업을 시작하지 못했어.' }, 502)
      pending = writePendingReunionJob(started.job_id, body)
    }

    const result = await pollReunionJob(fetcher, base, init, headers, pending)
    if (result !== 'lost') return result
    pending = null
  }

  return jsonResponse({ detail: '계산 중 서버가 재시작되어 작업을 복구하지 못했어. 다시 눌러줘.' }, 503)
}

export async function checkAppAccess(session: Session): Promise<AppAccess> {
  const email = (session.user.email ?? '').trim().toLowerCase()
  if (!email || session.user.is_anonymous === true) {
    authorizedApiSession = null
    return { allowed: false }
  }

  const { data, error } = await supabase
    .from('app_access')
    .select('email,role,user_id')
    .eq('enabled', true)
    .eq('email', email)
    .maybeSingle()

  if (error) {
    authorizedApiSession = null
    throw new Error('로그인 권한을 확인하는 중 연결이 끊겼어. 네트워크를 확인하고 다시 눌러줘.')
  }
  if (!data) {
    authorizedApiSession = null
    return { allowed: false }
  }

  const boundUserId = typeof data.user_id === 'string' ? data.user_id : ''
  if (boundUserId && boundUserId !== session.user.id) {
    authorizedApiSession = null
    return { allowed: false }
  }

  authorizedApiSession = session
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

  if (!authRefreshSubscriptionInstalled) {
    supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_OUT') {
        authorizedApiSession = null
        return
      }
      if (nextSession && authorizedApiSession?.user.id === nextSession.user.id) {
        authorizedApiSession = nextSession
      }
    })
    authRefreshSubscriptionInstalled = true
  }

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url

    if (!url.startsWith(base)) return originalFetch!(input, init)

    const session = await getAuthorizedApiSession()
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
