import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../viewport-background-v60.css', import.meta.url), 'utf8')
const reliability = readFileSync(new URL('../BirthTimeReliabilityFields.tsx', import.meta.url), 'utf8')

test('viewport background is the final visual owner while font fix stays last overall', () => {
  const marker = "import './viewport-background-v60.css'"
  const fontOwner = "import './reading-font-fix-v54.css'"
  assert.ok(main.includes(marker))
  assert.ok(main.indexOf(marker) > main.indexOf("import './reading-experience.css'"))
  assert.ok(main.indexOf(fontOwner) > main.indexOf(marker))
  const imports = [...main.matchAll(/import ['"]\.\/([^'"]+\.css)['"]/g)].map((match) => match[1])
  assert.equal(imports.at(-2), 'viewport-background-v60.css')
  assert.equal(imports.at(-1), 'reading-font-fix-v54.css')
})

test('aurora motion stays on the app surface without fixed pseudo compositing', () => {
  assert.match(css, /body\s*\{[\s\S]*background-image:\s*linear-gradient\(/)
  assert.match(css, /body::before,[\s\S]*body::after[\s\S]*display:\s*none\s*!important/)
  assert.match(css, /\.app-shell\.celestial-motion-on::before,[\s\S]*\.app-shell\.celestial-glow-off::after[\s\S]*display:\s*none\s*!important/)
  assert.doesNotMatch(css, /body::before\s*\{[\s\S]*position:\s*fixed/)
  assert.doesNotMatch(css, /\.app-shell::before\s*\{[\s\S]*position:\s*fixed/)
  assert.match(css, /@keyframes\s+astroAuroraSurfaceDriftV68/)
  assert.match(css, /\.app-shell\.celestial-motion-on[\s\S]*animation:\s*astroAuroraSurfaceDriftV68\s+15s/)
  assert.match(css, /\.app-shell\.celestial-motion-off[\s\S]*animation:\s*none\s*!important/)
  assert.doesNotMatch(css, /background-attachment:\s*fixed/i)
})

test('aurora vertical geometry is invariant to viewport and form height changes', () => {
  assert.doesNotMatch(css, /\b\d+(?:\.\d+)?(?:dvh|svh|lvh|vh)\b/i)
  assert.match(css, /body\s*\{[\s\S]*linear-gradient\(\s*90deg/)
  assert.match(css, /background-position:[\s\S]*-11rem\s+760px[\s\S]*1120px/)
  assert.doesNotMatch(css, /-11rem\s+\d+%/)
  assert.doesNotMatch(css, /calc\(100% \+ 9rem\)\s+\d+%/)
  assert.doesNotMatch(css, /astroAuroraSurfaceDriftV68[\s\S]*transform:/)
  assert.doesNotMatch(css, /astroAuroraSurfaceDriftV68[\s\S]*filter:/)
})

test('birth-time reliability choice does not use native select or force a focus scroll after selection', () => {
  assert.doesNotMatch(reliability, /<select\b/)
  assert.match(reliability, /aria-haspopup="listbox"/)
  assert.match(reliability, /role="listbox"/)
  assert.match(reliability, /onPointerDown=\{\(event\) => event\.preventDefault\(\)\}/)
  assert.doesNotMatch(reliability, /requestAnimationFrame\([\s\S]*focus/)
  assert.match(reliability, /focus\(\{ preventScroll: true \}\)/)
  assert.match(css, /\.stable-choice-menu[\s\S]*background:\s*#fff\s*!important/)
  assert.match(css, /\.stable-choice-menu[\s\S]*-webkit-overflow-scrolling:\s*auto/)
  assert.match(css, /\.stable-choice-menu[\s\S]*backdrop-filter:\s*none\s*!important/)
})

test('birth and location form uses one readable type and control scale', () => {
  assert.match(css, /\.app-shell \.field > span[\s\S]*font-size:\s*14px\s*!important/)
  assert.match(css, /\.app-shell \.field input,[\s\S]*\.app-shell \.stable-choice-trigger[\s\S]*height:\s*52px\s*!important/)
  assert.match(css, /\.app-shell \.field input,[\s\S]*\.app-shell \.stable-choice-trigger[\s\S]*font-size:\s*16px\s*!important/)
  assert.match(css, /\.stable-choice-option[\s\S]*font-size:\s*16px\s*!important/)
  assert.match(css, /\.app-shell \.birth-time-reliability-note[\s\S]*font-size:\s*14px\s*!important/)
})
