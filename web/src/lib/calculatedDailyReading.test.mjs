import test from 'node:test'
import assert from 'node:assert/strict'
import {fileURLToPath} from 'node:url'
import {createServer} from 'vite'
import {createElement as h} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {fortuneFixture} from './readingExperience.fixtures.mjs'

test('unwritten daily reading separates actual relationship signals and never invents situation advice',async()=>{
  const server=await createServer({root:fileURLToPath(new URL('../..',import.meta.url)),server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true}})
  try {
    const {PeriodAiInterpretationPanel}=await server.ssrLoadModule('/src/PeriodAiInterpretationPanel.tsx')
    const {fortuneField}=await server.ssrLoadModule('/src/lib/fortuneFields.ts')
    const {calculation}=fortuneFixture('today')
    calculation.western.relationship_signals.과거인연접점={average:39,band:'약함'}
    const show=id=>renderToStaticMarkup(h(PeriodAiInterpretationPanel,{period:'today',calculation,field:fortuneField(id),result:null,loading:false,error:'',onRetry:()=>assert.fail('automatic generation')}))
    const love=show('love')
    for(const fact of ['외부 연락 반응 신호 · 30점','내 연락 실행 적합도 · 70점','과거 인연 접점 · 39점','해설 생성']) assert.ok(love.includes(fact),fact)
    assert.doesNotMatch(love,/계산값으로 읽는|<summary>재회<|핵심 이미지 저장/)
    delete calculation.western.relationship_signals.과거인연접점
    assert.doesNotMatch(show('love'),/과거 인연 접점 ·/)
    assert.doesNotMatch(show('study'),/내 연락 실행 적합도|솔로 · 새 인연/)
  } finally {await server.close()}
})
