import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateForQa, cases, loginQaUser } from './fortune-live-qa.mjs'

test('QA login obtains a fresh non-anonymous session without logging credentials', async () => {
  const calls = []
  const token = await loginQaUser({
    supabase: 'https://project.supabase.test', anon: 'public-key',
    email: 'qa@example.test', password: 'secret-password',
  }, async (...args) => {
    calls.push(args)
    return { access_token: 'fresh-token', user: { email: 'qa@example.test', is_anonymous: false } }
  })
  assert.equal(token, 'fresh-token')
  assert.equal(calls[0][0], 'https://project.supabase.test/auth/v1/token?grant_type=password')
  assert.deepEqual(calls[0][2], { apikey: 'public-key' })
})

test('QA login rejects anonymous or incomplete identities', async () => {
  await assert.rejects(
    loginQaUser({ supabase: 'https://project.supabase.test', anon: 'public-key', email: 'x', password: 'y' },
      async () => ({ access_token: 'token', user: { is_anonymous: true } })),
    /QA_AUTH_IDENTITY_INVALID/,
  )
})

test('calculation API receives the same authenticated QA bearer header', async () => {
  const seen = []
  await calculateForQa(cases[0], {
    calcApi: 'https://calc.example.test/v1/fortune/integrated',
    headers: { apikey: 'public-key', Authorization: 'Bearer fresh-token' },
  }, async (url, body, headers) => {
    seen.push({ url, body, headers })
    return { ok: true }
  })
  assert.equal(seen[0].url, 'https://calc.example.test/v1/fortune/integrated')
  assert.equal(seen[0].headers.Authorization, 'Bearer fresh-token')
  assert.equal(seen[0].body.profile.name, 'synthetic-qa-only')
})
