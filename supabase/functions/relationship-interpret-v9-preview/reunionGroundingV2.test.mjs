import test from 'node:test'
import assert from 'node:assert/strict'
import { polishReunionNarrativeText, repairReunionGroundingV2 } from './reunionGroundingV2.ts'

const payload = {
  reunion_evidence_v2: {
    evidence: [
      { id: 'E1' }, { id: 'E2' }, { id: 'E3' }, { id: 'E4' }, { id: 'E5' }, { id: 'E6' },
    ],
    questions: {
      why_reconnect: { evidence_refs: ['E1', 'E2'] },
      initiative: { evidence_refs: ['E2', 'E3'] },
      timing: { evidence_refs: ['E3', 'E4'] },
      rebuild: { evidence_refs: ['E4', 'E5'] },
      repeat_risks: { evidence_refs: ['E5', 'E6'] },
    },
  },
}

function reading() {
  return {
    reunion_synthesis_v2: {
      summary: '짧은 요약',
      why_reconnect: { conclusion: '다시 연결될 여지는 분명히 남아 있어.', interpretation: '기본 결속과 현재 진행 접점이 서로 다른 층에서 동시에 남아 있는 흐름이야.', evidence_refs: ['WRONG'] },
      initiative: { conclusion: '현재는 내 쪽 움직임이 조금 더 먼저 잡혀.', interpretation: '상대 반응층도 열리지만 시작 압력은 내 방향에서 먼저 올라오는 구조로 읽혀.', evidence_refs: [] },
      timing: { conclusion: '접점은 한 번이 아니라 몇 구간으로 나뉘어.', windows: [{ period: '2027-01', meaning: '상대 반응과 동시 접점이 강해지는 구간이야.', evidence_refs: ['BAD'] }], evidence_refs: [] },
      rebuild: { conclusion: '연락 재개와 안정적인 재결합은 다른 문제야.', conditions: ['역할과 약속을 다시 정해야 해.'], evidence_refs: ['E5'] },
      repeat_risks: { conclusion: '예전 소통 패턴이 반복되면 다시 멀어질 수 있어.', patterns: ['말의 속도와 책임 기대가 엇갈리는 패턴'], evidence_refs: ['NOPE'] },
      convergence: [{ theme: '접점', period: '2027-01', meaning: '여러 층이 겹쳐.', evidence_refs: ['BAD', 'E4'] }],
      precision_note: '확률이 아니라 상대활성도 비교야.',
    },
  }
}

test('repairs invalid refs only from the server evidence matrix and expands a short summary from existing conclusions', () => {
  const out = repairReunionGroundingV2(reading(), payload)
  assert.equal(out.ok, true)
  assert.equal(out.repaired, true)
  assert.ok(out.data.reunion_synthesis_v2.summary.length >= 180)
  const json = JSON.stringify(out.data.reunion_synthesis_v2)
  assert.equal(json.includes('WRONG'), false)
  assert.equal(json.includes('BAD'), false)
  assert.equal(json.includes('NOPE'), false)
  assert.ok(out.data.reunion_synthesis_v2.why_reconnect.evidence_refs.every(x => ['E1','E2'].includes(x)))
  assert.ok(out.data.reunion_synthesis_v2.initiative.evidence_refs.length > 0)
  assert.match(out.data.reunion_synthesis_v2.initiative.conclusion, /정하기 어렵다/)
  assert.match(out.data.reunion_synthesis_v2.initiative.interpretation, /대화가 이어지는지/)
  assert.equal(out.data.reunion_synthesis_v2.convergence.length, 0)
})

test('does not manufacture prose when a core generated section is missing', () => {
  const x = reading()
  x.reunion_synthesis_v2.initiative.interpretation = ''
  const out = repairReunionGroundingV2(x, payload)
  assert.equal(out.ok, false)
  assert.equal(out.reason, 'missing_core_section_text')
})

test('turns technical English annotations into Korean, repairs the bogus node label, and displays tiny orbs without misleading 0.0 degree rounding', () => {
  const raw = 'Progressed Venus(금성) sextile(육십분위) Sun(태양)이 오차 0.002° 수준의 극도로 정밀한 각을 형성해. 진행 용수자리는 별도 근거야.'
  const out = polishReunionNarrativeText(raw, true)
  assert.match(out, /진행 금성/)
  assert.match(out, /육십분위/)
  assert.match(out, /태양/)
  assert.match(out, /0\.01° 미만/)
  assert.match(out, /진북교점/)
  assert.equal(out.includes('용수자리'), false)
  assert.equal(out.includes('Progressed'), false)
  assert.equal(out.includes('Venus('), false)
  assert.equal(out.includes('sextile('), false)
  assert.equal(out.includes('0.002°'), false)
  assert.equal(out.includes('극도로 정밀한'), false)
})

test('deduplicates inside each question without deleting useful explanation from later questions, and refuses unsupported first-contact direction', () => {
  const x = reading()
  x.reunion_synthesis_v2.summary = '재접촉 가능성을 살펴볼 신호는 있지만 실제 관계 회복은 별도 조건이 필요해. 누가 먼저 움직이는지와 언제 접점이 강해지는지를 나눠 봐야 하고, 다시 붙은 뒤의 유지력도 따로 확인해야 해. 같은 계산 근거라도 질문이 다르면 현실에서 뜻하는 바를 다시 설명할 수 있어.'
  x.reunion_synthesis_v2.why_reconnect.interpretation = 'Progressed Venus(금성) sextile(육십분위) Sun(태양)이 orb 0.021°로 가까워 과거의 호의적 정서를 다시 자극해. 이 접점은 재연결 동기를 설명하는 근거야.'
  x.reunion_synthesis_v2.initiative.interpretation = 'Progressed Venus(금성) sextile(육십분위) Sun(태양)이 orb 0.021°로 가까워 과거의 호의적 정서를 다시 자극해. 다만 먼저 움직이는 방향은 별도의 수신·발신 지표에서 내 쪽이 조금 앞서.'
  const out = repairReunionGroundingV2(x, { ...payload, precision: { partner_time_exact: false } })
  assert.equal(out.ok, true)
  const why = out.data.reunion_synthesis_v2.why_reconnect.interpretation
  const initiative = out.data.reunion_synthesis_v2.initiative.interpretation
  assert.match(why, /진행 금성/)
  assert.match(initiative, /진행 금성/)
  assert.match(out.data.reunion_synthesis_v2.initiative.conclusion, /정하기 어렵다/)
  assert.match(initiative, /실제 만남을 잡는지/)
  assert.equal(initiative.includes('내 쪽이 조금 앞서'), false)
  assert.equal(`${why} ${initiative}`.includes('0.021°'), false)
})

test('keeps a directional conclusion only when the server initiative gate is explicitly open', () => {
  const x = reading()
  const gatedPayload = {
    ...payload,
    reunion_evidence_v2: {
      ...payload.reunion_evidence_v2,
      initiative_gate: { available: true, verdict: 'user_to_counterpart' },
    },
  }
  const out = repairReunionGroundingV2(x, gatedPayload)
  assert.equal(out.ok, true)
  assert.match(out.data.reunion_synthesis_v2.initiative.conclusion, /내 쪽 움직임/)
  assert.equal(out.data.reunion_synthesis_v2.initiative.conclusion.includes('정하기 어렵다'), false)
})

test('exact dates fail closed when there is no fast-trigger allowlist while broad progression periods remain', () => {
  const x = reading()
  x.reunion_synthesis_v2.timing.windows = [
    { period: '2027-01-15', meaning: '정확한 날짜를 임의로 찍은 창이야.', evidence_refs: ['E3'] },
    { period: '2027-01', meaning: '진행각이 가리키는 넓은 기간 신호야.', evidence_refs: ['E4'] },
  ]
  const out = repairReunionGroundingV2(x, { ...payload, reunion_timing_windows: { windows: [] } })
  assert.equal(out.ok, true)
  const periods = out.data.reunion_synthesis_v2.timing.windows.map(x => x.period)
  assert.deepEqual(periods, ['2027-01'])
})

test('an exact date survives only when the calculation fast-trigger allowlist contains that date', () => {
  const x = reading()
  x.reunion_synthesis_v2.timing.windows = [
    { period: '2027-01-15', meaning: '계산 트리거가 실제 겹친 날짜야.', evidence_refs: ['E3'] },
    { period: '2027-01-16', meaning: '허용 목록에 없는 날짜야.', evidence_refs: ['E4'] },
  ]
  const out = repairReunionGroundingV2(x, { ...payload, reunion_timing_windows: { windows: [{ date: '2027-01-15' }] } })
  assert.equal(out.ok, true)
  const periods = out.data.reunion_synthesis_v2.timing.windows.map(x => x.period)
  assert.deepEqual(periods, ['2027-01-15'])
})

test('hierarchy rejects past dates and ungrounded month-only future windows', () => {
  const x=reading()
  x.reunion_synthesis_v2.timing.windows=[
    {period:'2026-08-01',meaning:'지나간 날짜',evidence_refs:['E3']},
    {period:'2027-01',meaning:'관문 없는 넓은 기간',evidence_refs:['E3']},
    {period:'2027-01-15',meaning:'관문 통과 날짜',evidence_refs:['E3']},
  ]
  const out=repairReunionGroundingV2(x,{...payload,reunion_hierarchy:{as_of_date:'2026-09-19'},reunion_timing_windows:{windows:[{date:'2026-08-01'},{date:'2027-01-15'}]}})
  assert.equal(out.ok,true)
  assert.deepEqual(out.data.reunion_synthesis_v2.timing.windows.map(x=>x.period),['2027-01-15'])
})

test('deterministic claims are repaired before display while grounded content survives',()=>{
  const x=reading(); x.headline='반드시 연락한다'
  const out=repairReunionGroundingV2(x,payload)
  assert.equal(out.ok,true)
  assert.doesNotMatch(JSON.stringify(out.data),/반드시 연락한다/)
  assert.match(out.data.headline,/확정할 수는 없지만/)
})

test('canonical period endpoints survive without joining unrelated windows',()=>{
  const x=reading()
  x.reunion_synthesis_v2.timing.windows=[
    {period:'2027-01-14 ~ 2027-01-16',meaning:'계산된 소구간',evidence_refs:['E3']},
    {period:'2027-01-14 ~ 2027-02-16',meaning:'서로 다른 구간을 임의로 연결',evidence_refs:['E3']},
  ]
  const out=repairReunionGroundingV2(x,{...payload,reunion_hierarchy:{as_of_date:'2026-09-19'},reunion_timing_windows:{windows:[
    {date:'2027-01-15',start:'2027-01-14',end:'2027-01-16'},
    {date:'2027-02-15',start:'2027-02-14',end:'2027-02-16'},
  ]}})
  assert.equal(out.ok,true)
  assert.deepEqual(out.data.reunion_synthesis_v2.timing.windows.map(x=>x.period),['2027-01-14 ~ 2027-01-16'])
})