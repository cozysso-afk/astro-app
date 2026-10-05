import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const index=fs.readFileSync(new URL('./index.ts',import.meta.url),'utf8')
const polish=fs.readFileSync(new URL('./editorialPolishV23.ts',import.meta.url),'utf8')
const stabilizer=fs.readFileSync(new URL('../fortune-interpret-v21-preview/costGuardV21.ts',import.meta.url),'utf8')
const frontend=fs.readFileSync(new URL('../../../web/src/lib/fortuneEditorialV3.ts',import.meta.url),'utf8')
const narrative=fs.readFileSync(new URL('../../../web/src/PeriodFortuneNarrativeV2.tsx',import.meta.url),'utf8')

test('normal V23 path gives authored clusters prose ownership',()=>{
  assert.match(index,/topic_analysis:mergeAuthoredTopicAnalysis\(core,buildDeterministicTopicAnalysis\(payload\),payload\)/)
  assert.match(polish,/export function mergeAuthoredTopicAnalysis/)
  assert.match(polish,/conclusion\.length>=12\?\{verdict:/)
  assert.match(polish,/scene\.length>=12\?\{reason:/)
  assert.doesNotMatch(index,/topic_analysis:buildDeterministicTopicAnalysis\(payload\)}/)
})

test('stabilizer uses deterministic prose only as a missing-field fallback',()=>{
  assert.match(stabilizer,/out\.summary=String\(out\?\.summary/)
  assert.match(stabilizer,/data\.overall\.summary=String\(data\.overall\.summary/)
  assert.match(stabilizer,/rr\.context=String\(rr\?\.context/)
  assert.match(stabilizer,/authoredContact/)
  assert.match(stabilizer,/ir\.psychology=String\(ir\?\.psychology/)
})

test('frontend preserves concise authored blocks instead of discarding them wholesale',()=>{
  const readerFacing=frontend.slice(frontend.indexOf('function readerFacing'),frontend.indexOf('function relationshipPartUsable'))
  assert.doesNotMatch(readerFacing,/TECHNICAL_RE\.test/)
  assert.match(narrative,/if \(sentences\.length < 2\) return null/)
  assert.doesNotMatch(narrative,/if \(sentences\.length < 4\) return null/)
})
