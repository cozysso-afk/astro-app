import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const view = readFileSync(new URL('../SystemReadingViews.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../system-reading-ux-v40.css', import.meta.url), 'utf8')
const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')

test('western independent view starts with an actual period takeaway', () => {
  assert.match(view, /const westernReaderHeadline = westernHeadline\(selectedWestern,westernPeriod\)/)
  assert.match(view, /className="system-hero western-reader-hero"/)
  assert.match(view, /<span>서양점성술 · \{westernPeriod\}<\/span><h3>\{westernReaderHeadline\}<\/h3>/)
  assert.doesNotMatch(view, /분야의 강약과 날짜를 나눠 읽어봐/)
  assert.doesNotMatch(view, /<span>서양점성술 · \{period\}<\/span>/)
})

test('western score cards expose plain guidance before date detail', () => {
  assert.match(view, /className="system-score-grid western-score-grid"/)
  assert.match(view, /className="western-score-guidance">\{westernGuidance\(name,s\)\}/)
  assert.match(view, /className="western-score-more">날짜 보기<\/span><\/summary>/)
  assert.match(view, /연락·재회·투자 관련 값은 실제 행동이나 수익을 보장하지 않으니/)
})

test('top-level life topics use a fixed two-row mobile grid instead of horizontal clipping', () => {
  assert.match(view, /system-topic-selector system-topic-selector-fixed/)
  assert.match(css, /system-topic-selector\.system-topic-selector-fixed[\s\S]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/)
  assert.match(css, /system-topic-selector\.system-topic-selector-fixed[\s\S]*overflow:\s*visible\s*!important/)
  assert.doesNotMatch(css, /system-topic-selector\.system-topic-selector-fixed[\s\S]*overflow-x:\s*auto/)
})

test('system reading UX layer loads after the shared reading owner so its scoped fixes are final', () => {
  const owner = main.indexOf("import './reading-experience.css'")
  const western = main.indexOf("import './system-reading-ux-v40.css'")
  assert.ok(owner >= 0 && western > owner)
})
