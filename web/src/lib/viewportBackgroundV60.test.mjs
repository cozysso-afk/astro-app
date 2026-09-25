import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../viewport-background-v60.css', import.meta.url), 'utf8')
const readingCss = readFileSync(new URL('../reading-experience.css', import.meta.url), 'utf8')
const reliability = readFileSync(new URL('../BirthTimeReliabilityFields.tsx', import.meta.url), 'utf8')
const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
const auroraBlock = css.match(/#app-aurora-layer\s*\{([^}]*)\}/)?.[1] ?? ''
const winningBodyBlock = css.match(/body:has\(#root\)\s*\{([^}]*)\}/)?.[1] ?? ''

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

test('aurora is a persistent DOM sibling outside the React root', () => {
  assert.match(html, /<div id="app-aurora-layer" aria-hidden="true"><\/div>\s*<div id="root"><\/div>/)
  assert.match(css, /#app-aurora-layer\s*\{[\s\S]*position:\s*fixed[\s\S]*inset:\s*0/)
  assert.match(auroraBlock, /background-image:[\s\S]*radial-gradient/)
  assert.match(auroraBlock, /linear-gradient\(/)
  assert.match(auroraBlock, /background-color:\s*#eef3f4/)
  assert.match(auroraBlock, /animation:\s*astroAuroraViewportDriftV70\s+15s/)
  assert.doesNotMatch(auroraBlock, /contain:\s*paint/)
  assert.doesNotMatch(auroraBlock, /(?:^|\s)filter\s*:/)
  assert.doesNotMatch(auroraBlock, /(?:^|\s)transform\s*:/)
  assert.doesNotMatch(auroraBlock, /will-change\s*:/)
})

test('scrollable app tree never owns the aurora surface', () => {
  assert.match(css, /\.app-shell,[\s\S]*\.app-shell \.page-content[\s\S]*background:\s*transparent\s*!important/)
  assert.match(css, /\.app-shell,[\s\S]*\.app-shell \.page-content[\s\S]*background-image:\s*none\s*!important/)
  assert.match(css, /\.app-shell\.celestial-motion-on[\s\S]*animation:\s*none\s*!important/)
  assert.match(css, /\.app-shell\.celestial-motion-on::before,[\s\S]*\.app-shell\.celestial-glow-off::after[\s\S]*display:\s*none\s*!important/)
  assert.doesNotMatch(css, /\.app-shell\.celestial-motion-on[\s\S]*astroAuroraViewportDriftV70/)
})

test('final body fallback outranks the legacy plain-white important rule', () => {
  assert.match(readingCss, /body:has\(\.app-shell\)\s*\{\s*background:\s*#f7f8fb\s*!important\s*\}/)
  assert.ok(winningBodyBlock, 'expected a high-specificity body:has(#root) fallback owner')
  assert.match(winningBodyBlock, /background-color:\s*#eef3f4\s*!important/)
  assert.match(winningBodyBlock, /background-image:\s*linear-gradient\(/)
  assert.match(winningBodyBlock, /rgba\(214, 239, 230, \.62\)/)
  assert.match(winningBodyBlock, /rgba\(235, 218, 244, \.64\)/)
})

test('fallback cannot flash to plain white and aurora geometry ignores document height', () => {
  assert.match(css, /@keyframes\s+astroAuroraViewportDriftV70/)
  assert.match(css, /background-position:[\s\S]*-11rem\s+760px[\s\S]*1120px[\s\S]*0\s+0/)
  assert.doesNotMatch(css, /\b\d+(?:\.\d+)?(?:dvh|svh|lvh|vh)\b/i)
  assert.doesNotMatch(css, /background-attachment:\s*fixed/i)
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
