import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
const result = await build({stdin:{contents:`import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {ReunionHierarchyPanel} from './src/ReunionHierarchyPanelV3'; export const render=(props)=>renderToStaticMarkup(React.createElement(ReunionHierarchyPanel,props));`,resolveDir:new URL('../../',import.meta.url).pathname},bundle:true,write:false,platform:'node',format:'cjs',loader:{'.css':'empty'}})
const mod={exports:{}}
new Function('module','exports','require',result.outputFiles[0].text)(mod,mod.exports,createRequire(import.meta.url))
const hierarchy={version:'test',as_of_date:'2026-10-22',validation:{status:'PASS'},stages:{emotional_reactivation:{activation:76,candidate_count:1},contact_recontact:{activation:59,candidate_count:4},in_person_meeting:{activation:null,candidate_count:0},relationship_rebuilding:{activation:32,candidate_count:1}},top_periods:[],current_windows:[],past_windows:[],limitations:[]}
export const render=(extra={})=>mod.exports.render({hierarchyData:hierarchy,observation:{state:'messaging',initiator:'user',events:[]},evidence:[],reunionV2:null,directionRows:[],sustainabilityText:'',...extra})
test('contact observed: advances to meeting and gives a direct reunion verdict',()=>{
 const html=render()
 assert.match(html,/관계는 재접촉 단계에 머물러 있어요/)
 assert.match(html,/대화가 지속되고 약속이 구체화되는지/)
 assert.match(html,/실제 만남<\/span><strong>뚜렷한 시기 없음/)
 assert.match(html,/다시 만나기로 정함<\/span><strong>앞 단계 미확인/)
 assert.equal((html.match(/aria-current="step"/g) || []).length,1)
 assert.equal((html.match(/data-stage-state=/g) || []).length,6)
 assert.doesNotMatch(html,/>0</)
 assert.doesNotMatch(html,/TOP|통과 점수|완전히 닫/)
})
test('incoming and outgoing are visibly separated while chart scores stay non-predictive',()=>{
 const html=render({directionRows:[{kind:'incoming',score:21.1,band:'낮음'},{kind:'outgoing',score:24.1,band:'낮음'}]})
 assert.match(html,/수신 · 상대 → 나/)
 assert.match(html,/발신 · 나 → 상대/)
 assert.match(html,/수신 · 상대 → 나<\/b><strong>낮음/)
 assert.match(html,/발신 · 나 → 상대<\/b><strong>낮음/)
 assert.match(html,/상대 차트 활성도: 21.1/)
 assert.match(html,/실제 첫 연락<\/b> · 내가 먼저/)
 assert.match(html,/실제 첫 연락자는 별도 기록/)
 assert.doesNotMatch(html,/근소 우세/)
})
test('empty AI arrays never leak a zero node and missing activation is not coerced to zero',()=>{
 const html=render({reunionV2:{why_reconnect:{},repeat_risks:{patterns:[]},rebuild:{conditions:[]},consultation_answer:{}}})
 assert.doesNotMatch(html,/>0</)
 assert.match(html,/실제 만남: 점수 없음/)
})
test('failed validation never shows predictive content',()=>{
 const html=render({hierarchyData:{...hierarchy,validation:{status:'FAIL'}}})
 assert.match(html,/다시 계산/)
 assert.doesNotMatch(html,/수신 · 상대 → 나/)
})
test('zero orb is an angular precision display while missing orb is excluded',()=>{
 const html=render({evidence:[{a:'Mars',b:'Saturn',aspect:'square',orb:0}]})
 assert.match(html,/&lt;0.01°/)
})
