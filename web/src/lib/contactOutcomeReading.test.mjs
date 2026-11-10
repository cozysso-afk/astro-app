import test from 'node:test'
import assert from 'node:assert/strict'
import {compareRecordedSignals, contactRecordReading, observedContactRows} from './contactOutcomeReading.ts'

test('dated observations deduplicate updates and exclude future and unrecorded days',()=>{
 const rows=observedContactRows([
   {date:'2026-11-01',event:'none',saved_at:'a'}, {date:'2026-11-01',event:'both',past_connection:true,saved_at:'b'},
   {date:'2026-11-04',event:'sent'}, {date:'2026-11-30',event:'received'}, {date:'2026-11-03',event:''},
 ],'2026-11-01','2026-11-10')
 assert.equal(rows.length,2)
 assert.match(contactRecordReading(rows),/서로 주고받음 1일/)
 assert.match(contactRecordReading(rows),/과거 인연과 연락한 날은 1일/)
 assert.match(contactRecordReading(rows,'2026-11-05'),/최근 기록인 2026-11-04에 내가 먼저/)
 assert.match(contactRecordReading(rows.slice(1),'2026-11-01'),/먼저 연락한 사람은 기록되지/)
})

test('comparison counts both as received, excludes sent and unknown scores',()=>{
 const row=(event,score)=>({event,scores:{수신신호:score}})
 assert.match(compareRecordedSignals([row('received',40),row('both',60),row('sent',95),row('received',null),row('none',70)]),/받은 2일의 수신 평균은 50.0점.*연락이 없던 날의 수신 점수가 더 높았어요/)
 assert.equal(compareRecordedSignals([row('none',60)]),'')
})

test('past record preserves the writer’s account and uses its own snapshot',async()=>{
 const {recordedSignalReading}=await import('./contactOutcomeReading.ts')
 const rows=observedContactRows([{date:'2026-11-08',event:'received',channel:'call',event_time_bucket:'evening',past_connection:true,note:'저녁에 전화가 먼저 와서 직접 만남',scores:{수신신호:65}}],'2026-11-01','2026-11-11')
 const reading=contactRecordReading(rows,'2026-11-11')
 assert.match(reading,/2026-11-08.*저녁 · 전화 · 과거 인연.*전화가 먼저 와서 직접 만남/)
 assert.match(recordedSignalReading(rows[0]),/2026-11-08.*65.0점.*연락을 받았/)
 assert.equal(recordedSignalReading({...rows[0],scores:{}}),'')
})
