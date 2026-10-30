import assert from 'node:assert/strict'
import test from 'node:test'
import { buildNarrativePlan } from './promptV23.ts'

test('narrative plan does not mistake low activation for a caution direction',()=>{
  const packet={
    period_kind:'week',
    ranking:{
      strongest:[
        {topic:'학업',average:51,band:'강함'},
        {topic:'금전',average:80,band:'보통'},
        {topic:'투자주의',average:50,band:'강함'},
      ],
      weakest:[
        {topic:'연락',average:49,band:'약함'},
        {topic:'소식',average:10,band:'보통'},
      ],
    },
    period_narrative:{
      kind:'week',
      phenomena:[
        {topics:['학업'],directions:['supportive'],role:'support',evidence_refs:['W:study']},
        {topics:['연락'],directions:['caution'],role:'caution',evidence_refs:['W:contact']},
        {topics:['투자주의'],evidence_refs:['W:risk']},
      ],
    },
  }
  const plan=buildNarrativePlan(packet)
  assert.deepEqual(plan.supporting_topics,['학업'])
  assert.deepEqual(plan.caution_topics,['연락','투자주의'])
  assert.deepEqual(plan.evidence_refs,['W:study','W:contact','W:risk'])
  assert.doesNotMatch(JSON.stringify(plan),/>=55|<45/)
})

test('weak band alone stays out of the daily caution plan',()=>{
  const packet={
    period_kind:'day',
    ranking:{strongest:[],weakest:[{topic:'학업',average:37,band:'약함'},{topic:'소식',average:38,band:'약함'}]},
    period_narrative:{kind:'day',phenomena:[]},
  }
  const plan=buildNarrativePlan(packet)
  assert.deepEqual(plan.supporting_topics,[])
  assert.deepEqual(plan.caution_topics,[])
  assert.match(plan.period_operation,/약한 분야는 결론을 미룬다/)
})
