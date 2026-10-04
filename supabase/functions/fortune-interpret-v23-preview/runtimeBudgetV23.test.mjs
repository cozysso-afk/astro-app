import assert from 'node:assert/strict'
import test from 'node:test'

import { publicCallTrace } from '../_shared/fortuneAiPublicError.ts'
import { v23FinishReason, v23OutputTokenLimit } from './runtimeBudgetV23.ts'

test('V23 structured output has completion headroom for every period', () => {
  assert.equal(v23OutputTokenLimit('day', false), 8200)
  assert.equal(v23OutputTokenLimit('day', true), 7000)
  assert.equal(v23OutputTokenLimit('week', false), 9000)
  assert.equal(v23OutputTokenLimit('week', true), 8000)
  assert.equal(v23OutputTokenLimit('month', false), 8000)
  assert.equal(v23OutputTokenLimit('month', true), 7000)
  assert.equal(v23OutputTokenLimit('annual', false), 10000)
  assert.equal(v23OutputTokenLimit('annual', true), 8200)
  assert.equal(v23OutputTokenLimit('today', false), 8200)
  assert.equal(v23OutputTokenLimit('weekly', false), 9000)
})

test('MAX_TOKENS is observable in the persisted safe call trace', () => {
  assert.equal(v23FinishReason({ candidates: [{ finishReason: 'MAX_TOKENS' }] }), 'MAX_TOKENS')
  assert.equal(v23FinishReason({ candidates: [{ finishReason: 'not safe text' }] }), '')
  const trace = publicCallTrace([{
    call: 1, model: 'gemini-3.7-flash', kind: 'initial', prompt_bytes: 83338, elapsed_ms: 24225,
    http_status: 200, max_output_tokens: 9000, finish_reason: 'MAX_TOKENS',
    usage: { prompt_tokens: 33568, candidate_tokens: 6379, thought_tokens: 606, total_tokens: 40553 },
  }])
  assert.equal(trace[0].max_output_tokens, 9000)
  assert.equal(trace[0].finish_reason, 'MAX_TOKENS')
})
