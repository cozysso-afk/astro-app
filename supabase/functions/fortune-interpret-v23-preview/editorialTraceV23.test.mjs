import test from 'node:test'
import assert from 'node:assert/strict'
import { buildEditorialTrace, captureEditorialStage, EDITORIAL_TRACE_VERSION } from './editorialTraceV23.ts'

test('editorial trace records overwrite add and delete without mutating prose', () => {
  const raw = {
    headline: '원래 헤드라인',
    overall: { summary: '원래 총평 문장' },
    clusters: [
      { key: 'study', conclusion: '공부 원문', real_scene: '책상 앞 장면', action: '분량을 줄여', change_condition: '집중이 돌아오면 늘려' },
    ],
  }
  const after = {
    headline: '원래 헤드라인',
    overall: { summary: '서버가 바꾼 총평 문장' },
    clusters: {
      work_study: {
        study: { conclusion: '공부 원문', real_scene: '책상 앞 장면', action: '분량을 줄여', change_condition: '' },
      },
    },
    topic_analysis: {
      학업: { verdict: '학업 활성도 33점', action: '오답부터 정리해' },
    },
  }
  const beforeJson = JSON.stringify(raw)
  const afterJson = JSON.stringify(after)
  const trace = buildEditorialTrace([
    captureEditorialStage('provider_raw', raw),
    captureEditorialStage('post_server', after),
  ], { origin: 'test' })

  assert.equal(trace.version, EDITORIAL_TRACE_VERSION)
  assert.equal(JSON.stringify(raw), beforeJson)
  assert.equal(JSON.stringify(after), afterJson)
  assert.equal(trace.transitions.length, 1)
  const transition = trace.transitions[0]
  assert.ok(transition.total_changes >= 4)
  assert.ok(transition.changes.some(change => change.path === 'overall.summary' && change.kind === 'overwritten'))
  assert.ok(transition.changes.some(change => change.path === 'topic_analysis.학업.verdict' && change.kind === 'added'))
  assert.ok(transition.changes.some(change => change.path.endsWith('study.change_condition') && change.kind === 'deleted'))
})

test('initial trace samples are bounded and whitespace-normalized', () => {
  const long = `  ${'긴 문장 '.repeat(80)}  `
  const trace = buildEditorialTrace([captureEditorialStage('provider_raw', { headline: long })])
  const row = trace.initial.fields.headline
  assert.ok(row.sample.length <= 140)
  assert.equal(row.sample.includes('  '), false)
  assert.ok(row.len > row.sample.length)
})
