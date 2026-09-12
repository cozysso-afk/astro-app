import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { normalizeTopicEntries } from './interpretationTopics.ts'

const annual = readFileSync(new URL('../AiInterpretationPanel.tsx', import.meta.url), 'utf8')
const period = readFileSync(new URL('../PeriodAiInterpretationPanel.tsx', import.meta.url), 'utf8')
const topicOrder = ['금전','학업','시험','직장','이직','대인관계','연애','연락','재회','소식','컨디션','투자심리','수익실현','신규진입','투자주의']

function sectionFrom(source, marker) {
  const start = source.indexOf(marker)
  assert.notEqual(start, -1, `missing UI marker: ${marker}`)
  const end = source.indexOf('</section>', start)
  assert.notEqual(end, -1, `missing section end after: ${marker}`)
  return source.slice(start, end + '</section>'.length)
}

function assertQuickDatesStayCompact(source, marker) {
  const quick = sectionFrom(source, marker)
  assert.doesNotMatch(quick, /item\.(?:summary|action|avoid|reason)/, 'TOP 3 must remain date/topic navigation, not repeat detailed prose')
  assert.match(quick, /item\.label/)
  assert.match(quick, /item\.topics/)
  assert.match(quick, /item\.signal/)
}

test('annual reading separates TOP 3, action cards, and date detail', () => {
  assertQuickDatesStayCompact(annual, 'className="ai-quick-date-list"')

  const actions = sectionFrom(annual, 'className="ai-decision-section"')
  assert.match(actions, /item\.action/)
  assert.match(actions, /item\.timing/)
  assert.match(actions, /item\.watch/)
  assert.match(actions, /className="ai-decision-more"/)
  const disclosure = actions.indexOf('className="ai-decision-more"')
  assert.ok(actions.indexOf('item.reason') > disclosure, 'decision reason should be preserved inside disclosure')
  assert.ok(actions.indexOf('item.avoid') > disclosure, 'decision avoid should be preserved inside disclosure')

  const windows = sectionFrom(annual, 'className="ai-key-window-section"')
  assert.match(windows, /!hasDecisions&&item\.action/, 'date detail should repeat action only when no decision cards exist')
  assert.match(windows, /item\.summary/)
  assert.match(windows, /item\.avoid/)
})

test('period reading uses the same non-repeating information roles', () => {
  assertQuickDatesStayCompact(period, 'className="period-ai-quick-date-list"')

  const actions = sectionFrom(period, 'className="period-ai-action-section"')
  assert.match(actions, /item\.action/)
  assert.match(actions, /item\.timing/)
  assert.match(actions, /item\.watch/)
  assert.match(actions, /className="period-ai-action-more"/)
  const disclosure = actions.indexOf('className="period-ai-action-more"')
  assert.ok(actions.indexOf('item.reason') > disclosure, 'period decision reason should be preserved inside disclosure')
  assert.ok(actions.indexOf('item.avoid') > disclosure, 'period decision avoid should be preserved inside disclosure')

  const windows = sectionFrom(period, 'period-ai-key-window-section')
  assert.match(windows, /!decisions\.length&&item\.action/, 'period date detail should repeat action only when no action cards exist')
  assert.match(windows, /item\.summary/)
  assert.match(windows, /item\.avoid/)
})

// Dedicated relationship focus owns directional synthesis; generic relationship cluster copy remains fallback-only.
test('relationship focus appears once and follows timing detail', () => {
  const annualKey = annual.indexOf('className="ai-key-window-section"')
  const annualRel = annual.indexOf('className="ai-relationship-section"')
  assert.ok(annualKey >= 0 && annualRel > annualKey, 'annual relationship focus should follow date detail')
  assert.equal((annual.match(/className="ai-relationship-section"/g) || []).length, 1)
  assert.equal((annual.match(/className="ai-direction-grid ai-relationship-direction"/g) || []).length, 1)
  assert.match(annual, /!showRelationshipFocus && data\.clusters\.relationship/)
  assert.match(annual, /className="ai-relationship-more"/)

  const periodKey = period.indexOf('period-ai-key-window-section')
  const periodRel = period.indexOf('period-ai-relationship-section')
  assert.ok(periodKey >= 0 && periodRel > periodKey, 'period relationship focus should follow date detail')
  assert.equal((period.match(/period-ai-relationship-section/g) || []).length, 1)
  assert.equal((period.match(/period-ai-relationship-directions/g) || []).length, 1)
  assert.match(period, /!showRelationshipFocus&&data\.clusters\.relationship/)
  assert.match(period, /className="period-ai-relationship-more"/)
})

test('period topic detail separates primary explanations from compact reference topics', () => {
  assert.match(period, /const topicEntries = normalizeTopicEntries\(data\.topic_analysis, topicOrder\)\.sort/)
  assert.match(period, /const primaryTopicEntries = topicEntries\.filter\(\(\[,item\]\)=>item\.importance === '핵심' \|\| item\.importance === '주목'\)/)
  assert.match(period, /const referenceTopicEntries = topicEntries\.filter\(\(\[,item\]\)=>item\.importance === '참고'\)/)
  assert.doesNotMatch(period, /15개 분야별 해석 펼치기/)

  const primaryStart = period.indexOf('<summary>핵심 · 주목 분야 해설</summary>')
  const referenceStart = period.indexOf('<summary>참고 분야 {referenceTopicEntries.length}개</summary>')
  const detailEnd = period.indexOf('<div className="period-ai-section"><strong>체계별 계산 해설</strong>', referenceStart)
  assert.ok(primaryStart >= 0 && referenceStart > primaryStart, 'primary disclosure must precede reference topics')
  assert.ok(detailEnd > referenceStart, 'reference disclosure must stay inside detailed interpretation')

  const primary = period.slice(primaryStart, referenceStart)
  assert.match(primary, /primaryTopicEntries\.map/)
  assert.match(primary, /item\.timing&&/)
  assert.match(primary, /item\.action&&/)
  assert.match(primary, /item\.avoid&&/)

  const reference = period.slice(referenceStart, detailEnd)
  assert.match(reference, /referenceTopicEntries\.map/)
  assert.match(reference, /item\.verdict/)
  assert.match(reference, /item\.reason/)
  assert.doesNotMatch(reference, /item\.timing|item\.action|item\.avoid/, 'reference cards should stay compact')
})

test('period topic normalization supports legacy arrays without exposing numeric indexes', () => {
  const topic = (importance, verdict) => ({importance,verdict,reason:'근거',timing:'',action:'',avoid:'',confidence:'보통',confidence_reason:'근거 연결'})
  const legacy = [
    {topic:'연애',...topic('핵심','연애 해설')},
    {topic:'연락',...topic('핵심','연락 해설')},
  ]
  const legacyEntries = normalizeTopicEntries(legacy,topicOrder)
  assert.deepEqual(legacyEntries.map(([name])=>name),['연애','연락'])
  const headings = legacyEntries.map(([name,item])=>`${name} · ${item.importance}`).join('\n')
  assert.match(headings,/연애 · 핵심/)
  assert.match(headings,/연락 · 핵심/)
  assert.doesNotMatch(headings,/(?:0|1) · 핵심/)

  const current = {연애:topic('핵심','연애 해설'),연락:topic('주목','연락 해설')}
  assert.deepEqual(normalizeTopicEntries(current,topicOrder).map(([name])=>name),['연애','연락'])
  assert.deepEqual(normalizeTopicEntries([null,{}, {topic:'0',...topic('핵심','잘못된 해설')}, {topic:'미등록',...topic('핵심','잘못된 해설')}],topicOrder),[])
})

test('period result labels deterministic output from reliable existing metadata', () => {
  assert.match(period, /result\.model === 'deterministic-provisional-v2' \|\| localQualityFallback/)
  assert.match(period, /계산근거 기반 자동 해설/)
})
