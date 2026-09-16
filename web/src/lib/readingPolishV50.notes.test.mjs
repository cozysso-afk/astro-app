import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const view = readFileSync(new URL('../SystemReadingViews.tsx', import.meta.url), 'utf8')

test('Western detail remains available through top-level category tabs after overall compaction', () => {
  assert.match(view, /애정:\['연애','연락','재회'\]/)
  assert.match(view, /학업:\['학업','시험'\]/)
  assert.match(view, /직업:\['직장','이직'\]/)
  assert.match(view, /금전:\['금전','투자심리','수익실현','신규진입','투자주의'\]/)
  assert.match(view, /field \|\| topic!=='전체' \? selectedWestern/)
})
