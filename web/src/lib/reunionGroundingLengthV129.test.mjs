import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const server = fs.readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/index.ts', import.meta.url), 'utf8')

const guard = fs.readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/reunionGroundingV2.ts', import.meta.url), 'utf8')

test('reunion grounding uses structural minimums instead of prose style targets', () => {
  assert.match(server, /validateReunionGroundingV2\(data,payload\)/)
  assert.match(guard, /text\(source\?\.summary\)\.length < 120/)
  assert.match(guard, /text\(value\?\.conclusion\)\.length >= 12 && text\(value\?\.interpretation\)\.length >= 24/)
  for (const section of ['timing','rebuild','repeat_risks'])
    assert.ok(guard.includes(`text(source?.${section}?.conclusion).length < 12`))
  assert.doesNotMatch(guard, /length\s*[<>]=?\s*(?:260|420)/)
})

test('reunion validation failures emit safe stage diagnostics', () => {
  for (const stage of ['single_author_shape','reunion_grounding','grounded','parse_or_validation_exception']) {
    assert.ok(server.includes(`stage:"${stage}"`))
    assert.ok(server.includes(`validationFailure(model,u,"${stage}"`))
  }
  const diagnostics = [...server.matchAll(/console\.warn\(JSON\.stringify\(\{event:"relationship_validation_failed",([^}]+)\}\)\)/g)]
  assert.equal(diagnostics.length, 4)
  for (const [,fields] of diagnostics) assert.doesNotMatch(fields, /rawText|\btxt\b|\bpayload\b|\bdata\b|\bkey\b/)
})
