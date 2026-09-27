import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const exporter = readFileSync(new URL('./readingImageExport.ts', import.meta.url), 'utf8')
const panel = readFileSync(new URL('../RelationshipInterpretationPanel.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../reading-image-export.css', import.meta.url), 'utf8')

test('period fortune export uses a structured iPhone-friendly card renderer instead of raw DOM pagination', () => {
  assert.match(exporter, /PAGE_WIDTH = 1206/)
  assert.match(exporter, /PAGE_HEIGHT = 1508/)
  assert.match(exporter, /collectPeriodExportModel/)
  assert.match(exporter, /renderPeriodPages/)
  assert.match(exporter, /오늘 핵심/)
  assert.match(exporter, /한눈에 보는 흐름/)
  assert.match(exporter, /분야별 핵심/)
  assert.match(exporter, /기억할 시기/)
  assert.match(exporter, /data\.readingExportRoot === 'period-fortune'|dataset\.readingExportRoot === 'period-fortune'/)
  assert.match(exporter, /점수는 상대적 강도이며 사건 확률이 아님/)
  assert.match(exporter, /canvas\.toBlob/)
  assert.match(exporter, /new File\(/)
  assert.match(exporter, /navigator\.share/)
  assert.match(exporter, /navigator\.canShare/)
  assert.match(exporter, /anchor\.download=file\.name|anchor\.download = file\.name/)
})

test('period export groups heading and content inside cards rather than drawing empty highlight bars', () => {
  assert.match(exporter, /drawCard/)
  assert.match(exporter, /drawFlow/)
  assert.match(exporter, /drawTopic/)
  assert.match(exporter, /drawDate/)
  assert.doesNotMatch(exporter, /drawHighlight\(/)
})

test('relationship result exposes image save and excludes its toolbar from exported content', () => {
  assert.match(panel, /exportReadingImages/)
  assert.match(panel, /data-reading-export-root="relationship"/)
  assert.match(panel, /data-reading-export-ignore="true"/)
  assert.match(panel, /결과 이미지 저장/)
  assert.match(panel, /이미지 만드는 중/)
})

test('image export control is mobile-safe and reduced-motion aware', () => {
  assert.match(css, /min-height:\s*44px/)
  assert.match(css, /@media \(max-width: 640px\)/)
  assert.match(css, /width:\s*100%/)
  assert.match(css, /prefers-reduced-motion:\s*reduce/)
})
