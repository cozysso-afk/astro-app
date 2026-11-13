import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { buildDailyReadingDocument } from './dailyReadingDocument.ts'

const home=readFileSync(new URL('../HomeControls.tsx',import.meta.url),'utf8')
const css=readFileSync(new URL('../daily-reading-quality-v75.css',import.meta.url),'utf8')
const main=readFileSync(new URL('../main.tsx',import.meta.url),'utf8')

test('selected fortune date and actual today stay separate and explicitly labeled',()=>{
  assert.match(home,/선택한 운세일/)
  assert.match(home,/<span>오늘<\/span>\{shortKoreanDate\(now\)\}/)
  assert.match(home,/onClick=\{\(\)=>onQueryDateChange\(resetDate\)\}/)
})

test('an archived love reading keeps its full scene and action without adding calculated prose or scores to the manuscript',()=>{
  const date='2026-11-11'
  const field={id:'love',label:'애정',topics:['연애','연락','재회']}
  const primary={
    conclusion:'만날 때 편한 분위기와 이후 연락의 속도는 다르게 볼 수 있어.',
    real_scene:'함께 있을 때 대화가 즐거웠다면 그 순간의 호감은 소중해. 헤어진 뒤 어느 쪽이 대화를 다시 여는지도 살펴봐.',
    action:'다시 보고 싶다면 둘이 나눴던 이야기로 안부를 건네 봐.',
    evidence_refs:['W:love'],
  }
  const data={clusters:{relationship:{love_general:primary}}}
  const calculation={period:{start:date,end:date},western:{overall:{연애:{average:53,band:'보통'}}}}
  const read=calc=>buildDailyReadingDocument(data,date,field,true,calc)
  const day=read(calculation)
  assert.equal(day.state,'ready')
  assert.equal(day.headline,primary.conclusion)
  assert.deepEqual(day.blocks.map(block=>block.text),[primary.real_scene,primary.action])
  for (const period of [{start:'2026-11-10',end:'2026-11-10'},{start:'2026-11-09',end:'2026-11-15'}]) {
    const other=read({...calculation,period})
    assert.deepEqual(other.blocks.map(block=>block.text),[primary.real_scene,primary.action])
    assert.ok(!other.details.some(block=>block.id.startsWith('application:')))
  }
})

test('daily editorial layer owns a consistent readable scale and loads after reunion polish',()=>{
  assert.match(css,/\.daily-reading-topic > b[\s\S]*font-size: 17px/)
  assert.match(css,/line-height: 1\.76/)
  assert.ok(main.indexOf("import './daily-reading-quality-v75.css'")>main.indexOf("import './reunion-quality-v74.css'"))
})
