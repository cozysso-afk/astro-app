import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const flow = readFileSync(new URL('../FortuneFlowCards.tsx', import.meta.url), 'utf8')
const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../reading-compact-v5.css', import.meta.url), 'utf8')
const runtime = readFileSync(new URL('./readingPresentationV5.ts', import.meta.url), 'utf8')
const exporter = readFileSync(new URL('./readingImageExport.ts', import.meta.url), 'utf8')

test('top flow cards are a compact screen index and no longer duplicate saved-image cards', () => {
  assert.match(flow, /flow-summary-section-v5/)
  assert.match(flow, /data-reading-export-ignore="true"/)
  assert.doesNotMatch(flow, /className={`flow-section/)
  assert.match(exporter, /querySelectorAll<HTMLElement>\('\.flow-section'\)/)
})

test('primary topic cards expose deeper why/timing/caution layers without opening every topic', () => {
  assert.match(runtime, /topics\.slice\(0, 2\)/)
  assert.match(runtime, /details\.open = true/)
  assert.match(runtime, /reading-topic-depth/)
  assert.match(main, /installReadingPresentationV5\(\)/)
})

test('mobile vertical density moves secondary system and reunion cards into horizontal lanes', () => {
  assert.match(css, /\.system-overview-grid[\s\S]*overflow-x:\s*auto/)
  assert.match(css, /\.reunion-ui-v3 \.reunion-v3-grid[\s\S]*overflow-x:\s*auto/)
  assert.match(css, /\.reunion-ui-v3 \.reunion-v3-situations[\s\S]*overflow-x:\s*auto/)
  assert.match(css, /\.flow-summary-section-v5 \.flow-tile > p[\s\S]*display:\s*none/)
})
