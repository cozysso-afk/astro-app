import test from 'node:test'
import assert from 'node:assert/strict'
import { DAILY_PRIMARY_KEYS, inspectDailyProviderDocument, omitUnsupportedDailyConditions } from './dailyReadingContractV1.ts'
const core=()=>({headline:'하루의 핵심 장면.',overall:{summary:'종합 요약은 분야별 결론과 구분해.'},clusters:DAILY_PRIMARY_KEYS.map(key=>({key,conclusion:`${key} 결론`,real_scene:'실제 장면',action:'구체적 행동',change_condition:'달라지는 조건',evidence_refs:['W:test'],applicability:'conditional'}))})
test('all six daily fields are mandatory, including compact retries',()=>{
  const d=core();assert.ok(inspectDailyProviderDocument(d,'day').passed)
  d.clusters.pop();assert.ok(!inspectDailyProviderDocument(d,'day').passed)
  assert.ok(inspectDailyProviderDocument(d,'week').passed)
})
test('explicit insufficient is allowed, omission and duplicate keys are not',()=>{
  const d=core();d.clusters[0]={key:DAILY_PRIMARY_KEYS[0],applicability:'insufficient'}
  assert.ok(inspectDailyProviderDocument(d,'day').passed)
  d.clusters.push(d.clusters[0]);assert.ok(!inspectDailyProviderDocument(d,'day').passed)
})
test('repeated field conclusions, overall fallback and unbounded hero fail',()=>{
  const d=core();d.clusters[1].conclusion=d.clusters[0].conclusion
  assert.ok(inspectDailyProviderDocument(d,'day').issues.some(i=>i.startsWith('daily_duplicate_conclusion')))
  d.clusters[0].conclusion=d.overall.summary
  assert.ok(inspectDailyProviderDocument(d,'day').issues.some(i=>i.startsWith('daily_overall_reused')))
  d.overall.summary='가'.repeat(361)
  assert.ok(inspectDailyProviderDocument(d,'day').issues.includes('daily_summary_invalid'))
})

test('a grounded daily reading does not have to invent an exception',()=>{
 const d=core();d.clusters[0].change_condition=''
 assert.ok(inspectDailyProviderDocument(d,'day').passed)
 d.clusters[0].action=''
 assert.ok(!inspectDailyProviderDocument(d,'day').passed)
})

test('unsupported optional exceptions are omitted without rewriting retained Gemini prose',()=>{
 const d=core(),original=structuredClone(d)
 const result=omitUnsupportedDailyConditions(d,'day')
 for(let i=0;i<d.clusters.length;i++){
  assert.equal(result.clusters[i].change_condition,'')
  for(const field of ['conclusion','real_scene','action','evidence_refs','applicability'])assert.deepEqual(result.clusters[i][field],d.clusters[i][field])
 }
 assert.deepEqual(d,original)
 assert.equal(result.headline,d.headline);assert.deepEqual(result.overall,d.overall)
 assert.equal(omitUnsupportedDailyConditions(d,'week'),d)
 assert.ok(inspectDailyProviderDocument(result,'day').passed)
 const normalized={clusters:{relationship:{summary:original.clusters[0]}}}
 assert.equal(omitUnsupportedDailyConditions(normalized,'day').clusters.relationship.summary.change_condition,'')
})
