import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source=readFileSync(fileURLToPath(new URL('../SystemReadingViews.tsx',import.meta.url)),'utf8')

test('Thai life cards show everyday guidance before calculation evidence',()=>{
  const meaning=source.indexOf('{lens.meaning}')
  const practice=source.indexOf('{lens.action}')
  const evidence=source.indexOf('thaiPlacementComparison(r,view.natalWheel')
  assert.ok(meaning>0 && practice>meaning && evidence>practice)
  assert.match(source,/thaiLensForTopic\(r.bhumi_key,topic\)/)
})

test('Thai disclosures do not use plus or x symbols that look like good and bad marks',()=>{
  assert.doesNotMatch(source,/aria-hidden="true">＋/)
  assert.doesNotMatch(source,/태국점성술[\s\S]*>×</)
  assert.match(source,/kind="reason">\{thaiPlacementComparison\(r,view\.natalWheel,isNatalWheel\)/)
})

test('single-day annual placement is labelled as the selected date instead of a fake one-day year',()=>{
  assert.match(source,/thaiPeriodLabel\(w\.start,w\.end\)/)
  assert.match(source,/w\.start===w\.end\?w\.start/)
})