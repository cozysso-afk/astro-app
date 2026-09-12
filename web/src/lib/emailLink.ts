/** Read only an unused verification link from this app's own auth provider.
 * Never navigate to it, follow redirect_to, or accept session bearer tokens.
 */
export function parseEmailVerificationLink(raw: string, providerUrl: string) {
  let link: URL
  try { link = new URL(raw.trim()) } catch { throw new Error('메일의 로그인 버튼을 길게 눌러 링크를 복사한 뒤 붙여넣어줘.') }
  const provider = new URL(providerUrl)
  if (link.protocol !== 'https:' || link.origin !== provider.origin || link.pathname !== '/auth/v1/verify' || link.username || link.password || link.hash) {
    throw new Error('별빛의 운명에서 보낸 인증 링크가 아니야. 메일의 원래 로그인 링크를 복사해줘.')
  }
  const token_hash = link.searchParams.get('token')
  const type = link.searchParams.get('type')
  if (!token_hash || !/^[a-zA-Z0-9_-]{20,256}$/.test(token_hash) || !['magiclink', 'email', 'email_change'].includes(type ?? '')) {
    throw new Error('사용 가능한 로그인 링크가 아니야. 새 인증 메일을 받아줘.')
  }
  return { token_hash, type: type === 'email_change' ? 'email_change' as const : 'email' as const }
}
