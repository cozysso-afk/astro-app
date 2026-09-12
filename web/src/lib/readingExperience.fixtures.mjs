export const topics = ['금전','학업','시험','직장','이직','대인관계','연애','연락','재회','소식','컨디션','투자심리','수익실현','신규진입','투자주의']
export const stat = (score, spread = 0) => ({average:score,band:score<40?'약함':score>=60?'강함':'보통',spread,best_days:spread?[{date:'2026-09-14',score:score+5,label:''}]:[],caution_days:spread?[{date:'2026-09-17',score:score-5,label:''}]:[]})
export function fortuneFixture(period = 'today') {
  const end = period === 'today' ? '2026-09-12' : period === 'week' ? '2026-09-18' : period === 'month' ? '2026-09-30' : '2026-12-31'
  const scores = {대인관계:67,이직:64,학업:52,연애:48,연락:50,컨디션:38,투자주의:50}
  const data = {headline:'기술 원문',overall:{summary:'원자료',evidence_refs:[]},clusters:{},systems:{},limits:'확률 아님',priorities:['대인관계','이직'],key_windows:[],cross_checks:[],decisions:[],topic_analysis:Object.fromEntries(topics.map(topic=>[topic,{importance:['대인관계','이직'].includes(topic)?'핵심':topic==='컨디션'?'주목':'참고',verdict:'원문',reason:'W:fixture orb 0.40',timing:'',action:'원문',avoid:'무리하지 않기',confidence:'보통',confidence_reason:'원자료',evidence_refs:['대인관계','이직','컨디션'].includes(topic)?[`W:${topic}`]:[]}]))}
  const calculation = {ok:true,engine:'synthetic',period:{start:'2026-09-12',end,day_count:period==='today'?1:period==='week'?7:period==='month'?19:111,month_segments:1},western:{overall:Object.fromEntries(topics.map(topic=>[topic,stat(scores[topic]??50,period==='today'?0:12)])),relationship_signals:{수신신호:stat(30),발신적합:stat(70)},daily_scores:[{date:'2026-09-12',evidence:[{source_topics:['대인관계'],transit:'Mercury',target:'Jupiter',aspect:'trine',contribution:3,text:'W:fixture orb 0.40'},{source_topics:['이직'],transit:'Jupiter',target:'Sun',aspect:'trine',contribution:2},{source_topics:['컨디션'],transit:'Mars',target:'Saturn',aspect:'square',contribution:-2}]}]},saju:{ok:false},thai:{}}
  return {data,calculation,context:{period,calculation,topicEntries:Object.entries(data.topic_analysis)}}
}
export const aspects = [
  {a:'Neptune',b:'Uranus',aspect:'conjunction',orb:.1,tone:'mixed'},
  {a:'Venus',b:'Mars',aspect:'trine',orb:.4,tone:'supportive'},
  {a:'Mercury',b:'Uranus',aspect:'square',orb:.6,tone:'challenging'},
  {a:'Saturn',b:'Venus',aspect:'square',orb:.8,tone:'challenging'},
  {a:'Mars',b:'Pluto',aspect:'opposition',orb:1,tone:'challenging'},
]
export const timing = {period:{start:'2026-09-12',end:'2026-09-30'},incoming:stat(30,15),outgoing:stat(70,15),reconnection:stat(63,15),months:[]}
