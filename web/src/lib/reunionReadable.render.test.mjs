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
 assert.match(html,/현재 서로 연락 중/)
 assert.match(html,/실제 만남의 계산 상태는 ‘계산됨 · 미래 후보 없음’/)
 assert.match(html,/기준일 이후 공개할 실제 만남 후보가 없어/)
 assert.match(html,/관계 재구축<\/span><strong>앞 단계 미확인/)
 assert.doesNotMatch(html,/>0</)
 assert.doesNotMatch(html,/TOP|통과 점수|완전히 닫/)
})
test('incoming and outgoing are visibly separated while chart scores stay non-predictive',()=>{
 const html=render({directionRows:[{kind:'incoming',score:21.1},{kind:'outgoing',score:24.1}]})
 assert.match(html,/수신 · 상대 → 나/)
 assert.match(html,/발신 · 나 → 상대/)
 assert.match(html,/활성도 21.1/)
 assert.match(html,/활성도 24.1/)
 assert.match(html,/상대 차트 활성도: 21.1/)
 assert.match(html,/실제 선연락이나 답장 여부를 뜻하는 확률은 아니에요/)
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
