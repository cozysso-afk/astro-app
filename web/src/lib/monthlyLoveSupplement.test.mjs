import test from 'node:test'
import assert from 'node:assert/strict'
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
  const item=monthlyLoveSupplements(doc,input).find(s=>s.id==='relationship.contact_activation')
  assert.match(item.text,/28점.*60점.*먼저 말을 건네는 쪽/)
  assert.doesNotMatch(item.text,/85점/)
})
