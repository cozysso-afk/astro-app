import test from 'node:test'
import assert from 'node:assert/strict'
import { validateReunionGroundingV2 } from './reunionGroundingV2.ts'

const ids=['E1','E2','E3','E4','E5','E6']
const payload={reunion_evidence_v2:{evidence:ids.map(id=>({id})),questions:{
  why_reconnect:{evidence_refs:['E1','E2']},initiative:{evidence_refs:['E2','E3']},timing:{evidence_refs:['E3','E4']},rebuild:{evidence_refs:['E4','E5']},repeat_risks:{evidence_refs:['E5','E6']},
},initiative_gate:{available:false}}}
const sentence='계산 근거가 뜻하는 바와 실제 관계에서 확인할 장면을 서로 구분해서 설명한다.'
function reading(){return {reunion_synthesis_v2:{
  summary:`${sentence} ${sentence} ${sentence}`,
  consultation_answer:{current_stage:sentence,contact_type_if_any:sentence,initiative:'누가 먼저 연락할지는 현재 계산만으로 정하기 어려워.',continuity:sentence,meeting_gate:sentence,rebuild_gate:sentence,behavior_change_evidence:sentence,next_stage_up_conditions:[sentence],down_conditions:[sentence],repeat_risks:[sentence],contextual_application:{complete_cutoff:'',no_contact:'',occasional_contact:'',meeting_again:'',ambiguous_relationship:''},evidence_refs:['E1','E3','E5']},
  why_reconnect:{conclusion:sentence,interpretation:sentence,evidence_refs:['E1']},
  initiative:{conclusion:'누가 먼저 움직일지는 현재 계산만으로 정하기 어려워.',interpretation:sentence,evidence_refs:['E2']},
  timing:{conclusion:sentence,windows:[],evidence_refs:['E3']},
  rebuild:{conclusion:sentence,conditions:[sentence],evidence_refs:['E4']},
  repeat_risks:{conclusion:sentence,patterns:[sentence],evidence_refs:['E5']},convergence:[],precision_note:sentence,
}}}

test('valid output is returned by identity without composing, translating, or repairing it',()=>{
  const data=reading(),before=JSON.stringify(data),out=validateReunionGroundingV2(data,payload)
  assert.equal(out.ok,true);assert.equal(out.data,data);assert.equal(JSON.stringify(data),before)
})

test('unknown or wrong-question evidence is rejected instead of replaced',()=>{
  for(const bad of ['UNKNOWN','E5']){const data=reading();data.reunion_synthesis_v2.why_reconnect.evidence_refs=[bad];const out=validateReunionGroundingV2(data,payload);assert.equal(out.ok,false);assert.equal(out.reason,'invalid_question_evidence_refs');assert.deepEqual(data.reunion_synthesis_v2.why_reconnect.evidence_refs,[bad])}
})

test('closed initiative gate rejects unsupported direction and preserves authored text',()=>{
  const data=reading();data.reunion_synthesis_v2.initiative.conclusion='내 쪽이 먼저 움직이는 흐름이야.';data.reunion_synthesis_v2.initiative.interpretation='시작 압력은 내 방향에서 앞서는 것으로 보여.'
  const out=validateReunionGroundingV2(data,payload);assert.equal(out.ok,false);assert.equal(out.reason,'unsupported_initiative_direction');assert.match(data.reunion_synthesis_v2.initiative.conclusion,/내 쪽/)
})

test('unsupported timing date is rejected rather than filtered',()=>{
  const data=reading();data.reunion_synthesis_v2.timing.windows=[{period:'2027-01-16',meaning:sentence,evidence_refs:['E3']}]
  const timed={...payload,reunion_hierarchy:{as_of_date:'2026-10-01'},reunion_timing_windows:{windows:[{date:'2027-01-15'}]}}
  const out=validateReunionGroundingV2(data,timed);assert.equal(out.ok,false);assert.equal(out.reason,'unsupported_timing_window');assert.equal(data.reunion_synthesis_v2.timing.windows.length,1)
})

test('calculated timing date survives validation without being changed',()=>{
  const data=reading();data.reunion_synthesis_v2.timing.windows=[{period:'2027-01-15',meaning:sentence,evidence_refs:['E3']}]
  const timed={...payload,reunion_hierarchy:{as_of_date:'2026-10-01'},reunion_timing_windows:{windows:[{date:'2027-01-15'}]}}
  const out=validateReunionGroundingV2(data,timed);assert.equal(out.ok,true);assert.equal(out.data.reunion_synthesis_v2.timing.windows[0].period,'2027-01-15')
})

test('deterministic claims are rejected instead of rewritten',()=>{
  const data=reading();data.reunion_synthesis_v2.summary=`반드시 연락한다. ${data.reunion_synthesis_v2.summary}`
  const out=validateReunionGroundingV2(data,payload);assert.equal(out.ok,false);assert.equal(out.reason,'unsupported_deterministic_claim');assert.match(data.reunion_synthesis_v2.summary,/반드시 연락한다/)
})
