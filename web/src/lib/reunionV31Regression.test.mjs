import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const birthplace = readFileSync(new URL('../koreaBirthplaces.tsx', import.meta.url), 'utf8')
const fontCss = readFileSync(new URL('../reading-font-fix-v54.css', import.meta.url), 'utf8')
const panel = readFileSync(new URL('../ReunionHierarchyPanel.tsx', import.meta.url), 'utf8')

test('birthplace chooser avoids native select and preserves rendered relationship results', () => {
  assert.match(birthplace, /createPortal/)
  assert.match(birthplace, /function LocationChoice/)
  assert.match(birthplace, /shouldPreserveRenderedResults/)
  assert.match(birthplace, /document\.querySelector\('\.results-wrap'\)/)
  assert.match(birthplace, /Object\.assign\(value, next\)/)
  assert.match(birthplace, /stagedSelectionRef/)
  assert.match(birthplace, /stagedValueRef/)
  assert.match(birthplace, /sameBirthplaceValue/)
  assert.match(birthplace, /if \(stagedSelectionRef\.current\) return/)
  assert.match(birthplace, /selection: \{ region: string; district: string \}/)
  assert.match(birthplace, /\{ region: nextRegion, district: '' \}/)
  assert.match(birthplace, /className="stable-choice-trigger"/)
  assert.doesNotMatch(birthplace, /<select\b/)
})

test('reunion consultation prose uses one serif family while headings and controls stay separate', () => {
  assert.match(fontCss, /relationship-experience\[data-mode="reunion"\] \.reunion-story-section > p/)
  assert.match(fontCss, /relationship-experience\[data-mode="reunion"\] \.reunion-behavior-guide > p/)
  assert.match(fontCss, /relationship-experience\[data-mode="reunion"\] \.reunion-final-takeaway > p/)
  assert.match(fontCss, /font-family: var\(--reading-display, 'Noto Serif KR', 'AppleMyungjo', 'Batang', serif\) !important/)
})

test('main reunion reader never exposes internal stage identifiers', () => {
  assert.match(panel, /normalizeReaderLanguage/)
  for (const id of ['emotional_reactivation','contact_recontact','in_person_meeting','relationship_rebuilding','initiative_gate']) {
    assert.match(panel, new RegExp(`\\b${id}\\b`))
  }
  assert.match(panel, /const summary = phaseVerdict\(hierarchyData\)/)
  assert.match(panel, /function dedupeTimingWindows/)
  assert.match(panel, /같은 종류의 신호라 날짜마다 서로 다른 사건을 뜻하는 것은 아니야/)
})
