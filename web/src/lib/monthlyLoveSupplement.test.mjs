import test from 'node:test'
import assert from 'node:assert/strict'
import {monthlyReadingCore} from './monthlyReadingCore.ts'
import {monthlyLoveSupplements, monthlyPeriodSupplements} from './monthlyLoveSupplement.ts'

const keys=['love_single','love_crush','love_flirting','love_ambiguous','love_couple','contact_activation','contact_continuity','love_reunion_interest']
const doc={scope:'love',state:'ready',date:'2026-11-01 → 2026-11-30',sections:keys.map(key=>({id:'relationship.'+key,label:key,state:'missing'}))}
const period={start:'2026-11-01',end:'2026-11-30'}
const stat={average:44,band:'다소 약함',best_days:[{date:'2026-12-01',score:77},{date:'2026-11-21',score:62}],caution_days:[]}
const topics={연애:stat,연락:{...stat,average:47},재회:{...stat,average:34}}
const calc={period,western:{months:[{...period,topics}]}}
test('eight distinct explanations for old month, with only real selected-month dates',()=>{
  const original=structuredClone(doc)
  const items=monthlyLoveSupplements(doc,calc)
  assert.equal(items.length,8)
  assert.equal(new Set(items.map(item=>item.text)).size,8)
  assert.ok(items.every(item=>item.evidence.includes('2026-11-21')&&!item.evidence.includes('2026-12')))
  assert.ok(items.find(item=>item.id.endsWith('continuity')).evidence.includes('47점'))
  assert.ok(items.find(item=>item.id.endsWith('reunion_interest')).evidence.includes('34점'))
  assert.deepEqual(doc,original)
})
test('authored, insufficient, non-love, mismatched, unverified and missing evidence are never filled',()=>{
  const changed=structuredClone(doc);changed.sections[0].state='ready';changed.sections[1].state='insufficient'
  assert.equal(monthlyLoveSupplements(changed,calc).length,6)
  for (const outside of [{...doc,scope:'work'},{...doc,state:'unverified'},{...doc,date:'other period'}])assert.deepEqual(monthlyLoveSupplements(outside,calc),[])
  assert.equal(monthlyLoveSupplements(doc,{period,western:{overall:{연락:topics.연락}}}).length,2)
})

test('overall and topic tabs use matching topic statistics without replacing authored or insufficient rows',()=>{
  const overall={...doc,scope:'overall',sections:[...doc.sections,
    {id:'relationship.friends',label:'친구',state:'missing'},
    {id:'relationship.coworkers',label:'동료',state:'missing'},
    {id:'work_study.exam',label:'시험',state:'ready'},
    {id:'work_study.career_change',label:'이직',state:'insufficient'},
    {id:'investment.entry',label:'신규 진입',state:'missing'},
  ]}
  const calculation={period,western:{months:[{...period,topics:{...topics,대인관계:stat,시험:stat,이직:stat}}]}}
  const rows=monthlyPeriodSupplements(overall,calculation)
  assert.equal(rows.length,10)
  assert.equal(new Set(rows.map(r=>r.text)).size,10)
  assert.ok(rows.at(-1).evidence.includes('월간 대인관계 평균 44점'))
  assert.deepEqual(monthlyPeriodSupplements({...overall,state:'unverified'},calculation),[])
})

test('month timing changes in the explanation even with the same overall band',()=>{
  const month=(later)=>({period,western:{overall:{시험:{...stat,best_days:[{date:later?'2026-11-24':'2026-11-04',score:62}],caution_days:[{date:'2026-11-16',score:30}]}}}})
  const exam={...doc,scope:'study',sections:[{id:'work_study.exam',label:'시험',state:'missing'}]}
  const makeText=(later)=>monthlyPeriodSupplements(exam,month(later))[0].text
  assert.match(makeText(false),/11월 4일에 62점, 11월 16일에 30점/)
  assert.match(makeText(true),/11월 16일에 30점, 11월 24일에 62점/)
})
test('monthly direction uses the selected month and distinguishes receiving and initiating',()=>{
  const row={...period,topics,relationship_signals:{수신신호:{...stat,average:28},발신적합:{...stat,average:60}}}
  const input={period,western:{months:[row],relationship_signals:{수신신호:{...stat,average:85}}}}
  const result=monthlyReadingCore({...doc,core:[],exportBlockIds:[]},input,{topics:['연락']})
  const item=result.core.find(s=>s.id==='month:contact-direction')
  assert.match(item.text,/28점.*60점.*먼저 말을 건네는 쪽/)
  assert.doesNotMatch(item.text,/85점/)
})

test('the same monthly work score leads to a different scheduling question when the peak moves',()=>{
  const work={...doc,scope:'work',sections:[{id:'work_study.work',label:'직장',state:'missing'}]}
  const question=early=>{
    const daily_scores=Array.from({length:30},(_,i)=>({
      date:'2026-11-'+String(i+1).padStart(2,'0'),scores:{직장:(early?i<10:i>=20)?60:45}
    }))
    return monthlyPeriodSupplements(work,{period,western:{overall:{직장:stat},daily_scores}})[0].text
  }
  assert.match(question(true),/초순에 내 작업을 넘겨야 다음 사람이/)
  assert.match(question(false),/하순에 내 작업을 넘겨야 다음 사람이/)
})

test('the reunion body compares its own month and past-contact means and complete daily reunion/contact peaks',()=>{
  const read=(reunionValues,contactValues,trim=0)=>{
    const daily_scores=reunionValues.map((score,i)=>({date:'2026-11-'+String(i+1).padStart(2,'0'),scores:{재회:score,연락:contactValues[i]}})).slice(trim)
    const input={period,western:{overall:{재회:{...stat,average:49.5}},relationship_signals:{과거인연접점:{...stat,average:43.6}},daily_scores}}
    return monthlyLoveSupplements(doc,input).find(row=>row.id.endsWith('love_reunion_interest')).text
  }
  const peak=i=>Array.from({length:30},(_,j)=>j===i?64:40)
  const separate=read(peak(18),peak(28))
  assert.match(separate,/재회 지표는 평균 49.5점.*별도로 본 접점 지표는 43.6점.*재회 지표는 11월 19일에 64점.*연락 지표는 11월 29일에 64점.*다른 사람과/)
  assert.match(read(peak(18),peak(18)),/두 지표가 같은 날.*교제하기로 한 합의/)
  const tied=peak(18);tied[22]=64
  assert.match(read(tied,Array(30).fill(40)),/11월 19일·11월 23일에 공동 최고 64점.*연락 지표는 한 달 내내 40점/)
  assert.doesNotMatch(read(peak(18),peak(28),1),/가장 높아|공동 최고|한 달 내내/)
})
