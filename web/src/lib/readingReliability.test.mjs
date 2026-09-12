import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { fortuneFixture, stat } from './readingExperience.fixtures.mjs'
const server=await createServer({root:fileURLToPath(new URL('../..',import.meta.url)),server:{middlewareMode:true,hmr:false},appType:'custom'})
try {
 const {buildFortuneUserSummary:build}=await server.ssrLoadModule('/src/lib/fortuneUserSummary.ts')
 const {applyLoveContext}=await server.ssrLoadModule('/src/lib/loveReadingContext.ts')
 const {lensForTopic,TEN_GOD_LENSES,thaiPlacementComparison}=await server.ssrLoadModule('/src/lib/systemReading.ts')
 for(const period of ['today','week','month','year']) {
  const f=fortuneFixture(period)
  const context={...f.context,focusTopics:['대인관계','연락']}
  const evidence=f.calculation.western.daily_scores[0].evidence[0]
  evidence.contribution=9; evidence.polarity=-0.55
  let v=build(f.data,context)
  assert.match(v.focusTopics[0].reason,/마찰이나 부담/)
  assert.doesNotMatch(v.focusTopics[0].reason,/힘이 실려/)
  delete evidence.polarity
  v=build(f.data,context)
  assert.match(v.focusTopics[0].reason,/단정하기는 어려워/)
  assert.doesNotMatch(v.focusTopics[0].reason,/힘이 실려/)
  evidence.polarity=0.65
  f.calculation.western.daily_scores[0].evidence.push({...evidence,transit:'Saturn',polarity:-0.55})
  v=build(f.data,context)
  assert.match(v.focusTopics[0].reason,/힘이 실려/); assert.match(v.focusTopics[0].reason,/마찰이나 부담/)
  assert.match(v.focusTopics.find(t=>t.topic==='연락').conclusion,/온다는 뜻은 아니야/)
  const before=JSON.stringify(f)
  for(const status of ['single','couple','flirting','intimate_uncommitted']) {
   const love=applyLoveContext(v,f.calculation,status)
   assert.equal(love.relationship.incoming,v.relationship.incoming)
   assert.equal(love.relationship.outgoing,v.relationship.outgoing)
   assert.equal(love.focusTopics.find(t=>t.topic==='연락').conclusion,v.focusTopics.find(t=>t.topic==='연락').conclusion)
  }
  assert.equal(JSON.stringify(f),before)
  const row=f.data.topic_analysis['대인관계']
  row.verdict='검증된 실제 해설은 계산 근거와 함께 보존되어야 해.'
  row.reason='이유도 화면에서 다른 정형 문장으로 덮어쓰지 않아야 해.'
  assert.equal(build(f.data,{...context,verifiedNarrative:true}).focusTopics[0].conclusion,row.verdict)
  assert.notEqual(build(f.data,context).focusTopics[0].conclusion,row.verdict)
  row.evidence_refs=[]
  assert.notEqual(build(f.data,{...context,verifiedNarrative:true}).focusTopics[0].conclusion,row.verdict)
  f.calculation.western.relationship_signals={}
  assert.match(build(f.data,context).focusTopics.find(t=>t.topic==='연락').conclusion,/정보가 부족/)
 }
 for(const lens of Object.values(TEN_GOD_LENSES)) {
  const relational=lensForTopic(lens,'애정')
  assert.equal(relational.key,lens.key)
  assert.notEqual(relational.meaning,lens.meaning)
  assert.match(relational.limit,/판정한 결과는 아니야/)
 }
 const natal=[{bhumi_key:'boriwan',planet:{label:'Sun'}}]
 assert.match(thaiPlacementComparison({bhumi_key:'boriwan',planet:{label:'Moon'}},natal,false),/태양.*달.*바뀌어/)
 assert.match(thaiPlacementComparison(natal[0],natal,false),/출생 배치와 같아/)
 assert.match(thaiPlacementComparison(natal[0],natal,true),/같은 출생 배경/)
 console.log('Reading regression: four periods, unsigned contribution, mixed/missing polarity, directional separation, context preservation, validated narrative and Saju/Thai evidence passed.')
} finally {await server.close()}
