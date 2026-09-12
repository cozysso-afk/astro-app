import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { rememberEmailCode, forgetEmailCode, pendingEmailCode } from './lib/pendingEmailCode'
import { AccountActionsContext } from './AccountActions'
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
  requestEmailCode,
  signOutSupabase,
  verifyEmailCode,
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
  const [verificationCode, setVerificationCode] = useState('')
  const [resendAt, setResendAt] = useState(0)
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    if (!resendAt) return
    const update = () => setRemaining(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)))
    update()
    const id = window.setInterval(() => { update(); if (Date.now() >= resendAt) window.clearInterval(id) }, 1000)
    return () => window.clearInterval(id)
  }, [resendAt])

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

    forgetEmailCode()
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
          setResendAt(pendingEmailCode()?.resendAt ?? 0)
          setNotice('인증 메일의 숫자 번호를 이 앱에 입력하면 기존 기록 계정으로 이어져.')
          setStage('sent')
          return
        }
        const pendingCode = pendingEmailCode()
        if (pendingCode) { setEmail(pendingCode.email); setResendAt(pendingCode.resendAt); setStage('sent'); return }
        setStage('email')
      })
      .catch((err) => {
        if (!active) return
        setError(authMessage(err))
        const pendingCode = pendingEmailCode()
        if (pendingCode) { setEmail(pendingCode.email); setResendAt(pendingCode.resendAt); setStage('sent'); return }
        setStage('email')
      })

    return () => {
      active = false
    }
  }, [])

  async function sendCode(event: { preventDefault: () => void }) {
    event.preventDefault()
    if (busy || Date.now() < resendAt) return
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
          setNotice('기존 기록 계정에 이메일을 연결하고 있어. 메일의 인증번호를 아래에 입력해줘.')
        } catch (linkError) {
          clearPendingAnonymousLink()
          if (!existingEmailError(linkError)) throw linkError

          const cloudRecordCount = await countCurrentCloudRecords()
          if (cloudRecordCount > 0) {
            throw new Error(`이 기기의 익명 계정에 클라우드 기록 ${cloudRecordCount}건이 있어서 기존 이메일 계정으로 자동 전환하지 않았어. 기록 이전을 먼저 확인해야 해.`)
          }

          await signOutSupabase()
          setSession(null)
          await requestEmailCode(normalized)
          setNotice('이미 연결된 계정이야. 기존 이메일 계정용 인증번호를 보냈어.')
        }
      } else {
        clearPendingAnonymousLink()
        await requestEmailCode(normalized)
        setNotice('인증번호를 보냈어. 메일을 확인하고 이 앱으로 돌아와 입력해줘.')
      }
      setEmail(normalized)
      setVerificationCode('')
      const nextResendAt = Date.now() + 60000
      rememberEmailCode(normalized, nextResendAt)
      setResendAt(nextResendAt)
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
      forgetEmailCode()
      setNotice('로그아웃했어.')
      setStage('email')
    } finally {
      setBusy(false)
    }
  }

  async function finishInApp(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    const code = verificationCode
    setVerificationCode('')
    try {
      const verified = session && isPermanentEmailSession(session) ? session : await verifyEmailCode(email, code)
      setSession(verified)
      await authorize(verified)
    } catch (err) {
      setError(authMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (stage === 'allowed') {
    return (
      <AccountActionsContext.Provider value={{ logout, busy }}>
        {children}
      </AccountActionsContext.Provider>
    )
  }

  return (
    <main className="private-auth-shell">
      <section className="private-auth-card" aria-live="polite">
        <div className="private-auth-mark" aria-hidden="true">☾<span>✦</span></div>
        <p className="private-auth-eyebrow">나만의 별빛 기록</p>
        <h1>별빛의 운명</h1>
        <p className="private-auth-copy">
          허용된 이메일로 로그인하고, 나의 운세와 저장한 기록을 이어서 만나봐.
        </p>

        {stage === 'booting' ? (
          <div className="private-auth-loading" role="status"><span className="private-auth-orbit" aria-hidden="true"/>로그인 상태를 확인하고 있어…</div>
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
            <button type="submit" disabled={busy || remaining > 0}>{busy ? '전송 중…' : remaining > 0 ? `${remaining}초 후 다시 받기` : '인증번호 받기'}</button>
          </form>
        ) : (
          <form className="private-auth-form" onSubmit={finishInApp}>
            <strong>인증번호 입력</strong>
            <p className="private-auth-instructions">{email}로 받은 숫자 인증번호를 입력해줘. 메일의 링크를 열 필요 없이 이 앱에서 로그인이 끝나.</p>
            <label htmlFor="private-auth-code">이메일 인증번호</label>
            <input id="private-auth-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} autoFocus spellCheck={false} value={verificationCode} onChange={event => setVerificationCode(event.target.value.replace(/[^0-9]/g, ''))} placeholder="숫자 인증번호" disabled={busy}/>
            <button type="submit" disabled={busy || (!isPermanentEmailSession(session) && !/^\d{6,10}$/.test(verificationCode))}>{busy ? '인증 중…' : isPermanentEmailSession(session) ? '로그인 다시 확인' : '로그인'}</button>
            <button className="private-auth-secondary" type="button" onClick={sendCode} disabled={busy || remaining > 0}>{remaining > 0 ? `${remaining}초 후 재전송` : '인증번호 다시 받기'}</button>
            <button className="private-auth-secondary" type="button" onClick={() => { forgetEmailCode(); setStage('email'); setError(''); setNotice(''); setVerificationCode('') }} disabled={busy}>
              이메일 다시 입력
            </button>
          </form>
        )}

        {notice && <p className="private-auth-notice">{notice}</p>}
        {error && <p className="private-auth-error">{error}</p>}
        <p className="private-auth-footnote">인증번호는 다른 사람과 공유하지 마. 로그인 후에도 이 앱에서 계속 이용할 수 있어.</p>
      </section>
    </main>
  )
}
