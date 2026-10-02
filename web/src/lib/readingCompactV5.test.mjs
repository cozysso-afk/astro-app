import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const flow = readFileSync(new URL('../FortuneFlowCards.tsx', import.meta.url), 'utf8')
const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../reading-compact-v5.css', import.meta.url), 'utf8')
const captureCss = readFileSync(new URL('../reading-capture-polish-v6.css', import.meta.url), 'utf8')
const runtime = readFileSync(new URL('./readingPresentationV5.ts', import.meta.url), 'utf8')
const exporter = readFileSync(new URL('./readingImageExport.ts', import.meta.url), 'utf8')

test('top flow cards are a compact screen index and no longer duplicate saved-image cards', () => {
  assert.match(flow, /flow-summary-section-v5/)
  assert.match(flow, /data-reading-export-ignore="true"/)
  assert.doesNotMatch(flow, /className={`flow-section/)
  assert.match(exporter, /querySelectorAll<HTMLElement>\('\.flow-section'\)/)
})

test('primary topic cards expose deeper why timing and caution layers without opening every topic', () => {
  assert.match(runtime, /topics\.slice\(0, 2\)/)
  assert.match(runtime, /details\.open = true/)
  assert.match(runtime, /reading-topic-depth/)
  assert.match(main, /installReadingPresentationV5\(\)/)
})

test('saved image receives one dense evidence sentence before direct action copy', () => {
  assert.match(runtime, /reading-reason-more > p/)
  assert.match(runtime, /reading-explanation\.is-reason > p/)
  assert.match(runtime, /reading-explanation\.is-timing > p/)
  assert.match(runtime, /reading-explanation\.is-caution > p/)
  assert.match(runtime, /primaryReason = technical \|\| reason/)
  assert.match(runtime, /reading-export-depth-v5/)
  assert.match(runtime, /insertBefore\(paragraph, firstDirectParagraph/)
  assert.match(css, /reading-export-depth-v5[\s\S]*position:\s*absolute/)
  assert.match(exporter, /const body = \[detail, \.\.\.paragraphs\]/)
})

test('mobile vertical density keeps only suitable secondary cards in horizontal lanes', () => {
  assert.match(css, /\.system-overview-grid[\s\S]*overflow-x:\s*auto/)
  assert.match(css, /period-ai-relationship-section \.reading-direction-panel[\s\S]*overflow-x:\s*auto/)
  assert.match(css, /\.reunion-ui-v3 \.reunion-v3-grid[\s\S]*overflow-x:\s*auto/)
  assert.match(css, /\.flow-summary-section-v5 \.flow-tile > p[\s\S]*display:\s*none/)
  assert.match(captureCss, /reunion-v3-situations[\s\S]*display:\s*grid/)
  assert.match(captureCss, /reunion-v3-situations[\s\S]*overflow:\s*visible/)
})

test('horizontal system and reunion cards keep their intrinsic mobile height', () => {
  assert.match(main, /reading-capture-polish-v6\.css[\s\S]*viewport-background-v60\.css[\s\S]*reading-font-fix-v54\.css/)
  assert.match(captureCss, /system-overview-grid[\s\S]*align-items:\s*flex-start/)
  assert.match(captureCss, /system-overview-grid > article[\s\S]*height:\s*auto[\s\S]*min-height:\s*0/)
  assert.match(captureCss, /reunion-v3-meaning[\s\S]*align-items:\s*flex-start/)
  assert.match(captureCss, /reunion-v3-meaning > \.reunion-v3-card[\s\S]*height:\s*auto/)
  assert.match(captureCss, /reunion-v3-situations > \.reunion-v3-situation[\s\S]*height:\s*auto/)
})
