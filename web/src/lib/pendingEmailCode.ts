const KEY = 'astro_pending_email_code_v1'
const TTL = 60 * 60 * 1000
export function rememberEmailCode(email: string, resendAt: number) {
  try { window.sessionStorage.setItem(KEY, JSON.stringify({email, resendAt, requestedAt:Date.now()})) } catch { /* Authentication remains usable when storage is unavailable. */ }
}
export function forgetEmailCode() { try { window.sessionStorage.removeItem(KEY) } catch { /* no stored code */ } }
export function pendingEmailCode(): {email:string;resendAt:number} | null {
  try {
    const value=JSON.parse(window.sessionStorage.getItem(KEY) ?? 'null')
    if (!value || typeof value.email!=='string' || !value.email.includes('@') || !Number.isFinite(value.requestedAt) || !Number.isFinite(value.resendAt) || Date.now()-value.requestedAt>TTL) {forgetEmailCode();return null}
    return {email:value.email,resendAt:value.resendAt}
  } catch {return null}
}
