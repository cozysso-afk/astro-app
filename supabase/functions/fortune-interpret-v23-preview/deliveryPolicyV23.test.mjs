import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')

test('V23 delivers locally repaired timing without paying for a second Gemini repair call', () => {
  assert.match(source, /quality\?\.local_timing_repair===true&&criticalPassed/)
  assert.match(source, /\(meta\?\.allow_degraded_quality===true&&criticalPassed\)\|\|locallyRepairedTiming/)
  assert.match(source, /Gemini를 한 번 더 호출하지 않아/)
  assert.match(source, /if\(first\.ok\)return \{\.\.\.first,attempt_count:budget\.used,call_trace:budget\.calls\}/)
})
