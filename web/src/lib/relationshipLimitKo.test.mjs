import assert from 'node:assert/strict'
import test from 'node:test'
import { relationshipLimitKo } from './relationshipLimitKo.ts'

test('current birth-data limitations distinguish provisional calculation from unavailable layers', () => {
  assert.match(relationshipLimitKo('Entered but unverified birth time/place: house, Davison and Marks layers are calculated as provisional reference only and may shift if the recorded time changes.'), /참고 결과.*출생시간이 달라지면/)
  assert.match(relationshipLimitKo('Concrete birth time/place missing for one or both people: Davison, Marks and Marks tertiary progression remain unavailable.'), /한 명 이상.*마크스 3차 진행을 계산하지 못했어/)
})

test('polar fallback identifies each affected birthplace independently of birth time precision', () => {
  for (const [subject, label] of [['user','내'], ['counterpart','상대의'], ['user, counterpart','두 사람의']]) {
    const message = 'Polar latitude house fallback: Swiss Ephemeris could not calculate Placidus for ' + subject + '; Porphyry quadrant houses were used explicitly instead.'
    assert.match(relationshipLimitKo(message), new RegExp(label + ' 출생지.*플라시두스.*포르피리'))
  }
  assert.equal(relationshipLimitKo('추가 계산 제한'), '추가 계산 제한')
})
