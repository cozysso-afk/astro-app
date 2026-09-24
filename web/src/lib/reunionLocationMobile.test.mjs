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

test('location results explain the ranking before raw lists', () => {
  assert.match(location, /지역·국가운 해설/)
  assert.match(location, /locationEvidenceText/)
  assert.match(location, /출생 순간의 행성과 각도 축/)
  assert.match(location, /비자, 직업시장, 생활비, 치안, 언어/)
  assert.match(location, /location-purpose-reading/)
  assert.match(location, /ReadingExplanation kind="reason"/)
  assert.match(location, /ReadingExplanation kind="practice"/)
  assert.match(location, /ReadingExplanation kind="caution"/)
  const explanation = location.indexOf('location-reading-card')
  const ranking = location.indexOf('국가 순위')
  assert.ok(explanation >= 0 && ranking > explanation)
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

test('v42 remains below shared reading styles; font fix precedes the viewport background owner', () => {
  const v42 = main.indexOf("import './reunion-location-mobile-v42.css'")
  const owner = main.indexOf("import './reading-experience.css'")
  const fontOwner = main.indexOf("import './reading-font-fix-v54.css'")
  const viewportOwner = main.indexOf("import './viewport-background-v60.css'")
  assert.ok(v42 >= 0 && owner > v42)
  assert.ok(fontOwner > owner)
  assert.ok(viewportOwner > fontOwner)
  const imports = [...main.matchAll(/import ['"]\.\/([^'"]+\.css)['"]/g)].map((match) => match[1])
  assert.equal(imports.at(-1), 'viewport-background-v60.css')
})
