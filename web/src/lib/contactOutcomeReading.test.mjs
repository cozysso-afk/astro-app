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

test('interpret actual outcome against its own stored direction and distinguish past contact from reunion',async()=>{
 const {recordedSignalReading}=await import('./contactOutcomeReading.ts')
 const record={event:'received',date:'2026-11-08',scores:{수신신호:29,발신적합:73,재접점:43},past_connection:true}
 assert.match(recordedSignalReading(record),/29.0점.*낮았는데도 실제로 연락을 받았어요.*43.0점.*과거 인연과 관련된 연락/)
 assert.match(recordedSignalReading({...record,event:'none',scores:{수신신호:73}}),/높았어도 이날은 실제 연락이 없었어요/)
 assert.doesNotMatch(recordedSignalReading({...record,event:'none'}),/다시 연락할 지표/)
 assert.match(recordedSignalReading({...record,event:'sent'}),/73.0점.*먼저 말 걸기 편한지/)
})

test('a dated encounter moves to the question after the meeting, even with another later contact',async()=>{
 const {nextRelationshipQuestion}=await import('./contactOutcomeReading.ts')
 const row={date:'2026-11-08',event:'received',past_connection:true,channel:'call',note:'저녁에 전화가 먼저 와서 직접 만남 (한규)'}
 const rows=observedContactRows([row,{date:'2026-11-10',event:'both'}, {...row,date:'2026-11-12'}],'2026-11-01','2026-11-11')
 const next=nextRelationshipQuestion(rows)
 assert.match(next.label,/만난 뒤/)
 assert.match(next.text,/2026-11-08에는 과거 인연과 직접 만났어요/)
 assert.doesNotMatch(next.text,/2026-11-10|2026-11-12/)
})

test('meeting fact respects explicit edits and never infers a meeting from unclear notes',async()=>{
 const {meetingRecorded,nextRelationshipQuestion}=await import('./contactOutcomeReading.ts')
 const row={date:'2026-11-08',event:'received',past_connection:true,channel:'call'}
 for(const note of ['직접 만날 예정','직접 만남 취소','직접 만남?','직접 만나지 못함','다른 사람과 직접 만남']) assert.equal(meetingRecorded({...row,note}),false)
 assert.match(nextRelationshipQuestion([{...row,met_in_person:true}]).label,/만난 뒤/)
 assert.match(nextRelationshipQuestion([{...row,channel:'in_person'}]).label,/만난 뒤/)
 assert.doesNotMatch(nextRelationshipQuestion([{...row,met_in_person:false,note:'직접 만남'}]).label,/만난 뒤/)
 assert.match(nextRelationshipQuestion([{...row,event:'sent'}]).label,/답이 돌아/)
 assert.equal(nextRelationshipQuestion([{...row,event:'none',met_in_person:true}]),null)
 assert.equal(nextRelationshipQuestion([{...row,past_connection:false,met_in_person:true}]),null)
})

test('observation panel shows recorded facts without forecasting from them', async()=>{
 const {createServer}=await import('vite')
 const {createElement}=await import('react')
 const {renderToStaticMarkup}=await import('react-dom/server')
 const {fileURLToPath}=await import('node:url')
 const server=await createServer({root:fileURLToPath(new URL('../..',import.meta.url)),optimizeDeps:{noDiscovery:true},server:{middlewareMode:true},appType:'custom'})
 try {
   const {ContactOutcomeReading}=await server.ssrLoadModule('/src/ContactOutcomeReading.tsx')
   const calculation={period:{start:'2020-11-11',end:'2020-11-11'},western:{relationship_signals:{수신신호:{band:'약함'}}}}
   const record={date:'2020-11-08',event:'received',channel:'call',past_connection:true,note:'저녁에 전화가 먼저 와서 직접 만남 (한규)'}
   const props={calculation,field:{id:'love'},localRecords:[record]}
   const html=renderToStaticMarkup(createElement(ContactOutcomeReading,props))
   assert.match(html,/내가 기록한 연락/)
   assert.match(html,/전화/)
   assert.doesNotMatch(html,/관계는 어떻게 이어질까|2020-11-11 연락운/)
   const weekly=renderToStaticMarkup(createElement(ContactOutcomeReading,{...props,calculation:{...calculation,period:{start:'2020-11-09',end:'2020-11-15'}}}))
   assert.doesNotMatch(weekly,/저녁에 전화가 먼저 와서|과거 인연과 직접 만났어요/)
 } finally { await server.close() }
})
