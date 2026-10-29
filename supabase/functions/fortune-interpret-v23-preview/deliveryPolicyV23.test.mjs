import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')

test('V23 validates Gemini prose without deterministic rewriting or local long-form fallback', () => {
  assert.doesNotMatch(source, /repairInterpretationQuality\(data,payload\)/)
  assert.doesNotMatch(source, /post_quality_repair/)
  assert.match(source, /const quality=inspectInterpretationQuality\(data,payload\)/)
  assert.match(source, /post_quality_validation/)
  assert.doesNotMatch(source, /buildLocalQualityFallbackCore\(payload\)/)
  assert.doesNotMatch(source, /allow_degraded_quality/)
  assert.match(source, /safe_summary_required:true/)
  assert.match(source, /if\(first\.ok\)return \{\.\.\.first,attempt_count:budget\.used,call_trace:budget\.calls\}/)
})


test('V23 starts with the model that leaves a second call for semantic quality rewrite', () => {
  assert.match(source, /const V23_DEFAULT_MODEL="gemini-3\.6-flash"/)
  assert.match(source, /const preferred=MODELS\[b\.model\]\?b\.model:V23_DEFAULT_MODEL/)
})

test('V23 completion recovery makes the response sparse instead of lowering its token ceiling', () => {
  assert.match(source, /const clusterLimit=compact\?6:10/)
  assert.match(source, /실제 근거로 직접 해설할 수 있는 key만 sparse 배열/)
  assert.match(source, /서버가 생략 key를 빈 insufficient 상태로 채운다/)
  assert.match(source, /coreInstruction\(fullPayload\?\.period_kind,compact\)/)
  assert.doesNotMatch(source, /정확히 \$\{EDITORIAL_SECTION_KEYS\.length\}개의 배열 항목/)
})

test('relationship focus dates require direct relationship timing evidence', () => {
  assert.match(source, /relationship_reading\.focus_timing은 relationship_reading\.evidence_refs를 먼저 고른 뒤/)
  assert.match(source, /그 근거 행의 date와 정확히 같은 날짜만 써/)
  assert.match(source, /start\/end 구간이나 다른 분야 근거 날짜는 관계 주목 날짜로 쓰지 마/)
  assert.match(source, /date가 있는 직접 관계 근거가 없으면 모든 정확한 날짜를 빼고/)
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
