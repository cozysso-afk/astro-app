import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { SCHEMA } from '../fortune-interpret-v6-preview/integratedInterpretationV2.ts'
import {
  DOMAIN_ANSWER_CONTRACTS,
  DOMAIN_ANSWER_KEYS,
  DOMAIN_ANSWER_CONTRACT_VERSION,
} from './domainAnswerContractsV1.ts'
import { buildProviderCoreSchema, normalizeProviderCore } from './providerSchemaV23.ts'

const promptSource=readFileSync(new URL('./promptV23.ts',import.meta.url),'utf8')
const indexSource=readFileSync(new URL('./index.ts',import.meta.url),'utf8')
const qualitySource=readFileSync(new URL('../fortune-interpret-v6-preview/qualityV2.ts',import.meta.url),'utf8')
const editorialSource=readFileSync(new URL('../../../web/src/lib/fortuneEditorialV3.ts',import.meta.url),'utf8')
const narrativeSource=readFileSync(new URL('../../../web/src/PeriodFortuneNarrativeV2.tsx',import.meta.url),'utf8')

test('C1 domain answer contracts cover distinct user questions instead of one generic editorial slot',()=>{
  assert.equal(DOMAIN_ANSWER_CONTRACT_VERSION,'domain-answer-contracts-v1')
  assert.deepEqual(DOMAIN_ANSWER_CONTRACTS.map(row=>row.topic),[
    '직장','이직','학업','시험','금전','소식','연애','연락','재회','컨디션',
  ])
  assert.equal(DOMAIN_ANSWER_KEYS.length,30)
  assert.equal(new Set(DOMAIN_ANSWER_KEYS.map(row=>`${row.topic}::${row.question_key}`)).size,30)
  for(const contract of DOMAIN_ANSWER_CONTRACTS){
    assert.equal(contract.questions.length,3,contract.topic)
    assert.equal(new Set(contract.questions.map(row=>row.key)).size,3,contract.topic)
  }
})

test('C2 provider schema adds domain_answers without replacing the legacy editorial clusters',()=>{
  const schema=buildProviderCoreSchema(SCHEMA)
  assert.equal(schema.properties.domain_answers.type,'ARRAY')
  assert.ok(schema.required.includes('domain_answers'))
  assert.equal(schema.properties.clusters.type,'ARRAY')
  assert.ok(schema.properties.domain_answers.items.required.includes('question_key'))
  assert.ok(schema.properties.domain_answers.items.required.includes('status'))
  assert.ok(schema.properties.domain_answers.items.required.includes('evidence_refs'))
  assert.deepEqual(schema.properties.domain_answers.items.properties.status.enum,['direct','partial'])
  assert.ok(!schema.properties.domain_answers.items.required.includes('label'))
})

test('C3 provider normalization preserves grounded answers and fills missing questions as not_calculated',()=>{
  const normalized=normalizeProviderCore({
    clusters:[],
    domain_answers:[
      {topic:'직장',question_key:'progress',label:'모델 임의 라벨',answer:'마감 전 처리 속도가 상대적으로 살아 있어.',status:'direct',evidence_refs:['W:work']},
      {topic:'시험',question_key:'performance_error',label:'수행',answer:'근거가 없지만 답함',status:'not_calculated',evidence_refs:['W:exam']},
    ],
  })
  assert.equal(normalized.domain_answers.length,30)
  const work=normalized.domain_answers.find(row=>row.topic==='직장'&&row.question_key==='progress')
  assert.equal(work.label,'업무 진행')
  assert.equal(work.answer,'마감 전 처리 속도가 상대적으로 살아 있어.')
  assert.equal(work.status,'direct')
  const exam=normalized.domain_answers.find(row=>row.topic==='시험'&&row.question_key==='performance_error')
  assert.equal(exam.status,'not_calculated')
  assert.equal(exam.answer,'')
  const recovery=normalized.domain_answers.find(row=>row.topic==='금전'&&row.question_key==='contract_recovery')
  assert.equal(recovery.status,'not_calculated')
  assert.equal(recovery.answer,'')
})

test('C4 malformed authored answer is isolated to its question instead of poisoning every domain answer',()=>{
  const normalized=normalizeProviderCore({
    clusters:[],
    domain_answers:[
      {topic:'금전',question_key:'inflow_outflow',label:'유입 · 유출',answer:'',status:'direct',evidence_refs:['W:money']},
      {topic:'금전',question_key:'timing',label:'시기',answer:'월말 쪽 변동이 상대적으로 커.',status:'partial',evidence_refs:['W:money:date']},
    ],
  })
  const bad=normalized.domain_answers.find(row=>row.topic==='금전'&&row.question_key==='inflow_outflow')
  const good=normalized.domain_answers.find(row=>row.topic==='금전'&&row.question_key==='timing')
  assert.equal(bad.status,'not_calculated')
  assert.equal(good.status,'partial')
  assert.match(good.answer,/월말/)
})

test('C5 V23 prompt contract forbids generic padding for unsupported subquestions',()=>{
  assert.match(promptSource,/domain_answer_contracts/)
  assert.match(promptSource,/not_calculated/)
  assert.match(promptSource,/일반론으로 채우지 마/)
  assert.match(indexSource,/domain_answers는 PROMPT_DATA\.domain_answer_contracts/)
  assert.match(indexSource,/근거가 없는 질문은 행 자체를 생략해/)
  assert.match(indexSource,/서버가 누락 질문을 not_calculated로 채운다/)
  assert.match(indexSource,/금전 점수만 있는데 계약·회수 근거가 없으면 contract_recovery 행을 출력하지 않는다/)
  assert.match(indexSource,/시험 점수만 있는데 실수 유형 근거가 없으면 performance_error/)
})

test('C6 quality gate rejects invented answers and requires grounding for direct or partial rows',()=>{
  assert.match(qualitySource,/미계산 질문에 답변 생성/)
  assert.match(qualitySource,/답변 상태인데 evidence_refs 누락/)
  assert.match(qualitySource,/domain_answers 중복/)
})

test('C7 frontend gives domain answers priority over generic topic editorial for field pages',()=>{
  assert.match(editorialSource,/domainAnswers: domainAnswers\(data\)/)
  assert.match(editorialSource,/row\.status!=='direct' && row\.status!=='partial'/)
  assert.match(narrativeSource,/const domainAnswerRows = verifiedNarrative && field/)
  assert.match(narrativeSource,/domainAnsweredTopics\.has\(item\.topic\)/)
  assert.match(narrativeSource,/질문별 해설/)
  assert.match(narrativeSource,/없는 세부값은 만들지 않아/)
  assert.match(narrativeSource,/부분 근거 · 이 질문 전체를 확정하는 계산은 아님/)
})
