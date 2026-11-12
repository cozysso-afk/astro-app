import test from 'node:test'
import assert from 'node:assert/strict'
import {renderReunion,hierarchy,candidate} from './fixtures/reunionPanel.mjs'

test('calculated future windows do not copy awkward engine prose into the displayed label',()=>{
  for (const phrase of ['현재 조회 시점 기준으로','가장 먼저 활성화되는 단계는','상위 관문','미충족 상태','국소 피크','유효 후보','오프라인 대면','(initiative_gate)']) {
    const row=candidate(hierarchy.as_of_date,'in_person_meeting',phrase)
    const html=renderReunion({hierarchy:{...hierarchy,top_periods:[row]}})
    assert.match(html,/만남을 살펴볼 시기/)
    assert.ok(!html.includes(phrase),phrase)
  }
})

test('a repeated candidate range takes one slot and a distinct next date remains visible',()=>{
  const first=candidate('2027-01-12'), next=candidate('2027-01-14')
  const html=renderReunion({hierarchy:{...hierarchy,top_periods:[first,{...first},next]}})
  const timeline=html.split('다음 단계의 계산상 참고 시기')[1].split('연락 방향 참고값')[0]
  assert.equal((timeline.match(/만남을 살펴볼 시기/g)||[]).length,2)
  assert.match(timeline,/2027-01-12/)
  assert.match(timeline,/2027-01-14/)
})
