import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildBasicFortuneReading } from './basicFortuneReading.ts'
import { buildFortuneUserSummary } from './fortuneUserSummary.ts'
import { fortunePresentationTone, fortuneToneAssessment, inspectFortuneToneRepetition } from './fortuneToneCalibration.ts'
import { buildDeterministicTopicAnalysis } from '../../../supabase/functions/fortune-interpret-v21-preview/costGuardV21.ts'

const stat = (average, band = average < 40 ? '약함' : average >= 60 ? '강함' : '보통') => ({
  average, band, spread: 0, best_days: [], caution_days: [],
})

function calculation(overall, evidence = []) {
  return {
    period: { start:'2026-10-07', end:'2026-10-07', day_count:1, month_segments:1 },
    western: {
      overall,
      relationship_signals: {},
      daily_scores: [{ date:'2026-10-07', evidence }],
      detail_days: [], months: [],
    },
  }
}

function dataFor(topics, overrides = {}) {
  return {
    headline:'', overall:{summary:'',dominant_pattern:'',best_phase:'',caution_phase:'',evidence_refs:[]},
    priorities:[], key_windows:[], cross_checks:[], clusters:{}, contact_flow:{},
    topic_analysis:Object.fromEntries(topics.map(topic => [topic, {
      importance:'핵심', verdict:'', reason:'', timing:'', action:'', avoid:'', confidence:'보통', confidence_reason:'fixture', evidence_refs:[],
    }])),
    ...overrides,
  }
}

function summary(topics, calc, data = dataFor(topics), verifiedNarrative = false) {
  return buildFortuneUserSummary(data, {
    verifiedNarrative,
    focusTopics: topics,
    period:'today',
    calculation:calc,
    topicEntries:Object.entries(data.topic_analysis),
    allowIntraday:false,
  })
}

test('tone 01: low activation alone cannot create a caution verdict', () => {
  const calc = calculation({ 연락:stat(24) })
  assert.equal(fortuneToneAssessment(calc, '연락').direction, 'neutral')
  assert.equal(fortunePresentationTone(calc, '연락', 24, '약함'), 'steady')
  const [row] = buildDeterministicTopicAnalysis({
    period:{start:'2026-10-07',end:'2026-10-07',day_count:1}, period_kind:'day',
    western:{overall:{연락:stat(24)},daily_pattern_digest:{}},
    evidence_ledger:[{id:'W:overall:연락',system:'western',scope:'period_average',topic:'연락',direction:'neutral',score:24,text:'연락 평균 24'}],
  }).filter(item => item.topic === '연락')
  assert.doesNotMatch(row.verdict, /주의|나쁘|불리/)
})

test('tone 02: low activation without challenging evidence stays neutral', () => {
  const calc = calculation({ 직장:stat(28) })
  const reading = buildBasicFortuneReading(calc, 'today')
  assert.equal(reading.caution.length, 0)
  assert.equal(reading.steady[0]?.topic, '직장')
})

test('tone 03: challenging evidence keeps a caution reading', () => {
  const calc = calculation({ 직장:stat(58) }, [{ source_topics:['직장'], polarity:-1, contribution:4, kind:'aspect', text:'업무 부담' }])
  assert.equal(fortuneToneAssessment(calc, '직장').direction, 'challenging')
  assert.equal(buildBasicFortuneReading(calc, 'today').caution[0]?.topic, '직장')
})

test('tone 04: supportive evidence keeps a supportive conclusion', () => {
  const calc = calculation({ 학업:stat(35) }, [{ source_topics:['학업'], polarity:1, contribution:3, kind:'aspect', text:'학습 지원' }])
  const result = summary(['학업'], calc)
  assert.deepEqual(result.bestFlow, ['학업'])
  assert.match(result.focusTopics[0].conclusion, /도움 방향 근거|수월|진도/)
})

test('tone 05: insufficient data is not translated into negative advice', () => {
  const calc = calculation({ 소식:null })
  const result = summary(['소식'], calc)
  assert.match(result.focusTopics[0].conclusion, /정보가 부족/)
  assert.equal(result.cautionFlow.length, 0)
  assert.doesNotMatch(result.focusTopics[0].conclusion, /나쁘|위험|조심/)
})

test('tone 06: different topics do not receive identical conclusion or action copy', () => {
  const topics = ['직장','학업','연애','금전']
  const calc = calculation(Object.fromEntries(topics.map(topic => [topic, stat(30)])))
  const rows = summary(topics, calc).focusTopics
  assert.equal(new Set(rows.map(row => row.conclusion)).size, rows.length)
  assert.equal(new Set(rows.map(row => row.action)).size, rows.length)
})

test('tone 07: excessive 확인해 endings are detected', () => {
  const issues = inspectFortuneToneRepetition(['직장','학업','금전'].map(topic => ({ topic, conclusion:`${topic}을 확인해.`, action:'조건을 확인해.' })))
  assert.ok(issues.includes('excessive 확인해 endings'))
})

test('tone 08: excessive 하지 마 endings are detected', () => {
  const issues = inspectFortuneToneRepetition(['직장','학업','금전'].map(topic => ({ topic, conclusion:`${topic}을 단정하지 마.`, action:'서두르지 마.' })))
  assert.ok(issues.includes('excessive 하지 마 endings'))
})

test('tone 09: semantic duplicates across conclusion/action/change condition are detected', () => {
  const issues = inspectFortuneToneRepetition([{ topic:'직장', conclusion:'담당자와 마감일을 정리해.', action:'담당자와 마감일을 정리해.', change_condition:'산출물이 나오면 일정이 구체화돼.' }])
  assert.ok(issues.includes('직장: semantic duplicate fields'))
})

test('tone 10: deterministic fallback does not converge every topic on 관망', () => {
  const topics = ['직장','학업','연애','금전']
  const calc = calculation(Object.fromEntries(topics.map(topic => [topic, stat(25)])))
  const rows = summary(topics, calc).focusTopics
  assert.ok(rows.every(row => !/관망/.test(`${row.conclusion} ${row.action}`)))
  assert.ok(!inspectFortuneToneRepetition(rows).includes('all topics converge on 관망'))
  const guard = readFileSync(new URL('../../../supabase/functions/fortune-interpret-v21-preview/costGuardV21.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(guard, /판단을 (?:올려|낮춰)/)
})

test('tone 11: grounded authored prose is not overwritten by tone calibration', () => {
  const calc = calculation({ 직장:stat(25) })
  const data = dataFor(['직장'])
  data.topic_analysis.직장 = {
    importance:'핵심', verdict:'담당자와 마감이 합의되어 업무가 안정적으로 이어지는 흐름이야.',
    reason:'직장 근거가 연결돼 있어.', timing:'', action:'합의된 결과물 범위를 그대로 이어가면 돼.', avoid:'', confidence:'보통', confidence_reason:'fixture', evidence_refs:['W:fixture'],
  }
  const result = summary(['직장'], calc, data, true)
  assert.equal(result.focusTopics[0].conclusion, data.topic_analysis.직장.verdict)
  assert.equal(result.focusTopics[0].action, data.topic_analysis.직장.action)
})

test('tone 12: actual safety domains keep their guard', () => {
  const calc = calculation({ 투자주의:stat(72, '높음') })
  const reading = buildBasicFortuneReading(calc, 'today')
  assert.equal(reading.caution[0]?.topic, '투자주의')
  assert.match(reading.caution[0]?.caution ?? '', /위험 관리|포지션/)
  const guard = readFileSync(new URL('../../../supabase/functions/fortune-interpret-v21-preview/costGuardV21.ts', import.meta.url), 'utf8')
  assert.match(guard, /가격방향·수익률 예측/)
})
