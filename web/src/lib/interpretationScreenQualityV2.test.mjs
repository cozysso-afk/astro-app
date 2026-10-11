import test from 'node:test'
import assert from 'node:assert/strict'
import { westernRankCopy } from './westernRankCopy.ts'
import { timelinePresentation, timelineWindowState } from './timelineTime.ts'
import { buildFortuneUserSummary } from './fortuneUserSummary.ts'
import { buildFortuneEditorialV3 } from './fortuneEditorialV3.ts'
import { polishFortuneSummary } from './fortuneNarrativePolish.ts'

const stat=(average,band='약함')=>({average,band,spread:0,best_days:[],caution_days:[]})
const topics=['연애','연락','재회']
function fixture(period='today',evidence=[]){
 const days={today:1,week:7,month:31,year:365}[period]
 const calculation={period:{start:'2026-10-11',end:period==='today'?'2026-10-11':'2026-12-31',day_count:days},western:{overall:{연애:stat(25),연락:stat(20),재회:stat(30)},relationship_signals:{},daily_scores:[{date:'2026-10-11',evidence}],detail_days:[],months:[]}}
 const data={headline:'',overall:{summary:'',evidence_refs:[]},priorities:[],key_windows:[],cross_checks:[],clusters:{},contact_flow:{},topic_analysis:Object.fromEntries(topics.map(topic=>[topic,{importance:'핵심',verdict:'',reason:'',timing:'',action:'',avoid:'',evidence_refs:[]}]))}
 const context={period,calculation,topicEntries:Object.entries(data.topic_analysis),focusTopics:topics,verifiedNarrative:false,allowIntraday:false}
 return {calculation,data,context}
}
for(const [period,when] of [['today','오늘'],['week','이번 주'],['month','이번 달'],['year','올해']]) test(`screenshot: relative first and low absolute activation / ${period}`,()=>{
 const {calculation,data,context}=fixture(period)
 const before=structuredClone(calculation)
 const text=westernRankCopy(Object.entries(calculation.western.overall),when)
 assert.match(text,/연애·연락·재회 중 재회의 점수가 가장 높아/)
 assert.match(text,/다른 분야보다 높더라도 재회 활성도는 ‘약함’/)
 assert.doesNotMatch(text,/흐름이 점수가|연애은|재회은/)
 const summary=polishFortuneSummary(buildFortuneUserSummary(data,context))
 assert.equal(new Set(summary.focusTopics.map(t=>t.action).filter(Boolean)).size,summary.focusTopics.filter(t=>t.action).length)
 assert.match(summary.focusTopics.find(t=>t.topic==='연애').conclusion,/연애는/)
 assert.doesNotMatch(JSON.stringify(summary),/크게 바꾸는 촉발|도움과 부담 방향/)
 assert.deepEqual(calculation,before)
})
test('ties and missing values never produce an invented ranking or band',()=>{
 assert.match(westernRankCopy([['연애',stat(30)],['연락',stat(30)],['재회',stat(null)]],'오늘'),/점수가 모두 같아/)
 assert.match(westernRankCopy([['연애',stat(NaN)]],'오늘'),/점수가 없어/)
 assert.match(westernRankCopy([['연애',stat(80,'강함')]],'오늘'),/‘강함’/)
})
test('support and friction cite distinct evidence, explicit direction takes precedence over unsigned contribution',()=>{
 const evidence=[{kind:'aspect',transit:'Moon',target:'Venus',aspect:'trine',direction:'supportive',contribution:2,source_topics:topics,text:'달 금성 삼분위'}, {kind:'house',transit:'Moon',whole_house:8,direction:'caution',contribution:4,source_topics:topics,text:'달 8하우스'}]
 const f=fixture('today',evidence), original=structuredClone(f.calculation)
 const summary=buildFortuneUserSummary(f.data,f.context)
 const reason=summary.focusTopics.find(t=>t.topic==='연애').reason
 assert.match(reason,/도움 근거:.*달과 금성/)
 assert.match(reason,/마찰 근거:.*8하우스/)
 assert.deepEqual(f.calculation,original)
 const positive=fixture('today',[evidence[0]])
 positive.calculation.western.overall.연애=stat(80,'강함')
 const row=buildFortuneUserSummary(positive.data,positive.context).focusTopics.find(t=>t.topic==='연애')
 assert.match(row.reason,/도움 근거/);assert.doesNotMatch(row.reason,/마찰 근거/)
})
test('domain answers require evidence and win over fallback without mutating dates or refs',()=>{
 const f=fixture(), summary=buildFortuneUserSummary(f.data,f.context)
 f.data.domain_answers=[{topic:'연애',question_key:'mutuality_meeting',label:'상호성 · 만남',answer:'호감 표현과 만남을 서로 주고받는 흐름이야.',status:'direct',evidence_refs:['W:2026-10-11:love']},{topic:'연락',question_key:'continuity',label:'대화 지속',answer:'근거 없이 채운 답변은 보이면 안 돼.',status:'direct',evidence_refs:[]}]
 const before=structuredClone(f.data)
 const result=buildFortuneEditorialV3(f.data,f.calculation,summary)
 assert.equal(result.domainAnswers.연애[0].answer,f.data.domain_answers[0].answer)
 assert.equal(result.domainAnswers.연락,undefined)
 assert.deepEqual(f.data,before)
})
test('local clock, calculation date, date ranges and midnight do not promote past windows',()=>{
 const context={now:new Date('2026-10-11T14:08:00Z'),timeZone:'Asia/Seoul',referenceDate:'2026-10-11'}
 assert.equal(timelinePresentation('15:30–17:00','favorable',context).label,'지난 구간 · 회고')
 assert.equal(timelineWindowState('23:00–23:30',context),'current')
 assert.equal(timelineWindowState('23:30–23:59',context),'upcoming')
 assert.equal(timelineWindowState('2026-10-10',context),'past')
 assert.equal(timelineWindowState('2026-10-12 → 2026-10-13',context),'upcoming')
 assert.equal(timelineWindowState('15:30–17:00',{...context,referenceDate:'2026-10-10'}),'past')
 assert.equal(timelineWindowState('23:30–01:00',{...context,now:new Date('2026-10-11T15:30:00Z')}),'current')
 assert.equal(timelineWindowState('15:30–17:00',{...context,timeZone:'America/New_York'}),'upcoming')
})
