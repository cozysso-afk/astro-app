import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const exporter = readFileSync(new URL('./readingImageExport.ts', import.meta.url), 'utf8')
const panel = readFileSync(new URL('../RelationshipInterpretationPanel.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../reading-image-export.css', import.meta.url), 'utf8')

test('reading export renders bounded multi-page PNGs instead of one giant screenshot', () => {
  assert.match(exporter, /PAGE_WIDTH = 1080/)
  assert.match(exporter, /PAGE_HEIGHT = 1440/)
  assert.match(exporter, /canvas\.toBlob/)
  assert.match(exporter, /new File\(/)
  assert.match(exporter, /navigator\.share/)
  assert.match(exporter, /navigator\.canShare/)
  assert.match(exporter, /anchor\.download = file\.name/)
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
