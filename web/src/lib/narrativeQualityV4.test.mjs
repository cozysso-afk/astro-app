import test from 'node:test'
import assert from 'node:assert/strict'
import { validateReaderManuscriptV4 } from './narrativeQualityV4.ts'

function manuscript(overrides = {}) {
  return {
    topic:'재회',
    verdict:{title:'연락은 닿았지만 아직 재회 단계는 아니에요',answer:'재접촉은 확인됐고 실제 만남은 아직 확인되지 않았어요.',tone:'caution'},
    reasons:[{id:'reason',kind:'observed',text:'현재 확인된 현실 단계는 서로 연락하는 상태예요.',evidenceRefs:[]}],
    limitingFactor:{id:'limit',kind:'interpretive',text:'구체적인 만남 제안이 아직 없어요.',evidenceRefs:[]},
    nextCheckpoint:{id:'next',kind:'advisory',text:'날짜와 장소가 포함된 만남 제안이 생기는지 보세요.',evidenceRefs:[]},
    risesWhen:['대화가 이어지고 실제 약속이 잡힐 때'],
    fallsWhen:['안부만 반복되고 만남 이야기가 흐려질 때'],
    ...overrides,
  }
}

test('직접 판정과 다음 확인점이 있는 원고를 통과시킨다', () => {
  assert.deepEqual(validateReaderManuscriptV4(manuscript()),[])
})

test('시스템 메타 언어가 기본 원고로 누출되면 실패한다', () => {
  const value=manuscript({verdict:{title:'계산 결과',answer:'계산축의 사건 확률은 아니에요.',tone:'insufficient'}})
  assert.ok(validateReaderManuscriptV4(value).includes('technical_language_leak'))
})

test('결론 없이 확인하라는 문장만 있으면 실패한다', () => {
  const value=manuscript({verdict:{title:'현재 판정',answer:'별도로 확인하세요.',tone:'insufficient'}})
  assert.ok(validateReaderManuscriptV4(value).includes('non_answer_verdict'))
})

test('같은 주장을 반복하면 의미 중복으로 실패한다', () => {
  const value=manuscript({reasons:[{id:'reason',kind:'observed',text:'재접촉은 확인됐고 실제 만남은 아직 확인되지 않았어요.',evidenceRefs:[]}]})
  assert.ok(validateReaderManuscriptV4(value).some(issue=>issue.startsWith('duplicate_claim:')))
})

