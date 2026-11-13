import test from 'node:test'
import assert from 'node:assert/strict'
import { DAILY_PRIMARY_KEYS, DAILY_DETAIL_KEYS, DAILY_SECTION_TOPICS, inspectDailyProviderDocument } from './dailyReadingContractV1.ts'
import { EDITORIAL_SECTION_KEYS, normalizeProviderCore } from './providerSchemaV23.ts'
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

test('daily overview stays role-neutral and repeated abstract copy is rejected',()=>{
 const d=core();d.headline='학업과 실무를 밀어붙이기 좋아.'
 assert.ok(inspectDailyProviderDocument(d,'day').issues.includes('daily_overview_role_specific'))
 const abstract=core();for(const row of abstract.clusters){row.real_scene='좋은 기류와 에너지가 작용해.'}
 assert.ok(inspectDailyProviderDocument(abstract,'day').issues.includes('daily_detail_abstract_repetition'))
})

test('unsupported incoming initiator and Korean copy errors are rejected',()=>{
 const incoming=core();incoming.contact_flow={incoming:'상대방이 먼저 메시지를 건네올 수 있어.'}
 assert.ok(inspectDailyProviderDocument(incoming,'day').issues.includes('daily_incoming_initiator_prediction'))
 const typo=core();typo.clusters[0].real_scene='상답의 여유를 확인해.'
 assert.ok(inspectDailyProviderDocument(typo,'day').issues.includes('daily_korean_copy_error'))
})

test('a grounded daily reading does not have to invent an exception',()=>{
 const d=core();d.clusters[0].change_condition=''
 assert.ok(inspectDailyProviderDocument(d,'day').passed)
 d.clusters[0].action=''
 assert.ok(!inspectDailyProviderDocument(d,'day').passed)
})

test('a supported condition survives provider validation and normalization',()=>{
 const d=core()
 d.clusters[0].change_condition='상대도 가능한 날을 제안하면 다음 만남을 함께 준비하는 단계야.'
 assert.equal(inspectDailyProviderDocument(d,'day').passed,true)
 assert.equal(normalizeProviderCore(d).clusters.relationship.love_general.change_condition,d.clusters[0].change_condition)
})

test('contact evidence requires both contact questions and cannot disappear behind six primary readings',()=>{
 const d=core(),payload={evidence_ledger:[{id:'W:contact',scope:'daily_actual_aspect_house',source_topics:['연락']}]}
 const report=inspectDailyProviderDocument(d,'day',payload)
 for(const key of ['relationship.contact_activation','relationship.contact_continuity']) {
  assert.ok(report.issues.includes(`daily_supported_detail_missing_or_duplicate:${key}`))
  d.clusters.push({...d.clusters[0],key,conclusion:`${key}에 대한 별도의 판단`,evidence_refs:['W:contact']})
 }
 assert.equal(inspectDailyProviderDocument(d,'day',payload).passed,true)
 d.clusters.at(-1).conclusion=d.clusters.at(-2).conclusion
 assert.ok(inspectDailyProviderDocument(d,'day',payload).issues.some(i=>i.startsWith('daily_duplicate_conclusion')))
})

test('existing details are evidence-dependent and generation omission is not evidence insufficiency',()=>{
 assert.deepEqual(Object.keys(DAILY_SECTION_TOPICS).sort(),[...EDITORIAL_SECTION_KEYS].sort())
 assert.equal(EDITORIAL_SECTION_KEYS.length,25)
 const d=core(),payload={evidence_ledger:DAILY_DETAIL_KEYS.map(key=>({id:`W:${key}`,topic:DAILY_SECTION_TOPICS[key][0],scope:'intraday_evidence'}))}
 for(const key of DAILY_DETAIL_KEYS)assert.ok(inspectDailyProviderDocument(d,'day',payload).issues.includes(`daily_supported_detail_missing_or_duplicate:${key}`))
 const noFacts=normalizeProviderCore(d)
 assert.equal(noFacts.editorial_delivery['relationship.contact_activation'],'omitted')
 d.clusters.push({key:'relationship.contact_activation',conclusion:'',real_scene:'',action:'',change_condition:'',applicability:'insufficient',evidence_refs:[]})
 const insufficient=normalizeProviderCore(d)
 assert.equal(insufficient.editorial_delivery['relationship.contact_activation'],'authored')
 assert.equal(insufficient.clusters.relationship.contact_activation.applicability,'insufficient')
 assert.ok(inspectDailyProviderDocument(core(),'day',{evidence_ledger:[]}).passed)
})

test('optional authored detail must be complete and insufficient cannot hide authored prose',()=>{
 const d=core();d.clusters.push({...d.clusters[0],key:'investment.entry',conclusion:'새로운 위험을 감수할 조건',action:''})
 assert.ok(inspectDailyProviderDocument(d,'day').issues.includes('daily_primary_incomplete:investment.entry'))
 d.clusters.at(-1).applicability='insufficient'
 assert.ok(inspectDailyProviderDocument(d,'day').issues.includes('daily_insufficient_with_prose:investment.entry'))
})

test('ordinary contact does not assign the reader a relationship or profession',()=>{
 const d=core(); d.headline='약속 시간을 바꾸려면 먼저 연락해 두는 게 좋아.'
 assert.equal(inspectDailyProviderDocument(d,'day').passed,true)
})

test('every cited fact belongs to the section, reader question and chosen day',()=>{
 const day='2026-11-12', section='work_study.work'
 const fact=(id,topic,date=day)=>({id,topic,date,scope:'daily_actual_aspect_house',system:'western'})
 const packet={period:{start:day,end:day},evidence_ledger:[fact('work','직장'),fact('money','금전'),fact('other-day','직장','2026-11-13')]}
 const d=core()
 for(const row of d.clusters)Object.assign(row,{applicability:'insufficient',conclusion:'',action:'',real_scene:'',change_condition:'',evidence_refs:[]})
 const work=d.clusters.find(row=>row.key===section)
 Object.assign(work,{applicability:'conditional',conclusion:'맡은 일의 범위를 정할 때야.',real_scene:'일을 나눠 맡는 상황이라면 책임 경계를 점검해.',action:'결정을 맡은 사람과 필요한 결과를 정해.',change_condition:'일을 나눌 필요가 없는 상황에는 이 판단을 적용하기 어려워.',evidence_refs:['work']})
 d.editorial_focus={section_key:section,evidence_refs:['work']}
 d.overall.evidence_refs=['work']
 d.domain_answers=[{topic:'직장',question_key:'progress',status:'partial',evidence_refs:['work']}]
 assert.deepEqual(inspectDailyProviderDocument(d,'day',packet).issues,[])
 for(const id of ['money','other-day','unknown']){
   work.evidence_refs=['work',id]
   d.domain_answers[0].evidence_refs=['work',id]
   const issues=inspectDailyProviderDocument(d,'day',packet).issues
   assert.ok(issues.includes('daily_evidence_outside_question:'+section))
   assert.ok(issues.includes('daily_answer_outside_question:직장:progress'))
 }
 work.evidence_refs=['work'];d.domain_answers=[]
 d.overall.evidence_refs=['money']
 assert.ok(inspectDailyProviderDocument(d,'day',packet).issues.includes('daily_overview_evidence_outside_selected_question'))
 const empty=d.clusters.find(row=>row.applicability==='insufficient')
 empty.evidence_refs=['money']
 assert.ok(inspectDailyProviderDocument(d,'day',packet).issues.includes('daily_insufficient_with_prose:'+empty.key))
})

test('incoming, outgoing and reconnection claims use their own axis from the requested period',()=>{
 const day='2026-11-12'
 const row=(id,topic,score,start=day)=>({id,topic,score,start,end:day,scope:'relationship_average',system:'western'})
 const p={period:{start:day,end:day},evidence_ledger:[row('incoming','수신신호',0),row('outgoing','발신적합',35),row('previous','과거인연접점',70,'2026-10-15')]}
 const d={...core(),contact_flow:{incoming:'외부 연락에 열려 있는 정도는 낮게 읽혀.',outgoing:'먼저 말을 꺼낼 때의 부담을 살펴봐.',reconnection:''},contact_evidence_refs:{incoming:['incoming'],outgoing:['outgoing'],reconnection:[]}}
 const axisIssues=()=>inspectDailyProviderDocument(d,'day',p).issues.filter(value=>value.includes('contact_axis'))
 assert.deepEqual(axisIssues(),[])
 d.contact_evidence_refs.incoming=['incoming','outgoing']
 d.contact_flow.reconnection='예전 인연과의 접점이 두드러져.'
 d.contact_evidence_refs.reconnection=['previous']
 assert.deepEqual(axisIssues(),['contact_axis_without_own_period_evidence:contact_flow.incoming','contact_axis_without_own_period_evidence:contact_flow.reconnection'])
 d.contact_flow.reconnection=''
 assert.ok(axisIssues().includes('empty_contact_axis_with_references:contact_flow.reconnection'))
})
