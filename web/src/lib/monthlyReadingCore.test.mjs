import test from 'node:test'
import assert from 'node:assert/strict'
import {monthlyReadingCore} from './monthlyReadingCore.ts'

const date=n=>'2026-11-'+String(n).padStart(2,'0')
const doc={state:'ready',date:date(1)+' → '+date(30),core:[{id:'original',text:'원고'}],revision:'original',exportBlockIds:['original']}
const period={start:date(1),end:date(30)}
const days=Array.from({length:30},(_,i)=>({date:date(i+1),scores:{연애:i<10?32:i<20?64:48,시험:i<25?30:90}}))

test('month display uses the selected topic, real ten-day means and retains authored prose and exports',()=>{
  const calc={period,western:{daily_scores:days}}
  const love=monthlyReadingCore(doc,calc,{topics:['연애']})
  assert.match(love.core[1].text,/초순 32점, 중순 64점, 하순 48점.*중순에.*호감/)
  assert.deepEqual(love.exportBlockIds,['original','month:segments:연애'])
  assert.equal(doc.core.length,1)
  const exam=monthlyReadingCore(doc,calc,{topics:['시험']})
  assert.match(exam.core[1].text,/하순 60점.*실전/)
  assert.doesNotMatch(exam.core[1].text,/호감/)
})
test('leaves sparse and unverified results untouched, and does not invent timing for ties',()=>{
  assert.equal(monthlyReadingCore(doc,{period,western:{daily_scores:days.slice(2,8)}}),doc)
  const calculation={period,western:{daily_scores:days.map(day=>({...day,scores:{연애:44}}))}}
  assert.match(monthlyReadingCore(doc,calculation,{topics:['연애']}).core[1].text,/평균이 같아/)
  const unverified={...doc,state:'unverified'}
  assert.equal(monthlyReadingCore(unverified,calculation),unverified)
})
