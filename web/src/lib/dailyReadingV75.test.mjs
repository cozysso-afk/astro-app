import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const home=readFileSync(new URL('../HomeControls.tsx',import.meta.url),'utf8')
const panel=readFileSync(new URL('../PeriodAiInterpretationPanel.tsx',import.meta.url),'utf8')
const css=readFileSync(new URL('../daily-reading-quality-v75.css',import.meta.url),'utf8')
const main=readFileSync(new URL('../main.tsx',import.meta.url),'utf8')

test('selected fortune date and actual today stay separate and explicitly labeled',()=>{
  assert.match(home,/선택한 운세일/)
  assert.match(home,/<span>오늘<\/span>\{shortKoreanDate\(now\)\}/)
  assert.match(home,/onClick=\{\(\)=>onQueryDateChange\(resetDate\)\}/)
})

test('daily reading leads with an honest domain score and unfolds two full explanations',()=>{
  assert.match(panel,/오늘 가장 두드러진 분야/)
  assert.match(panel,/분야별 상대 활성도 · 사건이 생길 확률은 아님/)
  assert.match(panel,/userSummary\.focusTopics\.indexOf\(item\)<2\?<div className="daily-reading-topic-depth"/)
  assert.match(panel,/결론부터 현실 장면까지/)
})

test('daily editorial layer owns a consistent readable scale and loads after reunion polish',()=>{
  assert.match(css,/\.daily-reading-topic > b[\s\S]*font-size: 17px/)
  assert.match(css,/line-height: 1\.76/)
  assert.ok(main.indexOf("import './daily-reading-quality-v75.css'")>main.indexOf("import './reunion-quality-v74.css'"))
})
