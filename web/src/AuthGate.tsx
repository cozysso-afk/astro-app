import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { checkAppAccess, installAuthenticatedApiFetch } from './lib/auth'
import {
  clearPendingAnonymousLink,
  countCurrentCloudRecords,
  getAuthRedirectError,
  getSupabaseSession,
  isPermanentEmailSession,
  linkAnonymousSessionToEmail,
  readPendingAnonymousLink,
  rememberPendingAnonymousLink,
  requestEmailMagicLink,
  signOutSupabase,
} from './lib/supabase'

type GateStage = 'booting' | 'email' | 'sent' | 'allowed'

function authMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return '로그인 처리 중 오류가 발생했어.'
}

function existingEmailError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const code = String((error as { code?: unknown }).code ?? '').toLowerCase()
  const message = String((error as { message?: unknown }).message ?? '').toLowerCase()
  return code.includes('already') || code.includes('exists') || message.includes('already') || message.includes('registered') || message.includes('exists')
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<GateStage>('booting')
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function authorize(nextSession: Session) {
    if (!isPermanentEmailSession(nextSession)) {
      setSession(nextSession)
      setStage('email')
      return
    }

    const pending = readPendingAnonymousLink()
    if (pending) {
      const authenticatedEmail = (nextSession.user.email ?? '').trim().toLowerCase()
      if (nextSession.user.id !== pending.userId || authenticatedEmail !== pending.email) {
        await signOutSupabase().catch(() => undefined)
        clearPendingAnonymousLink()
        setSession(null)
        setStage('email')
        throw new Error('이메일 연결 뒤 기존 기록 계정과 다른 사용자 ID가 확인됐어. 기록 보호를 위해 로그인을 중단했어.')
      }
    }

    const access = await checkAppAccess(nextSession)
    if (!access.allowed) {
      await signOutSupabase().catch(() => undefined)
      setSession(null)
      setStage('email')
      throw new Error('이 계정에는 별빛의 운명 접근 권한이 없어.')
    }

    installAuthenticatedApiFetch()
    clearPendingAnonymousLink()
    setSession(nextSession)
    setEmail(nextSession.user.email ?? '')
    setError('')
    setNotice('')
    setStage('allowed')
  }

  useEffect(() => {
    let active = true
    const redirectError = getAuthRedirectError()
    if (redirectError) setError(redirectError)

    getSupabaseSession()
      .then(async (current) => {
        if (!active) return
        setSession(current)
        if (current && isPermanentEmailSession(current)) {
          await authorize(current)
          return
        }

        const pending = readPendingAnonymousLink()
        if (current?.user?.is_anonymous && pending?.userId === current.user.id) {
          setEmail(pending.email)
          setNotice('인증 메일을 보냈어. 메일 안의 확인 링크를 누르면 기존 기록 계정 그대로 로그인돼.')
          setStage('sent')
          return
        }
        setStage('email')
      })
      .catch((err) => {
        if (!active) return
        setError(authMessage(err))
        setStage('email')
      })

    return () => {
      active = false
    }
  }, [])

  async function sendLink(event: FormEvent) {
    event.preventDefault()
    const normalized = email.trim().toLowerCase()
    if (!normalized || !normalized.includes('@')) {
      setError('이메일 주소를 확인해줘.')
      return
    }

    setBusy(true)
    setError('')
    setNotice('')
    try {
      const current = session ?? await getSupabaseSession()
      if (current?.user?.is_anonymous) {
        rememberPendingAnonymousLink(current.user.id, normalized)
        try {
          await linkAnonymousSessionToEmail(normalized)
          setNotice('기존 기록 계정 ID를 유지하면서 이메일을 연결하고 있어. 메일에서 새 이메일 확인 링크를 눌러줘.')
        } catch (linkError) {
          clearPendingAnonymousLink()
          if (!existingEmailError(linkError)) throw linkError

          const cloudRecordCount = await countCurrentCloudRecords()
          if (cloudRecordCount > 0) {
            throw new Error(`이 기기의 익명 계정에 클라우드 기록 ${cloudRecordCount}건이 있어서 기존 이메일 계정으로 자동 전환하지 않았어. 기록 이전을 먼저 확인해야 해.`)
          }

          await signOutSupabase()
          setSession(null)
          await requestEmailMagicLink(normalized)
          setNotice('이미 연결된 계정이야. 이 익명 계정에는 저장 기록이 없어 기존 이메일 계정용 로그인 링크를 보냈어.')
        }
      } else {
        clearPendingAnonymousLink()
        await requestEmailMagicLink(normalized)
        setNotice('로그인 링크를 이메일로 보냈어. 메일 안의 Sign in 링크를 눌러줘.')
      }
      setEmail(normalized)
      setStage('sent')
    } catch (err) {
      setError(authMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    setBusy(true)
    try {
      await signOutSupabase()
      clearPendingAnonymousLink()
      setSession(null)
      setNotice('로그아웃했어.')
      setStage('email')
    } finally {
      setBusy(false)
    }
  }

  if (stage === 'allowed') {
    return (
      <>
        {children}
        <button className="private-auth-logout" type="button" onClick={() => void logout()} disabled={busy} aria-label="로그아웃">
          로그아웃
        </button>
      </>
    )
  }

  return (
    <main className="private-auth-shell">
      <section className="private-auth-card" aria-live="polite">
        <div className="private-auth-mark">✦</div>
        <p className="private-auth-eyebrow">PRIVATE ACCESS</p>
        <h1>별빛의 운명</h1>
        <p className="private-auth-copy">
          개인용으로 보호된 공간이야. 허용된 이메일 계정으로 인증해야 들어갈 수 있어.
        </p>

        {stage === 'booting' ? (
          <div className="private-auth-loading">로그인 상태 확인 중…</div>
        ) : stage === 'email' ? (
          <form className="private-auth-form" onSubmit={sendLink}>
            <label htmlFor="private-auth-email">이메일</label>
            <input
              id="private-auth-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              disabled={busy}
            />
            <button type="submit" disabled={busy}>{busy ? '전송 중…' : '로그인 링크 받기'}</button>
          </form>
        ) : (
          <div className="private-auth-form">
            <div className="private-auth-loading">메일 확인을 기다리고 있어.</div>
            <button className="private-auth-secondary" type="button" onClick={() => { setStage('email'); setError(''); setNotice('') }} disabled={busy}>
              이메일 다시 입력
            </button>
          </div>
        )}

        {notice && <p className="private-auth-notice">{notice}</p>}
        {error && <p className="private-auth-error">{error}</p>}
        <p className="private-auth-footnote">비밀번호는 저장하지 않아. Supabase의 일회용 이메일 링크와 세션만 사용해.</p>
      </section>
    </main>
  )
}
