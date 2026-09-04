import assert from 'node:assert/strict'
import test from 'node:test'

import {
  FORTUNE_AI_JOB_CONTRACT,
  FORTUNE_AI_JOB_STORAGE_KEY,
  decodePendingFortuneAiJob,
  encodePendingFortuneAiJob,
} from './fortuneAiJob.ts'
import { buildInterpretationBrief } from './interpretationSummary.ts'

test('pending fortune AI job round-trips only with the current contract', () => {
  const raw = encodePendingFortuneAiJob({
    jobId: 'job-123',
    periodStart: '2026-09-03',
    periodEnd: '2026-09-03',
    cacheId: 'fortune-ai:test',
    ttlDays: 180,
    request: { period: 'today' },
  })
  const parsed = decodePendingFortuneAiJob(raw)
  assert.equal(parsed?.contract, FORTUNE_AI_JOB_CONTRACT)
  assert.equal(parsed?.jobId, 'job-123')
  assert.equal(parsed?.request?.period, 'today')
  assert.match(FORTUNE_AI_JOB_STORAGE_KEY, /\.v5$/)
  assert.match(FORTUNE_AI_JOB_CONTRACT, /v21\.3\.1-investment-output-guard$/)
})

test('legacy pending job without a contract is rejected', () => {
  const legacy = JSON.stringify({ jobId: 'old-job', periodStart: '2026-09-03' })
  assert.equal(decodePendingFortuneAiJob(legacy), null)
})

test('pending job from a different interpretation contract is rejected', () => {
  const stale = JSON.stringify({ contract: 'fortune-ai-job-release-v20', jobId: 'old-job' })
  assert.equal(decodePendingFortuneAiJob(stale), null)
})

test('malformed or jobless payload is rejected', () => {
  assert.equal(decodePendingFortuneAiJob('{oops'), null)
  assert.equal(decodePendingFortuneAiJob(JSON.stringify({ contract: FORTUNE_AI_JOB_CONTRACT })), null)
})

function interpretationFixture(overrides = {}) {
  return {
    headline: '관계와 일의 속도 조절이 핵심인 시기',
    overall: {
      summary: '금전 평균 46.3점, 변동폭 42점, 최고 81점이다. 관계와 일에서는 서두르기보다 실제 반응을 확인하며 속도를 조절하는 흐름이 핵심이다.',
      dominant_pattern: '평균 50.2점, 최고 83점, 최저 31점이다.',
      best_phase: '',
      caution_phase: '',
    },
    key_windows: [],
    decisions: [],
    clusters: { relationship: '', work_study: '', money_news: '', condition: '' },
    systems: { western: '', saju: '', thai: '' },
    priorities: ['중요한 결정은 핵심 날짜에 실제 반응을 확인한 뒤 확정해.'],
    topic_analysis: {},
    limits: '',
    ...overrides,
  }
}

test('top interpretation brief skips metric-dense summary sentences', () => {
  const brief = buildInterpretationBrief(interpretationFixture())
  assert.match(brief.flow, /실제 반응/)
  assert.doesNotMatch(brief.flow, /46\.3|50\.2|변동폭|평균/)
  assert.match(brief.remember, /핵심 날짜/)
})

test('meaningful calendar timing is not removed merely because it contains numbers', () => {
  const brief = buildInterpretationBrief(interpretationFixture({
    overall: {
      summary: '평균 51점, 최고 77점, 최저 33점이다.',
      dominant_pattern: '10월 11일 전후에는 관계의 실제 반응을 확인하는 흐름이 중요하다.',
      best_phase: '',
      caution_phase: '',
    },
  }))
  assert.match(brief.flow, /10월 11일/)
})

test('brief falls back to headline when all summary candidates are metric-dense', () => {
  const brief = buildInterpretationBrief(interpretationFixture({
    headline: '속도를 낮추고 현실 반응을 확인하는 기간',
    overall: {
      summary: '평균 51점, 변동폭 41점, 최고 77점, 최저 33점이다.',
      dominant_pattern: '평균 50점, 최고 80점, 최저 30점이다.',
      best_phase: '',
      caution_phase: '',
    },
    priorities: [],
  }))
  assert.equal(brief.flow, '속도를 낮추고 현실 반응을 확인하는 기간')
})
