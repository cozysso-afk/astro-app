import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../profile-form-aurora-v71.css', import.meta.url), 'utf8')
const viewportCss = readFileSync(new URL('../viewport-background-v60.css', import.meta.url), 'utf8')

const profileBlock = css.match(/\.app-shell \.form-card\.profile-form-card,[\s\S]*?\{([\s\S]*?)\}/)?.[1] ?? ''

test('profile form aurora override loads late without displacing viewport owner', () => {
  const profileMarker = "import './profile-form-aurora-v71.css'"
  const viewportMarker = "import './viewport-background-v60.css'"
  const fontMarker = "import './reading-font-fix-v54.css'"
  assert.ok(main.includes(profileMarker))
  assert.ok(main.indexOf(profileMarker) < main.indexOf(viewportMarker))
  assert.ok(main.indexOf(viewportMarker) < main.indexOf(fontMarker))
})

test('birth profile container cannot become an opaque white compositing surface', () => {
  assert.ok(profileBlock, 'expected profile-form-card override')
  assert.match(profileBlock, /background:\s*transparent\s*!important/)
  assert.match(profileBlock, /background-image:\s*none\s*!important/)
  assert.match(profileBlock, /background-color:\s*transparent\s*!important/)
  assert.match(profileBlock, /box-shadow:\s*none\s*!important/)
  assert.match(profileBlock, /-webkit-backdrop-filter:\s*none\s*!important/)
  assert.match(profileBlock, /backdrop-filter:\s*none\s*!important/)
  assert.match(profileBlock, /contain:\s*none\s*!important/)
  assert.match(css, /\.profile-form-card:focus-within/)
  assert.match(css, /\.profile-form-card:has\(\.stable-choice\.is-open\)/)
})

test('actual birth inputs stay opaque white while the container stays transparent', () => {
  assert.match(viewportCss, /\.app-shell \.field input,[\s\S]*\.app-shell \.stable-choice-trigger[\s\S]*background:\s*#fff\s*!important/)
})
