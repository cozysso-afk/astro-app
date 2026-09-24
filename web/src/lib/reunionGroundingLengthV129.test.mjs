import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const server = fs.readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/index.ts', import.meta.url), 'utf8')

test('reunion grounding uses structural minimums instead of prose style targets', () => {
  assert.match(server, /relationship-v12\.9-grounding-false-negative/)
  assert.match(server, /summary\?\?""\)\.trim\(\)\.length<120/)
  assert.match(server, /whyConclusion\.length<12\|\|whyInterpretation\.length<24/)
  assert.match(server, /timing\?\.conclusion\?\?""\)\.trim\(\)\.length<12/)
  assert.doesNotMatch(server, /summary\?\?""\)\.length<need\(260\)/)
  assert.doesNotMatch(server, /why\.length<need\(420\)/)
})

test('reunion validation failures emit safe stage diagnostics', () => {
  for (const stage of ['shape','reunion_repair','grounded','parse_or_validation_exception']) {
    assert.match(server, new RegExp(`stage:\\"${stage}\\"`))
  }
  assert.doesNotMatch(server, /console\.warn\([^\n]*rawText/)
  assert.doesNotMatch(server, /console\.warn\([^\n]*txt[},]/)
})
