import assert from 'node:assert/strict'
import {test} from 'node:test'
import {buildFortuneUserSummary as build} from './fortuneUserSummary.ts'
import {fortuneFixture,stat} from './readingExperience.fixtures.mjs'
for(const period of ['today','week','month','year']) test(`${period}: readable explanation distinguishes local support from weak aggregate and keeps every domain's depth`,()=>{
 const f=fortuneFixture(period)
 f.calculation.western.overall.학업=stat(35)
 f.calculation.western.daily_scores[0].evidence.push({source_topics:['학업'],transit:'Mercury',target:'Jupiter',aspect:'trine',contribution:4,polarity:0.65})
 const before=JSON.stringify(f)
 const v=build(f.data,{...f.context,focusTopics:['학업']})
 assert.match(v.focusTopics[0].reason,/도움을 주는 개별 근거.*전체 흐름은 약한/)
 if(period!=='today')assert.match(v.focusTopics[0].reason,/2026-09-12/)
 assert.equal(v.referenceTopics.length,14)
 for(const row of v.referenceTopics){assert.equal(row.detail.topic,row.topic);assert.ok(row.detail.reason);assert.ok(row.detail.caution)}
 assert.equal(JSON.stringify(f),before)
})
test('mixed study and exam explanations describe different practical bottlenecks',()=>{
 const f=fortuneFixture('week')
 f.calculation.western.daily_scores[0].evidence=[{source_topics:['학업','시험'],transit:'Mercury',target:'Jupiter',contribution:4,polarity:1},{source_topics:['학업','시험'],transit:'Mars',target:'Saturn',contribution:3,polarity:-1}]
 const v=build(f.data,{...f.context,focusTopics:['학업','시험']})
 assert.match(v.focusTopics[0].reason,/막힌 단계/)
 assert.match(v.focusTopics[1].reason,/시간·조건 누락/)
})
test('personal explanation distinguishes natal target and separating motion from relationship outcome',()=>{const f=fortuneFixture();f.calculation.western.daily_scores[0].evidence[0].motion='분리(Separating)';const r=build(f.data,{...f.context,focusTopics:['대인관계']}).focusTopics[0].reason;assert.match(r,/현재 운행 중인 수성.*출생차트의 목성/);assert.match(r,/각도에서 멀어지고/);assert.doesNotMatch(r,/상대가 멀어|관계가 끝나/)})
