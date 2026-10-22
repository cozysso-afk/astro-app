import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { render } from './reunionReadable.render.test.mjs'
const server=readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/index.ts',import.meta.url),'utf8')
const panel=readFileSync(new URL('../RelationshipInterpretationPanel.tsx',import.meta.url),'utf8')
const wrapper=readFileSync(new URL('../ReunionHierarchyPanel.tsx',import.meta.url),'utf8')
test('calculation and AI grounding contracts remain intact',()=>{
 for(const marker of ['relationship-v13.3-stage-answer','buildReunionEvidenceV2','repairReunionGroundingV2','validEvidenceRefs','reunion_synthesis_v2:REUNION_V2_SCHEMA']) assert.ok(server.includes(marker),marker)
})
test('reunion routes to hierarchy with AI synthesis',()=>{
 assert.match(panel,/const reunionV2/)
 assert.match(panel,/<ReunionHierarchyPanel/)
 assert.match(wrapper,/ReunionHierarchyPanelV3/)
})
test('four stages remain visible and evidence stays collapsed',()=>{
 const html=render()
 for(const label of ['다시 의식하기','연락·대화','실제 만남','관계 재구축']) assert.ok(html.includes(label),label)
 assert.match(html,/<details[^>]*><summary>계산 근거와 점수 보기/)
 assert.doesNotMatch(html,/<details[^>]*\bopen/)
 assert.match(html,/연락·만남·재회 확률이 아니에요/)
})
test('missing observation does not claim actual contact',()=>{
 const html=render({observation:{state:'',initiator:'',events:[]}})
 assert.match(html,/현재 관계 상태를 알려주세요/)
 assert.doesNotMatch(html,/연락은 이미 재개됐어요/)
})
