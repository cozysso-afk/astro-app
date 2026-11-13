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
  const result=archived?{ok:true,model:'gemini-3.7-flash',origin:'gemini',provenance_verified:true,usage:{quality_validation:{score:100}},data}:null
  return renderToStaticMarkup(h(archived?narrative:entry,{period,field:field(lens),calculation,result,loading:false,error:'',onRetry:()=>assert.fail('unexpected generation')}))
}

for(const period of ['today','month']) {
  test(period+' contact signals alone do not generate relationship advice',()=>{
    for (const [incoming,outgoing] of [[39,38],[85,14],[14,85],[14,null]]) {
      const free=render(period,incoming,outgoing)
      assert.match(free,/해설 생성/)
      assert.doesNotMatch(free,/호감을 표현하는 방식을 살펴봐|먼저 연락한다면|먼저 연락할 가능성/)
      const archived=render(period,incoming,outgoing,true)
      assert.match(archived,/호감을 표현하는 방식을 살펴봐/)
      assert.doesNotMatch(archived,/먼저 연락한다면|먼저 연락할 가능성/)
    }
  })
}
