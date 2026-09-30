import test from 'node:test'
import assert from 'node:assert/strict'
import { buildV23CorePrompt } from './promptV23.ts'
import { buildPeriodNarrativeContext } from './periodNarrativeV23.ts'

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
  assert.equal(out.packet.packet_version, 'fortune-ai-prompt-v23.4-editorial-usability-gate')
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

test('human-language contract requires concrete scenes and semantic non-repetition', () => {
  const day = buildV23CorePrompt(payload('day')).text
  const week = buildV23CorePrompt(payload('week')).text
  assert.match(day, /실제 생활에서 체감할 수 있는 구체적인 장면/)
  assert.match(day, /다른 날짜나 다른 사람에게 그대로 붙여도 말이 되는 범용 조언이면 실패/)
  assert.match(day, /"서두르지 마\/신중해\/천천히 봐"는 같은 의미/)
  assert.match(day, /오늘만의 촉발·시간대·현실 장면/)
  assert.match(day, /분야 점수 요약만 쓰지 마/)
  assert.match(week, /7일의 이동이나 전환/)
  assert.match(week, /초반→중반→후반/)
})

test('editorial usability gate requires an actionable reading instead of safe generic prose', () => {
  const text = buildV23CorePrompt(payload('day')).text
  assert.match(text, /최소 두 개의 서로 다른 생활 분야를 실제로 연결/)
  assert.match(text, /결론 ② 현실에서 나타나는 장면 또는 판단 기준 ③ 사용자가 취할 행동 또는 이 판단이 달라지는 조건/)
  assert.match(text, /무엇이 실제로 나타나면 지금 판단을 올리거나 낮출 수 있는지/)
  assert.match(text, /사용자가 읽고 나서 다음 행동이나 관찰 기준을 하나도 얻지 못하면 실패/)
  assert.match(text, /topic 이름만 바꿔도 그대로 통하는 문장을 반복하지 마/)
})

test('interpersonal and reunion editorial contracts preserve domain-specific limits', () => {
  const text = buildV23CorePrompt(payload('day')).text
  assert.match(text, /대인관계 세부항목은 친구·지인, 직장동료, 가족·가까운 사람, 새 인맥, 갈등·경계를 서로 다른 독립 계산 결과처럼 꾸미지 마/)
  assert.match(text, /공통 대인관계 근거를 각 현실 상황에 어떻게 적용해 읽는지 조건부로 번역/)
  assert.match(text, /재회 관심 해설은 생각남→연락→실제 만남→관계 재구축을 서로 다른 단계로 유지/)
  assert.match(text, /다시 낮춰 읽을 현실 조건/)
})

test('Korean editorial contract enforces grammar and separates love from contact', () => {
  const text = buildV23CorePrompt(payload('day')).text
  assert.match(text, /주어와 서술어가 무엇을 가리키는지 분명하게 맞춰/)
  assert.match(text, /목적어와 서술어의 의미 호응을 확인/)
  assert.match(text, /병렬 항목은 같은 문법 단위로 맞춰/)
  assert.match(text, /추상명사를 연속해서 쌓지 마/)
  assert.match(text, /headline·overall·topic verdict·action은 각자 다른 역할/)
  assert.match(text, /연애와 연락은 같은 분야가 아니야/)
  assert.match(text, /연애 해설을 답장과 연락 여부만으로 채우지 마/)
})

test('day prioritizes a one-day trigger while week prioritizes a multi-day pattern', () => {
  const evidence = [
    {
      id: 'day-trigger', system: 'western', topic: '직업', scope: 'daily_actual', date: '2026-09-14',
      direction: 'caution', text: 'Mars square Saturn',
      observation: { transit: 'Mars', target: 'Saturn', aspect: 'square' },
    },
    ...['2026-09-14','2026-09-16','2026-09-18'].map((date,index)=>({
      id: `week-pattern-${index+1}`, system: 'western', topic: '대인관계', scope: 'daily_actual', date,
      direction: 'supportive', text: 'Jupiter trine Sun',
      observation: { transit: 'Jupiter', target: 'Sun', aspect: 'trine' },
    })),
  ]
  const day = buildPeriodNarrativeContext({period_kind:'day', evidence_ledger:evidence})
  const week = buildPeriodNarrativeContext({period_kind:'week', evidence_ledger:evidence})
  assert.match(day.phenomena[0].label, /Mars square Saturn/)
  assert.match(week.phenomena[0].label, /Jupiter trine Sun/)
  assert.match(buildV23CorePrompt(payload('day')).text, /오늘만의 촉발/)
  assert.match(buildV23CorePrompt(payload('week')).text, /초반→중반→후반/)
})
