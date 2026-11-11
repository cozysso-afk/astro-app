import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTemporalWordingInstruction, buildV23CorePrompt, buildV23PromptBudget, buildV23CorePromptFromPacket } from './promptV23.ts'
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
  assert.equal(out.packet.packet_version, 'fortune-ai-prompt-v23.15-grounded-reader-contract')
  assert.equal(out.packet.period_narrative.kind, 'week')
  assert.match(out.text, /현상 묶음부터 시작/)
  assert.match(out.text, /같은 현상이 여러 topic에 걸쳐 있으면 한 번 설명/)
  assert.match(out.text, /Mercury trine Jupiter/)
})

test('daily copy contract keeps the headline and summary short and forbids overall fallback', () => {
  const out = buildV23CorePrompt(payload('day')).text
  assert.match(out, /문장 수를 맞추려고 조건을 삭제/)
  assert.match(out, /80~180자/)
  assert.match(out, /종합 요약으로 대체되는 결과는 실패/)
  assert.doesNotMatch(out,/relationship은 summary, friends, coworkers/)
  assert.match(out,/이번 요청은 종합과 기본 여섯 분야/)
})

test('non-today packets hard-ban today wording across every user-facing field', () => {
  const instruction = buildTemporalWordingInstruction({
    time_context: {
      requested_start: '2026-10-26',
      requested_end: '2026-10-26',
      current_date: '2026-10-28',
      today_word_allowed: false,
      permitted_deictics: ['선택한 날', '그날', '해당 날짜'],
    },
  })
  assert.match(instruction, /모든 사용자 문장 필드/)
  assert.match(instruction, /단어 "오늘"/)
  assert.match(instruction, /2026-10-26/)
  assert.match(instruction, /선택한 날 \/ 그날 \/ 해당 날짜/)
})

test('actual-today packets do not receive a contradictory hard ban', () => {
  assert.equal(buildTemporalWordingInstruction({ time_context: { today_word_allowed: true } }), '')
})

test('V23 prompt carries domain-specific user questions without inventing missing sub-calculations', () => {
  const out = buildV23CorePrompt(payload('week'))
  assert.equal(out.packet.domain_answer_contract_version,'domain-answer-contracts-v1')
  assert.ok(Array.isArray(out.packet.domain_answer_contracts))
  assert.ok(out.packet.domain_answer_contracts.some(row=>row.topic==='시험'&&row.questions.some(q=>q.key==='performance_error')))
  assert.ok(out.packet.domain_answer_contracts.some(row=>row.topic==='금전'&&row.questions.some(q=>q.key==='contract_recovery')))
  assert.match(out.text,/domain_answer_contracts/)
  assert.match(out.text,/not_calculated/)
  assert.match(out.text,/일반론으로 채우지 마/)
})

test('same evidence receives different period narrative contracts', () => {
  const day = buildV23CorePrompt(payload('day')).text
  const week = buildV23CorePrompt(payload('week')).text
  const month = buildV23CorePrompt(payload('month')).text
  const annual = buildV23CorePrompt(payload('annual')).text
  assert.match(day, /선택한 운세일 안에서/)
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

test('daily prompt has one scope and does not reference missing narrative plans', () => {
  const out=buildV23CorePrompt(payload('day')).text
  assert.match(out,/editorial_focus/)
  assert.match(out,/clusters 여섯 분야를 먼저 작성/)
  assert.match(out,/짧은 두 문장/)
  assert.match(out,/직장인·학생·수험생·구직자·투자자·연애 중이라고 가정하지 마/)
  assert.match(out,/점수가 낮거나 band가 약하다는 이유만으로/)
  assert.doesNotMatch(out,/HUMAN_LANGUAGE_CONTRACT|V23 CORE CONTRACT|반드시 따를 서사 순서|narrative_plan|domain_answer_contracts/)
  assert.match(out,/연애 해설을 답장과 연락 여부만으로 채우지 마/)
  const packet=JSON.parse(out.split('PROMPT_DATA=')[1])
  assert.ok(packet.daily_editorial_brief.questions.every(q=>q.reader_question.endsWith('?')))
})

test('non-daily prompt retains relationship and Korean editorial contracts', () => {
  const text=buildV23CorePrompt(payload('week')).text
  assert.match(text,/재회 관심 해설은 생각남→연락→실제 만남→관계 재구축/)
  assert.match(text,/다시 낮춰 읽을 현실 조건/)
  assert.match(text,/목적어와 서술어의 의미 호응을 확인/)
  assert.match(text,/초반·중반·후반의 변화를 의무적으로 만들지 않/)
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
  assert.match(buildV23CorePrompt(payload('day')).text, /선택한 운세일 안에서/)
  assert.match(buildV23CorePrompt(payload('week')).text, /표본이 같으면 유지되는 점/)
})

test('daily writer receives the actual date-wording contract from the source payload',()=>{
  const input=payload('day');input.time_context={today_word_allowed:false,requested_start:'2026-11-05'}
  const out=buildV23CorePrompt(input)
  assert.deepEqual(out.packet.time_context,input.time_context)
  assert.match(out.text,/DATE WORDING · HARD GATE/)
  assert.equal(JSON.parse(out.text.split('PROMPT_DATA=')[1]).time_context.today_word_allowed,false)
})


test('monthly budget measures the exact writer packet and preserves every selected fact and question mapping', () => {
  const input = payload('month')
  input.period = {start:'2026-09-01',end:'2026-09-30'}
  const budget = buildV23PromptBudget(input)
  const server = budget.packet
  const prompt = buildV23CorePromptFromPacket(server).text
  const writer = JSON.parse(prompt.split('PROMPT_DATA=').at(-1))
  assert.equal(budget.bytes, Buffer.byteLength(JSON.stringify(writer)))
  assert.deepEqual(writer.evidence_ledger, server.evidence_ledger)
  assert.equal(writer.period_reading.omitted_count, server.period_reading.omitted_ids.length)
  for (const question of writer.period_reading.questions) {
    const refs = writer.evidence_ledger.filter(row =>
      [row.topic,...row.source_topics??[]].some(topic=>question.topics.includes(topic))
    ).map(row=>row.id)
    assert.deepEqual(refs,server.period_reading.questions.find(q=>q.key===question.key).evidence_refs)
  }
})
