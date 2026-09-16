import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const home = readFileSync(new URL('../HomeControls.tsx', import.meta.url), 'utf8')
const panel = readFileSync(new URL('../PeriodFortunePanel.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../home-information-architecture-v35.css', import.meta.url), 'utf8')
const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')

test('period fortune and field fortune live in one primary home group', () => {
  const fortune = home.indexOf('home-fortune-group')
  const life = home.indexOf('home-life-section')
  assert.ok(fortune >= 0 && life > fortune)
  assert.ok(home.includes("'내 운세'"))
  assert.match(home, /오늘·주간·월간·연간 전체 기간운세/)
  assert.match(home, /className="home-field-entry"/)
  assert.match(home, /<strong>분야별 운세<\/strong>/)
  assert.match(home, /onWorkspace\?\.\('field'\)/)
})

test('long period results never portal ahead of relationship and system navigation', () => {
  assert.doesNotMatch(home, /home-period-result-slot/)
  assert.doesNotMatch(panel, /createPortal/)
  assert.doesNotMatch(panel, /getElementById\('home-period-result-slot'\)/)
  const life = home.indexOf('home-life-section')
  const systems = home.indexOf('home-system-section')
  const advanced = home.indexOf('home-specialist-tools')
  assert.ok(life >= 0 && systems > life && advanced > systems)
})

test('AI prompt copy is visually secondary to the reading result', () => {
  assert.match(css, /period-ai-v18 > \.period-ai-head[\s\S]*order:\s*0\s*!important/)
  assert.match(css, /period-ai-v18 > \.reading-flows[\s\S]*order:\s*1\s*!important/)
  assert.match(css, /period-ai-v18 > \.reading-copy-access[\s\S]*order:\s*90\s*!important/)
  assert.match(css, /period-ai-v18 > \.period-ai-details[\s\S]*order:\s*91\s*!important/)
})

test('compatibility marriage and location are peers in relationship and life', () => {
  const life = home.indexOf('home-life-section')
  const systems = home.indexOf('home-system-section')
  const advanced = home.indexOf('home-specialist-tools')
  assert.ok(life >= 0 && systems > life && advanced > systems)
  assert.match(home, /\['compatibility','marriage','location'\]/)
  assert.match(home, /key==='location'\?'is-wide'/)
  for (const label of ['궁합운','결혼운','지역·국가운']) assert.ok(home.includes(label))
  assert.doesNotMatch(home, /home-compatibility-cta/)
})

test('relationship and life cards prioritize text width over a cramped two-column layout', () => {
  assert.match(css, /home-section-heading[\s\S]*flex-direction:\s*column/)
  assert.match(css, /home-section-heading > p[\s\S]*text-align:\s*left/)
  assert.match(css, /home-life-grid[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/)
  assert.match(css, /home-life-card,[\s\S]*grid-template-columns:\s*44px minmax\(0, 1fr\) 16px/)
  assert.match(css, /home-life-card \.home-tool-symbol[\s\S]*width:\s*44px/)
  assert.match(css, /home-life-card \.home-tool-copy[\s\S]*gap:\s*4px/)
})

test('system choices stay compact and separate from annual and precision tools', () => {
  assert.match(home, /className="home-system-grid"/)
  for (const label of ['통합','서양점성술','사주','태국점성술']) assert.ok(home.includes(`>${label}</span>`))
  assert.match(home, /onPeriodSelect\(period,true\)/)
  assert.match(home, /<summary>연간·정밀 분석/)
  assert.match(home, /\['integrated','precision'\]/)
  assert.match(css, /home-system-grid[\s\S]*repeat\(4, minmax\(0, 1fr\)\)/)
})

test('home information architecture layer loads before the shared reading owner stylesheet', () => {
  const homeLayer = main.indexOf("import './home-information-architecture-v35.css'")
  const readingOwner = main.indexOf("import './reading-experience.css'")
  assert.ok(homeLayer >= 0 && readingOwner >= 0 && homeLayer < readingOwner)
  assert.doesNotMatch(main, /compatibility-cta-v34\.css/)
})
