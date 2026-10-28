import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compactCalculation } from '../../supabase/functions/fortune-interpret-v6-preview/integratedInterpretationV2.ts'
import { attachPrecisionPacketMetadata, precisionGateFromPayload } from '../../supabase/functions/fortune-interpret-v22-preview/precisionV2.ts'
import { evaluateCases, renderHtml } from './fortune-quality-audit.mjs'

/**
 * Opt-in, paid-call-capable QA for synthetic profiles only.
 * Requires manual workflow_dispatch confirmation plus four QA-only secrets.
 * Never persists Gemini prose, birth profiles, auth tokens, or calculation payloads.
 */
const cases = [
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
async function postJson(url, body, headers = {}, timeoutMs = 180000) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) throw new Error('QA upstream HTTP status ' + response.status)
  return data
}
export async function resolveQaAccessToken({ supabase, anon, accessToken, email, password }) {
  if (String(accessToken ?? '').trim()) return String(accessToken).trim()
  if (!String(email ?? '').trim() || !String(password ?? '').trim()) {
    throw new Error('Missing QA authentication secrets: QA_USER_EMAIL and QA_USER_PASSWORD')
  }
  const session = await postJson(
    supabase + '/auth/v1/token?grant_type=password',
    { email: String(email).trim(), password: String(password) },
    { apikey: anon },
    30_000,
  )
  const token = String(session?.access_token ?? '').trim()
  if (!token) throw new Error('QA account login did not return an access token')
  return token
}
export async function buildQaConfig(env = process.env) {
  const supabase = String(env.QA_SUPABASE_URL ?? '').trim().replace(/\/$/, '')
  const anon = String(env.QA_SUPABASE_ANON_KEY ?? '').trim()
  const calcApi = String(env.QA_CALC_API_URL ?? '').trim()
  if (!supabase) throw new Error('Missing QA-only secret: QA_SUPABASE_URL')
  if (!anon) throw new Error('Missing QA-only secret: QA_SUPABASE_ANON_KEY')
  if (!calcApi) throw new Error('Missing QA-only secret: QA_CALC_API_URL')
  const token = await resolveQaAccessToken({
    supabase,
    anon,
    accessToken: env.QA_USER_ACCESS_TOKEN,
    email: env.QA_USER_EMAIL,
    password: env.QA_USER_PASSWORD,
  })
  return {
    calcApi,
    fortuneUrl: supabase + '/functions/v1/fortune-interpret-v22-preview',
    headers: { apikey: anon, Authorization: 'Bearer ' + token },
    calcHeaders: { Authorization: 'Bearer ' + token },
  }
}
function profile(row) {
  return {
    name: 'synthetic-qa-only', birth_date: row.birth_date, birth_time: row.birth_time,
    time_known: true, time_source: 'official_record', time_confidence: 'exact',
    latitude: row.latitude, longitude: row.longitude,
    utc_offset_hours: row.utc_offset_hours, gender: row.gender,
  }
}
async function runCase(row, config) {
  const calculation = await postJson(config.calcApi, {
    profile: profile(row), start_date: row.start, end_date: row.end,
  }, config.calcHeaders)
  if (!calculation.ok || !calculation.western?.ok || !calculation.saju?.ok || !calculation.thai?.ok) {
    throw new Error('Integrated calculation failed')
  }
  const gate = precisionGateFromPayload(calculation)
  if (!gate.ok || gate.mode !== 'exact') throw new Error('Exact precision gate failed')
  const payload = attachPrecisionPacketMetadata(compactCalculation(calculation), calculation)
  const request = body => postJson(config.fortuneUrl, { narrative_engine: 'v23', ...body }, config.headers)
  const existingJobId = String(config.existingJobId ?? '')
  let status
  if (existingJobId) {
    status = await request({ action: 'status', job_id: existingJobId })
    if (status?.period_start !== row.start || status?.period_end !== row.end) {
      throw new Error('Stored QA job period did not match the synthetic case')
    }
  } else {
    const inspection = await request({ action: 'inspect', calculation })
    if (!inspection.ok || inspection.prompt_budget_ok !== true ||
        !String(inspection.interpreter_version ?? '').startsWith('supabase-ai-v23.')) {
      throw new Error('V23 inspection/budget gate failed; paid start was not attempted')
    }
    // Use the production V23 default explicitly so a model-default regression is
    // visible in the audit instead of depending on a stale caller preference.
    const started = await request({ action: 'start', calculation, model: 'gemini-3.6-flash' })
    if (!started.ok || !started.job_id) throw new Error('V23 start failed')
    for (let attempt = 0; attempt < 90; attempt++) {
      status = await request({ action: 'status', job_id: started.job_id }, config.headers)
      if (status?.status === 'done' || status?.status === 'failed') break
      await sleep(2000)
    }
  }
  if (status?.status !== 'done' || !status?.data) {
    return {
      id: row.id + '-' + row.kind, profile_id: row.id, period_kind: row.kind,
      payload,
      result: { data: null, origin: status?.origin, provenance_verified: status?.provenance_verified === true,
        model: status?.model, usage: status?.usage, interpreter_version: status?.interpreter_version },
      runner_error_code: status?.status === 'failed' ? 'V23_JOB_FAILED' : 'V23_JOB_TIMEOUT',
    }
  }
  return {
    id: row.id + '-' + row.kind, profile_id: row.id, period_kind: row.kind,
    payload,
    result: { data: status.data, origin: status.origin, provenance_verified: status.provenance_verified === true,
      model: status.model, usage: status.usage, interpreter_version: status.interpreter_version },
  }
}

function safeRunnerErrorCode(error) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  if (message.startsWith('QA upstream HTTP status ')) return 'UPSTREAM_HTTP_ERROR'
  if (message === 'Integrated calculation failed') return 'CALCULATION_FAILED'
  if (message === 'Exact precision gate failed') return 'PRECISION_GATE_FAILED'
  if (message.startsWith('V23 inspection/budget gate failed')) return 'V23_INSPECTION_FAILED'
  if (message === 'V23 start failed') return 'V23_START_FAILED'
  if (message === 'Stored QA job period did not match the synthetic case') return 'STORED_JOB_PERIOD_MISMATCH'
  if (message === 'V23 job failed or timed out') return 'V23_JOB_FAILED'
  return 'LIVE_RUNNER_ERROR'
}
async function main() {
  const args = process.argv.slice(2)
  const arg = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1] }
  const existingJobId = String(arg('--existing-job-id') || '').trim()
  if (existingJobId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existingJobId)) {
    throw new Error('existing-job-id must be a UUID')
  }
  if (existingJobId) {
    if (process.env.QA_REPLAY_APPROVED !== 'YES') throw new Error('Explicit QA_REPLAY_APPROVED=YES required')
  } else if (process.env.QA_LIVE_APPROVED !== 'YES') {
    throw new Error('Explicit QA_LIVE_APPROVED=YES required')
  }
  const maxJobs = Number(arg('--max-jobs') || 2)
  if (!Number.isInteger(maxJobs) || maxJobs < 1 || maxJobs > 4) {
    throw new Error('max-jobs must be an integer from 1 to 4')
  }
  if (existingJobId && maxJobs !== 1) throw new Error('existing-job-id replay requires max-jobs 1')
  const out = path.resolve(arg('--out') || 'fortune-live-qa-artifacts')
  const config = await buildQaConfig()
  config.existingJobId = existingJobId
  const results = []
  for (const row of cases.slice(0, maxJobs)) {
    try {
      results.push(await runCase(row, config))
      console.log('Completed synthetic live QA case ' + row.id + ' (' + row.kind + ')')
    } catch (error) {
      // Never log payloads, Gemini text, auth details or user-identifying data.
      console.error('Synthetic live QA case failed: ' + row.id)
      results.push({
        id: row.id + '-' + row.kind, profile_id: row.id, period_kind: row.kind,
        payload: { period_kind: row.kind, period: { start: row.start, end: row.end }, evidence_ledger: [] },
        result: null,
        runner_error_code: safeRunnerErrorCode(error),
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
    console.error('Live QA not started: ' + error.message)
    process.exitCode = 1
  })
}
