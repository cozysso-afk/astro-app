import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDailyReadingDocument } from './dailyReadingDocument.ts'
import {contactRecordReading} from './contactOutcomeReading.ts'
test('Nov 11: weak reception and missing status readings in a saved love document',()=>{
 const data={clusters:{relationship:{}}, contact_flow:{incoming:'안부가 도착할 흐름이 열려 있어.'}}
 const calc={period:{start:'2026-11-11',end:'2026-11-11'},western:{overall:{연애:{average:53,band:'보통'}},relationship_signals:{수신신호:{band:'약함'},발신적합:{band:'약함'}}}}
 const doc=buildDailyReadingDocument(data,'2026-11-11',{id:'love',label:'애정',topics:['연애','연락','재회']},true,calc)
 assert.equal(doc.details.find(row=>row.id==='direction:incoming').text,data.contact_flow.incoming)
 assert.equal(doc.details.filter(row=>row.id.startsWith('application:')&&row.id!=='application:basis').length,0)
 assert.doesNotMatch(contactRecordReading([{date:'2026-11-08',event:'received',note:'저녁에 전화가 먼저 와서 직접 만남'}],'2026-11-11'),/알 수 없/)
})
