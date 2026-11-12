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
  for(const p of [{...base,evidence_ledger:[{...love,date:'2026-12-01'}]},{...base,evidence_ledger:[{...love,topic:'연락'}]}])
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

test('all extended periods request six distinct love questions when their own topic has in-period evidence',()=>{
  for(const kind of ['week','month','annual']){
    const packet=attachPeriodReadingContext({...base,period_kind:kind,evidence_ledger:[love,{...love,id:'r11',topic:'과거인연접점'}]})
    const questions=packet.period_reading.love_situations.questions
    assert.equal(new Set(Object.values(questions)).size,5)
    const requested=packet.period_reading.required_section_keys
    for(const key of [...Object.keys(questions),'relationship.love_reunion_interest']) assert.equal(requested.filter(k=>k===key).length,1)
    assert.ok(!attachPeriodReadingContext({...base,period_kind:kind}).period_reading.required_section_keys.includes('relationship.love_reunion_interest'))
    const data={clusters:{relationship:{love_couple:{applicability:'conditional',evidence_meaning:'2026-11-20에 달라져.',evidence_refs:['w11']}}}}
    assert.ok(inspectPeriodReading(data,packet).issues.some(i=>i.code==='claim_date_without_local_evidence'))
  }
})

test('ordinary monthly scores preserve dated relationship observations and their original indexes in the writer prompt',async ()=>{
  const {compactCalculation}=await import('../fortune-interpret-v6-preview/integratedInterpretationV2.ts')
  const {buildV23PromptBudget,buildV23CorePrompt}=await import('./promptV23.ts')
  const evidence=(topic,aspect)=>({source_topics:[topic],transit:'Moon',target:'Venus',aspect,polarity:aspect==='충'?-0.5:0.5})
  const row=(date)=>({date,scores:{연애:50,재회:48},evidence:[evidence('재회','합'),evidence('연애','충')]})
  const calc={period:{start:'2026-11-01',end:'2026-11-30',day_count:30},western:{overall:{연애:{average:50},재회:{average:48}},daily_scores:[
    row('2026-12-01'),row('2026-11-25'),row('2026-11-12'),row('2026-11-04'),
  ]}}
  const compact=compactCalculation(calc), {packet,ok}=buildV23PromptBudget(compact)
  assert.equal(ok,true)
  assert.equal(compact.key_dates.length,0)
  const refs=packet.evidence_ledger.filter(r=>r.scope==='daily_actual_aspect_house')
  assert.deepEqual(refs.map(r=>r.id).sort(),['W:daily:2026-11-04:1','W:daily:2026-11-04:2','W:daily:2026-11-25:1','W:daily:2026-11-25:2'])
  assert.equal(packet.period_reading.required_section_keys.length,12)
  const prompt=buildV23CorePrompt(compact).text
  for(const row of refs) assert.ok(prompt.includes(row.id))
  assert.doesNotMatch(prompt,/W:daily:2026-12-01/)
  const missing=compactCalculation({...calc,western:{overall:calc.western.overall,daily_scores:[row('2026-12-01')]}})
  assert.equal(buildV23PromptBudget(missing).packet.period_reading.required_section_keys.length,6)
})

test('monthly cost estimate uses both actual output ceilings and full input, retaining job and packet limits',async()=>{
  const {compactCalculation,SCHEMA}=await import('../fortune-interpret-v6-preview/integratedInterpretationV2.ts')
  const {estimatedGeminiJobKrw}=await import('../fortune-interpret-v21-preview/costGuardV21.ts')
  const {buildV23PromptBudget,buildV23CorePrompt,SYSTEM}=await import('./promptV23.ts')
  const {buildProviderCoreSchema}=await import('./providerSchemaV23.ts')
  const {v23OutputTokenLimit}=await import('./runtimeBudgetV23.ts')
  const payload=compactCalculation({period:{start:'2026-11-01',end:'2026-11-30',day_count:30},western:{daily_scores:[]}})
  const budget=buildV23PromptBudget(payload)
  const input=SYSTEM+buildV23CorePrompt(payload).text+JSON.stringify(buildProviderCoreSchema(SCHEMA,'month'))
  const tokens=Math.ceil(new TextEncoder().encode(input).length/2.6)
  assert.equal(budget.estimated_input_tokens,tokens)
  assert.equal(budget.estimated_max_job_krw,estimatedGeminiJobKrw(tokens,'month',[v23OutputTokenLimit('month'),v23OutputTokenLimit('month',true)]))
  assert.equal(budget.ok,true)
  const oversized=buildV23PromptBudget({...payload,period:{...payload.period,metadata:'x'.repeat(budget.max_bytes)}})
  assert.ok(oversized.bytes>oversized.max_bytes)
  assert.ok(oversized.estimated_max_job_krw>oversized.max_job_krw)
  assert.equal(oversized.ok,false)
})
