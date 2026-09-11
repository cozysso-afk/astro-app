import assert from 'node:assert/strict'
import test from 'node:test'

import {
  FORTUNE_AI_JOB_CONTRACT,
  FORTUNE_AI_JOB_STORAGE_KEY,
  decodePendingFortuneAiJob,
  encodePendingFortuneAiJob,
} from './fortuneAiJob.ts'
import { buildInterpretationBrief } from './interpretationSummary.ts'
import {
  FORTUNE_AI_FAILED_JOB_FALLBACK,
  FORTUNE_AI_START_ERROR_FALLBACK,
  FORTUNE_AI_STATUS_ERROR_FALLBACK,
  fortuneAiErrorLooksUnsafe,
  fortuneAiFailedJobMessage,
  fortuneAiPublicErrorMessage,
  fortuneAiStartErrorMessage,
  fortuneAiStatusErrorMessage,
} from './fortuneAiPublicError.ts'

function exactRequest() {
  return { profile: { birth_time:'07:26', time_known:true, time_source:'official_record', time_confidence:'exact' }, period:'today' }
}
function provisionalRequest() {
  return { profile: { birth_time:'07:26', time_known:true, time_source:'family_memory', time_confidence:'medium' }, period:'today' }
}

test('pending fortune AI job round-trips only with the V22 precision contract', () => {
  const raw = encodePendingFortuneAiJob({
    jobId: 'job-123', periodStart: '2026-09-03', periodEnd: '2026-09-03',
    cacheId: 'fortune-ai:test', ttlDays: 180, request: exactRequest(),
  })
  const parsed = decodePendingFortuneAiJob(raw)
  assert.equal(parsed?.contract, FORTUNE_AI_JOB_CONTRACT)
  assert.equal(parsed?.precisionMode, 'exact')
  assert.equal(parsed?.jobId, 'job-123')
  assert.equal(parsed?.request?.period, 'today')
  assert.match(FORTUNE_AI_JOB_STORAGE_KEY, /\.v7$/)
  assert.match(FORTUNE_AI_JOB_CONTRACT, /v22-integrated-precision-v2$/)
})

test('provisional pending job records and verifies its precision mode', () => {
  const raw=encodePendingFortuneAiJob({jobId:'p:job-456',request:provisionalRequest()})
  const parsed=decodePendingFortuneAiJob(raw)
  assert.equal(parsed?.precisionMode,'provisional')
  assert.equal(parsed?.jobId,'p:job-456')
})

test('legacy or precision-less pending jobs are rejected', () => {
  assert.equal(decodePendingFortuneAiJob(JSON.stringify({ jobId: 'old-job', periodStart: '2026-09-03' })), null)
  assert.equal(decodePendingFortuneAiJob(JSON.stringify({ contract: FORTUNE_AI_JOB_CONTRACT, jobId:'x', request:{period:'today'} })), null)
  assert.equal(encodePendingFortuneAiJob({jobId:'x',request:{period:'today'}}), '')
})

test('pending job with mismatched precision mode is rejected', () => {
  const raw=JSON.stringify({contract:FORTUNE_AI_JOB_CONTRACT,jobId:'x',precisionMode:'exact',request:provisionalRequest()})
  assert.equal(decodePendingFortuneAiJob(raw),null)
})

test('pending job from a different interpretation contract is rejected', () => {
  const stale = JSON.stringify({ contract: 'fortune-ai-job-release-v21', jobId: 'old-job', precisionMode:'exact', request:exactRequest() })
  assert.equal(decodePendingFortuneAiJob(stale), null)
})

test('malformed or jobless payload is rejected', () => {
  assert.equal(decodePendingFortuneAiJob('{oops'), null)
  assert.equal(decodePendingFortuneAiJob(JSON.stringify({ contract: FORTUNE_AI_JOB_CONTRACT, precisionMode:'exact', request:exactRequest() })), null)
})

function interpretationFixture(overrides = {}) {
  return {
    headline: '관계와 일의 속도 조절이 핵심인 시기',
    overall: {
      summary: '금전 평균 46.3점, 변동폭 42점, 최고 81점이다. 관계와 일에서는 서두르기보다 실제 반응을 확인하며 속도를 조절하는 흐름이 핵심이다.',
      dominant_pattern: '평균 50.2점, 최고 83점, 최저 31점이다.', best_phase: '', caution_phase: '',
    },
    key_windows: [], decisions: [], clusters: { relationship: '', work_study: '', money_news: '', condition: '' },
    systems: { western: '', saju: '', thai: '' }, priorities: ['중요한 결정은 핵심 날짜에 실제 반응을 확인한 뒤 확정해.'],
    topic_analysis: {}, limits: '', ...overrides,
  }
}

test('top interpretation brief skips metric-dense summary sentences', () => {
  const brief = buildInterpretationBrief(interpretationFixture())
  assert.match(brief.flow, /실제 반응/)
  assert.doesNotMatch(brief.flow, /46\.3|50\.2|변동폭|평균/)
  assert.match(brief.remember, /핵심 날짜/)
})

test('meaningful calendar timing is not removed merely because it contains numbers', () => {
  const brief = buildInterpretationBrief(interpretationFixture({ overall: {
    summary: '평균 51점, 최고 77점, 최저 33점이다.', dominant_pattern: '10월 11일 전후에는 관계의 실제 반응을 확인하는 흐름이 중요하다.', best_phase: '', caution_phase: '',
  }}))
  assert.match(brief.flow, /10월 11일/)
})

test('brief falls back to headline when all summary candidates are metric-dense', () => {
  const brief = buildInterpretationBrief(interpretationFixture({
    headline: '속도를 낮추고 현실 반응을 확인하는 기간',
    overall: { summary: '평균 51점, 변동폭 41점, 최고 77점, 최저 33점이다.', dominant_pattern: '평균 50점, 최고 80점, 최저 30점이다.', best_phase: '', caution_phase: '' },
    priorities: [],
  }))
  assert.equal(brief.flow, '속도를 낮추고 현실 반응을 확인하는 기간')
})


function functionsError(name, message, context) {
  const error = new Error(message)
  error.name = name
  error.context = context
  return error
}

function functionsResponse(status, payload, bodyUsed = false) {
  return {
    status,
    bodyUsed,
    clone() {
      return { json: async () => payload }
    },
    json: async () => payload,
  }
}

test('fortune start FunctionsHttpError surfaces a safe V22 message', async () => {
  const error = functionsError(
    'FunctionsHttpError',
    'Edge Function returned a non-2xx status code',
    functionsResponse(409, { error: '잠정 해설 최종 검사를 통과하지 못했어.' }),
  )
  assert.equal(await fortuneAiStartErrorMessage(error, null), '잠정 해설 최종 검사를 통과하지 못했어.')
})

test('fortune start error fails closed for serialized credentials and secret URLs', async () => {
  const unsafeErrors = [
    'authorization: Bearer secret-value',
    '{"authorization":"Basic abcdefgh"}',
    '{"cookie":"session=secret"}',
    '{"set-cookie":"sid=secret"}',
    '{"apikey":"secret"}',
    '{"x-api-key":"secret"}',
    '{"client_secret":"secret"}',
    '{"password":"secret"}',
    '{"headers":{"authorization":"Bearer secret"}}',
    '{\\"authorization\\":\\"Bearer escaped-secret\\"}',
    'authorization%3ABearer%20secret',
    '%257B%2522headers%2522%253A%257B%2522authorization%2522%253A%2522Bearer%2520secret%2522%257D%257D',
    '%253Fclient_secret%253Dsecret',
    '\\u0063ookie: session=secret',
    '\\u0061uthorization%3ABearer%20secret',
    'coo\u200Bkie: session=secret',
    'ａｕｔｈｏｒｉｚａｔｉｏｎ：Bearer secret',
    'eyJabcdefghijklmnopqrstuvwxyz.ABCDEFGHIJKLMNOPQRST.UVWXYZabcdefghijklmnop',
    'https://example.test/callback?access_token=secret',
    'https://example.test/callback%3Fclient_secret%3Dsecret',
    'sk-secretvalue',
    'sb_secret_secretvalue',
    'sb_publishable_secretvalue',
  ]
  for (const backendError of unsafeErrors) {
    const error = functionsError(
      'FunctionsHttpError',
      'Edge Function returned a non-2xx status code',
      functionsResponse(409, { error: backendError }),
    )
    assert.equal(
      await fortuneAiStartErrorMessage(error, null),
      FORTUNE_AI_START_ERROR_FALLBACK,
      backendError,
    )
  }
})

test('fortune public error detector allows harmless security vocabulary without a credential value', () => {
  for (const safe of [
    '인증 세션이 필요해.',
    'API key 설정이 필요해.',
    'authorization failed',
    'cookie parsing failed',
    'AI 해설 서버에서 오류가 발생했어.',
  ]) assert.equal(fortuneAiErrorLooksUnsafe(safe), false, safe)
})

test('fortune known public error code maps to a local fixed message', () => {
  assert.equal(
    fortuneAiPublicErrorMessage(
      { error_code: 'PROVISIONAL_DB_WRITE_FAILED', error: 'client_secret=must-not-render' },
      FORTUNE_AI_START_ERROR_FALLBACK,
    ),
    'AI 해설 저장에 실패했어.',
  )
  assert.equal(
    fortuneAiPublicErrorMessage(
      { error_code: 'UNKNOWN_INTERNAL_CODE', error: 'authorization: Bearer secret' },
      FORTUNE_AI_START_ERROR_FALLBACK,
    ),
    FORTUNE_AI_START_ERROR_FALLBACK,
  )
})

test('fortune start uses already-parsed safe invoke data for FunctionsHttpError', async () => {
  const error = functionsError(
    'FunctionsHttpError',
    'Edge Function returned a non-2xx status code',
    functionsResponse(409, null, true),
  )
  assert.equal(
    await fortuneAiStartErrorMessage(error, { error: '인증이 필요해.' }),
    '인증이 필요해.',
  )
})

test('fortune start does not classify fetch or relay errors with context as HTTP errors', async () => {
  const context = functionsResponse(409, { error: '이 문구는 노출되면 안 돼.' })
  const fetchError = functionsError('FunctionsFetchError', 'Edge Function 요청 전송에 실패했어.', context)
  const relayError = functionsError('FunctionsRelayError', 'Edge Function relay 연결에 실패했어.', context)
  assert.equal(await fortuneAiStartErrorMessage(fetchError, null), fetchError.message)
  assert.equal(await fortuneAiStartErrorMessage(relayError, null), relayError.message)
})

test('fortune malformed FunctionsHttpError body falls back safely', async () => {
  const context = {
    status: 500,
    bodyUsed: false,
    clone() { return { json: async () => { throw new Error('malformed') } } },
    json: async () => null,
  }
  const error = functionsError('FunctionsHttpError', 'non-2xx', context)
  assert.equal(await fortuneAiStartErrorMessage(error, null), FORTUNE_AI_START_ERROR_FALLBACK)
})

test('fortune failed job payload uses known codes, safe legacy text, and blocks encoded secrets', () => {
  assert.equal(
    fortuneAiFailedJobMessage({ status:'failed', error_code:'JOB_TIMEOUT', error:'ignored' }),
    'AI 해설 작업이 제한시간을 넘겨 자동 종료됐어.',
  )
  assert.equal(
    fortuneAiFailedJobMessage({ status:'failed', error:'안전한 이전 버전 오류 문구야.' }),
    '안전한 이전 버전 오류 문구야.',
  )
  assert.equal(
    fortuneAiFailedJobMessage({ status:'failed', error:'%253Fclient_secret%253Dsecret' }),
    FORTUNE_AI_FAILED_JOB_FALLBACK,
  )
})

test('fortune status HTTP errors block encoded secrets and network errors keep reconnect fallback', async () => {
  const httpError = functionsError(
    'FunctionsHttpError',
    'non-2xx',
    functionsResponse(500, { error:'authorization%3ABearer%20secret' }),
  )
  assert.equal(await fortuneAiStatusErrorMessage(httpError), FORTUNE_AI_STATUS_ERROR_FALLBACK)
  const fetchError = functionsError('FunctionsFetchError', 'Failed to send a request', functionsResponse(500, { error:'safe but unreachable' }))
  assert.equal(await fortuneAiStatusErrorMessage(fetchError), FORTUNE_AI_STATUS_ERROR_FALLBACK)
})
