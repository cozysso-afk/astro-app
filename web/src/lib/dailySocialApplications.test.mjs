import assert from 'node:assert/strict'
import test from 'node:test'
import {buildDailyReadingDocument} from './dailyReadingDocument.ts'

const field={id:'social',label:'대인',topics:['대인관계','소식']}
const date='2026-10-26'
const calc={period:{start:date,end:date},western:{overall:{대인관계:{average:53,band:'보통'}}}}
const read=(data={},calculation=calc)=>buildDailyReadingDocument(data,date,field,true,calculation)
const supplements=doc=>doc.details.filter(row=>row.id.startsWith('social-application:'))
test('missing daily social applications stay missing for every calculation',()=>{
  const doc=read()
  for(const item of [doc,read({},{...calc,western:{overall:{대인관계:{average:30,band:'약함'}}}})]){
    assert.equal(supplements(item).length,0)
    assert.ok(item.slots.every(slot=>slot.state==='missing'))
    assert.equal(item.details.length,0)
  }
})
test('authored and insufficient social readings are preserved',()=>{
  const data={clusters:{relationship:{friends:{conclusion:'기존 해설',action:'기존 행동',real_scene:'기존 상황',evidence_refs:['f']},coworkers:{applicability:'insufficient'}}},editorial_delivery:{'relationship.coworkers':'authored'}}
  const doc=read(data)
  assert.equal(supplements(doc).length,0)
  assert.equal(doc.slots.find(row=>row.id==='relationship.coworkers').state,'insufficient')
  assert.equal(doc.details.find(row=>row.id==='relationship.friends:conclusion').text,'기존 해설')
})
