import test from 'node:test'
import assert from 'node:assert/strict'
import { editorialSectionReady } from './fortuneEditorialV3.ts'

function baseSection(change_condition) {
  return {
    conclusion: '지금은 확인된 조건 안에서 결정을 좁히는 게 좋아.',
    real_scene: '실제 일정과 상대 반응처럼 확인 가능한 장면을 먼저 봐.',
    action: '확인된 범위 안에서 다음 행동 하나만 정해.',
    change_condition,
    evidence_refs: [],
    applicability: 'direct',
  }
}

test('semantic change-condition corpus accepts observable triggers', () => {
  const accepted = [
    '실제 약속 날짜가 확정되면 판단을 다시 해.',
    '답장이 이틀 이상 없으면 추가 연락을 미뤄.',
    '상대가 다음 약속을 먼저 제안하면 관계 판단을 올려.',
    '두 번째 만남이 잡힌 경우 기대치를 다시 조정해.',
    '시험 일정이 바뀌면 학습 순서를 다시 정해.',
    '공식 결과가 나오면 지원 계획을 다시 정해.',
    '예산이 50만원 이하라면 추가 지출을 보류해.',
    '연락이 끊긴 뒤 먼저 연락할지 다시 판단해.',
  ]
  for (const change_condition of accepted) {
    assert.equal(editorialSectionReady(baseSection(change_condition)), true, change_condition)
  }
})

test('semantic change-condition corpus rejects Korean noun false positives and vague triggers', () => {
  const rejected = [
    '장면을 보고 판단을 다시 해.',
    '표면만 보고 판단을 바꿔.',
    '상황을 보면서 판단해.',
    '상황이 달라지면 판단해.',
    '흐름이 바뀌면 다시 생각해.',
    '분위기가 변하면 판단해.',
  ]
  for (const change_condition of rejected) {
    assert.equal(editorialSectionReady(baseSection(change_condition)), false, change_condition)
  }
})

test('same topic can still pass when four roles are meaningfully distinct', () => {
  const natural = {
    conclusion: '예산 안에서는 필요한 지출을 진행해도 돼.',
    real_scene: '카드 결제일과 고정비를 확인하면 실제로 쓸 수 있는 금액이 보여.',
    action: '고정비를 먼저 빼고 남는 금액만 생활비로 배정해.',
    change_condition: '예상치 못한 큰 지출이 생기면 남은 예산을 다시 계산해.',
    evidence_refs: [],
    applicability: 'direct',
  }
  assert.equal(editorialSectionReady(natural), true)
})
