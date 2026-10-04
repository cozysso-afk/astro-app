import assert from 'node:assert/strict'
import test from 'node:test'

import { ensureDayDepthGuides } from './dayDepthRepairV23.ts'

test('daily depth repair adds one exact intraday key window and linked timed decision', () => {
  const payload = {
    period_kind: 'day',
    period: { start: '2026-10-05', end: '2026-10-05' },
    evidence_ledger: [
      { id:'W:window:2026-10-05:학업:best', system:'western', scope:'intraday_window', topic:'학업', direction:'supportive', date:'2026-10-05', window:'06:30~08:00', text:'2026-10-05 학업 활용 시간창 06:30~08:00' },
      { id:'W:detail:2026-10-05:학업:1', system:'western', scope:'intraday_evidence', topic:'학업', direction:'supportive', date:'2026-10-05', text:'달-태양 조화' },
      { id:'W:window:2026-10-05:학업:caution', system:'western', scope:'intraday_window', topic:'학업', direction:'caution', date:'2026-10-05', window:'21:00~23:30', text:'2026-10-05 학업 주의 시간창 21:00~23:30' },
    ],
  }
  const core = {
    overall: { best_phase:'06:30~08:00 오전 활용', caution_phase:'21:00~23:30 야간 주의' },
    key_windows: [],
    decisions: [],
    topic_analysis: { 학업:{ action:'핵심 과제를 먼저 처리해.', avoid:'밤의 피로만으로 하루 전체 학습을 단정하지 마.' } },
    clusters: { work_study:{ study:{ action:'가장 어려운 과제 하나를 먼저 끝내.', real_scene:'아침에는 사고가 정리돼 핵심 개념 연결이 빠르다.', change_condition:'집중이 끊기기 시작하면 새 진도를 늘리지 말고 복습으로 전환해.' } } },
  }
  const out = ensureDayDepthGuides(structuredClone(core), payload)
  assert.equal(out.key_windows.length, 1)
  assert.equal(out.key_windows[0].signal, '활용')
  assert.ok(out.key_windows[0].evidence_refs.includes('W:window:2026-10-05:학업:best'))
  assert.ok(out.key_windows[0].evidence_refs.includes('W:detail:2026-10-05:학업:1'))
  assert.equal(out.decisions.length, 1)
  assert.equal(out.decisions[0].timing, '2026-10-05 06:30~08:00')
  assert.match(out.decisions[0].action, /가장 어려운 과제/)
  assert.ok(out.decisions[0].evidence_refs.includes('W:window:2026-10-05:학업:best'))
})

test('non-daily periods are untouched', () => {
  const core = { key_windows: [], decisions: [] }
  const out = ensureDayDepthGuides(structuredClone(core), { period_kind:'week', period:{start:'2026-10-05',end:'2026-10-11'}, evidence_ledger:[] })
  assert.deepEqual(out, core)
})
