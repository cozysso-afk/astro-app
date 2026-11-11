import test,{before,after} from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { render } from './reunionReadable.render.test.mjs'
import {createServer} from 'vite'
import {fileURLToPath} from 'node:url'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
let server,Panel
before(async()=>{
 server=await createServer({root:fileURLToPath(new URL('../..',import.meta.url)),optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false},appType:'custom'})
 Panel=(await server.ssrLoadModule('/src/RelationshipInterpretationPanel.tsx')).RelationshipInterpretationPanel
})
after(async()=>server?.close())
const serverSource=readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/index.ts',import.meta.url),'utf8')
const groundingSource=readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/reunionGroundingV2.ts',import.meta.url),'utf8')
const panel=readFileSync(new URL('../RelationshipInterpretationPanel.tsx',import.meta.url),'utf8')
const wrapper=readFileSync(new URL('../ReunionHierarchyPanel.tsx',import.meta.url),'utf8')
test('calculation and AI grounding contracts remain intact',()=>{
 for(const marker of ['relationship-v14.10-grounded-stage-question-reading-contract','buildReunionEvidenceV2','validateReunionGroundingV2','reunion_synthesis_v2:reunionSchema']) assert.ok(serverSource.includes(marker),marker)
 assert.match(groundingSource,/validateRefs\(value, valid\)/)
})
test('reunion keeps authored synthesis separate from calculated hierarchy without losing either',()=>{
 assert.match(wrapper,/ReunionHierarchyPanelV3/)
 const data={headline:'합성 재회 제목',overview:'상세 원고 보존',core_summary:'합성 재회 핵심 원문',core_reason:'합성 근거 원문',core_action:'합성 확인 원문',core_conditions:[],limits:'조건 원문',reunion_synthesis_v2:{summary:'재회 상세 요약 원문',consultation_answer:{current_stage:'입력 기록에서는 연락을 주고받았어.',next_stage_up_conditions:[],down_conditions:[],repeat_risks:[]},why_reconnect:{conclusion:'연결 이유 원문',interpretation:'연결 해석 원문'},initiative:{conclusion:'주체 미확인 원문',interpretation:'방향 제한 원문'},timing:{conclusion:'시기 설명 원문',windows:[]},rebuild:{conclusion:'재구축 조건 원문',conditions:[]},repeat_risks:{conclusion:'반복 위험 원문',patterns:[]},convergence:[],precision_note:'정밀도 원문'}}
 const hierarchy={version:'test',as_of_date:'2026-11-04',validation:{status:'PASS'},stages:{emotional_reactivation:{activation:50,candidate_count:1},contact_recontact:{activation:40,candidate_count:1},in_person_meeting:{activation:null,candidate_count:0},relationship_rebuilding:{activation:null,candidate_count:0}},top_periods:[],current_windows:[],past_windows:[],limitations:[]}
 const html=renderToStaticMarkup(createElement(Panel,{aspects:[],partnerExact:false,ai:{ok:true,origin:'gemini',provenance_verified:true,data},aiLoading:false,aiError:'',onAi:()=>{},analysisMode:'reunion',timeSensitivePoints:new Set(),formatAspect:()=>'',hierarchy,observation:{state:'messaging',initiator:'user',events:[]}}))
 for(const value of [data.core_summary,data.reunion_synthesis_v2.summary,data.reunion_synthesis_v2.consultation_answer.current_stage])assert.equal(html.split(value).length-1,1,value)
 assert.match(html,/data-authored-scope="reunion"/)
 assert.equal((html.match(/data-stage-state=/g)||[]).length,6)
 assert.match(html,/계산 근거와 점수 보기/)
})
test('six relationship axes remain visible and evidence stays collapsed',()=>{
 const html=render()
 for(const label of ['과거 관계가 다시 떠오름','연락이 닿음','대화가 이어짐','실제 만남','다시 교제하기로 합의','관계 유지']) assert.ok(html.includes(label),label)
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
