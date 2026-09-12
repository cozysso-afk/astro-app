import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { parseEmailVerificationLink: parse } = await server.ssrLoadModule('/src/lib/emailLink.ts')
  const provider = 'https://example.supabase.co'
  const token = 'a'.repeat(64)
  const url = `${provider}/auth/v1/verify?token=${token}&type=magiclink`
  assert.deepEqual(parse(url, provider), { token_hash: token, type: 'email' })
  assert.equal(parse(url + '&redirect_to=https://untrusted.example', provider).type, 'email')
  assert.equal(parse(url.replace('magiclink', 'email_change'), provider).type, 'email_change')
  for (const bad of [url.replace('https:', 'http:'), url.replace('example.supabase.co', 'example.supabase.co.evil.test'), url.replace('/verify', '/callback'), url.replace('magiclink', 'recovery'), url + '#access_token=secret', 'javascript:alert(1)', 'not a URL', url.replace(token, '123')]) {
    assert.throws(() => parse(bad, provider))
  }
  const auth = await server.ssrLoadModule('/src/lib/supabase.ts')
  let verification, signedOut = 0
  auth.supabase.auth.verifyOtp = async value => {
    verification = value
    return { data: { session: { user: { email: 'owner@example.com' } } }, error: null }
  }
  auth.supabase.auth.signOut = async () => { signedOut++; return { error: null } }
  const ownLink = url.replace(provider, auth.supabaseUrl)
  const session = await auth.verifyEmailLinkInApp(ownLink, ' OWNER@example.com ')
  assert.equal(session.user.email, 'owner@example.com')
  assert.deepEqual(verification, { token_hash: token, type: 'email' })
  await assert.rejects(auth.verifyEmailLinkInApp(ownLink, 'different@example.com'), /계정이 달라/)
  assert.equal(signedOut, 1)
  await assert.rejects(auth.verifyEmailLinkInApp(ownLink.replace('magiclink', 'email_change'), 'owner@example.com'), /이 앱에서 시작한/)
  auth.supabase.auth.verifyOtp = async () => ({ data: {}, error: { message: 'expired' } })
  await assert.rejects(auth.verifyEmailLinkInApp(ownLink, 'owner@example.com'), /만료됐거나 이미 사용/)
  console.log('Email link validation and in-app verification passed (mock provider; no emails or live sessions).')
} finally { await server.close() }
