import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')

test('V23 applies targeted timing repair before pure validation without paying for a second Gemini call', () => {
  assert.match(source, /const qualityRepair=repairInterpretationQuality\(data,payload\)/)
  assert.match(source, /post_quality_repair/)
  assert.match(source, /const quality=inspectInterpretationQuality\(data,payload\)/)
  assert.match(source, /post_quality_validation/)
  assert.match(source, /qualityRepair\?\.timing_repair===true&&criticalPassed/)
  assert.match(source, /\((?:meta|resultMeta)\?\.allow_degraded_quality===true&&criticalPassed\)\|\|locallyRepairedTiming/)
  assert.match(source, /Gemini를 한 번 더 호출하지 않아/)
  assert.match(source, /if\(first\.ok\)return \{\.\.\.first,attempt_count:budget\.used,call_trace:budget\.calls\}/)
})
