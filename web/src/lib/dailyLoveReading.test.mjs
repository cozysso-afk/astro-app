import test from 'node:test'
import assert from 'node:assert/strict'
import {buildDailyReadingDocument} from './dailyReadingDocument.ts'

const field = {id:'love',label:'애정',topics:['연애','연락','재회']}
const archived = {clusters:{relationship:{}},contact_flow:{incoming:'안부가 도착할 흐름이 열려 있어.'}}
function read(band, signals = {}, data = archived) {
  const calculation = {period:{start:'2026-11-11',end:'2026-11-11'},western:{overall:{연애:{average:53,band}},relationship_signals:signals}}
  return buildDailyReadingDocument(data,'2026-11-11',field,true,calculation)
}
test('all five legacy applications respond to the daily relationship band', () => {
  const readings = ['약함','보통','보통 이상'].map(band => read(band))
  for (const key of ['single','crush','flirting','ambiguous','couple']) {
    const texts = readings.map(doc => doc.details.find(row => row.id === 'application:'+key)?.text)
    assert.ok(texts.every(Boolean))
    assert.equal(new Set(texts).size,3)
  }
})
test('directions follow independent scores, including legacy reconnection signal name', () => {
  const doc = read('보통', {
    수신신호:{average:29,band:'매우 약함'}, 발신적합:{average:64,band:'보통 이상'},
    과거인연재접점:{average:46,band:'다소 약함'},
  })
  const direction = key => doc.details.find(row => row.id === 'direction:'+key)?.text
  assert.match(direction('incoming'),/29점.*근거는 약해/)
  assert.match(direction('outgoing'),/64점.*먼저 대화를 꺼내기/)
  assert.match(direction('reconnection'),/46점.*접촉이 다시 시작될 근거는 약해/)
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

test('unchanged love score yields different situational decisions when initiation and reception diverge', () => {
  const a=read('보통',{수신신호:{average:29,band:'매우 약함'},발신적합:{average:66,band:'보통 이상'}})
  const b=read('보통',{수신신호:{average:70,band:'강함'},발신적합:{average:42,band:'다소 약함'}})
  const text=(doc,key)=>doc.details.find(row=>row.id==='application:'+key).text
  assert.match(text(a,'crush'),/29점.*선연락을 기다리는 방식/)
  assert.match(text(b,'crush'),/70점.*용건이 끝난 뒤/)
  assert.match(text(a,'flirting'),/66점.*먼저 제안하기 편한/)
  assert.match(text(b,'flirting'),/42점.*답을 재촉하기보다/)
})

test('a reunion supplement uses the re-contact signal and preserves the next question after a meeting',()=>{
  const signals={과거인연접점:{average:39,band:'약함'}}
  const item=read('보통',signals).details.find(block=>block.id==='relationship.love_reunion_interest:calculated')
  assert.match(item.text,/39점.*이미 다시 만났다면 접촉은 이뤄진 거야/)
  assert.match(item.label,/계산값/)
  assert.ok(!read('보통',{}).details.some(block=>block.id===item.id))
  const data={clusters:{relationship:{love_reunion_interest:{applicability:'insufficient'}}},editorial_delivery:{'relationship.love_reunion_interest':'authored'}}
  assert.ok(!read('보통',signals,data).details.some(block=>block.id===item.id))
})

test('scenario-specific context survives when a signal is available',()=>{
  const doc=read('보통',{발신적합:{average:37,band:'약함'}})
  const solo=doc.details.find(block=>block.id==='application:single').text
  assert.match(solo,/대화가 잠시 끊겼을 때도 궁금한 게 남는다면/)
  assert.doesNotMatch(solo,/다음 약속/)
})
