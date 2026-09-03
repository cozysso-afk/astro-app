import assert from 'node:assert/strict'
import test from 'node:test'

import {
  FORTUNE_AI_JOB_CONTRACT,
  FORTUNE_AI_JOB_STORAGE_KEY,
  decodePendingFortuneAiJob,
  encodePendingFortuneAiJob,
} from './fortuneAiJob.ts'

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
  assert.match(FORTUNE_AI_JOB_STORAGE_KEY, /\.v2$/)
  assert.match(FORTUNE_AI_JOB_CONTRACT, /v17$/)
})

test('legacy pending job without a contract is rejected', () => {
  const legacy = JSON.stringify({ jobId: 'old-job', periodStart: '2026-09-03' })
  assert.equal(decodePendingFortuneAiJob(legacy), null)
})

test('pending job from a different interpretation contract is rejected', () => {
  const stale = JSON.stringify({ contract: 'fortune-ai-job-old', jobId: 'old-job' })
  assert.equal(decodePendingFortuneAiJob(stale), null)
})

test('malformed or jobless payload is rejected', () => {
  assert.equal(decodePendingFortuneAiJob('{oops'), null)
  assert.equal(decodePendingFortuneAiJob(JSON.stringify({ contract: FORTUNE_AI_JOB_CONTRACT })), null)
})
