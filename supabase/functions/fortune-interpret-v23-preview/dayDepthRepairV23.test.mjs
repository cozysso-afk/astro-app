import assert from 'node:assert/strict'
import test from 'node:test'

import { ensureDayDepthGuides } from './dayDepthRepairV23.ts'

test('daily depth repair adds one exact intraday key window and linked timed decision when authored guidance is absent', () => {
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

test('daily depth repair grounds authored windows and decisions without replacing their prose', () => {
  const payload = {
    period_kind: 'day',
    period: { start: '2026-10-06', end: '2026-10-06' },
    evidence_ledger: [
      { id:'W:window:2026-10-06:소식:best', system:'western', scope:'intraday_window', topic:'소식', direction:'supportive', date:'2026-10-06', window:'11:00~12:30', text:'2026-10-06 소식 활용 시간창 11:00~12:30' },
      { id:'W:detail:2026-10-06:소식:1', system:'western', scope:'intraday_evidence', topic:'소식', direction:'supportive', date:'2026-10-06', text:'달-수성 조화' },
      { id:'W:window:2026-10-06:금전:caution', system:'western', scope:'intraday_window', topic:'금전', direction:'caution', date:'2026-10-06', window:'17:00~18:30', text:'2026-10-06 금전 주의 시간창 17:00~18:30' },
      { id:'W:detail:2026-10-06:금전:1', system:'western', scope:'intraday_evidence', topic:'금전', direction:'caution', date:'2026-10-06', text:'화성-토성 긴장' },
    ],
  }
  const core = {
    overall: { best_phase:'11:00~12:30', caution_phase:'17:00~18:30' },
    key_windows: [
      {
        label:'점심 소통 및 확인 시간대', start:'2026-10-06', end:'2026-10-06', signal:'활용', topics:['소식'],
        summary:'정보 전달과 오해 해소, 간단한 점검 작업이 원활하게 풀리는 시간이야.',
        action:'미뤄둔 답장을 보내거나 제출할 서류를 집중 점검해.', avoid:'급하게 결론내리지 마.', evidence_refs:[],
      },
      {
        label:'늦은 오후 충동 및 평가 압박 시간대', start:'2026-10-06', end:'2026-10-06', signal:'주의', topics:['금전'],
        summary:'피로가 누적되고 충동적인 소비나 조급한 마무리가 발생하기 쉬워.',
        action:'새로운 지출 결정을 내일로 미뤄.', avoid:'즉흥 결제를 피해야 해.', evidence_refs:[],
      },
    ],
    decisions: [{
      action:'핵심 서류 검토 및 메시지 전송은 점심 전에 처리하기', timing:'11:00~12:30',
      reason:'이해력과 전달력이 가장 명확해지는 구간이기 때문이야.', watch:'답장 속도와 요구 사항의 구체성',
      avoid:'늦은 오후 불필요한 결제창 열기', evidence_refs:[],
    }],
    topic_analysis: {}, clusters: {},
  }
  const out = ensureDayDepthGuides(structuredClone(core), payload)
  assert.equal(out.key_windows.length, 2)
  assert.equal(out.key_windows[0].label, core.key_windows[0].label)
  assert.equal(out.key_windows[0].summary, core.key_windows[0].summary)
  assert.equal(out.key_windows[0].action, core.key_windows[0].action)
  assert.ok(out.key_windows[0].evidence_refs.includes('W:window:2026-10-06:소식:best'))
  assert.ok(out.key_windows[0].evidence_refs.includes('W:detail:2026-10-06:소식:1'))
  assert.equal(out.key_windows[1].label, core.key_windows[1].label)
  assert.ok(out.key_windows[1].evidence_refs.includes('W:window:2026-10-06:금전:caution'))
  assert.equal(out.decisions.length, 1)
  assert.equal(out.decisions[0].action, core.decisions[0].action)
  assert.equal(out.decisions[0].reason, core.decisions[0].reason)
  assert.equal(out.decisions[0].watch, core.decisions[0].watch)
  assert.equal(out.decisions[0].avoid, core.decisions[0].avoid)
  assert.equal(out.decisions[0].timing, core.decisions[0].timing)
  assert.ok(out.decisions[0].evidence_refs.includes('W:window:2026-10-06:소식:best'))
})

test('non-daily periods are untouched', () => {
  const core = { key_windows: [], decisions: [] }
  const out = ensureDayDepthGuides(structuredClone(core), { period_kind:'week', period:{start:'2026-10-05',end:'2026-10-11'}, evidence_ledger:[] })
  assert.deepEqual(out, core)
})
