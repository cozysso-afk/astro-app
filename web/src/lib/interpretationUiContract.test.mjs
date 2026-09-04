import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const annual = readFileSync(new URL('../AiInterpretationPanel.tsx', import.meta.url), 'utf8')
const period = readFileSync(new URL('../PeriodAiInterpretationPanel.tsx', import.meta.url), 'utf8')

function sectionFrom(source, marker) {
  const start = source.indexOf(marker)
  assert.notEqual(start, -1, `missing UI marker: ${marker}`)
  const end = source.indexOf('</section>}', start)
  assert.notEqual(end, -1, `missing section end after: ${marker}`)
  return source.slice(start, end)
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

  const windows = sectionFrom(period, 'className="period-ai-key-window-section"')
  assert.match(windows, /!decisions\.length&&item\.action/, 'period date detail should repeat action only when no action cards exist')
  assert.match(windows, /item\.summary/)
  assert.match(windows, /item\.avoid/)
})
