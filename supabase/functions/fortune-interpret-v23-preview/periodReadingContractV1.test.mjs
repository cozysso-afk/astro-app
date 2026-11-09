import {retainValidPeriodFields} from './periodReadingContractV1.ts'
import test from 'node:test'
import assert from 'node:assert/strict'
import {attachPeriodReadingContext,inspectPeriodProviderDocument,inspectPeriodReading,applyPeriodReadingGate,reusePlainHeadlineFromSummary,PERIOD_PRIMARY_KEYS} from './periodReadingContractV1.ts'
import {inspectInterpretationQuality} from '../fortune-interpret-v6-preview/qualityV2.ts'
import {buildPeriodNarrativeContext} from './periodNarrativeV23.ts'
const blank=key=>({key,conclusion:'',real_scene:'',action:'',change_condition:'',evidence_refs:[],applicability:'insufficient'})
const provider=()=>({headline:'맡은 역할의 범위를 비교할 때 차이가 보여.',overall:{summary:'기간의 일부 표본만 전달됐어. 관측된 날짜의 차이부터 읽어.'},clusters:PERIOD_PRIMARY_KEYS.map(blank)})
const packet=(rows=[],kind='annual')=>({period_kind:kind,period:{start:'2026-01-01',end:'2026-12-31'},evidence_ledger:rows})
const normalized=()=>({...provider(),clusters:Object.fromEntries(['relationship','work_study','money_news','condition'].map(g=>[g,Object.fromEntries(PERIOD_PRIMARY_KEYS.filter(k=>k.startsWith(g+'.')).map(k=>[k.split('.')[1],blank(k)]))]))})
const fact=(id,date,topic='직장')=>({id,date,topic,system:'western',scope:'daily_actual',direction:'context',text:'계산 관측'})

test('a required field omission cannot be normalized into evidence insufficiency',()=>{
 const core=provider()
 assert.equal(inspectPeriodProviderDocument(core,'week').passed,true)
 core.clusters.pop()
 assert.ok(inspectPeriodProviderDocument(core,'week').issues.some(i=>i.code==='primary_missing_or_duplicate'))
 assert.equal(inspectPeriodProviderDocument(core,'day').passed,true)
})
test('extended periods keep detail readings optional instead of forcing every sampled topic',()=>{
 const p=packet([fact('c','2026-01-02','연락'),fact('x','2026-01-03','시험')])
 assert.equal(inspectPeriodProviderDocument(provider(),'annual',p).passed,true)
 const core=provider();core.clusters.push(...['relationship.contact_activation','relationship.contact_continuity','work_study.exam'].map(blank))
 assert.equal(inspectPeriodProviderDocument(core,'annual',p).passed,true)
})
test('insufficient is an explicit state, never a container for invented prose',()=>{
 const core=provider();core.clusters[0].conclusion='누군가에게 연락이 올 거야.'
 assert.ok(inspectPeriodProviderDocument(core,'month').issues.some(i=>i.code==='insufficient_with_authored_claim'))
})
test('reader packet restores omitted topic evidence and retains source_topics and omission metadata',()=>{
 const kept=fact('kept','2026-02-01','학업'),contact={...fact('contact','2026-03-01'),topic:undefined,source_topics:['연락']},extra=fact('extra','2026-07-01','학업')
 const p=packet([kept]),full=packet([kept,contact,extra])
 const result=attachPeriodReadingContext(p,full)
 assert.deepEqual(result.evidence_ledger.find(r=>r.id==='contact'),contact)
 assert.deepEqual(result.period_reading.omitted_ids,['extra'])
 assert.deepEqual(result.period_reading.required_section_keys,PERIOD_PRIMARY_KEYS)
 assert.equal(result.period_reading.questions.find(q=>q.key==='work_study.study').coverage,'sampled')
 assert.deepEqual(p.evidence_ledger,[kept])
 assert.equal(attachPeriodReadingContext({...p,period_kind:'day'},full).period_reading,undefined)
})
test('single-date and two endpoint samples cannot substantiate a quarterly phase',()=>{
 const p=packet([fact('start','2026-10-01'),fact('end','2026-12-31')]),data=normalized()
 data.year_phases=[{start:'2026-10-01',end:'2026-12-31',evidence_refs:['start','end']}]
 assert.ok(inspectPeriodReading(data,p).issues.some(i=>i.code==='unsupported_period_span'))
 data.year_phases=[];data.key_windows=[{start:'2026-10-01',end:'2026-10-01',evidence_refs:['start']}]
 assert.equal(inspectPeriodReading(data,p).passed,true)
 p.evidence_ledger.push({id:'range',start:'2026-10-01',end:'2027-01-01',system:'saju',scope:'annual_segment'})
 data.year_phases=[{start:'2026-10-01',end:'2026-12-31',evidence_refs:['range']}]
 assert.equal(inspectPeriodReading(data,p).passed,true)
})
test('work cannot borrow only study evidence, but real source_topics are supported',()=>{
 const data=normalized();data.clusters.work_study.work={...blank('work_study.work'),applicability:'conditional',evidence_refs:['study']}
 const p=packet([fact('study','2026-10-01','학업')])
 assert.ok(inspectPeriodReading(data,p).issues.some(i=>i.code==='primary_without_same_topic_period_evidence'))
 p.evidence_ledger[0].source_topics=['직장']
 assert.equal(inspectPeriodReading(data,p).passed,true)
})
test('six-stage status cannot overwrite a failed period scope gate',()=>{
 const quality={ok:true,score:100,stages:Array.from({length:6},(_,i)=>({stage:i+1,passed:true,issues:[]}))}
 const data=normalized();data.key_windows=[{start:'2026-01-01',end:'2027-01-01',evidence_refs:[]}]
 const result=applyPeriodReadingGate(quality,inspectPeriodReading(data,packet()))
 assert.equal(result.ok,false);assert.equal(result.score,83);assert.equal(result.stages.length,6)
 assert.equal(quality.ok,true)
})
test('period contract removes forced phases and empty-condition failure without weakening legacy or daily defaults',()=>{
 const data=normalized();data.clusters.work_study.work={conclusion:'맡은 역할을 비교하는 기준이 중요해.',real_scene:'일의 범위가 다르다면 같은 조건인지 비교할 필요가 있어.',action:'약속한 책임의 범위를 먼저 비교해.',change_condition:'',evidence_refs:['work'],applicability:'conditional'}
 const p=packet([fact('work','2026-01-02')])
 const legacy=inspectInterpretationQuality(data,p),current=inspectInterpretationQuality(data,p,{periodReadingContract:true})
 assert.ok(legacy.stages[4].issues.some(i=>i.includes('4개 phase')))
 assert.ok(legacy.stages[5].issues.some(i=>i.includes('판단변경조건 누락')))
 assert.equal(current.stages[4].issues.some(i=>/핵심 시기 부족|4개 phase|교차검증 3개/.test(i)),false)
 assert.equal(current.stages[5].issues.some(i=>i.includes('판단변경조건 누락')),false)
 const daily=inspectInterpretationQuality(data,{...p,period_kind:'day'},{periodReadingContract:true})
 assert.ok(daily.stages[5].issues.some(i=>i.includes('판단변경조건 누락')))
})
test('period phenomena retain topics of actual multi-topic ledger rows and do not require fabricated quarters',()=>{
 const p=packet([{...fact('shared','2026-02-01'),topic:undefined,source_topics:['학업','시험']}])
 const context=buildPeriodNarrativeContext(p)
 assert.deepEqual(new Set(context.phenomena[0].topics),new Set(['학업','시험']))
 assert.equal(context.required_sequence.some(s=>/^[1-4]분기$/.test(s)),false)
})

test('an annual work claim about the second half cannot cite only February or a study date',()=>{
 const data=normalized(),p=packet([fact('work','2026-02-01'),fact('study','2026-11-21','학업')])
 data.clusters.work_study.work={...blank('work_study.work'),applicability:'conditional',conclusion:'하반기에는 역할이 안정적으로 정리돼.',evidence_refs:['work','study']}
 assert.ok(inspectPeriodReading(data,p).issues.some(i=>i.code==='claim_period_without_local_evidence'))
 data.clusters.work_study.work.conclusion='하반기를 판단할 근거는 부족해.'
 assert.equal(inspectPeriodReading(data,p).passed,true)
 data.clusters.work_study.work.conclusion='2026-11-21에 역할이 정리돼.'
 assert.ok(inspectPeriodReading(data,p).issues.some(i=>i.code==='claim_date_without_local_evidence'))
})
test('saju exclusive segment end does not substantiate the next day',()=>{
 const p=packet([{id:'S',system:'saju',scope:'monthly_segment',start:'2026-07-01',end:'2026-08-01'}]),data=normalized()
 data.year_phases=[{start:'2026-07-01',end:'2026-08-01',evidence_refs:['S']}]
 assert.ok(inspectPeriodReading(data,p).issues.some(i=>i.code==='unsupported_period_span'))
 data.year_phases[0].end='2026-07-31'
 assert.equal(inspectPeriodReading(data,p).passed,true)
})


test('period first screen rejects technical leads and abstract hero copy',()=>{
 const technical=provider();technical.headline='천왕성의 기류가 작용하는 한 달'
 const report=inspectPeriodProviderDocument(technical,'month')
 assert.ok(report.issues.some(i=>i.code==='period_hero_not_plain_language'))
 const section=provider();section.clusters[0]={key:PERIOD_PRIMARY_KEYS[0],conclusion:'금성 삼각각으로 관계가 좋아져.',real_scene:'먼저 생활 장면을 확인해.',action:'반응을 확인해.',change_condition:'',evidence_refs:['x'],applicability:'conditional'}
 assert.ok(inspectPeriodProviderDocument(section,'week').issues.some(i=>i.code==='period_section_not_plain_language'))
})


test('period first screen rejects malformed Korean copy',()=>{
 const data=provider();data.clusters[0]={key:PERIOD_PRIMARY_KEYS[0],conclusion:'컨디션 관리가 필요해.',real_scene:'무선 규칙적인 수면과 휴식을 확보해.',action:'일정을 줄여.',change_condition:'',evidence_refs:['x'],applicability:'conditional'}
 assert.ok(inspectPeriodProviderDocument(data,'annual').issues.some(i=>i.code==='period_korean_copy_error'))
})


test('period first screen rejects role assumptions and invented events or spans',()=>{
 const hero=provider();hero.overall.summary='이번 주에는 업무와 공부를 함께 점검해.'
 assert.ok(inspectPeriodProviderDocument(hero,'week').issues.some(i=>i.code==='period_hero_role_assumption'))
 const contact=provider();contact.contact_flow={incoming:'주 초반에는 연락이 올 가능성이 있어.'}
 assert.ok(inspectPeriodProviderDocument(contact,'week').issues.some(i=>i.code==='period_unobserved_event_or_span'&&i.path==='contact_flow.incoming'))
 const body=provider();body.clusters[0]={key:PERIOD_PRIMARY_KEYS[0],conclusion:'컨디션을 점검해.',real_scene:'퇴근 후에는 체력이 떨어질 수 있어.',action:'일정을 줄여.',change_condition:'',evidence_refs:['x'],applicability:'conditional'}
 assert.ok(inspectPeriodProviderDocument(body,'annual').issues.some(i=>i.code==='period_unobserved_event_or_span'&&i.path==='clusters.0.real_scene'))
 const investment=provider();investment.investment_reading={realization:'차익 실현을 고려할 시기야.'}
 assert.ok(inspectPeriodProviderDocument(investment,'annual').issues.some(i=>i.code==='period_unobserved_event_or_span'&&i.path==='investment_reading.realization'))
})


test('an isolated abstract headline reuses one complete authored summary sentence',()=>{
 const data=provider();data.headline='천왕성의 기류가 작용하는 한 달';data.overall.summary='약속을 정하기 전에 조건을 다시 확인하는 편이 좋아. 나머지는 날짜별 근거를 봐.'
 const out=reusePlainHeadlineFromSummary(data,'month')
 assert.equal(out.headline,'약속을 정하기 전에 조건을 다시 확인하는 편이 좋아')
 assert.equal(out.overall.summary,data.overall.summary)
 const many=provider();many.headline='천왕성의 기류가 작용하는 한 달';many.overall.summary='이번 달에는 업무와 공부를 함께 점검해.'
 assert.equal(reusePlainHeadlineFromSummary(many,'month'),many)
})


test('calendar month wording is not mistaken for the Moon',()=>{
 const data=provider();data.headline='이번 달은 약속 조건을 다시 확인하는 편이 좋아.';data.overall.summary='이번 달은 대화와 지출 조건을 서두르지 말고 확인하는 편이 좋아.'
 data.clusters=data.clusters.map(row=>row.key===PERIOD_PRIMARY_KEYS[0]?{...row,conclusion:'이번 달은 말을 서두르지 않는 편이 좋아.',real_scene:'이번 달에는 약속 조건을 다시 확인해.',action:'이번 달은 답하기 전에 내용을 읽어봐.',evidence_refs:['x'],applicability:'conditional'}:row)
 assert.equal(inspectPeriodProviderDocument(data,'month').issues.some(i=>i.code==='period_section_not_plain_language'),false)
 const moon=provider();moon.headline='달과 금성이 대화를 움직이는 한 달'
 assert.ok(inspectPeriodProviderDocument(moon,'month').issues.some(i=>i.code==='period_hero_not_plain_language'))
})


test('period provider rejects role-specific hero, invented symptoms, and generic repetition',()=>{
  const base={
    headline:'실무적 변화를 조율하는 달',
    overall:{summary:'현실적 압박과 조율의 흐름을 살펴봐.',best_phase:'조율이 쉬운 때',caution_phase:'압박이 커지는 때'},
    clusters:PERIOD_PRIMARY_KEYS.map((key,index)=>({
      key,conclusion:'현실적 조율이 필요해.',real_scene:index===0?'피로 누적이 수면을 방해할 수 있어.':'압박 속에서 조율의 흐름이 이어져.',
      action:'신중하게 정돈해.',change_condition:'',evidence_refs:['W:test'],applicability:'direct',
    })),
  }
  const report=inspectPeriodProviderDocument(base,'month',{})
  assert.ok(report.issues.some(issue=>issue.code==='period_hero_role_assumption'))
  assert.ok(report.issues.some(issue=>issue.code==='period_unobserved_event_or_span'&&issue.path==='clusters.0.real_scene'))
  assert.ok(report.issues.some(issue=>issue.code==='period_generic_repetition'))
})


test('period provider locates invented health claims and unsupported detail prose',()=>{
  const data=provider()
  data.clusters=data.clusters.map(row=>row.key==='condition.condition'?{...row,conclusion:'기력 소모와 생활 리듬 변화를 살펴야 해.',real_scene:'몸에 열감이 오르고 쉬어도 개운하지 않을 수 있어.',action:'저녁 시간에는 쉬어.',evidence_refs:['x'],applicability:'direct'}:row)
  data.investment_reading={risk:'변동성이 커질 수 있어.',entry:'새 종목은 관망해.'}
  const report=inspectPeriodProviderDocument(data,'month')
  assert.ok(report.issues.some(issue=>issue.code==='period_unobserved_health_claim'&&issue.path==='clusters.5.real_scene'))
  assert.ok(report.issues.some(issue=>issue.code==='period_unsupported_detail_prose'&&issue.path==='investment_reading.risk'))
})


test('authored period scenes stay conditional and relationship prose cannot invent contact',()=>{
  const data=provider()
  data.clusters=data.clusters.map((row,index)=>index===0?{...row,conclusion:'속도를 정하기보다 반응을 살펴봐.',real_scene:'상대의 짧은 연락이 이어져.',action:'답장 간격을 이틀로 늘려.',evidence_refs:['x'],applicability:'direct'}:row)
  const report=inspectPeriodProviderDocument(data,'month')
  assert.ok(report.issues.some(issue=>issue.code==='period_real_scene_not_conditional'&&issue.path==='clusters.0.real_scene'))
  assert.ok(report.issues.some(issue=>issue.code==='period_relationship_contact_leak'&&issue.path==='clusters.0.real_scene'))
  assert.ok(report.issues.some(issue=>issue.code==='period_specific_life_detail'&&issue.path==='clusters.0.action'))
  data.clusters[0].real_scene='실제로 대화를 나누는 상황이라면 확인된 반응보다 앞서 관계를 정하지 마.'
  data.clusters[0].action='말의 강도보다 약속 이행 여부를 살펴봐.'
  assert.equal(inspectPeriodProviderDocument(data,'month').issues.some(issue=>['period_real_scene_not_conditional','period_relationship_contact_leak','period_specific_life_detail'].includes(issue.code)),false)
})

test('period cards reject the dangling condition and technical reason seen in the monthly live reading', () => {
  const data = provider()
  const row = data.clusters[0]
  Object.assign(row, {applicability:'conditional', evidence_refs:['x'], conclusion:'약속 사이에 시간을 둬.', action:'약속 사이의 간격을 확인해.',
    applies_when:'만약 약속을 정해야 하는 경우라면', evidence_meaning:'토성과 금성의 긴장 배치가 나타나기 때문이야.'})
  const issues = () => inspectPeriodProviderDocument(data, 'month').issues
  assert.ok(issues().some(i=>i.path==='clusters.0.applies_when'))
  assert.ok(issues().some(i=>i.path==='clusters.0.evidence_meaning'))
  row.applies_when='두 약속 중 하나를 골라야 할 때 해당돼.'
  row.evidence_meaning='일정을 바로 정할 여유가 있는 날과 조금 더 기다릴 날이 나뉘어.'
  assert.ok(!issues().some(i=>i.path==='clusters.0.applies_when'||i.path==='clusters.0.evidence_meaning'))
})

test('a rejected edit keeps the original action only when all period checks pass',()=>{
 const original=provider()
 Object.assign(original.clusters[0],{applicability:'direct',conclusion:'상대와 표현의 속도를 살펴봐.',real_scene:'실제로 대화를 나누는 상황이라면 확인된 반응보다 앞서 관계를 정하지 마.',action:'상대의 말과 행동이 일치하는지 살펴봐.',evidence_refs:['x']})
 const edited=structuredClone(original)
 edited.clusters[0].action='답장 간격을 이틀로 늘려.'
 const recovered=retainValidPeriodFields(original,edited,'month',undefined)
 assert.equal(recovered.clusters[0].action,original.clusters[0].action)
 assert.equal(inspectPeriodProviderDocument(recovered,'month').passed,true)
 edited.clusters.pop()
 assert.equal(retainValidPeriodFields(original,edited,'month',undefined),edited)
})
test('checking a budget balance is a voluntary action, predicting a new bill still fails',()=>{
 const data=provider(), row=data.clusters.find(row=>row.key==='money_news.money')
 Object.assign(row,{applicability:'direct',conclusion:'지출 기준을 먼저 정해.',real_scene:'비용을 비교할 때 합계를 살펴봐.',action:'구매 전에 잔고를 확인해.',evidence_refs:['x']})
 const index=data.clusters.indexOf(row)
 assert.ok(!inspectPeriodProviderDocument(data,'month').issues.some(i=>i.path===`clusters.${index}.action`&&i.code==='period_specific_life_detail'))
 row.action='공과금이 늘어날 테니 잔고를 확인해.'
 assert.ok(inspectPeriodProviderDocument(data,'month').issues.some(i=>i.path===`clusters.${index}.action`&&i.code==='period_specific_life_detail'))
})
