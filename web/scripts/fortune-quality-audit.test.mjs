import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateCases, fixtureMatrix, renderHtml } from './fortune-quality-audit.mjs'

function sample() {
  return structuredClone(fixtureMatrix()[0])
}
test('20 synthetic profiles across four period kinds test the audit harness only', () => {
  const report = evaluateCases(fixtureMatrix(), { mode: 'fixture' })
  assert.equal(report.summary.cases, 80)
  assert.equal(report.summary.profiles, 20)
  assert.deepEqual(report.summary.period_coverage, { day: 20, week: 20, month: 20, annual: 20 })
  assert.equal(report.summary.failed, 0)
  assert.equal(report.summary.errors, 0)
  assert.equal(report.fixture_only, true)
  assert.equal(report.live_gemini_cases, 0)
  assert.match(renderHtml(report), /NO LIVE GEMINI RESPONSES TESTED/)
  assert.match(renderHtml(report), /통과한 사례 80건 펼치기/)
  assert.match(renderHtml(report), /검출된 문제 없음/)
})
test('invalid evidence IDs and out-of-period dates fail without prose in the report', () => {
  const row = sample()
  row.result.data.topic_analysis['직장'].evidence_refs = ['invented:123']
  row.result.data.key_windows = [{
    start: '2027-01-01', end: '2027-01-02', evidence_refs: ['invented:123'],
  }]
  const report = evaluateCases([row], { mode: 'fixture' })
  assert.equal(report.summary.failed, 1)
  assert.ok(report.cases[0].issues.some(i => i.code === 'UNKNOWN_EVIDENCE_REF'))
  assert.ok(report.cases[0].issues.some(i => i.code === 'WINDOW_OUTSIDE_PERIOD'))
  assert.doesNotMatch(JSON.stringify(report), /QA_ONLY_SENTINEL/)
})
test('same long authored verdict across unrelated topics requires human review', () => {
  const row = sample()
  row.result.data.topic_analysis['연애'].verdict =
    row.result.data.topic_analysis['직장'].verdict
  const report = evaluateCases([row], { mode: 'fixture' })
  assert.equal(report.summary.review, 1)
  assert.ok(report.cases[0].issues.some(i => i.code === 'REPEATED_TOPIC_PROSE'))
})
test('same topic text across two distinct profiles requires review', () => {
  const a = sample(), b = structuredClone(fixtureMatrix()[4])
  b.result.data.topic_analysis['직장'].verdict = a.result.data.topic_analysis['직장'].verdict
  const report = evaluateCases([a, b], { mode: 'fixture' })
  assert.equal(report.summary.review, 1)
  assert.ok(report.cases[1].issues.some(i => i.code === 'CROSS_PROFILE_IDENTICAL_PROSE'))
})
test('same authored cluster prose across distinct profiles requires review', () => {
  const a = sample(), b = structuredClone(fixtureMatrix()[4])
  const prose = {
    conclusion: '관계 속도보다 실제 약속의 구체성이 중요하게 작동하는 구간이야.',
    real_scene: '연락 횟수보다 날짜와 장소가 정해지는지를 먼저 확인해.',
    action: '한 번 묻고 답변의 구체성을 기록해.',
    change_condition: '약속이 구체화되면 판단을 올리고 아니면 보류해.',
    evidence_refs: [], applicability: 'conditional',
  }
  a.result.data.clusters = { relationship: { summary: prose } }
  b.result.data.clusters = { relationship: { summary: structuredClone(prose) } }
  const report = evaluateCases([a, b], { mode: 'fixture' })
  assert.equal(report.summary.review, 1)
  assert.ok(report.cases[1].issues.some(i => i.code === 'CROSS_PROFILE_IDENTICAL_PROSE'))
})
test('server insufficient and not-calculated placeholders are excluded from repetition review', () => {
  const a = sample(), b = structuredClone(fixtureMatrix()[4])
  for (const row of [a, b]) {
    row.result.data.clusters = { relationship: { summary: {
      conclusion: '이 항목은 이번 응답에서 직접 해설 근거가 충분하지 않아.',
      real_scene: '', action: '확인 가능한 사실을 우선해.',
      change_condition: '근거가 보강되면 갱신해.', evidence_refs: [], applicability: 'insufficient',
    } } }
    row.result.data.domain_answers = [{
      topic: '재회', question_key: 'timing', answer: '', status: 'not_calculated', evidence_refs: [],
    }]
  }
  const report = evaluateCases([a, b], { mode: 'fixture' })
  assert.equal(report.summary.review, 0)
})
test('identical long topic prose across two periods for one profile is flagged', () => {
  const a = sample(), b = structuredClone(fixtureMatrix()[1])
  b.result.data.topic_analysis['직장'].verdict = a.result.data.topic_analysis['직장'].verdict
  const report = evaluateCases([a, b], { mode: 'fixture' })
  assert.equal(report.summary.review, 1)
  assert.ok(report.cases[1].issues.some(i => i.code === 'CROSS_PERIOD_IDENTICAL_PROSE'))
})
test('live mode rejects fake provenance and incomplete V23 output', () => {
  const row = sample()
  const report = evaluateCases([row], { mode: 'live' })
  assert.equal(report.summary.failed, 1)
  assert.equal(report.live_gemini_cases, 0)
  assert.ok(report.cases[0].issues.some(i => i.code === 'GEMINI_PROVENANCE_UNVERIFIED'))
  assert.ok(report.cases[0].issues.some(i => i.code === 'V23_VERSION_UNVERIFIED'))
  assert.ok(report.cases[0].issues.some(i => i.code === 'V23_QUALITY_STAGE_FAILED'))
})
test('real Gemini provenance is counted only with a V23 version', () => {
  const row = sample()
  row.result.origin = 'gemini'
  row.result.provenance_verified = true
  row.result.model = 'gemini-3.6-flash'
  row.result.interpreter_version = 'supabase-ai-v23.9-gemini-single-author-v2'
  row.result.usage = {
    generation_version: row.result.interpreter_version,
    attempt_count: 1,
    call_trace: [{ call:1, model:row.result.model, kind:'initial', http_status:200, usage:{ total_tokens:100 } }],
    quality_validation: { stages:[1,2,3,4,5,6].map(stage => ({ stage, passed:true })) },
  }
  const report = evaluateCases([row], { mode: 'live' })
  assert.equal(report.live_gemini_cases, 1)
  assert.ok(report.summary.failed >= 1) // synthetic data is not valid real interpretation
})
test('live structural failures are distinct from a generic missing result', () => {
  const row = sample()
  row.result = {
    data: null, model: 'gemini-3.6-flash', interpreter_version: 'supabase-ai-v23.9-gemini-single-author-v10',
    usage: {
      generation_version: 'supabase-ai-v23.9-gemini-single-author-v10',
      structure_validation: { version: 'fortune-provider-structure-v1', passed: false, issues: ['topic_count_mismatch'] },
    },
  }
  const report = evaluateCases([row], { mode: 'live' })
  assert.ok(report.cases[0].issues.some(i => i.code === 'PROVIDER_STRUCTURE_INVALID'))
  assert.deepEqual(report.cases[0].provider.structure_issues, ['topic_count_mismatch'])
})
test('visual diagnostics detect overflow and saved-image count mismatch', () => {
  const visual = {
    systemCards: [{}, {}, {}], reunionOverflow: 18, birthRangeOverflow: 0,
    downloadCount: 1, mobileWidths: [{ width: 320, overflow: 18, stageOverlap: true }],
  }
  const report = evaluateCases([sample()], { mode: 'fixture', visual })
  assert.equal(report.visual.status, 'failed')
  assert.ok(report.visual.issues.some(i => i.code === 'VISUAL_MOBILE_LAYOUT'))
  assert.ok(report.visual.issues.some(i => i.code === 'VISUAL_EXPORT_COUNT_MISMATCH'))
})
test('HTML escapes IDs and never includes authored prose', () => {
  const row = sample()
  row.id = '<script>alert("x")</script>'
  const html = renderHtml(evaluateCases([row], { mode: 'fixture' }))
  assert.doesNotMatch(html, /<script>/)
  assert.match(html, /&lt;script&gt;/)
  assert.doesNotMatch(html, /QA_ONLY_SENTINEL/)
})
test('empty input and duplicate case IDs are never treated as green', () => {
  assert.throws(() => evaluateCases([], { mode: 'fixture' }))
  const row = sample()
  const report = evaluateCases([row, structuredClone(row)], { mode: 'fixture' })
  assert.equal(report.summary.failed, 1)
  assert.ok(report.cases[1].issues.some(i => i.code === 'DUPLICATE_CASE_ID'))
})
