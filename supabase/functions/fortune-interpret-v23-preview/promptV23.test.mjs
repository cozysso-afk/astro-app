import test from 'node:test'
import assert from 'node:assert/strict'
import { buildV23CorePrompt } from './promptV23.ts'

function payload(kind='week') {
  return {
    period_kind: kind,
    period: { start: '2026-09-14', end: '2026-09-20' },
    ranking: { strongest: [], weakest: [] },
    western: {
      engine: 'fixture',
      overall: {
        학업: { average: 61, band: '강', spread: 18 },
        시험: { average: 58, band: '중간', spread: 15 },
      },
      relationship_signals: {},
      daily_pattern_digest: {
        학업: { volatility: 6 },
        시험: { volatility: 5 },
      },
      months: [], detail_days: [], daily_evidence_coverage: {}, market: null,
    },
    key_dates: [], cross_system_timeline: [], saju: null, thai: null,
    evidence_ledger: [
      {
        id: 'W:daily:학업:1', system: 'western', topic: '학업', scope: 'daily_actual', date: '2026-09-15',
        direction: 'supportive', text: 'Mercury trine Jupiter',
        observation: { transit: 'Mercury', target: 'Jupiter', aspect: 'trine' },
      },
      {
        id: 'W:daily:시험:2', system: 'western', topic: '시험', scope: 'daily_actual', date: '2026-09-17',
        direction: 'supportive', text: 'Mercury trine Jupiter',
        observation: { transit: 'Mercury', target: 'Jupiter', aspect: 'trine' },
      },
    ],
  }
}

test('V23 prompt carries phenomenon-first contract instead of topic-first narration', () => {
  const out = buildV23CorePrompt(payload('week'))
  assert.equal(out.packet.packet_version, 'fortune-ai-prompt-v23-phenomenon-first')
  assert.equal(out.packet.period_narrative.kind, 'week')
  assert.match(out.text, /현상 묶음부터 시작/)
  assert.match(out.text, /같은 현상이 여러 topic에 걸쳐 있으면 한 번 설명/)
  assert.match(out.text, /Mercury trine Jupiter/)
})

test('same evidence receives different period narrative contracts', () => {
  const day = buildV23CorePrompt(payload('day')).text
  const week = buildV23CorePrompt(payload('week')).text
  const month = buildV23CorePrompt(payload('month')).text
  const annual = buildV23CorePrompt(payload('annual')).text
  assert.match(day, /오늘 안에서/)
  assert.match(week, /7일 안에서/)
  assert.match(month, /한 달 안에서/)
  assert.match(annual, /연중 구조적/)
  assert.notEqual(day, week)
  assert.notEqual(week, month)
  assert.notEqual(month, annual)
})

test('V23 prompt explicitly blocks score narration from becoming the explanation itself', () => {
  const out = buildV23CorePrompt(payload('month'))
  assert.match(out.text, /점수·평균·변동폭을 설명 자체로 착각하지 마/)
  assert.match(out.text, /고정 조언문을 분야명만 바꿔 반복하지 마/)
})
