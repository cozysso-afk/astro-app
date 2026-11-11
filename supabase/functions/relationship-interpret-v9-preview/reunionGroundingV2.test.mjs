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
  consultation_answer:{current_stage:'현실 관계 단계는 입력된 기록이 없어 미확인이야. 계산 후보는 실제 사건과 구분해야 해.',contact_type_if_any:sentence,initiative:'누가 먼저 연락할지는 현재 계산만으로 정하기 어려워.',continuity:sentence,meeting_gate:sentence,rebuild_gate:sentence,behavior_change_evidence:sentence,next_stage_up_conditions:[sentence],down_conditions:[sentence],repeat_risks:[sentence],contextual_application:{complete_cutoff:'',no_contact:'',occasional_contact:'',meeting_again:'',ambiguous_relationship:''},evidence_refs:['E1','E3','E5']},
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

test('explaining that side activation is not first-contact evidence remains allowed',()=>{
  const data=reading();data.reunion_synthesis_v2.initiative.conclusion='상대측 활성은 상대가 먼저 연락한다는 뜻이 아니야.'
  assert.equal(validateReunionGroundingV2(data,payload).ok,true)
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

test('unobserved reality cannot be inferred from a calculated candidate',()=>{
  const data=reading();data.reunion_synthesis_v2.consultation_answer.current_stage='연락 후보가 강하므로 현재 대화를 주고받는 단계야.'
  assert.equal(validateReunionGroundingV2(data,payload).reason,'unobserved_current_stage')
})

test('recorded messaging remains a fact when there are no future windows',()=>{
  const data=reading();data.reunion_synthesis_v2.consultation_answer.current_stage='입력 기록에서는 대화를 주고받았어. 미래 만남 후보가 없다는 계산과는 별개야.'
  const observed={...payload,reunion_observation:{state:'messaging',initiator:'counterpart',source:'user_input',as_of:null},reunion_hierarchy:{as_of_date:'2026-11-04'},reunion_timing_windows:{windows:[]}}
  data.reunion_synthesis_v2.initiative.conclusion='입력 기록에서는 상대가 먼저 연락했어. 다음 선연락 주체는 예측할 수 없어.'
  assert.equal(validateReunionGroundingV2(data,observed).ok,true)
  data.reunion_synthesis_v2.consultation_answer.current_stage='입력 기록에서 대화가 시작됐으니 이미 재결합했어.'
  assert.equal(validateReunionGroundingV2(data,observed).reason,'promoted_observed_stage')
})

test('direction leakage into summary roles or life advice is rejected',()=>{
  for(const key of ['core_summary','core_reason','core_action','limits']){
    const data=reading();data[key]='상대가 먼저 연락할 가능성이 높아.'
    assert.equal(validateReunionGroundingV2(data,payload).reason,'unsupported_initiative_direction',key)
  }
})

test('recorded initiator is not permission to forecast their next action',()=>{
  const data=reading();data.reunion_synthesis_v2.consultation_answer.current_stage='입력 기록에는 대화가 재개됐다고 나와. 만남은 별도로 확인해야 해.'
  data.reunion_synthesis_v2.initiative.conclusion='입력 기록에서 상대가 먼저 연락했으니 다음에도 상대가 먼저 연락할 가능성이 높아.'
  assert.equal(validateReunionGroundingV2(data,{...payload,reunion_observation:{state:'messaging',initiator:'counterpart'}}).reason,'unsupported_initiative_direction')
})

test('recorded direction may not be swapped and summary may not promote the observed stage',()=>{
  const data=reading();data.reunion_synthesis_v2.consultation_answer.current_stage='입력 기록에는 대화가 재개됐다고 나와. 만남은 별도로 확인해야 해.'
  const observed={...payload,reunion_observation:{state:'messaging',initiator:'user'}}
  data.reunion_synthesis_v2.initiative.conclusion='입력 기록에서는 상대가 먼저 연락했어.'
  assert.equal(validateReunionGroundingV2(data,observed).reason,'unsupported_initiative_direction')
  data.reunion_synthesis_v2.initiative.conclusion='입력 기록에서는 내가 먼저 연락했어. 다음 선연락은 예측할 수 없어.'
  assert.equal(validateReunionGroundingV2(data,observed).ok,true)
  data.core_summary='이미 재결합했으니 이제 생활을 맞추면 돼.'
  assert.equal(validateReunionGroundingV2(data,observed).reason,'promoted_observed_stage')
})

test('a chart comparison and an explicit inability to identify the next initiator are valid',()=>{
 const data=reading()
 data.reunion_synthesis_v2.initiative.conclusion='상대측 활성은 내측 활성보다 높아. 누가 먼저 연락할지는 판단할 수 없어.'
 assert.equal(validateReunionGroundingV2(data,payload).ok,true)
 data.reunion_synthesis_v2.initiative.conclusion='누가 먼저 연락할지는 판단할 수 없지만 상대가 먼저 연락할 가능성이 높아.'
 assert.equal(validateReunionGroundingV2(data,payload).reason,'unsupported_initiative_direction')
})

test('the words 나 and 내 inside other words do not predict an initiator',()=>{
 const data=reading()
 data.core_summary='만남 신호는 있으나 먼저 확인할 부분은 실제 대화 가능 여부야.'
 data.practical_advice=['정리되지 않은 장문의 메시지를 먼저 보내지 마.']
 assert.equal(validateReunionGroundingV2(data,payload).ok,true)
})

test('discussing whether to send a message is not a prediction about who will initiate',()=>{
 const d=reading()
 d.core_action='내가 먼저 연락할지 고민한다면, 실제로 대화를 나눌 상황인지 확인해.'
 assert.equal(validateReunionGroundingV2(d,payload).ok,true)
 d.core_action='상대방이 먼저 연락을 취할 가능성이 높아.'
 assert.equal(validateReunionGroundingV2(d,payload).reason,'unsupported_initiative_direction')
})

test('first call can cite only IDs valid for the chosen question',async()=>{
 const {questionCitationSchema}=await import('./reunionGroundingV2.ts')
 const input=structuredClone(payload)
 input.reunion_evidence_v2.questions.timing.evidence_refs=['E3','unknown','E4','E4']
 const schema=questionCitationSchema(input,'timing')
 assert.deepEqual(schema.items.enum,['E3','E4'])
 assert.equal(schema.maxItems,2)
 assert.equal(questionCitationSchema({},'timing'),null)
})

test('a recorded call from the other person is distinct from a prediction',()=>{
 const d=reading()
 const observed={...payload,reunion_observation:{state:'met',initiator:'counterpart'}}
 d.reunion_synthesis_v2.consultation_answer.current_stage='입력 기록에는 상대방이 먼저 전화를 걸었고 둘이 만났어.'
 assert.equal(validateReunionGroundingV2(d,observed).ok,true)
 assert.equal(validateReunionGroundingV2(d,{...observed,reunion_observation:{state:'met',initiator:'user'}}).reason,'unsupported_initiative_direction')
 d.reunion_synthesis_v2.initiative.conclusion='상대방이 다음에도 먼저 전화를 걸 거야.'
 assert.equal(validateReunionGroundingV2(d,observed).reason,'unsupported_initiative_direction')
})

test('observed facts take precedence across the narrative, including first-person polite wording',()=>{
  const observed={...payload,reunion_observation:{state:'met',initiator:'counterpart'}}
  for(const [claim,reason] of [
    ['입력 기록상 두 사람은 만난 적이 없어요.','denied_observed_stage'],
    ['입력 기록상 두 사람은 만났고 다시 교제하기로 합의했어요.','promoted_observed_stage'],
    ['입력 기록상 제가 먼저 연락했어요.','unsupported_initiative_direction'],
    ['입력 기록상 본인이 먼저 연락했어요.','unsupported_initiative_direction'],
  ]){
    for(const available of [false,true]){
      const data=reading()
      data.reunion_synthesis_v2.consultation_answer.current_stage='입력 기록상 두 사람이 실제로 만났어요.'
      data.reunion_synthesis_v2.rebuild.conclusion=claim
      const input={...observed,reunion_evidence_v2:{...payload.reunion_evidence_v2,initiative_gate:{available}}}
      assert.equal(validateReunionGroundingV2(data,input).reason,reason,claim)
    }
  }
})
test('recorded and conditional milestones retain their meaning across different dates',()=>{
  for(const [state,claim,events,actor] of [
    ['met','입력 기록에는 제가 먼저 연락했고 둘이 만났어요.',[],'user'],
    ['met','그 이후 만남은 없었어요. 다시 교제하기로 합의했다면 각자의 기대도 이야기해 보세요.',[],'unknown'],
    ['met','과거 기록에서 다시 교제하기로 합의했어요.',[{kind:'rebuilding',date:'2026-03-03'}],'unknown'],
    ['reunited','두 사람이 다시 교제하기로 합의했어요.',[],'unknown'],
    ['met','앞으로 상대가 먼저 연락한다면 다음 만남 일정을 물어보세요.',[],'unknown'],
  ]){
    const data=reading()
    data.reunion_synthesis_v2.consultation_answer.current_stage=state==='met'?'입력 기록상 두 사람이 실제로 만났어요.':'입력 기록상 두 사람이 재결합했어요.'
    data.core_reason=claim
    assert.equal(validateReunionGroundingV2(data,{...payload,reunion_observation:{state,events,initiator:actor}}).ok,true,claim)
  }
})

test('archived agreements are distinguishable from a meeting appointment',async()=>{
 const {reunionFactContradiction}=await import('./reunionGroundingV2.ts')
 const facts={state:'met',initiator:'counterpart'}
 assert.equal(reunionFactContradiction('다음 주에 다시 만나기로 약속했어요.',facts),null)
 assert.equal(reunionFactContradiction('기록상 제가 먼저 연락했어요.',facts),'contradicted_observed_initiator')
 assert.equal(reunionFactContradiction('다시 교제하기로 합의했는지 직접 확인해 보세요.',facts),null)
})

test('confirmed relationship agreement, previous states, and later conversations keep separate scopes',async()=>{
  const {reunionFactContradiction}=await import('./reunionGroundingV2.ts')
  const facts={state:'reunited',initiator:'counterpart',events:[{kind:'rebuilding',date:'2026-03-03'}]}
  for (const claim of ['기록상 두 사람은 재결합한 적이 없어요.','아직 교제에 합의하지 않았어요.']){
    assert.equal(reunionFactContradiction(claim,facts),'denied_observed_stage',claim)
  }
  for (const claim of ['그 전에는 교제에 합의하지 않았어요.','다음 약속에는 아직 합의하지 않았어요.','그 뒤에는 내가 먼저 연락했어요.','기록된 날짜에는 두 사람이 다시 교제하기로 합의했어요.']){
    assert.equal(reunionFactContradiction(claim,facts),null,claim)
    const data=reading()
    data.reunion_synthesis_v2.consultation_answer.current_stage='입력 기록상 두 사람이 재결합했어요.'
    data.core_reason=claim
    assert.equal(validateReunionGroundingV2(data,{...payload,reunion_observation:facts}).ok,true,claim)
  }
})
