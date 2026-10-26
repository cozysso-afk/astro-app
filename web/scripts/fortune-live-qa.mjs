import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compactCalculation } from '../../supabase/functions/fortune-interpret-v6-preview/integratedInterpretationV2.ts'
import { attachPrecisionPacketMetadata, precisionGateFromPayload } from '../../supabase/functions/fortune-interpret-v22-preview/precisionV2.ts'
import { evaluateCases, renderHtml } from './fortune-quality-audit.mjs'

/**
 * Opt-in, paid-call-capable QA for synthetic profiles only.
 * Requires manual workflow_dispatch confirmation plus five QA-only secrets.
 * Never persists Gemini prose, birth profiles, auth tokens, or calculation payloads.
 */
export const cases = [
  { id: 'synthetic-live-01', birth_date: '1987-06-15', birth_time: '08:30:00',
    latitude: 37.5665, longitude: 126.978, utc_offset_hours: 9, gender: 'female',
    kind: 'day', start: '2026-10-26', end: '2026-10-26' },
  { id: 'synthetic-live-02', birth_date: '1991-02-20', birth_time: '13:15:00',
    latitude: 35.1796, longitude: 129.0756, utc_offset_hours: 9, gender: 'male',
    kind: 'week', start: '2026-10-26', end: '2026-11-01' },
  { id: 'synthetic-live-03', birth_date: '1996-11-07', birth_time: '17:45:00',
    latitude: 13.7563, longitude: 100.5018, utc_offset_hours: 7, gender: 'female',
    kind: 'month', start: '2026-10-01', end: '2026-10-31' },
  { id: 'synthetic-live-04', birth_date: '2002-03-01', birth_time: '06:10:00',
    latitude: 35.6762, longitude: 139.6503, utc_offset_hours: 9, gender: 'male',
    kind: 'annual', start: '2026-01-01', end: '2026-12-31' },
]
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
function requiredEnv(name) {
  const value = String(process.env[name] ?? '').trim()
  if (!value) throw new Error('MISSING_' + name)
  return value
}
export async function postJson(url, body, headers = {}, timeoutMs = 180000) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) throw new Error('UPSTREAM_HTTP_' + response.status)
  return data
}
export async function loginQaUser({ supabase, anon, email, password }, post = postJson) {
  const session = await post(
    supabase + '/auth/v1/token?grant_type=password',
    { email, password },
    { apikey: anon },
    30_000,
  )
  if (!session?.access_token || !session?.user?.email || session?.user?.is_anonymous === true) {
    throw new Error('QA_AUTH_IDENTITY_INVALID')
  }
  return session.access_token
}
function profile(row) {
  return {
    name: 'synthetic-qa-only', birth_date: row.birth_date, birth_time: row.birth_time,
    time_known: true, time_source: 'official_record', time_confidence: 'exact',
    latitude: row.latitude, longitude: row.longitude,
    utc_offset_hours: row.utc_offset_hours, gender: row.gender,
  }
}
export async function calculateForQa(row, config, post = postJson) {
  return post(config.calcApi, {
    profile: profile(row), start_date: row.start, end_date: row.end,
  }, config.headers)
}
export async function runCase(row, config, { post = postJson, pause = sleep } = {}) {
  const calculation = await calculateForQa(row, config, post)
  if (!calculation.ok || !calculation.western?.ok || !calculation.saju?.ok || !calculation.thai?.ok) {
    throw new Error('INTEGRATED_CALCULATION_FAILED')
  }
  const gate = precisionGateFromPayload(calculation)
  if (!gate.ok || gate.mode !== 'exact') throw new Error('EXACT_PRECISION_GATE_FAILED')
  const payload = attachPrecisionPacketMetadata(compactCalculation(calculation), calculation)
  const request = body => post(config.fortuneUrl, { narrative_engine: 'v23', ...body }, config.headers)
  const inspection = await request({ action: 'inspect', calculation })
  if (!inspection.ok || inspection.prompt_budget_ok !== true ||
      !String(inspection.interpreter_version ?? '').startsWith('supabase-ai-v23.')) {
    throw new Error('V23_INSPECTION_OR_BUDGET_GATE_FAILED')
  }
  const started = await request({ action: 'start', calculation })
  if (!started.ok || !started.job_id) throw new Error('V23_START_FAILED')
  let status
  for (let attempt = 0; attempt < 90; attempt++) {
    status = await request({ action: 'status', job_id: started.job_id })
    if (status?.status === 'done' || status?.status === 'failed') break
    await pause(2000)
  }
  if (status?.status !== 'done' || !status?.data) throw new Error('V23_JOB_FAILED_OR_TIMED_OUT')
  return {
    id: row.id + '-' + row.kind, profile_id: row.id, period_kind: row.kind,
    payload,
    result: { data: status.data, origin: status.origin,
      interpreter_version: status.interpreter_version },
  }
}
function safeFailureCode(error) {
  const value = String(error?.message ?? 'UNKNOWN_FAILURE')
  return /^[A-Z0-9_]{3,80}$/.test(value) ? value : 'UNKNOWN_FAILURE'
}
async function main() {
  if (process.env.QA_LIVE_APPROVED !== 'YES') throw new Error('Explicit QA_LIVE_APPROVED=YES required')
  const args = process.argv.slice(2)
  const arg = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1] }
  const maxJobs = Number(arg('--max-jobs') || 2)
  if (!Number.isInteger(maxJobs) || maxJobs < 1 || maxJobs > 4) {
    throw new Error('max-jobs must be an integer from 1 to 4')
  }
  const out = path.resolve(arg('--out') || 'fortune-live-qa-artifacts')
  const supabase = requiredEnv('QA_SUPABASE_URL').replace(/\/$/, '')
  const anon = requiredEnv('QA_SUPABASE_ANON_KEY')
  const token = await loginQaUser({
    supabase,
    anon,
    email: requiredEnv('QA_USER_EMAIL'),
    password: requiredEnv('QA_USER_PASSWORD'),
  })
  const config = {
    calcApi: requiredEnv('QA_CALC_API_URL'),
    fortuneUrl: supabase + '/functions/v1/fortune-interpret-v22-preview',
    headers: { apikey: anon, Authorization: 'Bearer ' + token },
  }
  const results = []
  for (const row of cases.slice(0, maxJobs)) {
    try {
      results.push(await runCase(row, config))
      console.log('Completed synthetic live QA case ' + row.id + ' (' + row.kind + ')')
    } catch (error) {
      // Never log payloads, Gemini text, auth details or user-identifying data.
      const failureCode = safeFailureCode(error)
      console.error('Synthetic live QA case failed: ' + row.id + ' [' + failureCode + ']')
      results.push({
        id: row.id + '-' + row.kind, profile_id: row.id, period_kind: row.kind,
        payload: { period_kind: row.kind, period: { start: row.start, end: row.end }, evidence_ledger: [] },
        result: null, failure_code: failureCode,
      })
    }
  }
  const report = evaluateCases(results, { mode: 'live' })
  await mkdir(out, { recursive: true })
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
  await writeFile(path.join(out, 'report.html'), renderHtml(report))
  console.log(JSON.stringify({ ...report.summary, live_gemini_cases: report.live_gemini_cases,
    report_dir: out }))
  if (report.summary.failed || report.summary.review) process.exitCode = 1
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(error => {
    // Configuration errors are deliberately explicit but never print secret values.
    console.error('Live QA not started: ' + safeFailureCode(error))
    process.exitCode = 1
  })
}
