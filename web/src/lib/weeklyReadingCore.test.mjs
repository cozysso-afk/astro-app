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
