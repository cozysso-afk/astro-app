import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const home = readFileSync(new URL('../HomeControls.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../compatibility-cta-v34.css', import.meta.url), 'utf8')
const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')

test('compatibility is a visible primary home entry, not hidden inside specialist disclosure', () => {
  const cta = home.indexOf('home-compatibility-cta')
  const disclosure = home.indexOf('home-specialist-tools')
  assert.ok(cta >= 0 && disclosure >= 0 && cta < disclosure)
  assert.match(home, /onToolSelect\('compatibility'\)/)
  assert.match(home, />궁합운<\/strong>/)
  assert.match(home, />궁합 보기<\/span>/)
  assert.match(home, /<summary>통합·결혼·고급 분석/)
  assert.doesNotMatch(home, /keys:\['compatibility','marriage'\]/)
})

test('compatibility entry has stronger title hierarchy while staying compact', () => {
  assert.match(css, /home-compatibility-cta[\s\S]*min-height:\s*76px/)
  assert.match(css, /home-compatibility-cta \.home-tool-copy > strong[\s\S]*font-size:\s*18px/)
  assert.match(css, /home-compatibility-action[\s\S]*font-weight:\s*750/)
})

test('compatibility layer loads before the shared reading owner stylesheet', () => {
  const compatibility = main.indexOf("import './compatibility-cta-v34.css'")
  const readingOwner = main.indexOf("import './reading-experience.css'")
  assert.ok(compatibility >= 0 && readingOwner >= 0 && compatibility < readingOwner)
})
