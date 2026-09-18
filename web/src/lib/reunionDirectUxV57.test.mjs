import { readFileSync } from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

const panel = readFileSync(new URL('../RelationshipInterpretationPanel.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../reunion-direct-ux-v57.css', import.meta.url), 'utf8')
const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')

test('reunion starts with direction, first-mover comparison, and timing', () => {
  assert.match(panel, /재회 핵심 · 연락 방향과 재접점/)
  assert.match(panel, /상대 → 나/)
  assert.match(panel, /나 → 상대/)
  assert.match(panel, /과거 인연 재접점/)
  assert.match(panel, /directionLead/)
  assert.match(panel, /주목 시기/)
  assert.match(panel, /사건 확률은 아니야/)
})

test('Gemini reunion result is rendered by direction instead of one generic paragraph', () => {
  assert.match(panel, /reunion-ai-direction-grid/)
  assert.match(panel, /incoming_contact/)
  assert.match(panel, /outgoing_contact/)
  assert.match(panel, /재접점 · 시기/)
  assert.match(panel, /연락 이후 관계 회복을 볼 기준/)
})

test('reunion mobile surface cannot widen the document and fallback sections are spaced', () => {
  assert.match(css, /relationship-experience\[data-mode='reunion'\][\s\S]*overflow-x:\s*clip/)
  assert.match(css, /relationship-calculated-fallback\[open\][\s\S]*margin-top:\s*24px/)
  assert.match(css, /reading-heading-with-badges[\s\S]*flex-wrap:\s*wrap/)
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*overscroll-behavior-x:\s*none/)
  assert.match(main, /import '\.\/reunion-direct-ux-v57\.css'/)
  assert.ok(main.indexOf("reunion-direct-ux-v57.css") < main.indexOf("reading-font-fix-v54.css"))
})
