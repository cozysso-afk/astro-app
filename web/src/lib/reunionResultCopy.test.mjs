import assert from 'node:assert/strict'
import {after,before,test} from 'node:test'
import {fileURLToPath} from 'node:url'
import {createServer} from 'vite'
import {timing} from './readingExperience.fixtures.mjs'

let server,format
before(async()=>{
  server=await createServer({root:fileURLToPath(new URL('../..',import.meta.url)),optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false},appType:'custom'})
  format=(await server.ssrLoadModule('/src/lib/resultFormatters.ts')).relationshipResultText
})
after(async()=>server?.close())

const result={engine:'fixture',api_version:'1',relationship_status:'single',period:timing.period,
  result:{months:[],reunion_transits:{available:false,directional_context:timing}}}

test('reunion full result copies recorded first contact, current state and dated events independently',()=>{
  for(const [initiator,label] of [['user','내가 먼저'],['counterpart','상대가 먼저'],['mutual','서로 비슷한 시점'],['unknown','확인 어려움'],['','기록 안 함']]){
    const facts={state:'reunited',initiator,events:[{kind:'meeting',date:'2026-06-05'},{kind:'rebuilding',date:'2026-06-15'}]}
    const [human,json]=format('reunion',result,null,facts).split('[원본 계산 JSON]\n')
    assert.ok(human.includes('실제 첫 연락 · '+label))
    assert.match(human,/관계를 다시 이어가기로 합의했어요/)
    assert.match(human,/직접 만난 날 · 2026-06-05/)
    assert.match(human,/관계에 합의한 날 · 2026-06-15/)
    assert.match(human,/상대 차트 쪽 활성: 30.0/)
    assert.match(human,/내 차트 쪽 활성: 70.0/)
    assert.doesNotMatch(human,/관계 상태: single/)
    assert.deepEqual(JSON.parse(json).reunion_observation,facts)
    assert.deepEqual(JSON.parse(json).relationship,result)
  }
})
test('legacy or incomplete archive data cannot invent first contact or a confirmed stage',()=>{
  const malformed={state:'not_saved',initiator:'toString',events:[null,{kind:'meeting',date:'2026-02-31'},{kind:'other',date:'2026-06-15'}]}
  for(const facts of [undefined,malformed]){
    const [human,json]=format('reunion',result,null,facts).split('[원본 계산 JSON]\n')
    assert.match(human,/실제 첫 연락 · 기록 안 함/)
    assert.match(human,/현재 관계 상태 미입력/)
    assert.deepEqual(JSON.parse(json).reunion_observation,{state:'',initiator:'',events:[]})
  }
  assert.doesNotMatch(format('compatibility',result,null,{state:'reunited',initiator:'counterpart',events:[]}),/사용자가 확인한 관계|직접 기록한 관계|실제 첫 연락/)
})
