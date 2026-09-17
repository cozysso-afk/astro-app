import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const view = readFileSync(new URL('../SystemReadingViews.tsx', import.meta.url), 'utf8')
const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')
const index = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
const polish = readFileSync(new URL('../reading-polish-v50.css', import.meta.url), 'utf8')

test('integrated reading uses bold Noto Serif headline and sans-serif supporting copy', () => {
  assert.match(index, /family=Nanum\+Myeongjo:wght@400;700&family=Noto\+Serif\+KR:wght@500;600;700&display=swap/)
  const mainHeadlineRule = polish.match(/html body \.app-shell \.fortune-experience \.period-ai-head h3\s*\{([\s\S]*?)\}/)?.[1] ?? ''
  assert.match(mainHeadlineRule, /font-family:\s*'Noto Serif KR'/)
  assert.match(mainHeadlineRule, /font-weight:\s*700\s*!important/)
  const leadRule = polish.match(/\.fortune-experience \.period-ai-head \.reading-hero-subtitle\s*\{([\s\S]*?)\}/)?.[1] ?? ''
  assert.match(leadRule, /font-family:\s*-apple-system/)
  assert.match(leadRule, /font-weight:\s*400\s*!important/)
  const systemHeadlineRule = polish.match(/\.system-reading \.system-hero h3\s*\{([\s\S]*?)\}/)?.[1] ?? ''
  assert.match(systemHeadlineRule, /font-weight:\s*700\s*!important/)
  const imports = [...main.matchAll(/import ['"]\.\/([^'"]+\.css)['"]/g)].map(match => match[1])
  assert.ok(imports.indexOf('reading-polish-v50.css') < imports.indexOf('reading-experience.css'))
  assert.equal(imports.at(-1), 'reading-font-fix-v54.css')
})

test('Western independent surface suppresses every integrated period panel wrapper', () => {
  assert.match(polish, /system-reading\.system-western > \.period-ai-card/)
  assert.match(polish, /system-reading\.system-western > \.fortune-experience/)
  assert.match(polish, /system-reading\.system-western > \.period-deep-reading/)
})

test('Western overall reading is summarized instead of dumping every subtopic', () => {
  assert.match(view, /function representativeWesternRows/)
  assert.match(view, /const westernDisplayRows = field \|\| topic!=='전체' \? selectedWestern : representativeWesternRows\(selectedWestern\)/)
  assert.match(view, /전체에서는 대표 흐름 6개만 먼저 보여줘/)
  assert.match(view, /westernDisplayRows\.map/)
  assert.doesNotMatch(view, /선택 기간의 강약과 날짜를 읽는 층/)
})

test('Western overview uses a readable relative sentence instead of comma-separated bands', () => {
  assert.match(view, /const westernOverviewSummary = westernOverviewText\(selectedWestern,westernPeriod\)/)
  assert.match(view, /<p>\{westernOverviewSummary\}<\/p>/)
  assert.match(view, /상대적으로 강하고/)
  assert.match(view, /분야 간 차이가 크진 않아/)
})