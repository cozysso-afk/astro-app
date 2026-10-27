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
