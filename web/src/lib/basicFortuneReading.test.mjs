import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildBasicFortuneReading } from './basicFortuneReading.ts'

const stat = (average, band='보통') => ({average,band,spread:4,best_days:[{date:'2026-09-18',label:'상대적 상위',score:average+4}],caution_days:[{date:'2026-09-20',label:'상대적 하위',score:Math.max(0,average-4)}]})
const calculation = {
  period:{start:'2026-09-16',end:'2026-09-22',day_count:7,month_segments:1},
  western:{
    overall:{금전:stat(64,'좋음'),학업:stat(34,'약함'),직장:stat(52),컨디션:stat(38,'약함'),투자주의:stat(68,'높음')},
    relationship_signals:{연락:stat(58),재회:stat(42)},
    daily_scores:[{date:'2026-09-18',evidence:[{source_topics:['금전'],contribution:4.2,transit:'Venus',target:'Moon',aspect:'trine'}]}],
  },
}

test('basic reading is useful without any AI payload',()=>{
  const reading=buildBasicFortuneReading(calculation,'week')
  assert.match(reading.headline,/금전/)
  assert.ok(reading.favorable.some(row=>row.topic==='금전'))
  assert.ok(reading.caution.some(row=>row.topic==='학업'||row.topic==='컨디션'))
  assert.match(reading.summary,/이유.*활용법.*주의할 점.*시기/)
})

test('visible basic rows carry conclusion reason action caution and timing',()=>{
  const reading=buildBasicFortuneReading(calculation,'week')
  const money=reading.favorable.find(row=>row.topic==='금전')
  assert.ok(money)
  assert.ok(money.meaning.length>10)
  assert.ok(money.nuance.length>20)
  assert.match(money.why,/64점/)
  assert.match(money.why,/금성.*달.*삼분위/)
  assert.ok(money.practice.length>15)
  assert.ok(money.caution.length>15)
  assert.match(money.timing,/2026-09-18/)
})

test('investment caution is never promoted as a favorable high score',()=>{
  const reading=buildBasicFortuneReading(calculation,'week',{id:'investment',label:'주식·투자운',desc:'',topics:['투자주의'],lens:'금전'})
  assert.equal(reading.favorable.length,0)
  assert.equal(reading.caution[0]?.topic,'투자주의')
})

test('period UI keeps Gemini natural language primary and deterministic reading as fallback',()=>{
  const source=readFileSync(new URL('../PeriodFortuneResults.tsx',import.meta.url),'utf8')
  assert.ok(source.indexOf('<PeriodAiInterpretationPanel') < source.indexOf('period-fallback-reading'))
  assert.match(source,/기본 해설 보기/)
  assert.doesNotMatch(source,/계산 기반 보조 해설/)
})
