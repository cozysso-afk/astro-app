import test from 'node:test'
import assert from 'node:assert/strict'
import { isNearDuplicate, polishFortuneUserSummary } from './interpretationEditorialV2.ts'

function summaryFixture(topic='직장') {
  return {
    periodKind:'day', when:'오늘',
    headline:`오늘 전체 흐름에서 가장 먼저 볼 건 ${topic}이야. 이 흐름은 아직 강해지는 중이라 첫 반응 하나보다 실제 변화가 이어지는지를 봐.`,
    summary:`오늘은 ${topic} 쪽 장면이 가장 또렷해.`,
    doTitle:'오늘 이렇게', cautionTitle:'오늘 조심', focusTitle:'중요하게 볼 분야',
    doItems:[], cautionItems:[], bestFlow:[topic], cautionFlow:[],
    favorableCards:[{topic,score:58,band:'다소 강함',meaning:'첫 반응 하나보다 실제 변화가 이어지는지를 봐.'}],
    cautionCards:[], importantWindows:[], referenceTopics:[],
    focusTopics:[{
      topic,
      conclusion:`${topic}에서 오늘 가장 눈에 띄는 건 요청과 일정이야. 이 흐름은 아직 강해지는 중이라 첫 반응 하나보다 실제 변화가 이어지는지를 봐.`,
      reason:'직장 계산 근거가 이어져 있어.',
      action:'요청받은 일과 마감 순서를 적고 중요한 것부터 처리해.',
      observe:'말로 끝난 협의가 담당자와 일정까지 구체적으로 정해지는지를 봐.',
      caution:'책임 범위가 애매한 일을 바로 떠안지는 마.',
    }],
  }
}

test('generic applying copy is replaced by topic-specific Korean instead of repeating one sentence', () => {
  const result = polishFortuneUserSummary(summaryFixture('직장'))
  assert.match(result.headline,/오늘은 직장을 가장 먼저 봐/)
  assert.doesNotMatch(result.headline,/첫 반응 하나보다 실제 변화/)
  assert.match(result.headline,/담당자, 마감일, 완료 기준/)
  assert.doesNotMatch(result.focusTopics[0].conclusion,/첫 반응 하나보다 실제 변화/)
})

test('work guidance uses complete sentence components and concrete parallel nouns', () => {
  const result = polishFortuneUserSummary(summaryFixture('직장'))
  assert.equal(result.focusTopics[0].action,'말로만 오가던 요청은 담당자를 정하고, 마감일과 완료 기준까지 분명하게 정리해.')
  assert.equal(result.focusTopics[0].observe,'담당자와 마감일이 실제로 정해지고, 완료 기준까지 합의되는지 봐.')
})

test('semantic duplicate detector catches paraphrased repetition and removes redundant depth', () => {
  assert.equal(isNearDuplicate('첫 반응 하나보다 실제 변화가 이어지는지를 봐.','첫 반응보다 변화가 이어지는지를 봐.'),true)
  const fixture=summaryFixture('대인관계')
  fixture.focusTopics[0].conclusion='말투 하나보다 이후 태도와 약속이 이어지는지를 봐.'
  fixture.focusTopics[0].observe='한 번의 말투보다 이후 태도와 약속이 이어지는지를 봐.'
  const result=polishFortuneUserSummary(fixture)
  assert.equal(result.focusTopics[0].observe,undefined)
})

test('different sectors receive different follow-through language', () => {
  const work=polishFortuneUserSummary(summaryFixture('직장')).headline
  const study=polishFortuneUserSummary(summaryFixture('학업')).headline
  const contact=polishFortuneUserSummary(summaryFixture('연락')).headline
  assert.notEqual(work,study)
  assert.notEqual(study,contact)
  assert.match(study,/끝낸 분량/)
  assert.match(contact,/다음 질문이나 약속/)
})
