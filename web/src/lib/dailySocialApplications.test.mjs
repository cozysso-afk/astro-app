import assert from 'node:assert/strict'
import test from 'node:test'
import {buildDailyReadingDocument} from './dailyReadingDocument.ts'

const field={id:'social',label:'대인',topics:['대인관계','소식']}
const date='2026-10-26'
const calc={period:{start:date,end:date},western:{overall:{대인관계:{average:53,band:'보통'}}}}
const read=(data={},calculation=calc)=>buildDailyReadingDocument(data,date,field,true,calculation)
const supplements=doc=>doc.details.filter(row=>row.id.startsWith('social-application:'))
test('old daily social readings fill five distinct applications backed by the selected date',()=>{
  const doc=read()
  assert.equal(new Set(supplements(doc).map(row=>row.text)).size,5)
  assert.match(doc.details.find(row=>row.id==='social-calculation').text,/2026-10-26.*53점/)
  const other=read({},{...calc,western:{overall:{대인관계:{average:30,band:'약함'}}}})
  assert.ok(supplements(other).every(row=>!supplements(doc).some(previous=>previous.text===row.text)))
  for(const c of [{...calc,period:{start:date,end:'2026-10-31'}},{...calc,western:{overall:{}}}])
    assert.equal(supplements(read({},c)).length,0)
})
test('authored and insufficient social readings are preserved',()=>{
  const data={clusters:{relationship:{friends:{conclusion:'기존 해설',action:'기존 행동',real_scene:'기존 상황',evidence_refs:['f']},coworkers:{applicability:'insufficient'}}},editorial_delivery:{'relationship.coworkers':'authored'}}
  const doc=read(data)
  assert.equal(supplements(doc).length,3)
  assert.equal(doc.slots.find(row=>row.id==='relationship.coworkers').state,'insufficient')
  assert.equal(doc.details.find(row=>row.id==='relationship.friends:conclusion').text,'기존 해설')
})
