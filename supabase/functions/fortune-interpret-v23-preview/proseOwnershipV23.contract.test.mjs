import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import './proseGoldenRegressionV1.test.mjs'
import { buildAuthoredTopicAnalysisOnly } from './editorialPolishV23.ts'

const index=fs.readFileSync(new URL('./index.ts',import.meta.url),'utf8')
const polish=fs.readFileSync(new URL('./editorialPolishV23.ts',import.meta.url),'utf8')
const stabilizer=fs.readFileSync(new URL('../fortune-interpret-v21-preview/costGuardV21.ts',import.meta.url),'utf8')
const frontend=fs.readFileSync(new URL('../../../web/src/lib/fortuneEditorialV3.ts',import.meta.url),'utf8')
const narrative=fs.readFileSync(new URL('../../../web/src/PeriodFortuneNarrativeV2.tsx',import.meta.url),'utf8')

test('normal V23 path gives authored clusters prose ownership',()=>{
  assert.match(index,/topic_analysis:buildAuthoredTopicAnalysisOnly\(core,buildDeterministicTopicAnalysis\(payload\),payload\)/)
  assert.match(polish,/export function buildAuthoredTopicAnalysisOnly/)
  assert.match(polish,/export function mergeAuthoredTopicAnalysis/)
  assert.match(polish,/conclusion\.length>=12\?\{verdict:/)
  assert.match(polish,/scene\.length>=12\?\{reason:/)
  assert.doesNotMatch(index,/topic_analysis:buildDeterministicTopicAnalysis\(payload\)}/)
  assert.doesNotMatch(index,/stabilizeCoreForQuality\(withTopics,payload\)/)
  assert.doesNotMatch(index,/polishV23EditorialDepth\(data,payload\)/)
  assert.doesNotMatch(index,/buildLocalQualityFallbackCore\(payload\)/)
})

test('single-author projection never leaks deterministic fallback prose',()=>{
  const deterministic=[{
    topic:'직장',importance:'핵심',verdict:'서버 결론',reason:'서버 이유',timing:'서버 시기',
    action:'서버 행동',avoid:'서버 주의',confidence:'높음',confidence_reason:'서버 확신',evidence_refs:['W:work'],
  }]
  const missing=buildAuthoredTopicAnalysisOnly({clusters:{}},deterministic,{evidence_ledger:[{id:'W:work'}]})
  assert.equal(missing['직장'].verdict,'')
  assert.equal(missing['직장'].reason,'')
  assert.equal(missing['직장'].action,'')
  assert.equal(missing['직장'].confidence_reason,'')

  const authored=buildAuthoredTopicAnalysisOnly({clusters:{work_study:{work:{
    conclusion:'Gemini 결론',real_scene:'Gemini 장면',action:'Gemini 행동',change_condition:'Gemini 조건',
    evidence_refs:['W:work'],applicability:'direct',
  }}}},deterministic,{evidence_ledger:[{id:'W:work'}]})
  assert.equal(authored['직장'].verdict,'Gemini 결론')
  assert.equal(authored['직장'].reason,'Gemini 장면')
  assert.equal(authored['직장'].action,'Gemini 행동')
  assert.equal(authored['직장'].avoid,'Gemini 조건')
})

test('stabilizer preserves grounded authored prose and falls back only when needed',()=>{
  assert.match(stabilizer,/out\.summary=String\(out\?\.summary/)
  assert.match(stabilizer,/data\.overall\.summary=String\(data\.overall\.summary/)
  assert.match(stabilizer,/rr\.context=hasRelationshipAxes\(authoredContext\)\?authoredContext:/)
  assert.match(stabilizer,/rr\.flow=hasRelationshipAxes\(authoredFlow\)\?authoredFlow:/)
  assert.match(stabilizer,/rr\.focus_timing=authoredTimingGrounded\?authoredTiming:/)
  assert.match(stabilizer,/const axisCopy=/)
  assert.match(stabilizer,/authoredContact/)
  assert.match(stabilizer,/ir\.psychology=String\(ir\?\.psychology/)
  assert.match(stabilizer,/unsafeMarketClaim/)
})

test('frontend preserves concise authored blocks instead of discarding them wholesale',()=>{
  const readerFacing=frontend.slice(frontend.indexOf('function readerFacing'),frontend.indexOf('function relationshipPartUsable'))
  assert.doesNotMatch(readerFacing,/TECHNICAL_RE\.test/)
  assert.match(readerFacing,/계산\\s\*/)
  assert.match(narrative,/if \(sentences\.length < 2\) return null/)
  assert.doesNotMatch(narrative,/if \(sentences\.length < 4\) return null/)
})
