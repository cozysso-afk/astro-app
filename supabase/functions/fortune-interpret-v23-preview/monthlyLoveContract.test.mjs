import test from 'node:test'
import assert from 'node:assert/strict'
import {attachPeriodReadingContext, inspectPeriodProviderDocument, inspectPeriodReading, PERIOD_PRIMARY_KEYS} from './periodReadingContractV1.ts'
import {MONTHLY_OUTPUT_CACHE_VERSION,exactV23JobKind,provisionalV23JobKind} from './cacheIdentityV23.ts'

const date='2026-11-11'
const love={id:'w11',system:'western',date,topic:'연애'}
const base={period_kind:'month',period:{start:'2026-11-01',end:'2026-11-30'},evidence_ledger:[love]}
const empty=key=>({key,conclusion:'',action:'',real_scene:'',change_condition:'',applicability:'insufficient',evidence_refs:[]})
const firstSix=()=>({clusters:PERIOD_PRIMARY_KEYS.map(empty)})
test('monthly love scenarios only require selected in-period love evidence',()=>{
  const packet=attachPeriodReadingContext(base)
  const keys=Object.keys(packet.period_reading.love_situations.questions)
  assert.equal(keys.length,5)
  assert.deepEqual(packet.period_reading.required_section_keys,[...PERIOD_PRIMARY_KEYS,...keys])
  for(const p of [{...base,period_kind:'week'},{...base,period_kind:'annual'},{...base,evidence_ledger:[{...love,date:'2026-12-01'}]},{...base,evidence_ledger:[{...love,topic:'연락'}]}])
    assert.deepEqual(attachPeriodReadingContext(p).period_reading.required_section_keys,PERIOD_PRIMARY_KEYS)
  const core=firstSix()
  assert.equal(inspectPeriodProviderDocument(core,'month',packet).issues.length,5)
  core.clusters.push(...keys.map((key,i)=>({...empty(key),applicability:'conditional',conclusion:'상황별 판단 '+i,applies_when:'둘이 만나는 경우에 해당돼.',evidence_meaning:'둘이 시간을 맞출 여지가 있어.',action:'필요한 행동 '+i,evidence_refs:['w11']})))
  assert.deepEqual(inspectPeriodProviderDocument(core,'month',packet).issues,[])
  core.clusters.at(-1).action=core.clusters.at(-2).action
  core.clusters.at(-1).evidence_refs=['wrong-topic']
  const issues=inspectPeriodProviderDocument(core,'month',packet).issues
  assert.ok(issues.some(i=>i.code==='monthly_love_repeated_answer'))
  assert.ok(issues.some(i=>i.code==='monthly_love_requires_conditional_topic_evidence'))
})
test('monthly scenario dates must be covered by their own evidence',()=>{
  const data={clusters:{relationship:{love_crush:{applicability:'conditional',conclusion:'2026-11-12에 만날 수 있어.',evidence_refs:['w11']}}}}
  assert.ok(inspectPeriodReading(data,base).issues.some(i=>i.path==='clusters.relationship.love_crush.conclusion'&&i.code==='claim_date_without_local_evidence'))
})
test('monthly cache renews for both job paths without changing week or year markers',()=>{
  for(const build of [exactV23JobKind,provisionalV23JobKind]){
    assert.ok(build('v',{period_kind:'month'},'h').includes(MONTHLY_OUTPUT_CACHE_VERSION))
    for(const kind of ['week','annual'])assert.ok(!build('v',{period_kind:kind},'h').includes(MONTHLY_OUTPUT_CACHE_VERSION))
  }
})
