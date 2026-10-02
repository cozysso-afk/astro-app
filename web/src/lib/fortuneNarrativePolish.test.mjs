import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  distinctNarrativeParts,
  inspectKoreanNarrative,
  narrativeClaimFamily,
  polishFortuneSummary,
  polishKoreanSentence,
} from './fortuneNarrativePolish.ts'

const periodResults = readFileSync(new URL('../PeriodFortuneResults.tsx', import.meta.url), 'utf8')
const narrativeV2 = readFileSync(new URL('../PeriodFortuneNarrativeV2.tsx', import.meta.url), 'utf8')
const editorialV3 = readFileSync(new URL('./fortuneEditorialV3.ts', import.meta.url), 'utf8')

function summaryFixture(overrides = {}) {
  return {
    periodKind: 'day',
    when: '오늘',
    headline: '오늘은 한 분야가 압도적으로 튀기보다 전반적인 균형이 중요해.',
    summary: '',
    doTitle: '오늘 이렇게',
    cautionTitle: '오늘 조심',
    focusTitle: '중요하게 볼 분야',
    doItems: [],
    cautionItems: [],
    bestFlow: ['직장'],
    cautionFlow: ['금전'],
    favorableCards: [{ topic:'직장', score:56, band:'다소 강함', meaning:'업무 요청과 협의에 힘이 실림' }],
    cautionCards: [{ topic:'금전', score:35, band:'약함', meaning:'예상 밖 지출에 여유를 둘 것' }],
    focusTopics: [
      { topic:'직장', conclusion:'오늘 업무는 요청받은 일과 마감 순서를 먼저 정리해.', reason:'', action:'요청받은 일과 마감 순서를 적고 중요한 것부터 처리해.', observe:'협의가 담당자와 일정까지 구체적으로 정해지는지를 봐.' },
      { topic:'금전', conclusion:'오늘 금전은 새 지출을 늘리기보다 정한 예산 안에서 처리해.', reason:'', action:'결제 전에 예산과 우선순위를 다시 정리해.', observe:'예상하지 못한 지출이 생기는지를 봐.' },
    ],
    referenceTopics: [],
    importantWindows: [],
    ...overrides,
  }
}

test('work headline is rewritten into natural subject-predicate Korean', () => {
  const source = '말로만 오가던 요청을 담당자·마감·완료 기준까지 구체화하기 좋은 날이야.'
  assert.equal(
    polishKoreanSentence(source),
    '말로만 오가던 요청은 담당자를 정하고, 마감일과 완료 기준까지 분명하게 정리해.',
  )
})

test('generic motion filler is removed instead of repeated across every sector', () => {
  const source = '직장에서 오늘 가장 눈에 띄는 건 업무 범위야. 이 흐름은 아직 강해지는 중이라 첫 반응 하나보다 실제 변화가 이어지는지를 봐.'
  const polished = polishKoreanSentence(source)
  assert.doesNotMatch(polished, /이 흐름은 아직 강해지는 중|첫 반응 하나보다 실제 변화/)
  assert.match(polished, /업무 범위/)
})

test('vague steady-state templates are rewritten into concrete user actions', () => {
  assert.equal(
    polishKoreanSentence('이번 달 금전 흐름은 무난한 편이니 계획한 범위 안에서 움직여.'),
    '이번 달 금전은 새 지출을 늘리기보다 정한 예산 안에서 처리해.',
  )
  assert.equal(
    polishKoreanSentence('이번 주 업무는 맡은 일의 순서를 분명히 하면 무난하게 풀 수 있어.'),
    '이번 주 업무는 요청받은 일과 마감 순서를 먼저 정리해.',
  )
  assert.equal(
    polishKoreanSentence('오늘 사람 관계는 무리하게 맞추기보다 적당한 거리를 지키면 무난해.'),
    '오늘 사람 관계는 필요한 말만 분명히 하고, 상대 반응은 이후 행동으로 판단해.',
  )
})

test('soft advice templates from real captures become direct reader-facing Korean', () => {
  assert.equal(
    polishKoreanSentence('오늘은 집중이 쉽게 흐트러질 수 있으니 목표를 작게 잡는 편이 좋아.'),
    '오늘은 집중이 쉽게 흩어질 수 있어. 목표를 넓히기보다 끝낼 단위를 하나로 좁혀.',
  )
  assert.equal(
    polishKoreanSentence('답장 속도 하나를 마음의 결론처럼 확대해석하지 않는 편이 좋아.'),
    '답장 속도를 마음의 결론으로 해석하지 마. 내용과 다음 행동을 봐.',
  )
  assert.equal(
    polishKoreanSentence('오늘은 기다리는 답이 늦어질 수 있으니 한 번에 결론 내리지 않는 편이 좋아.'),
    '오늘은 기다리는 답이 늦어질 수 있어. 지연 자체를 결과로 해석하지 마.',
  )
})

test('daily hero prefers favorable and caution roles instead of blindly concatenating first focus topics', () => {
  const result = polishFortuneSummary(summaryFixture({
    favorableCards:[{topic:'투자심리',score:58,band:'다소 강함',meaning:'투자 판단 기준을 점검'}],
    cautionCards:[{topic:'학업',score:33,band:'약함',meaning:'학업 집중 점검'}],
    focusTopics:[
      {topic:'학업',conclusion:'오늘은 집중이 쉽게 흐트러질 수 있으니 목표를 작게 잡는 편이 좋아.',reason:'',action:'공부할 분량을 나눠.',observe:'같은 시간을 써도 이해가 이어지는 단원과 막히는 단원이 갈리는지 살펴봐.'},
      {topic:'연락',conclusion:'오늘 연락은 답장 속도 하나를 마음의 결론처럼 확대해석하지 않는 편이 좋아.',reason:'',action:'필요한 말만 정리해.',observe:'질문에 실제로 답하는지 봐.'},
      {topic:'투자심리',conclusion:'오늘 투자 판단은 감정보다 미리 정한 기준을 따르는 게 좋아.',reason:'',action:'매매 이유와 손실 범위를 적어.',observe:'계획보다 조급함이 결정을 끌고 가는지 살펴봐.'},
    ],
  }))
  assert.match(result.headline, /투자 판단/)
  assert.match(result.headline, /집중이 쉽게 흩어질 수 있어/)
  assert.doesNotMatch(result.headline, /답장 속도/)
})

test('daily hero prefers concrete topic conclusions over shorthand flow-card slogans', () => {
  const result = polishFortuneSummary(summaryFixture())
  assert.match(result.headline, /업무는 요청받은 일과 마감 순서/)
  assert.match(result.headline, /금전은 새 지출을 늘리기보다 정한 예산/)
  assert.doesNotMatch(result.headline, /힘이 실림|여유를 둘 것|전반적인 균형/)
})

test('reference fields lead with an observable scene instead of generic coaching', () => {
  const result = polishFortuneSummary(summaryFixture({
    referenceTopics:[{
      topic:'시험',band:'다소 약함',summary:'실수하기 쉬운 부분부터 점검',
      detail:{topic:'시험',conclusion:'오늘은 새로운 내용을 늘리기보다 아는 문제의 실수를 줄이는 편이 좋아.',reason:'',action:'틀린 문제부터 다시 봐.',observe:'시간 안에 문제를 끝내는지, 같은 실수를 반복하는지를 살펴봐.',caution:'범위를 갑자기 넓히지 마.'},
    }],
  }))
  assert.match(result.referenceTopics[0].detail.conclusion, /시간 안에 문제를 끝내는지/)
  assert.doesNotMatch(result.referenceTopics[0].detail.conclusion, /편이 좋아/)
})

test('quiet-hour communication windows become preparation guidance instead of send-now advice', () => {
  const result = polishFortuneSummary(summaryFixture({
    importantWindows:[{date:'00:30–02:00',kind:'favorable',guidance:'연락 · 안부·질문·약속을 먼저 꺼내보기'}],
  }))
  assert.match(result.importantWindows[0].guidance, /지금 바로 연락하기보다/)
  assert.match(result.importantWindows[0].guidance, /상대 생활시간대/)
  assert.doesNotMatch(result.importantWindows[0].guidance, /먼저 꺼내보기/)
})

test('vague period hero falls back to concrete topic conclusions and next actions', () => {
  const result = polishFortuneSummary(summaryFixture({
    periodKind:'month',
    when:'이번 달',
    headline:'이번 달은 한 분야가 압도하기보다 전반적인 균형이 중요해. 실제 일정과 반응에 맞춰 속도를 조절해.',
    summary:'이번 달은 평소 계획을 유지해.',
    focusTopics:[
      { topic:'직장', conclusion:'이번 달 업무는 진행 중인 일을 먼저 닫고 새 일을 늘리지 마.', reason:'', action:'담당자와 마감일을 적고 끝낼 순서를 정해.', observe:'미뤄진 일이 실제 완료로 바뀌는지를 봐.' },
      { topic:'금전', conclusion:'이번 달 금전은 새 지출보다 이미 잡힌 비용부터 처리해.', reason:'', action:'고정비와 예정 결제를 먼저 적어.', observe:'예상 밖 지출이 생기면 남은 예산을 다시 계산해.' },
    ],
  }))
  assert.match(result.headline, /진행 중인 일을 먼저 닫고/)
  assert.match(result.headline, /이미 잡힌 비용부터 처리/)
  assert.doesNotMatch(result.headline, /전반적인 균형|속도를 조절/)
  assert.match(result.summary, /담당자와 마감일|미뤄진 일이 실제 완료/)
  assert.doesNotMatch(result.summary, /평소 계획/)
})

test('semantic families dedupe paraphrased repetition, not only exact strings', () => {
  const rows = distinctNarrativeParts([
    '답장 속도 하나를 관계의 결론으로 확대하지 마.',
    '한 번의 반응만 보고 관계 전체를 단정하지 마.',
    '다음 약속이 실제로 잡히는지를 확인해.',
  ])
  assert.equal(rows.length, 2)
  assert.equal(narrativeClaimFamily(rows[0]), 'single-reaction')
  assert.equal(narrativeClaimFamily(rows[1]), 'follow-through')
})

test('Korean QA catches semantic predicate mismatch and repeated claims', () => {
  const issues = inspectKoreanNarrative([
    '변화 욕구를 직무·보상·일정 비교로 바꾸는 것이야.',
    '답장 뒤 실제 변화가 이어지는지를 봐.',
    '말보다 실제 행동이 이어지는지를 봐.',
    '다음 약속이 실제 만남으로 이어지는지를 봐.',
  ])
  assert.ok(issues.some(issue => /의미 호응 오류/.test(issue)))
  assert.ok(issues.some(issue => /동일 의미 반복/.test(issue)))
})

test('love UI exposes six conditional contexts at once instead of requiring a preselected status', () => {
  for (const marker of ['솔로 · 새 인연','짝사랑 · 마음 가는 사람','썸 · 알아가는 중','관계가 애매한 사이','연애 중','재회를 생각하는 경우']) {
    assert.match(editorialV3, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.doesNotMatch(periodResults, /LOVE_STATUS_OPTIONS\.map/)
  assert.match(periodResults, /솔로·짝사랑·썸·애매한 관계·연애 중·재회 관심/)
  assert.match(narrativeV2, /editorial\.loveContexts\.map/)
  assert.match(narrativeV2, /내 상황에 맞춰 읽기/)
})

test('completed period results consume the verified integrated hero and remain exportable', () => {
  assert.match(periodResults, /PeriodFortuneNarrativeV2/)
  assert.match(periodResults, /data-reading-export-root="period-fortune"/)
  assert.match(periodResults, /결과 이미지 저장/)
  assert.match(narrativeV2, /buildFortuneEditorialV3/)
  assert.match(narrativeV2, /integratedHeroHeadline = verifiedNarrative && !field && editorialCopyUsable\(editorial\.heroHeadline\)/)
  assert.match(narrativeV2, /integratedHeroSummary = verifiedNarrative && !field && editorialCopyUsable\(editorial\.heroSummary\)/)
  assert.match(narrativeV2, /분야별 흐름/)
  assert.doesNotMatch(narrativeV2, /전 분야를 통틀어 보면/)
  assert.match(narrativeV2, /기억할 시기/)
})