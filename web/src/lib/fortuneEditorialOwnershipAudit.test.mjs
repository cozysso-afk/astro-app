import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const editorial = readFileSync(new URL('./fortuneEditorialV3.ts', import.meta.url), 'utf8')
const narrative = readFileSync(new URL('../PeriodFortuneNarrativeV2.tsx', import.meta.url), 'utf8')
const panel = readFileSync(new URL('../PeriodAiInterpretationPanel.tsx', import.meta.url), 'utf8')
const polish = readFileSync(new URL('./fortuneNarrativePolish.ts', import.meta.url), 'utf8')
const summary = readFileSync(new URL('./fortuneUserSummary.ts', import.meta.url), 'utf8')

test('frontend ownership keeps valid authored prose instead of rejecting whole sections', () => {
  assert.match(editorial, /const TECHNICAL_RE =/)
  assert.doesNotMatch(editorial, /if \(TECHNICAL_RE\.test\(text\)\) return false/)
  assert.match(editorial, /if \(\/계산\\s\*\(\?:엔진\|로직\|threshold\|오브\)/)
  assert.match(editorial, /const value = clean\(topicSectionCopy\(section\)\)/)
  assert.match(editorial, /if \(!readerFacing\(value\)\) return \[\]/)
  assert.doesNotMatch(narrative, /if \(sentences\.length < 4\) return null/)
  assert.match(narrative, /if \(sentences\.length < 2\) return null/)
  assert.match(narrative, /sceneAction: sentences\.length >= 3/)
})

test('frontend ownership still keeps explicit fallbacks and safety/meta filters', () => {
  assert.match(editorial, /function relationshipPartUsable\(/)
  assert.match(editorial, /!TECHNICAL_RE\.test\(text\) && !RELATIONSHIP_META_RE\.test\(text\)/)
  assert.match(panel, /const semanticHero = !westernOnly && \(period === 'today' \|\| period === 'week'\) && !verifiedHero/)
  assert.match(panel, /semanticHero\s*\? userSummary\.headline[\s\S]*verifiedHero \? visibleAiText\(data\.headline\)/)
  assert.match(panel, /verifiedHero[\s\S]*visibleAiText\(data\.overall\.summary\)/)
  assert.match(summary, /const FLOW_COPY:/)
  assert.match(summary, /function topicCopy\(/)
  assert.match(polish, /'오늘은 \$1부터 확인해\.'/)
})

test('frontend ownership path remains observable from stored prose to reader-visible prose', () => {
  assert.match(editorial, /function readerFacing\(/)
  assert.match(editorial, /function topicEditorial\(/)
  assert.match(narrative, /export function focusEditorialParts\(/)
  assert.match(narrative, /buildFortuneEditorialV3/)
  assert.match(panel, /buildFortuneUserSummary/)
  assert.match(panel, /editorialGroupCopy/)
})
