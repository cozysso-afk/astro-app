import test from 'node:test'
import assert from 'node:assert/strict'
import {planRelationshipCopyRepair,applyRelationshipCopyRepair} from './relationshipCopyRepair.ts'
test('one edit can fix the reason and disputed intent without rewriting the rest',()=>{
 const draft = {core_reason:'금성이 대화에 영향을 줘.',chemistry:'끌리는 마음은 확실해.',communication:'대화를 이어갈 때 확인해.',nested:{evidence_refs:['a']}}
 const plan=planRelationshipCopyRepair(draft,{},'compatibility')
 assert.deepEqual(plan.targets.map(t=>t.path),[['core_reason'],['chemistry']])
 const patched=applyRelationshipCopyRepair(plan,{field_0:'표현의 속도가 다를 수 있어.',field_1:'실제로 호감이 있는지는 대화를 통해 확인해.'})
 assert.equal(patched.communication,draft.communication)
 assert.deepEqual(patched.nested,draft.nested)
 assert.throws(()=>applyRelationshipCopyRepair(plan,{field_0:'한 문장'}))
})

test('a style-only rejection can be corrected without regenerating unrelated fields',()=>{
 const draft={core_reason:'대화 속도가 다를 수 있다. 일정을 맞추는 데 확인이 필요하다.',core_summary:'조건이 달라질 수 있어.'}
 const plan=planRelationshipCopyRepair(draft,{},'reunion')
 assert.deepEqual(plan.targets.map(row=>row.path),[['core_reason']])
})
