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
const narrativePolish=fs.readFileSync(new URL('../../../web/src/lib/fortuneNarrativePolish.ts',import.meta.url),'utf8')

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
  assert.equal(authored['직장'].avoid,'')
})

test('single-author metadata cannot claim high confidence or core importance without strong evidence',()=>{
  const deterministic=[{
    topic:'직장',importance:'핵심',confidence:'높음',evidence_refs:['W:work'],
  }]
  const data={clusters:{work_study:{work:{
    conclusion:'Gemini 결론',real_scene:'Gemini 장면',action:'Gemini 행동',change_condition:'Gemini 조건',
    evidence_refs:['W:work'],applicability:'direct',
  }}}}
  const weak=buildAuthoredTopicAnalysisOnly(data,deterministic,{evidence_ledger:[{id:'W:work',system:'western'}]})
  assert.equal(weak['직장'].importance,'주목')
  assert.equal(weak['직장'].confidence,'보통')

  const strong=structuredClone(data)
  strong.clusters.work_study.work.evidence_refs.push('S:work')
  const supported=buildAuthoredTopicAnalysisOnly(strong,deterministic,{evidence_ledger:[
    {id:'W:work',system:'western'},{id:'S:work',system:'saju'},
  ]})
  assert.equal(supported['직장'].importance,'핵심')
  assert.equal(supported['직장'].confidence,'높음')
})

test('relationship salience requires a relationship-direction evidence axis',()=>{
  const deterministic=[{topic:'연애',importance:'핵심',confidence:'높음'}]
  const data={clusters:{relationship:{love_general:{
    conclusion:'Gemini 결론',real_scene:'Gemini 장면',action:'Gemini 행동',change_condition:'Gemini 조건',
    evidence_refs:['W:generic','S:generic'],applicability:'direct',
  }}}}
  const projected=buildAuthoredTopicAnalysisOnly(data,deterministic,{evidence_ledger:[
    {id:'W:generic',system:'western',topic:'대인관계'},
    {id:'S:generic',system:'saju',topic:'대인관계'},
  ]})
  assert.equal(projected['연애'].importance,'참고')
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
  assert.match(narrative,/buildPeriodReadingDocument/)
  assert.doesNotMatch(narrative,/sentences\.length|sentences\.slice/)
})

test('verified V23 UI projects Gemini prose only and never authors replacement copy',async()=>{
  const {buildPeriodReadingDocument}=await import('../../../web/src/lib/authoredReadingDocument.ts')
  const source={headline:'작성된 제목',overall:{summary:'작성된 첫 문장. 중간의 중요한 부정 조건. 마지막 문장.',dominant_pattern:'작성된 이유',evidence_refs:['W:1']},clusters:{}}
  const hidden=buildPeriodReadingDocument(source,'week','2026-11-01','2026-11-07',undefined,false)
  assert.equal(hidden.state,'unverified');assert.equal(hidden.headline,'');assert.deepEqual(hidden.core,[])
  const visible=buildPeriodReadingDocument(source,'week','2026-11-01','2026-11-07',undefined,true)
  assert.equal(visible.headline,source.headline)
  assert.equal(visible.core.find(b=>b.id==='overall:summary').text,source.overall.summary)
  assert.match(narrative,/result\.provenance_verified === true/)
  assert.doesNotMatch(narrative,/firstSentences|compactEditorialCopy|authoredSummaryOnly/)
})
