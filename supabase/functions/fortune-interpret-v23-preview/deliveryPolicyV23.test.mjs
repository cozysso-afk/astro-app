import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildProviderCoreSchema } from './providerSchemaV23.ts'
import { inspectPeriodReading, inspectPeriodProviderDocument, PERIOD_PRIMARY_KEYS } from './periodReadingContractV1.ts'
import { SCHEMA } from '../fortune-interpret-v6-preview/integratedInterpretationV2.ts'
import { inspectInterpretationQuality } from '../fortune-interpret-v6-preview/qualityV2.ts'

const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')

test('V23 validates Gemini prose without deterministic rewriting or local long-form fallback', () => {
  assert.doesNotMatch(source, /repairInterpretationQuality\(data,payload\)/)
  assert.doesNotMatch(source, /post_quality_repair/)
  assert.match(source, /const quality=applyDailyEditorialGate\(inspectInterpretationQuality\(data,payload,\{requireDailyTimedDecision:false,allowEmptyDailyChangeCondition:true,periodReadingContract:true\}\),dailyEditorial\)/)
  assert.match(source, /post_quality_validation/)
  assert.doesNotMatch(source, /buildLocalQualityFallbackCore\(payload\)/)
  assert.doesNotMatch(source, /allow_degraded_quality/)
  assert.match(source, /safe_summary_required:true/)
  assert.match(source, /if\(first\.ok&&payload\?\.period_kind!=="day"\)return \{\.\.\.first,attempt_count:budget\.used,call_trace:budget\.calls\}/)
})


test('daily starts with the reviewed model while longer periods retain their existing default', () => {
  assert.match(source, /const V23_DEFAULT_MODEL="gemini-3\.6-flash"/)
  assert.match(source, /const preferred=MODELS\[b\.model\]\?b\.model:compacted\.period_kind==="day"\?"gemini-3\.7-flash":V23_DEFAULT_MODEL/)
})

test('period retries do not invent windows or force every optional contact detail', () => {
  const schema=buildProviderCoreSchema(SCHEMA,'annual')
  assert.equal(schema.properties.year_phases.minItems,0)
  assert.equal(schema.properties.key_windows.minItems,0)
  const p={period_kind:'annual',period:{start:'2026-01-01',end:'2026-12-31'},evidence_ledger:[{id:'contact',topic:'연락',date:'2026-02-01'}]}
  const core={clusters:PERIOD_PRIMARY_KEYS.map(key=>({key,applicability:'insufficient',conclusion:'',real_scene:'',action:'',change_condition:'',evidence_refs:[]}))}
  assert.equal(inspectPeriodProviderDocument(core,'annual',p).issues.some(i=>i.path==='clusters.relationship.contact_activation'),false)
})

test('relationship focus dates require direct relationship timing evidence', () => {
  const p={period_kind:'week',period:{start:'2026-09-14',end:'2026-09-20'},evidence_ledger:[{id:'work',topic:'직장',date:'2026-09-15'},{id:'relationship',topic:'연락',date:'2026-09-15'},{id:'range',topic:'연락',start:'2026-09-14',end:'2026-09-20'}]}
  const d={relationship_reading:{focus_timing:'2026-09-15',evidence_refs:['work','range']}}
  assert.ok(inspectPeriodReading(d,p).issues.some(i=>i.code==='relationship_date_without_direct_relationship_evidence'))
  d.relationship_reading.evidence_refs=['relationship']
  assert.equal(inspectPeriodReading(d,p).issues.some(i=>i.code==='relationship_date_without_direct_relationship_evidence'),false)
  assert.equal(inspectInterpretationQuality(d,p).stages[1].issues.some(i=>i.includes('주목 날짜')),false)
})

test('sparse omissions remain non-authored metadata instead of failing prose ownership', () => {
  const quality = readFileSync(new URL('../fortune-interpret-v6-preview/qualityV2.ts', import.meta.url), 'utf8')
  const projection = readFileSync(new URL('./editorialPolishV23.ts', import.meta.url), 'utf8')
  assert.match(quality, /if\(mode==="insufficient"\)continue/)
  assert.match(quality, /if\(importance==="참고"&&!authoredTopic\)continue/)
  assert.match(projection, /const importance=authored\?groundedImportance:'참고'/)
  assert.match(projection, /const confidence=authored\?.*:'낮음'/)
})

test('V23 provenance is derived from stored successful calls and the stored generation version', () => {
  assert.match(source, /generation_version:VERSION/)
  assert.match(source, /function verifiedGeminiJob\(data:any\)/)
  assert.match(source, /trace\.some\(\(row:any\)=>Number\(row\?\.http_status\)>=200/)
  assert.match(source, /stages\.length===6&&stages\.every/)
  assert.match(source, /provenance_verified:provenanceVerified/)
})
