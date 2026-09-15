import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { fortuneFixture, stat } from './readingExperience.fixtures.mjs'
const server=await createServer({root:fileURLToPath(new URL('../..',import.meta.url)),server:{middlewareMode:true,hmr:false},appType:'custom'})
const {buildFortuneUserSummary:build}=await server.ssrLoadModule('/src/lib/fortuneUserSummary.ts')
const {applyLoveContext}=await server.ssrLoadModule('/src/lib/loveReadingContext.ts')
const {interpretationQualityPassed:quality}=await server.ssrLoadModule('/src/lib/interpretationTopics.ts')
after(()=>server.close())
const render=(f, extra={})=>build(f.data,{...f.context,...extra})
test('01 domain completeness: omitted AI topics retain requested/calculated domains',()=>{
 const f=fortuneFixture();f.context.topicEntries=[]
 let v=render(f,{focusTopics:['학업','시험']})
 assert.deepEqual(v.focusTopics.map(t=>t.topic),['학업','시험'])
 v=render(f);assert.equal(v.focusTopics.length+v.referenceTopics.length,15)
})
test('02 missing score is unknown, never favorable reference copy',()=>{
 const f=fortuneFixture();f.calculation.western.overall.이직.average=null
 const v=render(f,{focusTopics:['학업']})
 assert.match(v.referenceTopics.find(t=>t.topic==='이직').summary,/정보가 부족/)
 assert.ok(!v.favorableCards.some(t=>t.topic==='이직'))
})
test('03 neutral, positive and negative evidence all remain visible',()=>{
 const f=fortuneFixture();const e=f.calculation.western.daily_scores[0].evidence[0]
 f.calculation.western.daily_scores[0].evidence=[{...e,polarity:0,contribution:10},{...e,polarity:1,contribution:9},{...e,polarity:-1,contribution:8}]
 const reason=render(f,{focusTopics:['대인관계']}).focusTopics[0].reason
 assert.match(reason,/단정하기는 어려워/);assert.match(reason,/힘이 실려/);assert.match(reason,/마찰이나 부담/)
})
test('04 cross-system claims cannot borrow an out-of-period check',()=>{
 const f=fortuneFixture();f.data.cross_checks=[{start:'2025-01-01',end:'2025-01-02',western:'x',saju:'x',mode:'상반맥락',evidence_refs:['W:대인관계']}]
 assert.doesNotMatch(render(f,{focusTopics:['대인관계']}).focusTopics[0].reason,/사주/)
})
test('05 explicit validation failure overrides total score and blocks badge',()=>{
 assert.equal(quality({score:100,stages:[{passed:false}]}),false)
 assert.equal(quality({score:100,stages:[{}]}),false)
 assert.equal(quality({score:100,stages:[{passed:true}]}),true)
 assert.equal(quality(undefined),false)
})
test('06 missing reconnection data is not a medium-strength prediction',()=>{
 const f=fortuneFixture();f.calculation.western.relationship_signals.과거인연접점={...stat(50),average:null}
 const v=render(f,{focusTopics:['재회']})
 assert.equal(v.relationship.reconnection,undefined);assert.equal(v.relationship.reconnectionBand,undefined)
})
test('07 reversed/out-of-period ranges cannot become recommended windows',()=>{
 const f=fortuneFixture('week');const w={signal:'활용',topics:['학업'],start:'2026-09-14',end:'2026-09-15'}
 f.data.key_windows=[w,{...w,end:'2026-09-13'},{...w,end:'2026-09-20'}]
 assert.deepEqual(render(f).importantWindows.map(w=>w.date),['2026-09-14~2026-09-15'])
})
test('08 impossible clock times and unavailable precision never produce intraday guidance',()=>{
 const f=fortuneFixture();f.calculation.western.detail_days=[{date:f.calculation.period.start,topics:{학업:{best_window:{start:'25:00',end:'26:00'}}}}]
 assert.equal(render(f,{focusTopics:['학업'],allowIntraday:true}).importantWindows.length,0)
 f.calculation.western.detail_days[0].topics.학업.best_window={start:'09:00',end:'10:00'}
 assert.equal(render(f,{focusTopics:['학업'],allowIntraday:false}).importantWindows.length,0)
 assert.equal(render(f,{focusTopics:['학업'],allowIntraday:true}).importantWindows.length,1)
})
test('09 relationship context preserves specific caution and missing AI avoid has fallback',()=>{
 const f=fortuneFixture();f.data.topic_analysis.연애.avoid='';let v=render(f,{focusTopics:['연애']})
 assert.ok(v.focusTopics[0].caution)
 v.focusTopics[0].caution='근거에 연결된 특별한 주의사항'
 for(const status of ['single','flirting','intimate_uncommitted','couple']) assert.match(applyLoveContext(v,f.calculation,status).focusTopics[0].caution,/특별한 주의사항/)
})
test('10 risk activation is caution; contact headline does not turn receiving into sending',()=>{
 const f=fortuneFixture();f.calculation.western.overall.투자주의=stat(90);f.calculation.western.overall.연락=stat(75)
 f.data.topic_analysis.투자주의.importance='핵심';f.data.topic_analysis.연락.importance='핵심'
 const before=JSON.stringify(f);const v=render(f)
 assert.ok(v.cautionCards.some(t=>t.topic==='투자주의'));assert.ok(!v.favorableCards.some(t=>t.topic==='투자주의'))
 assert.match(v.favorableCards.find(t=>t.topic==='연락').meaning,/받는 연락.*보내는 연락/)
 assert.equal(JSON.stringify(f),before)
})
test('11 strong reconnection with weak contact never becomes a push-to-reconnect recommendation',()=>{
 const f=fortuneFixture();f.calculation.western.overall.재회=stat(70);f.calculation.western.overall.연락=stat(30)
 f.calculation.western.relationship_signals.수신신호=stat(30);f.calculation.western.relationship_signals.발신적합=stat(30);f.calculation.western.relationship_signals.과거인연접점=stat(70)
 f.data.topic_analysis.재회.importance='핵심';f.data.topic_analysis.연락.importance='핵심'
 const before=JSON.stringify(f);const v=render(f,{focusTopics:['재회','연락']})
 assert.ok(!v.favorableCards.some(t=>t.topic==='재회'))
 assert.ok(!v.bestFlow.includes('재회'))
 assert.match(v.focusTopics.find(t=>t.topic==='재회').conclusion,/실제 연락 움직임은 약/)
 assert.doesNotMatch(v.headline,/재회(?: 문제)?에 힘/)
 assert.match(v.relationship.reconnection,/연락 전체 흐름이 약/)
 assert.equal(JSON.stringify(f),before)
})
test('12 strong contact with weak reconnection does not convert contact into reunion',()=>{
 const f=fortuneFixture();f.calculation.western.overall.재회=stat(30);f.calculation.western.overall.연락=stat(75)
 f.calculation.western.relationship_signals.수신신호=stat(75);f.calculation.western.relationship_signals.발신적합=stat(75);f.calculation.western.relationship_signals.과거인연접점=stat(30)
 const v=render(f,{focusTopics:['재회','연락']})
 const reunion=v.focusTopics.find(t=>t.topic==='재회')
 assert.match(reunion.conclusion,/연락을 주고받는 흐름이 강해도 재회 자체는 약/)
 assert.match(reunion.caution,/연락이 왔다는 사실만으로/)
})
test('13 strong contact and strong reconnection still separates contact from relationship recovery',()=>{
 const f=fortuneFixture();f.calculation.western.overall.재회=stat(75);f.calculation.western.overall.연락=stat(75)
 f.calculation.western.relationship_signals.수신신호=stat(75);f.calculation.western.relationship_signals.발신적합=stat(75);f.calculation.western.relationship_signals.과거인연접점=stat(75)
 const v=render(f,{focusTopics:['재회','연락']})
 assert.match(v.favorableCards.find(t=>t.topic==='재회').meaning,/관계 회복은 별도 확인/)
 assert.match(v.focusTopics.find(t=>t.topic==='재회').conclusion,/대화가 닿는 것과 관계가 회복되는 것은 다른 단계/)
})
test('14 weak incoming and strong outgoing remain directionally distinct',()=>{
 const f=fortuneFixture();f.calculation.western.overall.연락=stat(65)
 f.calculation.western.relationship_signals.수신신호=stat(25);f.calculation.western.relationship_signals.발신적합=stat(75)
 const text=render(f,{focusTopics:['연락']}).focusTopics[0].conclusion
 assert.match(text,/내가 연락하기 괜찮다는 말이 상대에게서 연락이 온다는 뜻은 아니야/)
})
test('15 strong incoming and weak outgoing remain directionally distinct',()=>{
 const f=fortuneFixture();f.calculation.western.overall.연락=stat(65)
 f.calculation.western.relationship_signals.수신신호=stat(75);f.calculation.western.relationship_signals.발신적합=stat(25)
 const text=render(f,{focusTopics:['연락']}).focusTopics[0].conclusion
 assert.match(text,/오는 연락을 살피는 흐름과 내가 먼저 재촉하는 흐름이 서로 달라/)
})
test('16 reconnection windows never use generic push language',()=>{
 const f=fortuneFixture('week');f.data.key_windows=[{signal:'활용',topics:['재회'],start:'2026-09-14',end:'2026-09-15'}]
 const guidance=render(f,{focusTopics:['재회']}).importantWindows[0].guidance
 assert.match(guidance,/실제 연락과 재접촉/)
 assert.doesNotMatch(guidance,/힘을 써보기/)
})
