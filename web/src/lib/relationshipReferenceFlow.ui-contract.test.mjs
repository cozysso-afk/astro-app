import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { fortuneFixture, stat } from './readingExperience.fixtures.mjs'

const server=await createServer({root:fileURLToPath(new URL('../..',import.meta.url)),optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false},appType:'custom'})
const {SystemReadingViews}=await server.ssrLoadModule('/src/SystemReadingViews.tsx')
const {fortuneField}=await server.ssrLoadModule('/src/lib/fortuneFields.ts')
after(()=>server.close())

function render(calculation,field,initialSystem='integrated'){
  return renderToStaticMarkup(h(SystemReadingViews,{calculation,field:fortuneField(field),initialSystem},null))
}

test('overall and love explain a stronger reunion score alongside weak contact without prompting outreach',()=>{
  for(const period of ['today','week','month']){
    const {calculation}=fortuneFixture(period)
    calculation.western.overall.재회=stat(58)
    calculation.western.overall.연락={...stat(42),band:'다소 약함'}
    const saved=JSON.stringify(calculation)
    for(const field of [undefined,'love']){
      const html=render(calculation,field)
      assert.equal(html.match(/재회와 연락을 함께 보면/g)?.length,1)
      assert.match(html,/다시 연결될 조건은 58점/)
      assert.match(html,/연락 지표는 42점으로 약해/)
      assert.match(html,/이 점수만 보고 먼저 연락할 이유는 없어/)
    }
    assert.doesNotMatch(render(calculation,'study'),/재회와 연락을 함께 보면/)
    assert.doesNotMatch(render(calculation,'love','saju'),/재회와 연락을 함께 보면/)
    assert.equal(JSON.stringify(calculation),saved)
  }
})

test('both calculated directions can justify a comparison and missing or strong contact does not imply weak contact',()=>{
  const {calculation}=fortuneFixture('week')
  const western=calculation.western
  western.overall.재회=stat(64)
  western.overall.연락=stat(55)
  western.relationship_signals={수신신호:stat(31),발신적합:stat(32)}
  assert.match(render(calculation,'love'),/31점, 먼저 연락할 흐름은 32점/)
  delete western.relationship_signals.발신적합
  delete western.overall.연락
  assert.doesNotMatch(render(calculation,'love'),/재회와 연락을 함께 보면/)
  western.overall.연락=stat(70)
  western.relationship_signals={수신신호:stat(71),발신적합:stat(72)}
  assert.doesNotMatch(render(calculation,'love'),/재회와 연락을 함께 보면/)
  western.overall.재회=stat(30)
  western.overall.연락=stat(25)
  assert.doesNotMatch(render(calculation,'love'),/재회와 연락을 함께 보면/)
})
