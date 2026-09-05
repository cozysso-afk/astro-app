import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')

test('relationship cost-guard job states match ai_interpret_jobs database contract', () => {
  assert.match(source, /status:\"queued\"/)
  assert.match(source, /cached\?\.status===\"queued\"\|\|cached\?\.status===\"running\"/)
  assert.doesNotMatch(source, /status:\"pending\"/)
  assert.doesNotMatch(source, /cached\?\.status===\"pending\"/)
})
