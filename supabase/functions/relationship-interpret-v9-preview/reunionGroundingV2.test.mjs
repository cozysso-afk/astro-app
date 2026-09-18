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
  assert.equal(out.data.reunion_synthesis_v2.convergence.length, 0)
})

test('does not manufacture prose when a core generated section is missing', () => {
  const x = reading()
  x.reunion_synthesis_v2.initiative.interpretation = ''
  const out = repairReunionGroundingV2(x, payload)
  assert.equal(out.ok, false)
  assert.equal(out.reason, 'missing_core_section_text')
})

test('turns technical English annotations into natural Korean and removes false sub-degree precision', () => {
  const raw = 'Progressed Venus(금성) sextile(육십분위) Sun(태양)이 오차 0.002° 수준의 극도로 정밀한 각을 형성해.'
  const out = polishReunionNarrativeText(raw, true)
  assert.match(out, /진행 금성/)
  assert.match(out, /육십분위/)
  assert.match(out, /태양/)
  assert.equal(out.includes('Progressed'), false)
  assert.equal(out.includes('Venus('), false)
  assert.equal(out.includes('sextile('), false)
  assert.equal(out.includes('0.002°'), false)
  assert.equal(out.includes('극도로 정밀한'), false)
})

test('suppresses a repeated technical evidence sentence when the later section still has unique interpretation', () => {
  const x = reading()
  x.reunion_synthesis_v2.summary = '재접촉 문은 열려 있지만 실제 관계 회복은 별도 조건이 필요해. 누가 먼저 움직이는지와 언제 접점이 강해지는지를 나눠 봐야 하고, 다시 붙은 뒤의 유지력도 따로 확인해야 해. 같은 계산 근거를 여러 섹션에서 반복해 강도를 부풀리지는 않을게.'
  x.reunion_synthesis_v2.why_reconnect.interpretation = 'Progressed Venus(금성) sextile(육십분위) Sun(태양)이 orb 0.021°로 가까워 과거의 호의적 정서를 다시 자극해. 이 접점은 재연결 동기를 설명하는 근거야.'
  x.reunion_synthesis_v2.initiative.interpretation = 'Progressed Venus(금성) sextile(육십분위) Sun(태양)이 orb 0.021°로 가까워 과거의 호의적 정서를 다시 자극해. 다만 먼저 움직이는 방향은 별도의 수신·발신 지표에서 내 쪽이 조금 앞서.'
  const out = repairReunionGroundingV2(x, { ...payload, precision: { partner_time_exact: false } })
  assert.equal(out.ok, true)
  const why = out.data.reunion_synthesis_v2.why_reconnect.interpretation
  const initiative = out.data.reunion_synthesis_v2.initiative.interpretation
  assert.match(why, /진행 금성/)
  assert.equal(initiative.includes('진행 금성'), false)
  assert.match(initiative, /먼저 움직이는 방향/)
  assert.equal(`${why} ${initiative}`.includes('0.021°'), false)
})
