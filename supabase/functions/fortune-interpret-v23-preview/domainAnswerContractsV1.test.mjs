import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildV23CorePrompt } from './promptV23.ts'
import { inspectInterpretationQuality } from '../fortune-interpret-v6-preview/qualityV2.ts'

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

test('C5 unsupported subquestions remain not calculated and cannot publish an authored answer',()=>{
  const p={period_kind:'month',period:{start:'2026-11-01',end:'2026-11-30'},evidence_ledger:[]}
  const actual=buildV23CorePrompt(p)
  assert.match(actual.text,/domain_answer_contracts/)
  assert.match(actual.text,/일반론으로 채우지 마/)
  const normalized=normalizeProviderCore({clusters:[],domain_answers:[]})
  assert.equal(normalized.domain_answers.find(r=>r.question_key==='contract_recovery').status,'not_calculated')
  const data={domain_answers:[{topic:'금전',question_key:'contract_recovery',status:'not_calculated',answer:'회수할 수 있어.',evidence_refs:[]}]}
  assert.ok(inspectInterpretationQuality(data,p).stages[0].issues.some(i=>i.includes('미계산 질문에 답변 생성')))
})

test('C6 quality gate rejects invented answers and requires grounding for direct or partial rows',()=>{
  assert.match(qualitySource,/미계산 질문에 답변 생성/)
  assert.match(qualitySource,/답변 상태인데 evidence_refs 누락/)
  assert.match(qualitySource,/domain_answers 중복/)
})

test('C7 frontend preserves scoped domain answers before detailed context without invented missing answers',async()=>{
  const {buildPeriodReadingDocument}=await import('../../../web/src/lib/authoredReadingDocument.ts')
  const field={id:'contact',label:'연락운',topics:['연락','소식']}
  const section={conclusion:'연락의 핵심',real_scene:'대화가 오가는 장면',action:'실제 답변을 확인해.',change_condition:'답변이 없으면 판단을 보류해.',evidence_refs:['W:contact'],applicability:'direct'}
  const data={clusters:{relationship:{contact_activation:section,contact_continuity:section}},domain_answers:[{topic:'연락',question_key:'reply',label:'답변',answer:'답변 조건 원문',status:'partial',evidence_refs:['W:contact']},{topic:'연락',question_key:'missing',label:'미작성',answer:'',status:'not_calculated',evidence_refs:[]},{topic:'직장',question_key:'work',label:'업무',answer:'다른 분야 원고',status:'direct',evidence_refs:['W:work']}]}
  const doc=buildPeriodReadingDocument(data,'week','2026-11-01','2026-11-07',field,true)
  assert.equal(doc.sections[0].id,'question:연락:reply')
  assert.equal(doc.sections[0].blocks[0].text,'답변 조건 원문')
  assert.equal(doc.sections.find(s=>s.id==='question:연락:missing').state,'missing')
  assert.ok(!doc.sections.some(s=>s.id.includes('직장')))
})
