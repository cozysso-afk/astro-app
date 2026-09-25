import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../viewport-background-v60.css', import.meta.url), 'utf8')
const motion = readFileSync(new URL('../celestial-motion-v23.css', import.meta.url), 'utf8')

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

test('page background has exactly one visible owner', () => {
  assert.match(css, /body::before[\s\S]*position:\s*fixed/)
  assert.match(css, /body::before[\s\S]*inset:\s*0/)
  assert.match(css, /\.app-shell[\s\S]*background:\s*transparent\s*!important/)
  assert.match(css, /\.app-shell \.page-content[\s\S]*background:\s*transparent\s*!important/)
  assert.match(css, /\.app-shell\.celestial-motion-on::before,[\s\S]*\.app-shell\.celestial-motion-on::after[\s\S]*display:\s*none\s*!important/)
  assert.match(css, /\.app-shell\.celestial-motion-on::before,[\s\S]*animation:\s*none\s*!important/)
})

test('legacy motion layer cannot revive the shell aurora', () => {
  assert.match(motion, /\.app-shell\.celestial-motion-on::before[\s\S]*display:block!important/)
  assert.match(motion, /animation:astroAuroraDrift/)
  assert.match(css, /\.app-shell\.celestial-motion-on::before/)
  assert.match(css, /content:\s*none\s*!important/)
  assert.match(css, /background:\s*none\s*!important/)
  assert.match(css, /opacity:\s*0\s*!important/)
})

test('background is vertically invariant across iOS auto-scroll and viewport changes', () => {
  assert.doesNotMatch(css, /\b\d+(?:\.\d+)?(?:dvh|svh|lvh|vh)\b/i)
  assert.doesNotMatch(css, /radial-gradient/i)
  assert.match(css, /linear-gradient\(\s*90deg/)
  assert.doesNotMatch(css, /linear-gradient\(\s*180deg/)
  assert.doesNotMatch(css, /\bat\s+[^,;]+\s+\d+px/i)
})
