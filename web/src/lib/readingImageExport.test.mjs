import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const exporter = readFileSync(new URL('./readingImageExport.ts', import.meta.url), 'utf8')
const relationshipPanel = readFileSync(new URL('../RelationshipInterpretationPanel.tsx', import.meta.url), 'utf8')
const periodPanel = readFileSync(new URL('../PeriodFortuneResults.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../reading-image-export.css', import.meta.url), 'utf8')

test('reading export renders iPhone-readable 4:5 multi-page PNGs instead of one giant screenshot', () => {
  assert.match(exporter, /PAGE_WIDTH = 1206/)
  assert.match(exporter, /PAGE_HEIGHT = 1508/)
  assert.match(exporter, /size: 48/)
  assert.match(exporter, /size: 50/)
  assert.match(exporter, /#fff6bf/)
  assert.match(exporter, /canvas\.toBlob/)
  assert.match(exporter, /new File\(/)
  assert.match(exporter, /navigator\.share/)
  assert.match(exporter, /navigator\.canShare/)
  assert.match(exporter, /anchor\.download = file\.name/)
})

test('relationship result exposes image save and excludes its toolbar from exported content', () => {
  assert.match(relationshipPanel, /exportReadingImages/)
  assert.match(relationshipPanel, /data-reading-export-root="relationship"/)
  assert.match(relationshipPanel, /data-reading-export-ignore="true"/)
  assert.match(relationshipPanel, /결과 이미지 저장/)
  assert.match(relationshipPanel, /이미지 만드는 중/)
})

test('daily weekly monthly annual results all expose the same PNG export path', () => {
  assert.match(periodPanel, /exportReadingImages/)
  assert.match(periodPanel, /ref=\{exportRef\}/)
  assert.match(periodPanel, /PNG 저장/)
  assert.match(periodPanel, /오늘 운세/)
  assert.match(periodPanel, /주간 운세/)
  assert.match(periodPanel, /월간 운세/)
  assert.match(periodPanel, /연간 운세/)
  assert.match(periodPanel, /data-reading-export-ignore="true"/)
})

test('love result exposes all supported relationship contexts instead of collapsing love into contact', () => {
  assert.match(periodPanel, /loveStatus==='single'/)
  assert.match(periodPanel, /loveStatus==='flirting'/)
  assert.match(periodPanel, /loveStatus==='intimate_uncommitted'/)
  assert.match(periodPanel, /loveStatus==='couple'/)
  assert.match(periodPanel, /솔로 · 새 인연/)
  assert.match(periodPanel, /썸 · 알아가는 중/)
  assert.match(periodPanel, /친밀하지만 관계 미정/)
  assert.match(periodPanel, /커플 · 현재 관계/)
})

test('image export control is mobile-safe and reduced-motion aware', () => {
  assert.match(css, /min-height:\s*44px/)
  assert.match(css, /@media \(max-width: 640px\)/)
  assert.match(css, /width:\s*100%/)
  assert.match(css, /prefers-reduced-motion:\s*reduce/)
})
