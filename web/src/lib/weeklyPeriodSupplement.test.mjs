import test from 'node:test'
import assert from 'node:assert/strict'
import {weeklyPeriodSupplements} from './weeklyPeriodSupplement.ts'

const ids = ['relationship.contact_activation','relationship.contact_continuity','relationship.love_reunion_interest',
  ...['single','crush','flirting','ambiguous','couple'].map(k=>'relationship.love_'+k),
  ...['friends','coworkers','family','new_people','boundaries'].map(k=>'relationship.'+k),
  'money_news.news','work_study.exam','work_study.career_change','investment.psychology','investment.realization','investment.entry']
const topicNames = ['연락','연애','재회','대인관계','소식','시험','이직','투자심리','수익실현','신규진입']
const period = {start:'2026-11-30',end:'2026-12-06'}
const stat = {average:48,band:'다소 약함',best_days:[{date:'2026-12-02',score:61},{date:'2026-12-10',score:91}],caution_days:[{date:'2026-11-30',score:38}]}
const calc = {period,western:{overall:Object.fromEntries(topicNames.map(t=>[t,stat])),months:[{start:'2026-12-01',end:period.end,topics:{연애:{...stat,average:95}}}],
  relationship_signals:{수신신호:{...stat,average:29,band:'매우 약함'},발신적합:{...stat,average:60,band:'보통 이상'}},
  daily_scores:[{date:'2026-12-01',evidence:[{kind:'aspect',source_topics:['연애'],direction:'supportive',transit:'Venus',target:'Sun',aspect:'trine',contribution:4}]}]}}
const makeDoc = (scope,keys) => ({scope,state:'ready',date:period.start+' → '+period.end,sections:keys.map(id=>({id,label:id,state:'missing'}))})

test('weekly archive covers the nineteen missing overview slots and the eight relationship slots using that exact week',()=>{
  for(const [scope,keys] of [['overall',ids],['love',ids.slice(0,8)]]) {
    const doc=makeDoc(scope,keys), original=structuredClone(doc), rows=weeklyPeriodSupplements(doc,calc)
    assert.deepEqual(doc,original)
    assert.deepEqual(rows.map(r=>r.id),keys)
    assert.equal(new Set(rows.map(r=>r.text)).size,keys.length)
    assert.ok(rows.every(r=>r.evidence.includes('평균 48점')&&r.evidence.includes('2026-11-30(38점)')&&r.evidence.includes('2026-12-02(61점)')&&!r.evidence.includes('2026-12-10')))
    assert.match(rows[0].text,/받을 조건은 29점.*먼저 말을 걸 조건은 60점/)
    assert.match(rows.find(r=>r.id.endsWith('love_crush')).evidence,/금성–출생 태양 삼분위.*2026-12-01/)
    assert.doesNotMatch(rows.find(r=>r.id.endsWith('love_crush')).text,/이번 달|월간|95점/)
  }
})

test('old or missing evidence, absent topics, unavailable domains and authored text retain their original state',()=>{
  const doc=makeDoc('love',ids.slice(0,8))
  doc.sections[0].state='ready'
  doc.sections[1].state='insufficient'
  doc.sections.push({id:'question:연락:timing',state:'insufficient',label:'시기'})
  const incomplete={...calc,western:{overall:{재회:stat,연애:{...stat,average:NaN}},months:calc.western.months}}
  assert.deepEqual(weeklyPeriodSupplements(doc,incomplete).map(r=>r.id),['relationship.love_reunion_interest'])
  for (const invalid of [{...doc,state:'unverified'},{...doc,date:'2026-11-09 → 2026-11-15'}]) assert.deepEqual(weeklyPeriodSupplements(invalid,calc),[])
  for(const invalid of [{start:'2026-11-30',end:'2026-12-07'},{start:'2026-02-30',end:'2026-03-08'}]) {
    assert.deepEqual(weeklyPeriodSupplements({...doc,date:invalid.start+' → '+invalid.end},{...calc,period:invalid}),[])
  }
})
