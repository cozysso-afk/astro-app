import test from 'node:test'
import assert from 'node:assert/strict'
import { polishFortuneSummary } from './fortuneNarrativePolish.ts'

function card(topic, meaning, score = 60, band = '강함') { return { topic, meaning, score, band } }

function base() {
  return {
    periodKind: 'day', when: '오늘',
    headline: '오늘은 컨디션에서 움직일 장면과 금전에서 한 번 더 확인할 장면이 갈려.',
    summary: '오늘은 컨디션에서 움직일 장면과 금전에서 한 번 더 확인할 장면이 갈려.',
    doTitle: '가장 좋은 흐름', cautionTitle: '가장 조심할 흐름', focusTitle: '중요 분야',
    doItems: [], cautionItems: [], bestFlow: ['컨디션'], cautionFlow: ['금전'],
    favorableCards: [card('컨디션','무작정 버티기보다 집중할 일정과 쉴 시간을 나눠 쓰기 좋은 날이야.')],
    cautionCards: [card('금전','예상 밖 지출이나 충동 결제는 금액과 필요성을 한 번 더 확인하는 편이 좋아.',35,'약함')],
    focusTopics: [], referenceTopics: [], importantWindows: [],
  }
}

test('daily hero is rebuilt from concrete favorable and caution claims', () => {
  const value = polishFortuneSummary(base())
  assert.equal(value.headline, '무작정 버티기보다 집중할 일정과 쉴 시간을 나눠 쓰기 좋은 날이야. 예상 밖 지출이나 충동 결제는 금액과 필요성을 한 번 더 확인하는 편이 좋아.')
  assert.equal(value.summary, '')
  assert.doesNotMatch(value.headline, /움직일 장면|컨디션부터 봐/)
})
