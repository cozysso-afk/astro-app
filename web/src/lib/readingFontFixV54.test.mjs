import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../reading-font-fix-v54.css', import.meta.url), 'utf8')

test('live mobile integrated headline uses the final Myeongjo owner', () => {
  assert.match(css, /\.system-reading\.system-integrated[\s\S]*?h3\.period-ai-hero-title-v4/)
  assert.match(css, /font-family:\s*'Nanum Myeongjo', 'Noto Serif KR', 'AppleMyungjo', 'Batang', serif\s*!important/)
  assert.match(css, /font-weight:\s*700\s*!important/)
  assert.match(css, /font-synthesis:\s*none\s*!important/)
  assert.match(css, /\.period-ai-head \.reading-hero-subtitle[\s\S]*font-family:\s*-apple-system/)
  assert.match(css, /\.period-ai-head \.reading-hero-subtitle[\s\S]*font-weight:\s*400\s*!important/)
})

test('compatibility hero stays compact and uses the full text column on mobile', () => {
  assert.match(css, /relationship-experience\[data-mode="compatibility"\] \.reading-hero\s*\{[\s\S]*?min-height:\s*0\s*!important/)
  assert.match(css, /relationship-experience\[data-mode="compatibility"\] \.reading-hero \.celestial-mark\s*\{[\s\S]*?position:\s*absolute\s*!important/)
  assert.match(css, /relationship-experience\[data-mode="compatibility"\] \.reading-hero h3\s*\{[\s\S]*?font-size:\s*17px\s*!important/)
  assert.match(css, /relationship-experience\[data-mode="compatibility"\] \.reading-hero h3\s*\{[\s\S]*?max-width:\s*none\s*!important/)
})

test('reunion mode row cannot wobble horizontally and relationship loader does not transform on iOS', () => {
  assert.match(css, /\.relationship-main-mode-row\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)\s*!important/)
  assert.match(css, /\.relationship-main-mode-row\s*\{[\s\S]*?overflow-x:\s*hidden\s*!important/)
  assert.match(css, /\.relationship-main-mode-row\s*\{[\s\S]*?touch-action:\s*pan-y\s*!important/)
  assert.match(css, /\.relationship-main-mode-row\s*~\s*\.primary-button \.spin\s*\{[\s\S]*?animation:\s*none\s*!important/)
  assert.match(css, /\.relationship-main-mode-row\s*~\s*\.primary-button \.spin\s*\{[\s\S]*?transform:\s*none\s*!important/)
})

test('font fix is the final stylesheet owner so older reading CSS cannot override it', () => {
  const imports = [...main.matchAll(/import ['"]\.\/([^'"]+\.css)['"]/g)].map(match => match[1])
  assert.equal(imports.at(-1), 'reading-font-fix-v54.css')
  assert.ok(imports.indexOf('reading-experience.css') < imports.indexOf('reading-font-fix-v54.css'))
})