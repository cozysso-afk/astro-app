import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const view = readFileSync(new URL('../SystemReadingViews.tsx', import.meta.url), 'utf8')

test('Western whole view limits the first screen to representative life groups', () => {
  assert.match(view, /const WESTERN_OVERVIEW_GROUPS = \[/)
  assert.match(view, /function representativeWesternRows/)
  assert.match(view, /representativeWesternRows\(selectedWestern\)/)
  assert.match(view, /전체에서는 대표 흐름 6개만 먼저 보여줘/)
  assert.match(view, /westernDisplayRows\.map/)
})

test('Western summary speaks in relative life-language rather than raw band pairs', () => {
  assert.match(view, /function westernOverviewText/)
  assert.match(view, /상대적으로 강하고/)
  assert.match(view, /westernOverviewSummary/)
  assert.doesNotMatch(view, /선택 기간의 강약과 날짜를 읽는 층/)
})
