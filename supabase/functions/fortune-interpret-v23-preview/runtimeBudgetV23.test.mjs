import assert from 'node:assert/strict'
import test from 'node:test'

import { publicCallTrace } from '../_shared/fortuneAiPublicError.ts'
import { v23FinishReason, v23OutputTokenLimit } from './runtimeBudgetV23.ts'

test('V23 structured output has completion headroom for every period', () => {
  assert.equal(v23OutputTokenLimit('day', false), 8200)
  assert.equal(v23OutputTokenLimit('day', true), 7000)
  assert.equal(v23OutputTokenLimit('week', false), 7000)
  assert.equal(v23OutputTokenLimit('week', true), 6200)
  assert.equal(v23OutputTokenLimit('month', false), 8000)
  assert.equal(v23OutputTokenLimit('month', true), 7000)
  assert.equal(v23OutputTokenLimit('annual', false), 10000)
  assert.equal(v23OutputTokenLimit('annual', true), 8200)
  assert.equal(v23OutputTokenLimit('today', false), 8200)
})

test('MAX_TOKENS is observable in the persisted safe call trace', () => {
  assert.equal(v23FinishReason({ candidates: [{ finishReason: 'MAX_TOKENS' }] }), 'MAX_TOKENS')
  assert.equal(v23FinishReason({ candidates: [{ finishReason: 'not safe text' }] }), '')
  const trace = publicCallTrace([{
    call: 1, model: 'gemini-3.7-flash', kind: 'initial', prompt_bytes: 63000, elapsed_ms: 23000,
    http_status: 200, max_output_tokens: 8200, finish_reason: 'MAX_TOKENS',
    usage: { prompt_tokens: 25063, candidate_tokens: 5383, thought_tokens: 802, total_tokens: 31248 },
  }])
  assert.equal(trace[0].max_output_tokens, 8200)
  assert.equal(trace[0].finish_reason, 'MAX_TOKENS')
})
