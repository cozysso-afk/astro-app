import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runner = readFileSync(new URL('./visual-live-fortune-qa.mjs', import.meta.url), 'utf8')
const workflow = readFileSync(new URL('../../.github/workflows/fortune-live-mobile-qa.yml', import.meta.url), 'utf8')
const entry = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')

test('stored-result mobile QA can only read status and cannot start a paid Gemini job', () => {
  assert.match(runner, /JSON\.stringify\(\{ narrative_engine:'v23', action:'status', job_id:jobId \}\)/)
  assert.doesNotMatch(runner, /action:\s*['"]start['"]/) 
  assert.match(workflow, /confirm_no_paid_call == 'NO_PAID_CALL'/)
  assert.match(workflow, /LIVE_FORTUNE_QA_JOB_ID/)
})

test('stored-result mobile QA covers four iPhone widths, evidence disclosure and image export', () => {
  assert.match(runner, /\[320, 350, 393, 430\]/)
  assert.match(runner, /details\.period-ai-details/)
  assert.match(runner, /data-qa-live-export/)
  assert.match(runner, /UNNATURAL_KOREAN_BYTE_PAUSE/)
})

test('real-response preview remains restricted to a local QA route', () => {
  assert.match(entry, /localQaHost && qaMode === 'fortune-live'/)
  assert.doesNotMatch(entry, /editorialQaHost && qaMode === 'fortune-live'/)
})
