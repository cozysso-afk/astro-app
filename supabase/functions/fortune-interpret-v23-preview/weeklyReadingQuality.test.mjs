import assert from 'node:assert/strict'
import test from 'node:test'
import {attachPeriodReadingContext,buildPeriodReadingInstruction,inspectPeriodProviderDocument,inspectPeriodReading,PERIOD_PRIMARY_KEYS} from './periodReadingContractV1.ts'
import {exactV23JobKind,provisionalV23JobKind,WEEKLY_OUTPUT_CACHE_VERSION} from './cacheIdentityV23.ts'

const period={start:'2026-11-09',end:'2026-11-15'}
const input={period_kind:'week',period,evidence_ledger:[
  {id:'contact',system:'western',date:'2026-11-11',topic:'연락'},
  {id:'exam',system:'western',date:'2026-11-13',topic:'시험'},
  {id:'outside',system:'western',date:'2026-11-16',topic:'이직'},
  {id:'placement',system:'thai',date:'2026-11-14',topic:'금전'},
]}
const packet=attachPeriodReadingContext(input)
const core={
  headline:'여럿이 약속을 정할 때는 서로 생각하는 조건을 먼저 맞춰 봐.',
  overall:{summary:'2026-11-11에는 말을 꺼내기 전에 먼저 물어볼 내용을 정리해 봐. 약속을 정하는 자리라면 서로 제시한 조건을 듣고 날짜를 정하기가 쉬워.',dominant_pattern:'대화를 시작하는 일과 모두가 같은 뜻으로 이해하는 데에는 서로 다른 조건이 필요해.',evidence_refs:['contact']},
  clusters:packet.period_reading.required_section_keys.map(key=>({key,applicability:'insufficient',evidence_refs:[]})),
}
test('week requests directly evidenced details across families within the existing response budget',()=>{
  assert.deepEqual(packet.period_reading.required_section_keys,[...PERIOD_PRIMARY_KEYS,'relationship.contact_activation','work_study.exam'])
  assert.match(buildPeriodReadingInstruction('week'),/어디에서 다시 확인/)
  for(const fn of [exactV23JobKind,provisionalV23JobKind])assert.ok(fn('v',input,'hash').includes(WEEKLY_OUTPUT_CACHE_VERSION))
  const missing={...core,clusters:core.clusters.filter(row=>row.key!=='work_study.exam')}
  assert.ok(inspectPeriodProviderDocument(missing,'week',packet).issues.some(issue=>issue.path==='clusters.work_study.exam'))
})
test('Nov 9–15 abstract weekly reason, repeated summary and borrowed date fail the weekly gate',()=>{
  assert.equal(inspectPeriodProviderDocument(core,'week',packet).passed,true)
  const altered=overall=>inspectPeriodProviderDocument({...core,overall:{...core.overall,...overall}},'week',packet).issues
  assert.ok(altered({dominant_pattern:'추진력과 대화상 점검 압박의 공존'}).some(i=>i.code==='weekly_reason_needs_interpretation'))
  assert.ok(altered({summary:'조건을 먼저 따져 봐. 조건을 먼저 따져 봐.'}).some(i=>i.code==='weekly_summary_needs_explanation'))
  assert.ok(altered({summary:core.overall.summary.replace('2026-11-11','2026-11-13')}).some(i=>i.code==='weekly_date_without_cited_observation'))
  assert.ok(!altered({evidence_refs:['contact','exam']}).length)
})
test('a weekly split evidence paragraph cannot borrow a date from a different topic',()=>{
  const data={...core,clusters:{relationship:{contact_activation:{applicability:'conditional',evidence_refs:['contact'],evidence_meaning:'2026-11-13의 연락 근거를 봐.'}}}}
  assert.ok(inspectPeriodReading(data,packet).issues.some(i=>i.path==='clusters.relationship.contact_activation.evidence_meaning'&&i.code==='claim_date_without_local_evidence'))
})
