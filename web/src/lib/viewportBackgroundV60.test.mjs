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

test('aurora stays static on the app surface without fixed pseudo compositing', () => {
  assert.match(css, /body\s*\{[\s\S]*background-image:\s*linear-gradient\(/)
  assert.match(css, /body::before,[\s\S]*body::after[\s\S]*display:\s*none\s*!important/)
  assert.match(css, /\.app-shell::before,[\s\S]*\.app-shell::after[\s\S]*display:\s*none\s*!important/)
  assert.doesNotMatch(css, /body::before\s*\{[\s\S]*position:\s*fixed/)
  assert.doesNotMatch(css, /\.app-shell::before\s*\{[\s\S]*position:\s*fixed/)
  assert.doesNotMatch(css, /@keyframes\s+astroAuroraSurfaceDrift/i)
  assert.match(css, /\.app-shell\.celestial-motion-on[\s\S]*\.app-shell\.celestial-motion-off[\s\S]*background-image:[\s\S]*radial-gradient/)
  assert.match(css, /background-position:[\s\S]*-11rem\s+760px[\s\S]*1120px/)
  assert.match(css, /animation:\s*none\s*!important/)
  assert.match(css, /transition:\s*none\s*!important/)
  assert.doesNotMatch(css, /background-attachment:\s*fixed/i)
})

test('static fallback avoids visual-viewport units and interaction-sensitive vertical percentages', () => {
  assert.doesNotMatch(css, /\b\d+(?:\.\d+)?(?:dvh|svh|lvh|vh)\b/i)
  assert.match(css, /linear-gradient\(\s*90deg/)
  assert.doesNotMatch(css, /@supports\s*\(-webkit-touch-callout:\s*none\)/)
  assert.doesNotMatch(css, /-11rem\s+\d+%/)
  assert.doesNotMatch(css, /calc\(100% \+ 9rem\)\s+\d+%/)
})

test('birth-time reliability choices avoid the iOS native select popover', () => {
  assert.doesNotMatch(reliability, /<select\b/)
  assert.match(reliability, /aria-haspopup="listbox"/)
  assert.match(reliability, /role="listbox"/)
  assert.match(reliability, /stable-choice-trigger/)
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
