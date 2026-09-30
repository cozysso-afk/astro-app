import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFortuneUserSummary } from './fortuneUserSummary.ts'
import { buildFortuneEditorialV3 } from './fortuneEditorialV3.ts'
import { FORTUNE_FIELDS } from './fortuneFields.ts'

const ALL_TOPICS = ['연애','연락','재회','금전','투자심리','신규진입','수익실현','투자주의','학업','시험','직장','이직','대인관계','소식','컨디션']

function stat(average = 50, band = '보통') {
  return { average, band, spread: 0, best_days: [], caution_days: [] }
}

function calculation() {
  return {
    period: { start: '2026-09-30', end: '2026-09-30', day_count: 1, month_segments: 1 },
    western: {
      overall: Object.fromEntries(ALL_TOPICS.map(topic => [topic, stat()])),
      relationship_signals: {
        수신신호: stat(),
        발신적합: stat(),
        과거인연접점: stat(),
      },
      daily_scores: [],
      detail_days: [],
      months: [],
    },
  }
}

function blankSection() {
  return {
    conclusion: '', real_scene: '', action: '', change_condition: '',
    evidence_refs: [], applicability: 'insufficient',
  }
}

function blankData() {
  return {
    headline: '',
    overall: { summary: '', dominant_pattern: '', best_phase: '', caution_phase: '', evidence_refs: [] },
    priorities: [],
    key_windows: [],
    cross_checks: [],
    clusters: {
      relationship: Object.fromEntries([
        'summary','friends','coworkers','family','new_people','boundaries',
        'love_general','love_single','love_crush','love_flirting','love_ambiguous','love_couple','love_reunion_interest',
        'contact_activation','contact_continuity',
      ].map(key => [key, blankSection()])),
      work_study: Object.fromEntries(['work','career_change','exam','study'].map(key => [key, blankSection()])),
      money_news: { money: blankSection(), news: blankSection() },
      investment: { psychology: blankSection(), realization: blankSection(), entry: blankSection() },
      condition: { condition: blankSection() },
    },
    contact_flow: { incoming: '', outgoing: '', reconnection: '' },
    topic_analysis: {},
  }
}

function summaryFor(field) {
  return buildFortuneUserSummary(blankData(), {
    verifiedNarrative: false,
    focusTopics: field.topics,
    period: 'today',
    calculation: calculation(),
    topicEntries: [],
    allowIntraday: false,
  })
}

const GENERIC_ONLY_RE = /평소 계획 유지|별도로 참고할 신호가 뚜렷하지 않아|흐름 살펴보기|활용할 부분을 구체적으로 확인해/

test('all ten user fields keep a concrete deterministic floor when structured AI is unavailable', () => {
  assert.deepEqual(FORTUNE_FIELDS.map(field => field.id), [
    'love','money','investment','study','exam','work','job-change','social','contact','condition',
  ])

  for (const field of FORTUNE_FIELDS) {
    const summary = summaryFor(field)
    assert.deepEqual(summary.focusTopics.map(row => row.topic), field.topics, `${field.id}: requested topics disappeared`)
    for (const row of summary.focusTopics) {
      assert.ok(row.conclusion.length >= 20, `${field.id}/${row.topic}: conclusion too thin`)
      assert.ok(row.action.length >= 10, `${field.id}/${row.topic}: action missing`)
      assert.ok((row.observe ?? '').length >= 10, `${field.id}/${row.topic}: observable scene missing`)
      assert.ok((row.caution ?? '').length >= 10, `${field.id}/${row.topic}: caution missing`)
      assert.doesNotMatch(`${row.conclusion} ${row.action} ${row.observe} ${row.caution}`, GENERIC_ONLY_RE, `${field.id}/${row.topic}: generic-only fallback leaked`)
    }
  }
})

test('dedicated relationship screens remain useful with every structured relationship section insufficient', () => {
  const data = blankData()
  const calc = calculation()

  const loveField = FORTUNE_FIELDS.find(field => field.id === 'love')
  const love = buildFortuneEditorialV3(data, calc, summaryFor(loveField), loveField)
  assert.equal(love.loveContexts?.length, 6)
  for (const row of love.loveContexts ?? []) assert.ok(row.text.length >= 25, `love/${row.key}: fallback too thin`)
  assert.match(love.loveContexts?.find(row => row.key === 'reunion_interest')?.text ?? '', /재접촉|관계 재구축/)

  const socialField = FORTUNE_FIELDS.find(field => field.id === 'social')
  const social = buildFortuneEditorialV3(data, calc, summaryFor(socialField), socialField)
  assert.equal(social.interpersonalContexts?.length, 5)
  assert.match(social.interpersonalContexts?.find(row => row.key === 'coworkers')?.text ?? '', /담당자·마감·완료 기준/)
  assert.match(social.interpersonalContexts?.find(row => row.key === 'boundaries')?.text ?? '', /가능한 범위|경계/)

  const contactField = FORTUNE_FIELDS.find(field => field.id === 'contact')
  const contactBase = summaryFor(contactField)
  const contact = buildFortuneEditorialV3(data, calc, contactBase, contactField)
  assert.ok(contact.contact?.activation.length >= 20)
  assert.ok(contact.contact?.continuity.length >= 30)
  assert.match(contact.contact?.continuity ?? '', /공식 안내·날짜·다음 단계/)
  assert.match(contact.contact?.incoming ?? '', /안부·질문·약속 제안/)
  assert.match(contact.contact?.outgoing ?? '', /짧고 구체적으로/)
  assert.ok(contactBase.focusTopics.some(row => row.topic === '소식'), 'contact/news deterministic source disappeared')
  assert.equal(contact.topicEditorial['소식'], undefined, 'test must exercise deterministic news fallback, not structured news')
})
