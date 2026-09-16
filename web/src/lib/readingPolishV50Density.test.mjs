import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const view = readFileSync(new URL('../SystemReadingViews.tsx', import.meta.url), 'utf8')

test('overall Western reading has six semantic groups rather than fifteen raw fields', () => {
  const block = view.slice(view.indexOf('const WESTERN_OVERVIEW_GROUPS'), view.indexOf('const SAJU_LEAD_COPY'))
  const groups = (block.match(/^\s*\[/gm) || []).length
  assert.equal(groups, 6)
})
