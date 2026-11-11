import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { westernRankCopy, westernLoveHeadline } from './westernRankCopy.ts'

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
  const rows = [['연애',{average:53,band:'보통'}], ['연락',{average:29,band:'매우 약함'}], ['재회',{average:46,band:'다소 약함'}]]
  assert.match(westernRankCopy(rows, '오늘'), /연애 흐름.*보통/)
  assert.match(westernLoveHeadline(rows), /호감을 나누는 흐름이 연락을 주고받는 흐름보다 높아/)
  assert.doesNotMatch(westernLoveHeadline(rows), /투자|학업|[0-9]점/)
  const tied = rows.map(([name]) => [name,{average:53,band:'보통'}])
  assert.match(westernLoveHeadline(tied), /강도가 같아/)
  assert.match(westernLoveHeadline([]), /비교할 애정 점수가 없어/)
})
