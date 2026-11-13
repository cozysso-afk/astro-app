import test from 'node:test'
import assert from 'node:assert/strict'
import {buildDailyReadingDocument} from './dailyReadingDocument.ts'

const field = {id:'love',label:'애정',topics:['연애','연락','재회']}
const archived = {clusters:{relationship:{}},contact_flow:{incoming:'안부가 도착할 흐름이 열려 있어.'}}
function read(band, signals = {}, data = archived) {
  const calculation = {period:{start:'2026-11-11',end:'2026-11-11'},western:{overall:{연애:{average:53,band}},relationship_signals:signals}}
  return buildDailyReadingDocument(data,'2026-11-11',field,true,calculation)
}
test('missing love manuscripts stay missing with favorable, weak, or absent relationship data', () => {
  const signals={수신신호:{average:29,band:'매우 약함'},발신적합:{average:64,band:'보통 이상'},과거인연재접점:{average:46,band:'다소 약함'}}
  for(const band of ['약함','보통','보통 이상']){
    const doc=read(band,signals)
    assert.equal(doc.state,'missing')
    assert.ok(doc.slots.every(slot=>slot.state==='missing'))
    assert.deepEqual(doc.details,[{id:'direction:incoming',label:'연락을 받을 흐름',text:archived.contact_flow.incoming}])
  }
})
test('preserve authored and explicitly insufficient scenario readings', () => {
  const section = {conclusion:'서로 궁금해하는 주제가 있어.',real_scene:'이어지는 질문을 봐.',action:'한 가지 더 물어봐.',evidence_refs:['daily-love']}
  const data = {clusters:{relationship:{love_crush:section,love_couple:{applicability:'insufficient'}}},
    editorial_delivery:{'relationship.love_couple':'authored'}}
  const doc = read('보통',{},data)
  assert.equal(doc.details.find(row=>row.id==='relationship.love_crush:conclusion')?.text,section.conclusion)
  assert.equal(doc.details.some(row=>['application:crush','application:couple'].includes(row.id)),false)
  assert.equal(doc.slots.find(slot=>slot.id==='relationship.love_couple')?.state,'insufficient')
})
