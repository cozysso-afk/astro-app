import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const editorial = readFileSync(new URL('./fortuneEditorialV3.ts', import.meta.url), 'utf8')
const narrative = readFileSync(new URL('../PeriodFortuneNarrativeV2.tsx', import.meta.url), 'utf8')
const panel = readFileSync(new URL('../PeriodAiInterpretationPanel.tsx', import.meta.url), 'utf8')
const polish = readFileSync(new URL('./fortuneNarrativePolish.ts', import.meta.url), 'utf8')
const summary = readFileSync(new URL('./fortuneUserSummary.ts', import.meta.url), 'utf8')

test('frontend ownership audit pins current prose replacement and rejection gates', () => {
  assert.match(editorial, /const TECHNICAL_RE =/)
  assert.match(editorial, /if \(TECHNICAL_RE\.test\(text\)\) return false/)
  assert.match(narrative, /if \(sentences\.length < 4\) return null/)
  assert.match(panel, /const semanticHero = !westernOnly && \(period === 'today' \|\| period === 'week'\)/)
  assert.match(panel, /semanticHero\s*\? userSummary\.headline/)
  assert.match(summary, /const FLOW_COPY:/)
  assert.match(summary, /function topicCopy\(/)
  assert.match(polish, /'오늘은 \$1부터 확인해\.'/)
})

test('frontend ownership audit documents why stored prose alone cannot prove reader-visible prose', () => {
  assert.match(editorial, /function readerFacing\(/)
  assert.match(editorial, /function topicEditorial\(/)
  assert.match(narrative, /export function focusEditorialParts\(/)
  assert.match(narrative, /buildFortuneEditorialV3/)
  assert.match(panel, /buildFortuneUserSummary/)
  assert.match(panel, /editorialGroupCopy/)
})
