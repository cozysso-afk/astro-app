import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeReunionObservation, validateRelationshipEditorial} from './relationshipEditorialV1.ts'

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
