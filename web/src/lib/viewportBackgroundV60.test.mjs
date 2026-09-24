import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../viewport-background-v60.css', import.meta.url), 'utf8')

test('viewport background is imported after every legacy style owner', () => {
  const marker = "import './viewport-background-v60.css'"
  assert.ok(main.includes(marker))
  assert.ok(main.indexOf(marker) > main.indexOf("import './reading-font-fix-v54.css'"))
  assert.equal(main.slice(main.indexOf(marker) + marker.length).includes("import './"), false)
})

test('aurora is fixed to viewport and app shell cannot repaint it', () => {
  assert.match(css, /body::before[\s\S]*position:\s*fixed/)
  assert.match(css, /body::before[\s\S]*inset:\s*0/)
  assert.match(css, /\.app-shell[\s\S]*background:\s*transparent\s*!important/)
  assert.match(css, /background-image:\s*none\s*!important/)
})
