import assert from 'node:assert/strict'
import {after,before,test} from 'node:test'
import {createServer} from 'vite'
import {fileURLToPath} from 'node:url'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
let server,Panel
before(async()=>{
  server=await createServer({root:fileURLToPath(new URL('../..',import.meta.url)),optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false},appType:'custom'})
  Panel=(await server.ssrLoadModule('/src/RelationshipInterpretationPanel.tsx')).RelationshipInterpretationPanel
})
after(()=>server?.close())
const hierarchy={version:'fixture',as_of_date:'2025-11-11',validation:{status:'PASS'},stages:{relationship_rebuilding:{activation:64,candidate_count:1}},top_periods:[{start:'2025-11-18',end:'2025-11-18',date:'2025-11-18',stage:'relationship_rebuilding',final:64}],past_windows:[],current_windows:[]}
function show(more={}) {
  return renderToStaticMarkup(createElement(Panel,{analysisMode:'reunion',aspects:[],timeSensitivePoints:new Set(),formatAspect:()=>'',observation:{state:'met',initiator:'user',events:[]},hierarchy,ai:null,aiLoading:false,aiError:'',onAi:()=>assert.fail('generated on render'),...more}))
}
test('confirmed meeting, next-stage timing and first contact remain distinct in the reading',()=>{
  const html=show()
  const headings=['두 사람이 실제로 다시 만났어요','관계가 어디까지 왔는지','다음 단계의 계산상 참고 시기','연락 방향 참고값','지난 시기와 실제 기록 비교']
  const positions=headings.map(heading=>html.indexOf(heading))
  assert.ok(positions.every((offset,i)=>offset>=0 && (!i || offset>positions[i-1])))
  assert.match(html,/실제 첫 연락<\/b> · 내가 먼저/)
  assert.match(html,/다시 교제하기로 합의<\/span><strong>주목 시기 있음/)
  assert.match(html,/예측 적중률을 뜻하지 않아요/)
})
test('free facts and calculations precede optional generation and survive a generation error',()=>{
  for(const props of [{},{aiError:'사용 한도가 찼어요.'},{aiLoading:true}]){
    const html=show(props)
    assert.ok(html.indexOf('두 사람이 실제로 다시 만났어요')>=0)
    assert.ok(html.indexOf('계산 근거와 점수 보기')<html.indexOf('ai-preflight-cost'))
    assert.match(html,/관계 유지<\/span><strong>앞 단계 미확인/)
  }
})
