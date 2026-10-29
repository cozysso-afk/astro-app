import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { validateReunionGroundingV2 } from '../../../supabase/functions/relationship-interpret-v9-preview/reunionGroundingV2.ts'

const server=readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/index.ts',import.meta.url),'utf8')
const cache=readFileSync(new URL('./readingCache.ts',import.meta.url),'utf8')

test('reunion Gemini packet has a tighter target and compact hierarchy windows',()=>{
  assert.match(server,/REUNION_PROMPT_TARGET_BYTES=40000/)
  assert.match(server,/target_ok:bytes<=targetBytes/)
  assert.match(server,/purpose===\"reunion\"&&budget\.target_ok/)
  assert.match(server,/relationship-v14\.0-gemini-single-author/)
  assert.match(server,/slice\(0,limit\)\.map\(compactHierarchyWindow\)/)
  assert.match(server,/fast_evidence:compactList\(x\?\.fast_evidence,2\)/)
  assert.match(server,/period_support:compactList\(x\?\.period_support,2\)/)
  assert.doesNotMatch(server,/top_periods:h\.top_periods/)
  assert.match(server,/past_windows:\(Array\.isArray\(h\?\.past_windows\)/)
  assert.match(server,/current_windows:\(Array\.isArray\(h\?\.current_windows\)/)
  assert.match(cache,/relationship-v14\.0-gemini-single-author/)
})

test('unsupported deterministic wording is rejected for targeted Gemini repair',()=>{
  const ids=['R2:why:1','R2:init:2','R2:timing:3','R2:rebuild:4','R2:risk:5']
  const evidence=ids.map(id=>({id}))
  const questions={
    why_reconnect:{evidence_refs:[ids[0]]},initiative:{evidence_refs:[ids[1]]},timing:{evidence_refs:[ids[2]]},rebuild:{evidence_refs:[ids[3]]},repeat_risks:{evidence_refs:[ids[4]]},
  }
  const payload={precision:{partner_time_exact:false},reunion_hierarchy:{as_of_date:'2026-09-25'},reunion_timing_windows:{windows:[]},reunion_evidence_v2:{evidence,questions,initiative_gate:{available:true}}}
  const data={headline:'테스트',overview:'',timing:'',reunion_context:'',practical_advice:[],top_aspects:[],limits:'',reunion_synthesis_v2:{
    summary:'운명적 인연이라 반드시 연락한다는 식으로 단정하는 문장이 들어왔지만 이 전체 답변을 버리지 않고 안전하게 교정해야 한다. 상대가 아직 사랑한다는 표현이나 재회 확률 80% 같은 표현도 같은 방식으로 고쳐야 하며, 계산 근거 자체와 나머지 설명은 그대로 보존해야 한다. 이 문장은 길이 검증도 통과하도록 충분한 설명을 포함한다.',
    consultation_answer:{current_stage:'현재 단계에 관한 충분한 직접 답변이다.',contact_type_if_any:'연락 형태에 관한 충분한 직접 답변이다.',initiative:'선연락 주체는 현재 계산만으로 정하기 어려워.',continuity:'연락 지속성에 관한 충분한 직접 답변이다.',meeting_gate:'실제 만남 조건에 관한 충분한 직접 답변이다.',rebuild_gate:'관계 재구축 조건에 관한 충분한 직접 답변이다.',behavior_change_evidence:'행동 변화 근거에 관한 충분한 직접 답변이다.',next_stage_up_conditions:['다음 단계 조건에 관한 충분한 문장이다.'],down_conditions:['단계 하락 조건에 관한 충분한 문장이다.'],repeat_risks:['반복 위험에 관한 충분한 문장이다.'],contextual_application:{},evidence_refs:ids.slice(0,3)},
    why_reconnect:{conclusion:'운명적 인연처럼 느껴질 수 있다는 표현이 들어왔다.',interpretation:'끊을 수 없는 인연이라는 단정 대신 실제 계산 근거가 가리키는 관계의 반복 패턴을 설명하는 충분한 문장이다.',evidence_refs:[ids[0]]},
    initiative:{conclusion:'상대가 아직 사랑한다는 식의 단정은 피해야 한다.',interpretation:'누가 먼저 연락할지는 실제 행동 방향 근거가 부족하므로 차트 활성만으로 판정하지 않는 충분한 설명이다.',evidence_refs:[ids[1]]},
    timing:{conclusion:'연락 확률 80%라고 단정하면 안 되고 활성 시기만 설명한다.',windows:[],evidence_refs:[ids[2]]},
    rebuild:{conclusion:'천생연분이라는 표현 없이 관계 재구축 조건을 실제 근거에 따라 설명한다.',conditions:[],evidence_refs:[ids[3]]},
    repeat_risks:{conclusion:'서로를 지울 수 없다는 식의 표현 대신 반복 위험을 설명한다.',patterns:[],evidence_refs:[ids[4]]},
    convergence:[],precision_note:''
  }}
  const out=validateReunionGroundingV2(data,payload)
  assert.equal(out.ok,false)
  assert.equal(out.reason,'unsupported_deterministic_claim')
  assert.equal(out.data,data)
})
