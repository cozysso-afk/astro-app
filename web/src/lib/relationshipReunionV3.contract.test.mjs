import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { render } from './reunionReadable.render.test.mjs'
const server=readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/index.ts',import.meta.url),'utf8')
const panel=readFileSync(new URL('../RelationshipInterpretationPanel.tsx',import.meta.url),'utf8')
const wrapper=readFileSync(new URL('../ReunionHierarchyPanel.tsx',import.meta.url),'utf8')
test('calculation and AI grounding contracts remain intact',()=>{
 for(const marker of ['relationship-v14.2-gemini-single-author','buildReunionEvidenceV2','validateReunionGroundingV2','validEvidenceRefs','reunion_synthesis_v2:REUNION_V2_SCHEMA']) assert.ok(server.includes(marker),marker)
})
test('reunion routes to hierarchy with AI synthesis',()=>{
 assert.match(panel,/const reunionV2/)
 assert.match(panel,/<ReunionHierarchyPanel/)
 assert.match(wrapper,/ReunionHierarchyPanelV3/)
})
test('six relationship axes remain visible and evidence stays collapsed',()=>{
 const html=render()
 for(const label of ['과거 관계가 다시 떠오름','연락이 닿음','대화가 이어짐','실제 만남','다시 만나기로 정함','관계 유지']) assert.ok(html.includes(label),label)
 assert.equal((html.match(/data-stage-state=/g) || []).length,6)
 assert.match(html,/<details[^>]*><summary>계산 근거와 점수 보기/)
 assert.doesNotMatch(html,/<details[^>]*\bopen/)
 assert.match(html,/연락·만남·재회 확률이 아니에요/)
})
test('missing observation does not claim actual contact',()=>{
 const html=render({observation:{state:'',initiator:'',events:[]}})
 assert.match(html,/현재 상태를 입력하면/)
 assert.doesNotMatch(html,/실제 연락은 이미 닿았어요|연락은 이미 재개됐어요/)
})
