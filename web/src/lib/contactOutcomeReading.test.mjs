import test from 'node:test'
import assert from 'node:assert/strict'
import {contactRecordReading, observedContactRows} from './contactOutcomeReading.ts'

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
