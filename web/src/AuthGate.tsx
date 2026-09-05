import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { checkAppAccess, installAuthenticatedApiFetch } from './lib/auth'
import {
  getSupabaseSession,
  isPermanentEmailSession,
  linkAnonymousSessionToEmail,
  requestEmailOtp,
  signOutSupabase,
  supabase,
  verifyEmailChangeOtp,
  verifyEmailOtp,
} from './lib/supabase'

type GateStage = 'booting' | 'email' | 'code' | 'allowed'
type OtpKind = 'email' | 'email_change'

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
  const [token, setToken] = useState('')
  const [otpKind, setOtpKind] = useState<OtpKind>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function authorize(nextSession: Session) {
    if (!isPermanentEmailSession(nextSession)) {
      setSession(nextSession)
      setStage('email')
      return
    }
    const access = await checkAppAccess(nextSession)
    if (!access.allowed) {
      await signOutSupabase().catch(() => undefined)
      setSession(null)
      setStage('email')
      throw new Error('이 계정에는 별빛의 운명 접근 권한이 없어.')
    }
    installAuthenticatedApiFetch()
    setSession(nextSession)
    setEmail(nextSession.user.email ?? '')
    setError('')
    setStage('allowed')
  }

  useEffect(() => {
    let active = true
    getSupabaseSession()
      .then(async (current) => {
        if (!active) return
        setSession(current)
        if (current && isPermanentEmailSession(current)) await authorize(current)
        else setStage('email')
      })
      .catch((err) => {
        if (!active) return
        setError(authMessage(err))
        setStage('email')
      })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active || !nextSession || !isPermanentEmailSession(nextSession)) return
      void authorize(nextSession).catch((err) => setError(authMessage(err)))
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  async function sendCode(event: FormEvent) {
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
        try {
          await linkAnonymousSessionToEmail(normalized)
          setOtpKind('email_change')
          setNotice('기존 기록 계정을 유지하면서 이메일을 연결하고 있어. 메일로 받은 6자리 코드를 입력해줘.')
        } catch (linkError) {
          if (!existingEmailError(linkError)) throw linkError
          await signOutSupabase()
          setSession(null)
          await requestEmailOtp(normalized)
          setOtpKind('email')
          setNotice('이미 연결된 계정이야. 메일로 받은 6자리 코드를 입력해줘.')
        }
      } else {
        await requestEmailOtp(normalized)
        setOtpKind('email')
        setNotice('메일로 받은 6자리 코드를 입력해줘.')
      }
      setEmail(normalized)
      setToken('')
      setStage('code')
    } catch (err) {
      setError(authMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault()
    if (!/^\d{6}$/.test(token.trim())) {
      setError('6자리 인증 코드를 입력해줘.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const nextSession = otpKind === 'email_change'
        ? await verifyEmailChangeOtp(email, token)
        : await verifyEmailOtp(email, token)
      if (!nextSession) throw new Error('인증 세션을 만들지 못했어.')
      await authorize(nextSession)
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
      setSession(null)
      setToken('')
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
          <form className="private-auth-form" onSubmit={sendCode}>
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
            <button type="submit" disabled={busy}>{busy ? '전송 중…' : '인증 코드 받기'}</button>
          </form>
        ) : (
          <form className="private-auth-form" onSubmit={verifyCode}>
            <label htmlFor="private-auth-code">6자리 인증 코드</label>
            <input
              id="private-auth-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={token}
              onChange={(event) => setToken(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              disabled={busy}
            />
            <button type="submit" disabled={busy}>{busy ? '확인 중…' : '로그인'}</button>
            <button className="private-auth-secondary" type="button" onClick={() => { setStage('email'); setToken(''); setError('') }} disabled={busy}>
              다른 이메일 사용
            </button>
          </form>
        )}

        {notice && <p className="private-auth-notice">{notice}</p>}
        {error && <p className="private-auth-error">{error}</p>}
        <p className="private-auth-footnote">비밀번호는 저장하지 않아. 인증 메일과 Supabase 세션만 사용해.</p>
      </section>
    </main>
  )
}
