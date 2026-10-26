import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { inspectInterpretationQuality } from '../../supabase/functions/fortune-interpret-v6-preview/qualityV2.ts'

/**
 * QA-only evaluation. Never creates, repairs, or replaces user-facing prose.
 * Fixture mode tests the audit machinery; only live mode assesses Gemini output.
 * Reports contain IDs and issue codes, never birth data or generated prose.
 */
export const PERIODS = ['day', 'week', 'month', 'annual']
export const AUDIT_VERSION = 'fortune-quality-audit-v1'
const ISO = /^\d{4}-\d{2}-\d{2}$/
const TEXT_FIELDS = ['verdict', 'conclusion']
const MIN_COMPARE_CHARS = 32

function clean(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ')
}
function similar(a, b) {
  const x = clean(a), y = clean(b)
  if (x.length < MIN_COMPARE_CHARS || y.length < MIN_COMPARE_CHARS) return false
  if (x === y) return true
  const ax = new Set(x.split(' ')), bx = new Set(y.split(' '))
  if (ax.size < 8 || bx.size < 8) return false
  const shared = [...ax].filter(token => bx.has(token)).length
  return shared / (ax.size + bx.size - shared) >= 0.88
}
function sections(data) {
  const topics = data?.topic_analysis
  if (topics && typeof topics === 'object' && !Array.isArray(topics)) {
    return Object.entries(topics).map(([topic, section]) => ({
      topic, text: String(section?.verdict ?? section?.conclusion ?? '').trim(),
    })).filter(row => row.text)
  }
  return []
}
function allRefs(value, refs = [], depth = 0) {
  if (!value || typeof value !== 'object' || depth > 12) return refs
  if (Array.isArray(value)) {
    for (const item of value) allRefs(item, refs, depth + 1)
    return refs
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === 'evidence_refs' && Array.isArray(child)) {
      for (const ref of child) if (typeof ref === 'string' && ref) refs.push(ref)
    } else if (child && typeof child === 'object') allRefs(child, refs, depth + 1)
  }
  return refs
}
function issue(code, severity = 'error', details = {}) {
  return { code, severity, ...details }
}
function unwrap(result) {
  if (!result || typeof result !== 'object') return { data: null, origin: '', version: '' }
  const data = result.result_json ?? result.data ?? (result.topic_analysis ? result : null)
  return {
    data,
    origin: String(result.origin ?? result.usage?.origin ?? ''),
    version: String(result.interpreter_version ?? result.version ?? ''),
  }
}
function inPeriod(date, start, end) {
  return ISO.test(date) && ISO.test(start) && ISO.test(end) && date >= start && date <= end
}
function evaluateOne(row, mode) {
  const problems = []
  const { data, origin, version } = unwrap(row?.result)
  const payload = row?.payload ?? {}
  const period = row?.period_kind ?? payload?.period_kind
  const id = String(row?.id ?? '')
  const profile = String(row?.profile_id ?? '')
  const start = String(payload?.period?.start ?? '')
  const end = String(payload?.period?.end ?? '')
  if (!id || !profile) problems.push(issue('CASE_ID_OR_PROFILE_MISSING'))
  if (!PERIODS.includes(period)) problems.push(issue('INVALID_PERIOD_KIND'))
  if (!ISO.test(start) || !ISO.test(end) || start > end) problems.push(issue('INVALID_PERIOD_RANGE'))
  if (!data || typeof data !== 'object' || Array.isArray(data)) problems.push(issue('RESULT_MISSING'))
  if (mode === 'live') {
    if (origin !== 'gemini') problems.push(issue('GEMINI_ORIGIN_UNVERIFIED'))
    if (!version.startsWith('supabase-ai-v23.')) problems.push(issue('V23_VERSION_UNVERIFIED'))
  }
  const known = new Set((Array.isArray(payload?.evidence_ledger) ? payload.evidence_ledger : [])
    .map(entry => entry?.id).filter(x => typeof x === 'string' && x))
  const refs = allRefs(data)
  for (const ref of new Set(refs)) {
    if (!known.has(ref)) problems.push(issue('UNKNOWN_EVIDENCE_REF', 'error', { evidence_id: ref.slice(0, 100) }))
  }
  for (const window of Array.isArray(data?.key_windows) ? data.key_windows : []) {
    for (const key of ['start', 'end']) {
      if (window?.[key] && !inPeriod(String(window[key]), start, end))
        problems.push(issue('WINDOW_OUTSIDE_PERIOD', 'error', { field: key }))
    }
  }
  const authored = sections(data)
  for (let a = 0; a < authored.length; a++) {
    for (let b = a + 1; b < authored.length; b++) {
      if (similar(authored[a].text, authored[b].text)) {
        problems.push(issue('REPEATED_TOPIC_PROSE', 'warning', {
          topics: [authored[a].topic, authored[b].topic],
        }))
      }
    }
  }
  if (mode === 'live' && data && typeof data === 'object') {
    try {
      const report = inspectInterpretationQuality(data, payload)
      for (const stage of report?.stages ?? []) {
        if (!stage?.passed) problems.push(issue('V23_QUALITY_STAGE_FAILED', 'error', {
          stage: Number(stage.stage),
          finding_count: Array.isArray(stage.issues) ? stage.issues.length : 0,
        }))
      }
    } catch {
      problems.push(issue('V23_QUALITY_CHECK_ERROR'))
    }
  }
  return {
    id, profile_id: profile, period_kind: period,
    status: problems.some(p => p.severity === 'error') ? 'failed' : problems.length ? 'review' : 'passed',
    origin_verified: mode === 'live' && origin === 'gemini' && version.startsWith('supabase-ai-v23.'),
    evidence_refs_checked: refs.length, topics_checked: authored.length, issues: problems,
    _topics: authored,
  }
}
function checkAcrossCases(cases) {
  const seen = new Map()
  for (const row of cases) {
    for (const topic of row._topics) {
      const norm = clean(topic.text)
      if (norm.length < MIN_COMPARE_CHARS) continue
      const key = topic.topic + ':' + norm
      const prior = seen.get(key)
      if (prior && prior.profile_id !== row.profile_id) {
        row.issues.push(issue('CROSS_PROFILE_IDENTICAL_PROSE', 'warning', {
          topic: topic.topic, compared_case: prior.id,
        }))
        if (row.status === 'passed') row.status = 'review'
      } else if (!prior) seen.set(key, { id: row.id, profile_id: row.profile_id })
    }
  }
}
function checkVisual(diagnostics) {
  if (!diagnostics) return { status: 'not_provided', issues: [], screenshots: [] }
  const issues = []
  if (diagnostics.systemCards?.length !== 3) issues.push(issue('VISUAL_SYSTEM_CARDS_MISSING'))
  if (Number(diagnostics.reunionOverflow) > 1) issues.push(issue('VISUAL_REUNION_OVERFLOW'))
  if (Number(diagnostics.birthRangeOverflow) > 1) issues.push(issue('VISUAL_BIRTH_RANGE_OVERFLOW'))
  if (Number(diagnostics.downloadCount) !== 2) issues.push(issue('VISUAL_EXPORT_COUNT_MISMATCH'))
  for (const width of diagnostics.mobileWidths ?? []) {
    if (Number(width.overflow) > 1 || width.stageOverlap) {
      issues.push(issue('VISUAL_MOBILE_LAYOUT', 'error', { width: Number(width.width) }))
    }
  }
  return {
    status: issues.length ? 'failed' : 'passed',
    issues,
    screenshots: ['mobile-full.png', 'systems-mobile.png', 'interpretation-v2-mobile.png',
      'reunion-mobile.png', 'export-source-mobile.png', 'saved-result-1.png', 'saved-result-2.png'],
  }
}
export function evaluateCases(input, { mode = 'live', visual = null } = {}) {
  if (!['fixture', 'live'].includes(mode)) throw new Error('mode must be fixture or live')
  if (!Array.isArray(input) || input.length === 0) throw new Error('QA requires non-empty cases')
  const cases = input.map(row => evaluateOne(row, mode))
  const ids = new Set()
  for (const row of cases) {
    if (ids.has(row.id)) {
      row.issues.push(issue('DUPLICATE_CASE_ID'))
      row.status = 'failed'
    }
    ids.add(row.id)
  }
  checkAcrossCases(cases)
  const profiles = new Set(cases.map(row => row.profile_id))
  const visualResult = checkVisual(visual)
  const safeCases = cases.map(({ _topics, ...row }) => row)
  const errors = safeCases.reduce((n, row) => n + row.issues.filter(i => i.severity === 'error').length, 0)
  const warnings = safeCases.reduce((n, row) => n + row.issues.filter(i => i.severity === 'warning').length, 0)
  return {
    audit_version: AUDIT_VERSION, mode, fixture_only: mode === 'fixture',
    live_gemini_cases: mode === 'live' ? safeCases.filter(row => row.origin_verified).length : 0,
    summary: {
      cases: safeCases.length, profiles: profiles.size,
      period_coverage: Object.fromEntries(PERIODS.map(period => [period, safeCases.filter(row => row.period_kind === period).length])),
      passed: safeCases.filter(row => row.status === 'passed').length,
      review: safeCases.filter(row => row.status === 'review').length,
      failed: safeCases.filter(row => row.status === 'failed').length,
      errors, warnings,
    },
    visual: visualResult,
    cases: safeCases,
  }
}
export function fixtureMatrix() {
  const rows = []
  const periodRanges = {
    day: ['2026-10-26', '2026-10-26'],
    week: ['2026-10-26', '2026-11-01'],
    month: ['2026-10-01', '2026-10-31'],
    annual: ['2026-01-01', '2026-12-31'],
  }
  for (let profile = 1; profile <= 20; profile++) {
    const profileId = 'synthetic-' + String(profile).padStart(2, '0')
    for (const kind of PERIODS) {
      const [start, end] = periodRanges[kind]
      const topic_analysis = {}
      const evidence_ledger = []
      for (const topic of ['직장', '연애', '금전']) {
        const evidenceId = 'QA:' + profileId + ':' + kind + ':' + topic
        evidence_ledger.push({ id: evidenceId, system: 'western', topic, date: start, direction: 'context' })
        topic_analysis[topic] = {
          verdict: 'QA_ONLY_SENTINEL ' + profileId + ' ' + kind + ' ' + topic + ' nonproduction test data only',
          evidence_refs: [evidenceId],
        }
      }
      rows.push({
        id: profileId + '-' + kind, profile_id: profileId, period_kind: kind,
        payload: { period_kind: kind, period: { start, end }, evidence_ledger },
        result: { data: { topic_analysis, key_windows: [] }, origin: 'fixture', interpreter_version: 'qa-fixture-only' },
      })
    }
  }
  return rows
}
function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
export function renderHtml(report) {
  const s = report.summary
  const status = report.fixture_only
    ? 'TEST HARNESS ONLY — NO LIVE GEMINI RESPONSES TESTED'
    : 'LIVE GEMINI RESULT AUDIT'
  const rows = report.cases.map(row =>
    '<tr><td>' + escapeHtml(row.id) + '</td><td>' + escapeHtml(row.period_kind) +
    '</td><td>' + escapeHtml(row.status) + '</td><td>' +
    escapeHtml(row.issues.map(i => i.code).join(', ') || '—') + '</td></tr>'
  ).join('\n')
  const screenshots = report.visual.status === 'not_provided' ? '<p>No visual diagnostics supplied.</p>'
    : '<p>Visual: ' + escapeHtml(report.visual.status) + '</p><p>' +
      report.visual.screenshots.map(file => '<a href="../' + escapeHtml(file) + '">' + escapeHtml(file) + '</a>').join(' · ') + '</p>'
  return '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width">' +
    '<title>별빛의 운명 · 자동 검증 보고서</title><style>body{font:15px system-ui;max-width:1000px;margin:2rem auto;padding:0 1rem;line-height:1.6}table{border-collapse:collapse;width:100%}td,th{padding:.5rem;border-bottom:1px solid #ccc;text-align:left}tr:nth-child(even){background:#f6f6f6}.warning{font-weight:700}a{margin-right:.6rem}</style>' +
    '<h1>별빛의 운명 · 자동 검증 보고서</h1><p class="warning">' + escapeHtml(status) + '</p>' +
    '<p>Cases: ' + s.cases + ' · Profiles: ' + s.profiles + ' · Passed: ' + s.passed +
    ' · Review: ' + s.review + ' · Failed: ' + s.failed + ' · Errors: ' + s.errors +
    ' · Warnings: ' + s.warnings + ' · Live Gemini: ' + report.live_gemini_cases + '</p>' +
    '<p>Period coverage: ' + escapeHtml(JSON.stringify(s.period_coverage)) + '</p>' +
    screenshots + '<h2>Cases (no personal data or generated prose)</h2>' +
    '<table><thead><tr><th>Case</th><th>Period</th><th>Status</th><th>Issue codes</th></tr></thead><tbody>' +
    rows + '</tbody></table></html>'
}
async function cli() {
  const args = process.argv.slice(2)
  const value = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1] }
  const fixture = args.includes('--fixture-matrix')
  const mode = value('--mode') || (fixture ? 'fixture' : 'live')
  const inputPath = value('--input')
  const out = path.resolve(value('--out') || 'fortune-quality-artifacts')
  if (fixture === Boolean(inputPath)) throw new Error('Provide exactly one of --fixture-matrix or --input <file>')
  const input = fixture ? fixtureMatrix() : JSON.parse(await readFile(inputPath, 'utf8'))
  const visualPath = value('--visual')
  const visual = visualPath ? JSON.parse(await readFile(visualPath, 'utf8')) : null
  const report = evaluateCases(Array.isArray(input) ? input : input.cases, { mode, visual })
  await mkdir(out, { recursive: true })
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
  await writeFile(path.join(out, 'report.html'), renderHtml(report))
  console.log(JSON.stringify({ mode, ...report.summary, live_gemini_cases: report.live_gemini_cases,
    visual: report.visual.status, report_dir: out }))
  if (report.summary.failed || report.visual.status === 'failed') process.exitCode = 1
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  cli().catch(error => { console.error('fortune QA failed:', error.message); process.exitCode = 1 })
}
