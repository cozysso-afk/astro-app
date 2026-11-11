import assert from 'node:assert/strict'
import {after,before,test} from 'node:test'
import {fileURLToPath} from 'node:url'
import {createServer} from 'vite'
import {createElement as h} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {fortuneFixture,stat} from './readingExperience.fixtures.mjs'

let server,entry,narrative,field
before(async()=>{
  server=await createServer({root:fileURLToPath(new URL('../..',import.meta.url)),optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false},appType:'custom'})
  entry=(await server.ssrLoadModule('/src/PeriodAiInterpretationPanel.tsx')).PeriodAiInterpretationPanel
  narrative=(await server.ssrLoadModule('/src/PeriodFortuneNarrativeV2.tsx')).PeriodFortuneNarrativeV2
  field=(await server.ssrLoadModule('/src/lib/fortuneFields.ts')).fortuneGroup
})
after(()=>server?.close())

function render(period,incoming,outgoing,archived=false,lens='애정') {
  const {calculation,data}=fortuneFixture(period)
  const signals={수신신호:stat(incoming),발신적합:outgoing===null?null:stat(outgoing)}
  calculation.western.relationship_signals=signals
  if(period==='month'){
    calculation.western.months=[{...calculation.period,topics:calculation.western.overall,relationship_signals:signals}]
    calculation.western.relationship_signals={수신신호:stat(91),발신적합:stat(92)}
  }
  const section={conclusion:'호감을 표현하는 방식을 살펴봐.',real_scene:'편하게 이야기를 나눴어.',action:'좋았던 장면 하나를 얘기해 봐.',evidence_refs:['W:fixture']}
  data.clusters={relationship:{love_general:section}}
  const result=archived?{ok:true,origin:'gemini',provenance_verified:true,usage:{quality_validation:{score:100}},data}:null
  return renderToStaticMarkup(h(archived?narrative:entry,{period,field:field(lens),calculation,result,loading:false,error:'',onRetry:()=>assert.fail('unexpected generation')}))
}

for(const period of ['today','month']) {
  test(period+' displays both weak scores and preserves the 1-point difference in archived and free readings',()=>{
    for(const archived of [false,true]){
      const html=render(period,39,38,archived)
      assert.match(html,/연락을 받을 조건은 39점, 내가 먼저 말을 꺼낼 조건은 38점/)
      assert.match(html,/연락을 받는 쪽이 1점 높아/)
      assert.doesNotMatch(html,/신호는 91점|받을 조건은 91점/)
    }
  })
  test(period+' distinguishes a tie, reversed direction and missing data in the selected field',()=>{
    assert.match(render(period,39,39),/두 값이 같아서/)
    assert.match(render(period,38,39),/내가 먼저 말을 건네는 쪽이 1점 높아/)
    assert.doesNotMatch(render(period,39,null),/받는 연락과 먼저 거는 연락/)
    assert.doesNotMatch(render(period,39,38,false,'학업'),/받는 연락과 먼저 거는 연락/)
  })
}

test('monthly relationship situations respond independently when contact direction changes',()=>{
  const select=(html,id)=>html.split('data-reading-section="relationship.love_'+id+'"')[1].split('</details>')[0]
  const a=render('month',29,63), b=render('month',63,29)
  assert.match(select(a,'crush'),/29점.*먼저 오는 연락이 뜸해도/)
  assert.match(select(b,'crush'),/63점.*용건이 끝난 뒤/)
  assert.match(select(a,'ambiguous'),/늘 네가 먼저/)
  assert.match(select(b,'ambiguous'),/상대가 먼저 안부/)
  assert.match(select(a,'couple'),/63점.*함께 바꾸고 싶은/)
  assert.match(select(b,'couple'),/29점.*언제 편하게 얘기/)
})

for(const period of ['today','week','month']) {
  test(period+' turns opposite contact bands into different practical readings',()=>{
    const outgoing=render(period,25,75),incoming=render(period,75,25)
    assert.match(outgoing,/먼저 전할 용건이 있다면 질문 하나/)
    assert.doesNotMatch(outgoing,/이미 질문을 보냈다면 답이 늦다는/)
    assert.match(incoming,/이미 질문을 보냈다면 답이 늦다는/)
    assert.doesNotMatch(incoming,/먼저 전할 용건이 있다면 질문 하나/)
  })
}
