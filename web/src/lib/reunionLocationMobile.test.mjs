import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const css = readFileSync(new URL('../reunion-location-mobile-v42.css', import.meta.url), 'utf8')
const location = readFileSync(new URL('../LocationResults.tsx', import.meta.url), 'utf8')
const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')

test('location results have a scoped mobile owner', () => {
  assert.match(location, /className="results-wrap location-results"/)
  assert.match(css, /\.location-results \.location-rank-row[\s\S]*grid-template-columns:\s*28px minmax\(0, 1fr\) 42px/)
  assert.match(css, /\.location-results \.location-rank-row > div > small[\s\S]*white-space:\s*normal\s*!important/)
})

test('location mobile filters no longer require sideways scrolling', () => {
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*\.location-results \.astro-purpose-tabs[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)[\s\S]*overflow:\s*visible\s*!important/)
  assert.match(css, /\.location-results \.astro-angle-filter,[\s\S]*\.location-results \.astro-planet-filter[\s\S]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)[\s\S]*overflow:\s*visible\s*!important/)
})

test('reunion timing rows wrap inside the viewport with visible hierarchy', () => {
  assert.match(css, /\.reunion-signal-grid > article[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) auto\s*!important/)
  assert.match(css, /\.reunion-window-list p[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) auto\s*!important/)
  assert.match(css, /\.reunion-window-list p > span[\s\S]*grid-column:\s*1 \/ -1\s*!important/)
  assert.match(css, /\.relationship-range-buttons[\s\S]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)\s*!important/)
})

test('v42 remains below legacy layers while reading-experience keeps final ownership', () => {
  const v42 = main.indexOf("import './reunion-location-mobile-v42.css'")
  const owner = main.indexOf("import './reading-experience.css'")
  assert.ok(v42 >= 0 && owner > v42)
  const imports = [...main.matchAll(/import ['"]\.\/([^'"]+\.css)['"]/g)].map((match) => match[1])
  assert.equal(imports.at(-1), 'reading-experience.css')
})
