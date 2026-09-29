import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const view = readFileSync(new URL('../SystemReadingViews.tsx', import.meta.url), 'utf8')
const periodPanel = readFileSync(new URL('../PeriodFortuneNarrativeV2.tsx', import.meta.url), 'utf8')
const signals = readFileSync(new URL('../ReadingSignals.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../system-reading-ux-v40.css', import.meta.url), 'utf8')
const polish = readFileSync(new URL('../reading-polish-v50.css', import.meta.url), 'utf8')
const finalFont = readFileSync(new URL('../reading-font-fix-v54.css', import.meta.url), 'utf8')
const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')

test('western independent view starts with an actual period takeaway', () => {
  assert.match(view, /const westernReaderHeadline = westernHeadline\(selectedWestern,westernPeriod\)/)
  assert.match(view, /className="system-hero western-reader-hero"/)
  assert.match(view, /<span>서양점성술 · \{westernPeriod\}<\/span><h3>\{westernReaderHeadline\}<\/h3>/)
  assert.doesNotMatch(view, /분야의 강약과 날짜를 나눠 읽어봐/)
  assert.doesNotMatch(view, /<span>서양점성술 · \{period\}<\/span>/)
})

test('western reader copy names the score difference and gives a concrete next action', () => {
  assert.doesNotMatch(view, /상대적으로 더 살아 있어|힘이 덜 실리|무난해|이어가기 괜찮아|상대적으로 강하고|약한 편이야/)
  assert.match(view, /분야별 점수 차이가 크지 않아/)
  assert.match(view, /점수가 가장 높고/)
  assert.match(view, /공부할 분량을 정하고/)
  assert.match(view, /직무·보상·시작 일정/)
})

test('western score cards expose plain guidance before date detail', () => {
  assert.match(view, /className="system-score-grid western-score-grid"/)
  assert.match(view, /className="western-score-guidance">\{westernGuidance\(name,s\)\}/)
  assert.match(view, /className="western-score-more">날짜 보기<\/span><\/summary>/)
  assert.match(view, /연락·재회·투자 관련 값은 실제 행동이나 수익을 보장하지 않으니/)
})

test('western date detail uses relative score labels and tells users how to act', () => {
  assert.doesNotMatch(view, /좋은 날:|주의할 날:/)
  assert.match(view, /점수가 높은 날:/)
  assert.match(view, /점수가 낮은 날:/)
  assert.match(view, /실제 일정·조건을 함께 확인해/)
  assert.match(view, /피해야 할 날로 단정하지 말고/)
})

test('important windows use action checks instead of fortune-style verdict labels', () => {
  assert.match(periodPanel, /<span>기억할 시기<\/span><strong>날짜별 행동·확인 기준<\/strong>/)
  assert.match(periodPanel, /return '진행 후보'/)
  assert.match(periodPanel, /return '확인 필요'/)
  assert.match(periodPanel, /return '변동 확인'/)
  assert.match(periodPanel, /실제 일정·약속·조건이 구체화되는지 확인해/)
  assert.match(periodPanel, /일정·문서·상대 행동처럼 확인 가능한 조건을 다시 봐/)
  assert.match(periodPanel, /다음 행동이 이어지는지 확인해/)
  assert.doesNotMatch(periodPanel, /활용·주의 구간/)
  assert.doesNotMatch(periodPanel, /status: window\.kind === 'caution' \? '주의'/)
  assert.match(signals, /TIMELINE_SIGNAL_LABELS/)
  assert.match(signals, /favorable: '진행 후보', caution: '확인 필요', mixed: '변동 확인'/)
})

test('thai overview leads with concrete actions and keeps placement jargon secondary', () => {
  assert.match(view, /오늘은 부탁을 받을 때 내가 맡을 범위부터 정하고/)
  assert.match(view, /수면·회복 시간을 일정에 먼저 넣어/)
  assert.match(view, /부탁과 책임이 한쪽에 몰리는지/)
  assert.match(view, /쉬는 시간·내가 결정할 범위·돈과 시간을 장기 계획으로 나눠 관리해/)
  assert.match(view, /thaiLifeSummary\(w\.wheel\.map\(r=>r\.bhumi_key\)\)/)
  assert.match(view, /부탁·휴식·결정 범위·돈과 시간처럼 지금 손댈 수 있는 부분부터 확인해/)
  assert.doesNotMatch(view, /부탁·책임의 패턴|생활 영역을 읽는 기준표|좋고 나쁨을 한 줄로 단정하기보다/)
})

test('integrated synthesis shows each system takeaway instead of methodology prose', () => {
  assert.match(view, /className="system-synthesis"><summary>세 체계에서 지금 확인할 것<\/summary>/)
  assert.match(view, /<b>서양점성술<\/b> · \{westernOverviewSummary\}/)
  assert.match(view, /<b>사주<\/b> · \{sajuOverviewSummary\}/)
  assert.match(view, /<b>태국점성술<\/b> · \{thaiReaderSummary\}/)
  assert.match(view, /세 체계의 수치나 기준은 합산하지 않고 각각의 계산 근거로 확인해/)
  assert.doesNotMatch(view, /서양점성술의 분야 강약과 사주의 운 구간|선택한 분야에서 실제로 겹치는 맥락이 있는지 비교해/)
})

test('western independent view never shows the integrated period panel again', () => {
  assert.match(polish, /system-reading\.system-western > \.period-ai-card,/)
  assert.match(polish, /system-reading\.system-western > \.fortune-experience,/)
  assert.match(polish, /system-reading\.system-western > \.period-deep-reading\s*\{[\s\S]*?display:\s*none\s*!important/)
})

test('mobile integrated reading uses a strong 800 sans headline and lighter supporting copy', () => {
  assert.match(finalFont, /period-ai-head h3\.period-ai-hero-title-v4\s*\{[\s\S]*?font-family:\s*-apple-system/)
  assert.match(finalFont, /period-ai-head h3\.period-ai-hero-title-v4\s*\{[\s\S]*?font-weight:\s*800\s*!important/)
  assert.match(finalFont, /period-ai-head \.reading-hero-subtitle\s*\{[\s\S]*?font-weight:\s*400\s*!important/)
})

test('top-level life topics use a fixed two-row mobile grid instead of horizontal clipping', () => {
  assert.match(view, /system-topic-selector system-topic-selector-fixed/)
  assert.match(css, /system-topic-selector\.system-topic-selector-fixed[\s\S]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/)
  assert.match(css, /system-topic-selector\.system-topic-selector-fixed[\s\S]*overflow:\s*visible\s*!important/)
  assert.doesNotMatch(css, /system-topic-selector\.system-topic-selector-fixed[\s\S]*overflow-x:\s*auto/)
})

test('scoped system UX loads before the shared reading owner, which stays below system UX', () => {
  const western = main.indexOf("import './system-reading-ux-v40.css'")
  const owner = main.indexOf("import './reading-experience.css'")
  assert.ok(western >= 0 && owner > western)
})
