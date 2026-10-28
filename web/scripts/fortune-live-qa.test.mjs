import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildQaConfig, resolveQaAccessToken } from './fortune-live-qa.mjs'

const runner = readFileSync(new URL('./fortune-live-qa.mjs', import.meta.url), 'utf8')
const workflow = readFileSync(new URL('../../.github/workflows/fortune-quality-audit.yml', import.meta.url), 'utf8')

test('an explicitly supplied access token avoids an auth request', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('fetch must not run') }
  try {
    assert.equal(await resolveQaAccessToken({ accessToken: ' short-lived-token ' }), 'short-lived-token')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('QA email login obtains a fresh access token without returning credentials', async () => {
  const originalFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    return new Response(JSON.stringify({ access_token: 'fresh-token', refresh_token: 'never-persisted' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    const token = await resolveQaAccessToken({
      supabase: 'https://project.supabase.co', anon: 'anon-key',
      email: 'qa@example.invalid', password: 'secret-value',
    })
    assert.equal(token, 'fresh-token')
    assert.equal(calls[0].url, 'https://project.supabase.co/auth/v1/token?grant_type=password')
    assert.equal(calls[0].init.headers.apikey, 'anon-key')
    assert.deepEqual(JSON.parse(calls[0].init.body), {
      email: 'qa@example.invalid', password: 'secret-value',
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('fresh user token is sent to both Render calculation API and Supabase function', async () => {
  const config = await buildQaConfig({
    QA_SUPABASE_URL: 'https://project.supabase.co/',
    QA_SUPABASE_ANON_KEY: 'anon-key',
    QA_CALC_API_URL: 'https://calc.example/v1/fortune/integrated',
    QA_USER_ACCESS_TOKEN: 'user-token',
  })
  assert.deepEqual(config.calcHeaders, { Authorization: 'Bearer user-token' })
  assert.deepEqual(config.headers, { apikey: 'anon-key', Authorization: 'Bearer user-token' })
  assert.equal(config.fortuneUrl, 'https://project.supabase.co/functions/v1/fortune-interpret-v22-preview')
})

test('missing automatic-login secrets fails before any paid call', async () => {
  await assert.rejects(
    buildQaConfig({
      QA_SUPABASE_URL: 'https://project.supabase.co',
      QA_SUPABASE_ANON_KEY: 'anon-key',
      QA_CALC_API_URL: 'https://calc.example/v1/fortune/integrated',
    }),
    /QA_USER_EMAIL and QA_USER_PASSWORD/,
  )
})

test('existing-job replay is status-only and requires the no-paid-call workflow gate', () => {
  assert.match(runner, /if \(existingJobId\)/)
  assert.match(runner, /status = await request\(\{ action: 'status', job_id: existingJobId \}\)/)
  assert.match(runner, /QA_REPLAY_APPROVED/)
  assert.match(workflow, /inputs\.confirm_no_paid_call == 'NO_PAID_CALL'/)
  assert.match(workflow, /inputs\.confirm_paid_calls == 'YES' && inputs\.existing_job_id == ''/)
  assert.match(workflow, /--existing-job-id "\$QA_EXISTING_JOB_ID"/)
})
