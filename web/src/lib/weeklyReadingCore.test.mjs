import test from 'node:test'
import assert from 'node:assert/strict'
import {weeklyReadingCore} from './weeklyReadingCore.ts'
test('a short overview reason uses only its cited day, and saved source stays untouched',()=>{
  const core=[{id:'overall:reason',label:'이렇게 읽는 이유',text:'두 조건의 공존'},{id:'decision:primary:reason',label:'행동의 이유',text:'원래 이유'}]
  const doc={state:'ready',date:'2026-11-09 → 2026-11-15',core,sections:[],exportBlockIds:core.map(b=>b.id)}
  const data={decisions:[{action:'약속의 시간을 확인해.',evidence_refs:['W:daily:2026-11-11:1']}]}
  const calc={period:{start:'2026-11-09',end:'2026-11-15',day_count:7},western:{daily_scores:[{date:'2026-11-11',scores:{},evidence:[{transit:'Mercury',aspect:'사분위',target:'Saturn'},{transit:'Mercury',aspect:'사분위',target:'Jupiter'}]}]}}
  const updated=weeklyReadingCore(doc,data,calc)
  assert.match(updated.core[0].text,/11월 11일.*수성과 토성/)
  assert.doesNotMatch(updated.core[0].text,/목성/)
  assert.equal(core[0].text,'두 조건의 공존')
  assert.deepEqual(updated.exportBlockIds,updated.core.map(b=>b.id))
})

test('love timing contrasts both indicators on the same day and responds to changed peaks',()=>{
  const doc={state:'ready',date:'2026-11-09 → 2026-11-15',core:[],sections:[],exportBlockIds:[]}
  const daily_scores=[57,56,53,51,54,51,56].map((love,i)=>({
    date:'2026-11-'+String(9+i).padStart(2,'0'), scores:{연애:love,연락:[33,32,28,28,34,30,37][i]},
  }))
  const calc={period:{start:'2026-11-09',end:'2026-11-15',day_count:7},western:{daily_scores}}
  const read=()=>weeklyReadingCore(doc,{},calc,{id:'love',topics:['연애','연락','재회']}).core.find(b=>b.id==='weekly:love-and-contact')
  assert.match(read().text,/11월 9일.*57점.*33점.*11월 15일\(37점\)/)
  daily_scores[0].scores.연락=40
  assert.match(read().text,/11월 9일.*각각 이번 주 최고치/)
  daily_scores[1].scores.연락=40
  assert.equal(read(),undefined)
})

test('weekly comparisons show all dates tied at either endpoint',()=>{
  const start='2026-11-09',end='2026-11-15'
  const daily_scores=[34,50,34,48,48,43,50].map((score,i)=>({date:'2026-11-'+String(9+i).padStart(2,'0'),scores:{학업:score}}))
  const doc={state:'calculated',date:start+' → '+end,core:[],sections:[],exportBlockIds:[]}
  const calc={period:{start,end,day_count:7},western:{daily_scores}}
  const result=weeklyReadingCore(doc,undefined,calc,{id:'study',topics:['학업']})
  assert.match(result.core[0].text,/11월 10일·11월 15일에 50점.*11월 9일·11월 11일에는 34점/)
})
