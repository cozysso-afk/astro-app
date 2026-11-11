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

test('stored daily, weekly and monthly readings retain the dated field evidence without changing the manuscript',async()=>{
 const {buildDailyReadingDocument}=await import('./dailyReadingDocument.ts')
 const {weeklyReadingCore}=await import('./weeklyReadingCore.ts')
 const {monthlyReadingCore}=await import('./monthlyReadingCore.ts')
 const field={id:'study',topics:['학업'],label:'학업운'}
 const section={conclusion:'복습할 범위를 좁혀 봐.',real_scene:'설명이 막힌 단원을 다시 펼쳐 봐.',action:'예제를 덮고 풀어봐.',change_condition:'혼자 풀이가 되면 다음 단원으로 가.',evidence_refs:['W:checked']}
 const input={clusters:{work_study:{study:section}}},snapshot=JSON.stringify(input)
 for(const period of ['today','week','month']) {
   const f=fortuneFixture(period),start=f.calculation.period.start
   const day=f.calculation.western.daily_scores[0]
   day.scores={학업:39};day.evidence=[{kind:'aspect',source_topics:['학업'],transit:'Mercury',target:'Saturn',aspect:'사분위',polarity:-.8,contribution:3}]
   const datedDoc = () => {
     if(period==='today') return buildDailyReadingDocument(input,start,field,true,f.calculation).blocks
     const doc={state:'ready',date:start+' → '+f.calculation.period.end,core:[{id:'saved',label:'원고',text:section.conclusion}],sections:[],exportBlockIds:['saved']}
     return (period==='week'?weeklyReadingCore(doc,{},f.calculation,field):monthlyReadingCore(doc,f.calculation,field)).core
   }
   assert.match(datedDoc().find(b=>b.id.endsWith(':aspect:학업')).text,/9월 12일 학업 지표는 39점.*출생차트의 토성이 사각을 이뤄.*첫 단계/)
   day.evidence[0].source_topics=['시험']
   assert.equal(datedDoc().some(b=>b.id.endsWith(':aspect:학업')),false)
 }
 assert.equal(JSON.stringify(input),snapshot)
})

test('opposed daily contributions preserve their calculation polarity even for the same conjunction',async()=>{
 const {datedAspectReading}=await import('./fortuneUserSummary.ts')
 const {calculation}=fortuneFixture('week')
 calculation.western.daily_scores=[-1,1].map((polarity,i)=>({date:'2026-09-'+(12+i),scores:{연애:i?42:54},
   evidence:[{kind:'aspect',source_topics:['연애'],transit:'Moon',target:'Venus',aspect:'합',contribution:4,polarity}]}))
 const text=datedAspectReading(calculation,'week',['연애']).text
 assert.match(text,/54점.*합을 이뤄.*서운할 수 있어.*42점.*합을 이뤄.*반가운 마음/)
 assert.match(text,/54점인 날에는 마찰/)
})

test('weekly reading follows both orders of dates and monthly examples compare against their own ten-day means',async()=>{
  const {datedAspectReading,periodProgression}=await import('./fortuneUserSummary.ts')
  const calc={period:{start:'2026-11-01',end:'2026-11-30'},western:{daily_scores:[]}}
  for(let day=1;day<=30;day++){
    const date='2026-11-'+String(day).padStart(2,'0')
    const scores={연애:day===8?56:day===22?50:day<=10?46:50,투자주의:day<15?20:80}
    const evidence=[8,22].includes(day)?[{kind:'aspect',source_topics:['연애'],transit:'Moon',target:'Venus',aspect:'합',polarity:day===8?-1:1,contribution:4}]:[]
    calc.western.daily_scores.push({date,scores,evidence})
  }
  const month=datedAspectReading(calc,'month',['연애']).text
  assert.match(month,/8일의 56점은 초순에 계산된 10일 평균 47점보다 9점 높아/)
  assert.match(month,/22일의 50점은 하순에 계산된 10일 평균 50점과 같아/)
  assert.match(periodProgression(calc,'투자주의','month'),/이번 달 2026-11-15~2026-11-21 구간에 활성도가/)
  calc.western.daily_scores=calc.western.daily_scores.filter(d=>d.evidence.length)
  assert.doesNotMatch(datedAspectReading(calc,'month',['연애']).text,/일 평균/)
  const [early,late]=calc.western.daily_scores
  early.date='2026-11-13'
  late.date='2026-11-15'
  calc.period={start:'2026-11-09',end:'2026-11-15'}
  assert.match(datedAspectReading(calc,'week',['연애']).text,/13일에 반응이.*15일에도 만나고 싶은/)
  early.evidence[0].polarity=1
  late.evidence[0].polarity=-1
  assert.match(datedAspectReading(calc,'week',['연애']).text,/13일에 표현하기.*15일에는/)
})
