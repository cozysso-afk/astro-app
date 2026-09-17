import test from 'node:test'
import assert from 'node:assert/strict'
import {
  auditPeriodDistinctness,
  buildPeriodNarrativeContext,
  buildPeriodNarrativeInstruction,
  clusterPhenomena,
  lexicalSimilarity,
  normalizePeriodKind,
  selectNarrativePhenomena,
} from './periodNarrativeV23.ts'

function packet(kind='week') {
  return {
    period_kind: kind,
    period: { start: '2026-09-14', end: '2026-09-20' },
    evidence_ledger: [
      {
        id: 'W:daily:1', system: 'western', topic: '학업', scope: 'daily_actual', date: '2026-09-15',
        direction: 'supportive', text: 'Mercury trine Jupiter',
        observation: { transit: 'Mercury', target: 'Jupiter', aspect: 'trine', motion: 'applying' },
      },
      {
        id: 'W:daily:2', system: 'western', topic: '시험', scope: 'daily_actual', date: '2026-09-17',
        direction: 'supportive', text: 'Mercury trine Jupiter',
        observation: { transit: 'Mercury', target: 'Jupiter', aspect: 'trine', motion: 'separating' },
      },
      {
        id: 'W:detail:3', system: 'western', topic: '직장', scope: 'intraday_evidence', date: '2026-09-16',
        direction: 'caution', text: 'Mars square Saturn',
        observation: { transit: 'Mars', target: 'Saturn', aspect: 'square', motion: 'applying' },
      },
      {
        id: 'W:daily:4', system: 'western', topic: '직장', scope: 'daily_actual', date: '2026-09-18',
        direction: 'supportive', text: 'Mars square Saturn',
        observation: { transit: 'Mars', target: 'Saturn', aspect: 'square', motion: 'separating' },
      },
      {
        id: 'S:month:1', system: 'saju', topic: '직장', scope: 'month_context', start: '2026-09-01', end: '2026-09-30',
        direction: 'context', text: '역할과 책임의 월운 맥락',
      },
    ],
  }
}

test('normalizes year to annual without changing the public four-mode model', () => {
  assert.equal(normalizePeriodKind('year'), 'annual')
  assert.equal(normalizePeriodKind('annual'), 'annual')
  assert.equal(normalizePeriodKind('day'), 'day')
})

test('same astronomical phenomenon across multiple topics becomes one phenomenon cluster', () => {
  const rows = clusterPhenomena(packet())
  const mercury = rows.find(row => row.label === 'Mercury trine Jupiter')
  assert.ok(mercury)
  assert.equal(mercury.evidence_count, 2)
  assert.deepEqual(new Set(mercury.topics), new Set(['학업', '시험']))
  assert.equal(mercury.distinct_dates, 2)
})

test('mixed directions on one phenomenon are treated as tension rather than duplicated support/caution events', () => {
  const rows = clusterPhenomena(packet())
  const mars = rows.find(row => row.label === 'Mars square Saturn')
  assert.ok(mars)
  assert.equal(mars.role, 'tension')
  assert.equal(mars.evidence_count, 2)
})

test('independent systems are not fused into the same phenomenon merely because the topic matches', () => {
  const rows = clusterPhenomena(packet())
  const jobRows = rows.filter(row => row.topics.includes('직장'))
  assert.ok(jobRows.some(row => row.systems.includes('western')))
  assert.ok(jobRows.some(row => row.systems.includes('saju')))
  assert.ok(!jobRows.some(row => row.systems.includes('western') && row.systems.includes('saju')))
})

test('each period gets a genuinely different editorial objective and reading sequence', () => {
  const contexts = Object.fromEntries(['day','week','month','annual'].map(kind => [kind, buildPeriodNarrativeContext(packet(kind))]))
  assert.match(contexts.day.objective, /오늘 안에서/)
  assert.match(contexts.week.objective, /7일 안에서/)
  assert.match(contexts.month.objective, /한 달 안에서/)
  assert.match(contexts.annual.objective, /연중 구조적/)
  assert.notDeepEqual(contexts.day.required_sequence, contexts.week.required_sequence)
  assert.notDeepEqual(contexts.week.required_sequence, contexts.month.required_sequence)
  assert.notDeepEqual(contexts.month.required_sequence, contexts.annual.required_sequence)
})

test('period instructions are not near-duplicates with the period label swapped', () => {
  const instructions = Object.fromEntries(['day','week','month','annual'].map(kind => [kind, buildPeriodNarrativeInstruction(packet(kind))]))
  const pairs = [['day','week'],['day','month'],['day','annual'],['week','month'],['week','annual'],['month','annual']]
  for (const [left,right] of pairs) {
    const similarity = lexicalSimilarity(instructions[left], instructions[right])
    assert.ok(similarity < 0.78, `${left}/${right} similarity too high: ${similarity}`)
  }
  assert.equal(auditPeriodDistinctness(instructions, 0.78).ok, true)
})

test('day favors triggers while annual favors recurring background patterns', () => {
  const base = packet('day')
  base.evidence_ledger.push(
    ...['2026-01-15','2026-03-15','2026-06-15','2026-09-15'].map((date,index) => ({
      id: `W:bg:${index}`, system: 'western', topic: '직장', scope: 'background', date,
      direction: 'context', text: 'Saturn conjunction MC-like long context',
      observation: { transit: 'Saturn', target: 'Sun', aspect: 'conjunction' },
    }))
  )
  const dayTop = selectNarrativePhenomena(base, 1)[0]
  const annualTop = selectNarrativePhenomena({ ...base, period_kind: 'annual', period: { start: '2026-01-01', end: '2026-12-31' } }, 1)[0]
  assert.notEqual(dayTop.id, annualTop.id)
  assert.equal(annualTop.role, 'background')
})

test('distinctness audit flags copy-pasted prose across periods', () => {
  const copied = '학업 흐름이 강하니 실제 반응을 확인하고 무리하지 마. 중요한 날짜를 보고 현실적인 행동을 해.'
  const report = auditPeriodDistinctness({ day: copied, week: copied, month: copied }, 0.78)
  assert.equal(report.ok, false)
  assert.ok(report.violations.length >= 1)
})
