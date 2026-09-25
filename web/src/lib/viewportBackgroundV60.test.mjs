import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../viewport-background-v60.css', import.meta.url), 'utf8')
const motion = readFileSync(new URL('../celestial-motion-v23.css', import.meta.url), 'utf8')
const reliability = readFileSync(new URL('../BirthTimeReliabilityFields.tsx', import.meta.url), 'utf8')

test('viewport background is the final background owner while font fix stays last overall', () => {
  const marker = "import './viewport-background-v60.css'"
  const fontOwner = "import './reading-font-fix-v54.css'"
  assert.ok(main.includes(marker))
  assert.ok(main.indexOf(marker) > main.indexOf("import './reading-experience.css'"))
  assert.ok(main.indexOf(fontOwner) > main.indexOf(marker))
  const imports = [...main.matchAll(/import ['"]\.\/([^'"]+\.css)['"]/g)].map((match) => match[1])
  assert.equal(imports.at(-2), 'viewport-background-v60.css')
  assert.equal(imports.at(-1), 'reading-font-fix-v54.css')
})

test('page underlay stays non-fixed while motion layer remains available', () => {
  assert.match(css, /body\s*\{[\s\S]*background-image:\s*linear-gradient\(/)
  assert.match(css, /body::before,[\s\S]*body::after[\s\S]*display:\s*none\s*!important/)
  assert.doesNotMatch(css, /body::before\s*\{[\s\S]*position:\s*fixed/)
  assert.match(css, /\.app-shell[\s\S]*background:\s*transparent\s*!important/)
  assert.match(css, /\.app-shell:not\(\.celestial-motion-on\)::before/)
  assert.doesNotMatch(css, /\.app-shell\.celestial-motion-on::before[\s\S]*display:\s*none\s*!important/)
})

test('celestial motion owns the animated aurora when motion is enabled', () => {
  assert.match(motion, /\.app-shell\.celestial-motion-on::before[\s\S]*display:block!important/)
  assert.match(motion, /animation:astroAuroraDrift/)
  assert.match(motion, /radial-gradient/)
  assert.doesNotMatch(css, /\.app-shell\.celestial-motion-on::before/)
  assert.doesNotMatch(css, /@supports\s*\(-webkit-touch-callout:\s*none\)/)
})

test('static page background is vertically invariant across auto-scroll and viewport changes', () => {
  assert.doesNotMatch(css, /\b\d+(?:\.\d+)?(?:dvh|svh|lvh|vh)\b/i)
  assert.doesNotMatch(css, /radial-gradient/i)
  assert.match(css, /linear-gradient\(\s*90deg/)
  assert.doesNotMatch(css, /linear-gradient\(\s*180deg/)
  assert.doesNotMatch(css, /\bat\s+[^,;]+\s+\d+px/i)
})

test('birth-time reliability choices avoid the iOS native select popover', () => {
  assert.doesNotMatch(reliability, /<select\b/)
  assert.match(reliability, /aria-haspopup="listbox"/)
  assert.match(reliability, /role="listbox"/)
  assert.match(reliability, /stable-choice-trigger/)
  assert.match(css, /\.stable-choice-menu[\s\S]*background:\s*#fffefa/)
  assert.match(css, /\.stable-choice-menu[\s\S]*backdrop-filter:\s*none/)
})
