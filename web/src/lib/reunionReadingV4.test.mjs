import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReunionReadingV4 } from './reunionReadingV4.ts'
import { validateReaderManuscriptV4 } from './narrativeQualityV4.ts'

function hierarchy(overrides = {}) {
  const stages = {
    emotional_reactivation:{label:'감정',activation:55,candidate_count:1},
    contact_recontact:{label:'연락',activation:52,candidate_count:1},
    in_person_meeting:{label:'만남',activation:31,candidate_count:0},
    relationship_rebuilding:{label:'재구축',activation:70,candidate_count:1},
    ...(overrides.stages ?? {}),
  }
  return {
    version:'v4-fixture', as_of_date:'2026-10-24', score_meaning:'relative',
    validation:{status:'PASS',checks:[]}, stages,
    current_windows:overrides.current_windows ?? [],
    top_periods:overrides.top_periods ?? [{start:'2026-11-01',end:'2026-11-03',date:'2026-11-01',stage:'relationship_rebuilding',label:'재구축',final:70,components:{long_term:0,mid_term:0,event_trigger:0,cross_system:0,final:70}}],
    past_windows:[], nearest_window:null, limitations:[],
  }
}

const directions = [
  {kind:'incoming',label:'수신',score:43,band:'보통',text:''},
  {kind:'outgoing',label:'발신',score:39,band:'약함',text:''},
]

test('연락 중이지만 만남 후보가 없으면 재회 성립이 아니라 재접촉 단계로 판정한다', () => {
  const result = buildReunionReadingV4({
    hierarchy:hierarchy(),
    observation:{state:'messaging',initiator:'user',events:[]},
    directionRows:directions,
  })
  assert.match(result.manuscript.verdict.title,/재접촉 단계에 머물러 있어요/)
  assert.match(result.manuscript.verdict.answer,/약속이 구체화되는지/)
  assert.equal(result.axes.find(row=>row.key==='recontact')?.state,'observed')
  assert.equal(result.axes.find(row=>row.key==='continuity')?.state,'observed')
  assert.equal(result.axes.find(row=>row.key==='meeting')?.state,'no_candidate')
  assert.equal(result.axes.find(row=>row.key==='agreement')?.state,'blocked')
  assert.equal(result.observedInitiator,'내가 먼저')
})

test('상위 재구축 후보가 있어도 만남 단계가 닫혀 있으면 상단 판정을 건너뛰지 않는다', () => {
  const result = buildReunionReadingV4({
    hierarchy:hierarchy(),
    observation:{state:'recontacted',initiator:'',events:[]},
    directionRows:directions,
  })
  assert.equal(result.axes.find(row=>row.key==='agreement')?.state,'blocked')
  assert.doesNotMatch(result.manuscript.verdict.answer,/관계 재구축 단계가 열려/)
})

test('실제 만남은 대화 지속을 자동 확인하지 않는다', () => {
  const result = buildReunionReadingV4({
    hierarchy:hierarchy({top_periods:[]}),
    observation:{state:'met',initiator:'counterpart',events:[]},
    directionRows:directions,
  })
  assert.equal(result.axes.find(row=>row.key==='meeting')?.state,'observed')
  assert.equal(result.axes.find(row=>row.key==='continuity')?.state,'not_calculated')
  assert.equal(result.observedInitiator,'상대가 먼저')
})

test('수신과 발신은 차트 활성축으로 분리하고 실제 첫 연락과 섞지 않는다', () => {
  const result = buildReunionReadingV4({
    hierarchy:hierarchy(),
    observation:{state:'messaging',initiator:'counterpart',events:[]},
    directionRows:directions,
  })
  assert.deepEqual(result.directions.map(row=>row.label),['수신 · 상대 → 나','발신 · 나 → 상대'])
  assert.match(result.directions[0].meaning,/상대 쪽 흐름/)
  assert.match(result.directions[1].meaning,/내 쪽 흐름/)
  assert.deepEqual(result.directions.map(row=>row.metric),['보통','약함'])
  assert.equal(result.observedInitiator,'상대가 먼저')
})

test('연락 중이면 미래 시기는 회상이 아니라 실제 만남 단계에서만 고른다', () => {
  const period = (stage,start) => ({start,end:start,date:start,stage,label:stage,final:60,components:{long_term:0,mid_term:0,event_trigger:0,cross_system:0,final:60}})
  const result = buildReunionReadingV4({
    hierarchy:hierarchy({
      stages:{in_person_meeting:{label:'만남',activation:60,candidate_count:1}},
      top_periods:[period('emotional_reactivation','2026-10-28'),period('in_person_meeting','2026-11-04')],
    }),
    observation:{state:'messaging',initiator:'user',events:[]},
    directionRows:directions,
  })
  assert.deepEqual(result.futureWindows.map(row=>row.stage),['in_person_meeting'])
})

test('유지력 설명이 있어도 지속 가능성을 미래 후보로 만들지 않는다', () => {
  const result = buildReunionReadingV4({
    hierarchy:hierarchy(),
    observation:{state:'reunited',initiator:'mutual',events:[]},
    directionRows:directions,
    hasSustainabilityEvidence:true,
  })
  assert.equal(result.axes.find(row=>row.key==='sustainability')?.state,'not_calculated')
  assert.equal(result.axes.find(row=>row.key==='sustainability')?.status,'지속 행동으로 확인')
  assert.deepEqual(result.futureWindows,[])
})

test('모든 실제 관계 상태의 상단 원고가 중복·메타 언어 품질 계약을 통과한다', () => {
  for (const state of ['','disconnected','recontacted','messaging','met','intimate_undefined','reunited']) {
    const result = buildReunionReadingV4({
      hierarchy:hierarchy(),
      observation:{state,initiator:'unknown',events:[]},
      directionRows:directions,
    })
    assert.deepEqual(validateReaderManuscriptV4(result.manuscript),[],state || 'not_provided')
  }
})

