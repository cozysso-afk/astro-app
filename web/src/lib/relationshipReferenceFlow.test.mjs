import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { fortuneFixture, stat } from './readingExperience.fixtures.mjs'

const server = await createServer({root:fileURLToPath(new URL('../..',import.meta.url)),server:{middlewareMode:true,hmr:false},appType:'custom'})
const {buildFortuneUserSummary} = await server.ssrLoadModule('/src/lib/fortuneUserSummary.ts')
const {relationshipReferenceFlowCards} = await server.ssrLoadModule('/src/lib/relationshipReferenceFlow.ts')
after(()=>server.close())

const render = f => buildFortuneUserSummary(f.data,{...f.context})

test('suppressed reunion remains visible as a non-actionable reference card',()=>{
  const f=fortuneFixture()
  f.calculation.western.overall.재회=stat(58)
  f.calculation.western.overall.연락={...stat(42),band:'다소 약함'}
  f.calculation.western.relationship_signals.수신신호=stat(30)
  f.calculation.western.relationship_signals.발신적합=stat(30)
  f.calculation.western.relationship_signals.과거인연접점=stat(58)
  f.data.topic_analysis.재회.importance='핵심'
  f.data.topic_analysis.연락.importance='핵심'

  const summary=render(f)
  assert.ok(!summary.favorableCards.some(item=>item.topic==='재회'))
  const cards=relationshipReferenceFlowCards(summary,f.calculation)
  assert.equal(cards.length,1)
  assert.equal(cards[0].topic,'재회')
  assert.equal(cards[0].score,58)
  assert.equal(cards[0].band,'보통')
  assert.match(cards[0].meaning,/실제 연락 흐름은 약함/)
  assert.match(cards[0].meaning,/행동 추천 보류/)
})

test('reference card is not duplicated when reunion is already actionable',()=>{
  const f=fortuneFixture()
  f.calculation.western.overall.재회=stat(70)
  f.calculation.western.overall.연락=stat(70)
  f.calculation.western.relationship_signals.수신신호=stat(70)
  f.calculation.western.relationship_signals.발신적합=stat(70)
  f.calculation.western.relationship_signals.과거인연접점=stat(70)
  f.data.topic_analysis.재회.importance='핵심'
  f.data.topic_analysis.연락.importance='핵심'

  const summary=render(f)
  assert.ok(summary.favorableCards.some(item=>item.topic==='재회'))
  assert.deepEqual(relationshipReferenceFlowCards(summary,f.calculation),[])
})
