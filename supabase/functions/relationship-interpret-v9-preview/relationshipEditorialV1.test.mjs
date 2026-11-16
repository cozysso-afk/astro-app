import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeReunionObservation, validateRelationshipEditorial, hasInventedDuration} from './relationshipEditorialV1.ts'

// Contract fixtures, not purported real model output or proof of reading quality.
const core=()=>({headline:'서로에게 끌리는 지점과 대화의 차이',core_summary:'핵심 답변',core_reason:'해당 판단을 만든 실제 근거',core_action:'확인할 구체적인 생활 장면',core_conditions:['생시가 없어서 하우스는 판단하지 못함'],reunion_context:''})
const marriage=mode=>({...core(),marriage_reading:{mode,...Object.fromEntries(['bottom_line','bond','emotional_home','daily_life','intimacy_resources','conflict_repair','commitment_or_current_cycle','timing','caution','precision_note'].map(k=>[k,`${k} 질문의 근거 범위 답`]))}})

test('core roles remain exact model text; missing or overlong role is rejected',()=>{
  const data=core(),before=JSON.stringify(data)
  assert.equal(validateRelationshipEditorial(data,'compatibility').ok,true)
  assert.equal(JSON.stringify(data),before)
  for(const key of ['core_summary','core_reason','core_action','core_conditions']){const bad=core();delete bad[key];assert.equal(validateRelationshipEditorial(bad,'compatibility').ok,false,key)}
  data.core_summary='가'.repeat(181)
  assert.equal(validateRelationshipEditorial(data,'compatibility').reason,'invalid_core_summary')
  assert.equal(data.core_summary.length,181)
})

test('core answer rejects technical shorthand, report style, copy errors and unobserved feelings',()=>{
 const technical=core();technical.core_summary='태양과 금성의 삼각각이 관계를 받쳐줘.'
 assert.equal(validateRelationshipEditorial(technical,'compatibility').reason,'technical_terms_in_core_answer')
 const report=core();report.overview='생활 규칙을 맞추는 것이 필요하다.'
 assert.equal(validateRelationshipEditorial(report,'compatibility').reason,'inconsistent_report_style')
 const typo=core();typo.core_reason='생활 가관을 확인해.'
 assert.equal(validateRelationshipEditorial(typo,'compatibility').reason,'korean_copy_error')
 const mind=core();mind.overview='두 사람 모두 관계를 지키려는 의지가 강해.'
 assert.equal(validateRelationshipEditorial(mind,'compatibility').reason,'unobserved_mind_claim')
 const marriedMind=core();marriedMind.core_summary='서로에 대한 강한 애정과 가정을 지키려는 책임감이 단단해.'
 assert.equal(validateRelationshipEditorial(marriedMind,'compatibility').reason,'unobserved_mind_claim')
 const observedIntent=core();observedIntent.overview='너희 부부는 가정을 지키는 책임감과 협력 체계가 단단하게 갖춰져 있어.'
 assert.equal(validateRelationshipEditorial(observedIntent,'marriage_married').reason,'unobserved_mind_claim')
 const technicalLead=core();technicalLead.core_reason='화성과 금성의 삼각각이 관계를 받쳐줘. 쉽게 말하면 대화가 잘 맞기 쉬워.'
 assert.equal(validateRelationshipEditorial(technicalLead,'compatibility').reason,'technical_terms_lead_core_reason')
})

test('copying the summary into reason, action or meaningful limits is rejected',()=>{
  for(const key of ['core_reason','core_action']){const data=core();data[key]=data.core_summary;assert.equal(validateRelationshipEditorial(data,'compatibility').reason,'duplicated_core_roles')}
  const data=core();data.core_conditions=[data.core_summary];assert.equal(validateRelationshipEditorial(data,'compatibility').reason,'duplicated_core_roles')
})

test('no condition permits an empty list instead of encouraging invented exceptions',()=>{
  const data=core();data.core_conditions=[]
  assert.equal(validateRelationshipEditorial(data,'compatibility').ok,true)
  delete data.core_conditions
  assert.equal(validateRelationshipEditorial(data,'compatibility').reason,'invalid_core_conditions')
})

test('unmarried and married are separate required modes and intimacy is not silently missing',()=>{
  for(const mode of ['marriage_unmarried','marriage_married']){
    const data=marriage(mode);assert.equal(validateRelationshipEditorial(data,mode).ok,true)
    data.marriage_reading.mode=mode==='marriage_married'?'marriage_unmarried':'marriage_married'
    assert.equal(validateRelationshipEditorial(data,mode).reason,'marriage_mode_mismatch')
    data.marriage_reading.mode=mode;delete data.marriage_reading.intimacy_resources
    assert.equal(validateRelationshipEditorial(data,mode).reason,'missing_marriage_intimacy_resources')
  }
})

test('irrelevant reunion and duplicate marriage blocks are rejected',()=>{
  const data=core();data.reunion_context='재접촉 시기를 기다려'
  assert.equal(validateRelationshipEditorial(data,'compatibility').reason,'unrequested_reunion_content')
  const married=marriage('marriage_married');married.chemistry='다른 필드의 끌림을 중복 작성'
  assert.equal(validateRelationshipEditorial(married,'marriage_married').reason,'duplicated_marriage_sections')
})

test('observation source and unknown as-of remain distinct from calculation time',()=>{
  assert.equal(normalizeReunionObservation(null),null)
  const data=normalizeReunionObservation({state:'messaging',initiator:'counterpart',events:[{kind:'recontact',date:'2026-10-21'}]})
  assert.deepEqual(data,{state:'messaging',initiator:'counterpart',source:'user_input',as_of:null,events:[{kind:'recontact',date:'2026-10-21'}]})
  assert.equal(normalizeReunionObservation({...data,as_of:'2026-10-25'}).as_of,'2026-10-25')
  assert.equal(normalizeReunionObservation({...data,as_of:'2026-02-30'}).as_of,null)
  assert.equal(normalizeReunionObservation({state:'predicted_reunion',initiator:'chart',events:[]}).state,'')
})

test('a long paragraph cannot become the relationship headline',()=>{
  const data=core();data.headline='가'.repeat(181)
  assert.equal(validateRelationshipEditorial(data,'compatibility').reason,'invalid_headline')
  assert.equal(data.headline.length,181)
})


test('stored-style unsupported claims, exact cooldowns and aspect label mismatches are rejected',()=>{
 const attraction=core();attraction.headline='서로에게 끌리는 마음은 확실하지만 대화 차이를 맞춰야 해.'
 assert.equal(validateRelationshipEditorial(attraction,'compatibility').reason,'unobserved_mind_claim')
 const exact=core();exact.practical_advice=['갈등이 생기면 10분간 생각할 시간을 가져.']
 assert.equal(validateRelationshipEditorial(exact,'compatibility').reason,'invented_exact_behavior_duration')
 const intent=marriage('marriage_unmarried');intent.marriage_reading.emotional_home='서로를 삶의 안전지대로 인식하는 흐름이 있어.'
 assert.equal(validateRelationshipEditorial(intent,'marriage_unmarried').reason,'unobserved_mind_claim')
 const mismatch=marriage('marriage_unmarried');mismatch.marriage_reading.daily_life='수성과 상승점의 대립각(Mercury square ASC)이 대화를 어렵게 해.'
 assert.equal(validateRelationshipEditorial(mismatch,'marriage_unmarried').reason,'aspect_translation_mismatch')
})

test('calendar timing and measured arcminutes are distinct from prescribed behavior durations',()=>{
 const data=core(); data.timing='11월 10일 전후를 살펴봐.'; data.top_aspects=[{meaning:'오브 1도 20분'}]
 assert.equal(validateRelationshipEditorial(data,'compatibility').ok,true)
 data.core_action='연락하기 전에 3일 기다려.'
 assert.equal(validateRelationshipEditorial(data,'compatibility').reason,'invented_exact_behavior_duration')
})

test('the requested Korean conditional ending is accepted and unqualified advice rejected',()=>{
 const d=core();d.core_conditions=['두 사람이 만남에 합의하면 시기 판단이 달라져.']
 assert.equal(validateRelationshipEditorial(d,'reunion').ok,true)
 d.core_conditions=['서로 대화를 나눠 봐.']
 assert.equal(validateRelationshipEditorial(d,'reunion').reason,'core_condition_is_advice')
})

test('reunion timing ranges with dates do not prescribe a contact duration',()=>{
 const data=core(); data.timing='2026-11-03일부터 11월 5~10일 사이에 대화를 이어갈 조건을 살펴봐.'
 assert.equal(validateRelationshipEditorial(data,'reunion').ok,true)
 data.core_action='답장을 30분 뒤에 해.'
 assert.equal(validateRelationshipEditorial(data,'reunion').reason,'invented_exact_behavior_duration')
})

test('feelings framed as tendencies or things to confirm are allowed; flat claims are not',()=>{
 const ok=core();ok.chemistry='네 금성과 상대 화성이 맞물려 처음 만났을 때 서로에게 끌리기 쉬운 조건이야. 예를 들어 첫 약속 뒤에 바로 다음 약속을 잡게 되기 쉬워.'
 assert.equal(validateRelationshipEditorial(ok,'compatibility').ok,true)
 const ask=core();ask.communication='상대가 아직 서로를 원하는지는 직접 물어봐야 알 수 있어.'
 assert.notEqual(validateRelationshipEditorial(ask,'compatibility').reason,'unobserved_mind_claim')
 const flat=core();flat.chemistry='서로를 강하게 원하는 사이야.'
 assert.equal(validateRelationshipEditorial(flat,'compatibility').reason,'unobserved_mind_claim')
})
<<<<<<< HEAD
=======

test('a prescribed wait before talking again is an invented duration',()=>{
 const d=core();d.conflict_pattern='감정이 격해지면 말을 멈추고 30분 뒤에 다시 이야기하는 규칙을 세워.'
 assert.equal(validateRelationshipEditorial(d,'compatibility').reason,'invented_exact_behavior_duration')
})

test('spelled-out and minimum waits are invented durations too; evidence dates are not',()=>{
 for (const line of ['각자 혼자 쉬는 시간을 30분이라도 보장해줘.','일단 대화를 멈추고 감정이 가라앉은 다음 날 다시 이야기하는 게 안전해.','하루 정도 연락을 쉬어 봐.']) {
  const d=core();d.conflict_pattern=line
  assert.equal(validateRelationshipEditorial(d,'compatibility').reason,'invented_exact_behavior_duration',line)
 }
 assert.equal(hasInventedDuration('2027년 2월 3일 전후로 대화가 다시 열리기 쉬워.'),false)
})

test('reunion readings from the app screenshot: pipeline words, orbs, adjustment phrases and repeated roles are caught',async()=>{
  const {systemJargon,orbNumber,abstractEnding,repeatedReunionFields}=await import('./relationshipEditorialV1.ts')
  for (const line of ['입력된 현실 상태는 이미 실제로 대면 만남을 가졌던 단계야.','현재 연락·재접촉 자체의 독립 후보는 없어.','실제 만남을 촉발하는 유의미한 중장기 및 일별 접점 관문이 열려 있어.','사용자 입력 기록상 실제로 만난 상태이나 기준 시점은 입력되지 않음으로 확인돼.','수신과 발신 측면의 활성 지표는 모두 매우 약해.'])
    assert.ok(systemJargon.test(line),line)
  assert.ok(orbNumber.test('너의 출생 화성과 상대 명왕성이 150도각(0.27°)으로 긴장 관계를 형성해.'))
  assert.ok(abstractEnding.test('긴장이 올라올 수 있어 지속적인 현실 조율이 뒷받침되어야 해.'))
  assert.equal(systemJargon.test('네가 알려준 대로 이미 한 번 만났으니, 이번엔 그때 피했던 얘기를 꺼낼 수 있는지가 관건이야.'),false)
  const data={core_summary:'이미 한 번 만났고 봄에 다시 마주칠 때가 와. 그때 예전 문제를 꺼낼 수 있는지가 관건이야.',overview:'이미 한 번 만났고 봄에 다시 마주칠 때가 와서 그때 예전 문제를 꺼낼 수 있는지가 관건이야.',reunion_synthesis_v2:{summary:'네 화성과 상대 수성이 부딪혀서 말다툼이 쉽게 커지니, 다음 만남에서 말투부터 확인해.'}}
  assert.deepEqual(repeatedReunionFields(data),['overview'])
})

test('live reunion draft wording: activation and candidate words are pipeline language',async()=>{
  const {systemJargon}=await import('./relationshipEditorialV1.ts')
  for (const line of ['감정 활성과 만남 창은 열려 있어.','연락 재접촉의 단독 미래 후보는 잡히지 않아.','연락 단계의 미래 후보는 비어 있어.','실제 만남의 창문들이 차례로 열려.','상대 진행 흐름이 네 영역을 두드리는 지표가 있어.'])
    assert.ok(systemJargon.test(line),line)
})
