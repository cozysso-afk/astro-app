import assert from 'node:assert/strict'
import {after,before,test} from 'node:test'
import {fileURLToPath} from 'node:url'
import {createElement as h} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {createServer} from 'vite'

let server,Panel,formatPrompt
before(async()=>{
  server=await createServer({root:fileURLToPath(new URL('../..',import.meta.url)),optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false},appType:'custom'})
  Panel=(await server.ssrLoadModule('/src/RelationshipInterpretationPanel.tsx')).RelationshipInterpretationPanel
  formatPrompt=(await server.ssrLoadModule('/src/lib/resultFormatters.ts')).relationshipPromptText
})
after(()=>server?.close())
const asOf='2025-11-11'
const stages=['emotional_reactivation','contact_recontact','in_person_meeting','relationship_rebuilding']
const hierarchy={version:'fixture',as_of_date:asOf,validation:{status:'PASS'},
  stages:Object.fromEntries(stages.map(stage=>[stage,{activation:65,candidate_count:2}])),
  top_periods:stages.slice(1).map((stage,i)=>({stage,start:'2025-11-2'+i,end:'2025-11-2'+i,date:'2025-11-2'+i,final:65})),
  current_windows:[],past_windows:[],limitations:[]}
function render(state,events=[],extra={}){
  return renderToStaticMarkup(h(Panel,{aspects:[],partnerExact:false,ai:null,aiLoading:false,aiError:'',onAi:()=>assert.fail('paid call'),analysisMode:'reunion',timeSensitivePoints:new Set(),formatAspect:()=>'',hierarchy,observation:{state,initiator:'',events},...extra}))
}
const hasState=(html,label,state)=>new RegExp('data-stage-state="'+state+'"[^>]*><span>'+label+'</span>').test(html)
const dateEvent=(kind,date)=>({kind,date})

test('contact, meeting and agreement each confirm only their supplied facts; the future window follows the next question',()=>{
  for(const [state,axis,title,window] of [
    ['recontacted','연락이 닿음','다시 연락이 닿았어요','만남을 살펴볼 시기'],
    ['met','실제 만남','두 사람이 실제로 다시 만났어요','관계를 다시 정할 여건'],
    ['reunited','다시 교제하기로 합의','관계를 다시 이어가기로 합의했어요',null],
  ]) {
    const html=render(state)
    assert.match(html,new RegExp(title))
    assert.ok(hasState(html,axis,'observed'))
    assert.equal((html.match(/data-stage-state="observed"/g)??[]).length,1)
    assert.equal(hasState(html,'과거 관계가 다시 떠오름','observed'),false)
    if(window) assert.ok(html.includes(window));else assert.ok(!html.includes('다음 단계의 계산상 참고 시기'))
  }
})
test('a calculated timing signal does not assert a contact event or event probability',()=>{
  const html=render('')
  assert.ok(hasState(html,'연락이 닿음','future_candidate'))
  assert.doesNotMatch(html,/data-stage-state="observed"|aria-current="step"/)
  assert.match(html,/연락·만남·재회 확률이 아니에요/)
  assert.match(html,/다시 연락할 여건/)
  const undated=render('',[],{hierarchy:{...hierarchy,top_periods:[]}})
  assert.ok(hasState(undated,'연락이 닿음','undated_signal'))
  assert.doesNotMatch(undated,/다음 단계의 계산상 참고 시기/)
})
test('dated history, future plans and the current relationship remain distinct even without an AI manuscript',()=>{
  const events=[dateEvent('meeting','2025-11-08'),dateEvent('rebuilding','2099-12-25'),dateEvent('recontact','2025-02-30')]
  for(const state of ['','disconnected']){
    const html=render(state,events)
    assert.match(html,/직접 만난 날.*2025-11-08/)
    assert.ok(hasState(html,'실제 만남','past_event'))
    assert.doesNotMatch(html,/2099-12-25|2025-02-30|data-stage-state="observed"/)
    assert.ok(html.includes(state?'지금은 연락이 끊긴 상태':'현재 관계 상태 미입력'))
  }
})
test('compact and full external readings carry the same dated observation and initiator only for reunion',()=>{
  const observation={state:'met',initiator:'counterpart',events:[dateEvent('meeting','2025-11-08')]}
  for(const mode of ['compact','full']){
    const text=formatPrompt('reunion',{},null,null,mode,observation)
    assert.match(text,/두 사람이 실제로 다시 만났어요.*상대가 먼저.*직접 만난 날 · 2025-11-08/)
    assert.doesNotMatch(formatPrompt('compatibility',{},null,null,mode,observation),/사용자가 확인한 관계 기록|2025-11-08/)
  }
})


test('copied JSON separates observed direction, current state and dated events from the numerical inputs',()=>{
 const direction={period:{start:'2025-11-01',end:'2025-11-30'},months:[],incoming:{average:22,band:'약함'},outgoing:{average:75,band:'강함'},reconnection:null}
 const calc={relationship_status:'single',period:direction.period,result:{months:[],reunion_transits:{available:false,directional_context:direction}}}
 for(const mode of ['compact','full']) for(const initiator of ['user','counterpart','mutual','unknown','']){
   for(const [state,kind] of [['messaging','recontact'],['met','meeting'],['reunited','rebuilding'],['','meeting']]){
     const observation={state,initiator,events:[dateEvent(kind,'2025-11-08'),dateEvent('meeting','2099-01-01')]}
     const text=formatPrompt('reunion',{relationship_status:'single'},calc,null,mode,observation)
     const payload=JSON.parse(mode==='compact' ? text.split('CALCULATED_DATA=')[1] : text.slice(text.lastIndexOf('[COMPACT_CALCULATED_DATA · 압축단계')).split('\n').slice(1).join('\n'))
     assert.deepEqual(payload.reunion_observation,{state,initiator,events:[observation.events[0]]})
     assert.equal(payload.calculation_relationship_status,'single')
     assert.equal(payload.relationship_status,undefined)
     assert.equal(payload.reunion_directional_context.incoming.average,22)
     assert.equal(payload.reunion_directional_context.outgoing.average,75)
     assert.doesNotMatch(text,/관계 상태: single|2099-01-01/)
   }
 }
})

test('oversized full external prompt preserves complete JSON, direction and confirmed stages',()=>{
 const state={state:'reunited',initiator:'unknown',events:[dateEvent('rebuilding','2025-11-08')]}
 const calculation={relationship_status:'single',result:{months:[],reunion_return_support:{historical_rows:Array(9000).fill('extra detail')}}}
 const text=formatPrompt('reunion',{},calculation,null,'full',state)
 assert.ok(text.length<=28000)
 const payload=JSON.parse(text.split('[COMPACT_CALCULATED_DATA · 압축단계 3]')[1])
 assert.deepEqual(payload.reunion_observation,state)
 assert.ok(payload.omitted_full_sections.includes('reunion_return_support'))
})


test('a hierarchy-selected transit date can lack individual-side scores',()=>{
 const transit={date:'2027-09-17',score:60.21,components:{final:60.21},hits:[{person:'counterpart',transit:'Venus',target:'Venus',aspect:'square',orb:0.05296,score:87.128,tone:'challenging'}]}
 const calc={result:{months:[],reunion_transits:{available:true,top_days:[transit],top_months:[]}}}
 const text=formatPrompt('reunion',{},calc,null,'full')
 const data=JSON.parse(text.split(/\[COMPACT_CALCULATED_DATA · 압축단계 \d\]\n/)[1])
 const persisted=data.reunion_transits.top_days[0]
 assert.deepEqual(persisted,{date:transit.date,score:transit.score,hits:transit.hits})
 assert.equal(persisted.user_score,undefined)
 assert.equal(persisted.counterpart_score,undefined)
})
