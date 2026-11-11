import test from 'node:test'
import assert from 'node:assert/strict'
import { hierarchy,renderReunion } from './fixtures/reunionPanel.mjs'
import { timing } from './readingExperience.fixtures.mjs'

test('direction scores remain visible and independent of the contact-stage score',()=>{
  const html=renderReunion()
  const section=html.split('<h4>연락 방향 참고값</h4>')[1].split('</section>')[0]
  assert.match(section,/수신 · 상대 → 나<\/b><strong>약함 · 30점/)
  assert.match(section,/발신 · 나 → 상대<\/b><strong>강함 · 70점/)
  assert.match(html,/연락·대화: 42/)
  assert.doesNotMatch(section,/42점|내가 먼저 연락하게/)
  assert.match(renderReunion({timing:{...timing,incoming:null}}),/수신 · 상대 → 나<\/b><strong>정보 부족<\/strong>/)
})

test('known initiator, mutual, unknown and absent keep their recorded meaning even without a valid hierarchy',()=>{
  for (const [initiator,label] of Object.entries({counterpart:'상대가 먼저',user:'내가 먼저',mutual:'서로 비슷한 시점',unknown:'확인 어려움','':'미기록'})) {
    for (const calculation of [hierarchy,null,{...hierarchy,validation:{status:'FAIL'}}]) {
      const html=renderReunion({hierarchy:calculation,observation:{state:'recontacted',initiator,events:[]}})
      assert.equal(html.split('<b>실제 첫 연락</b> · '+label).length-1,1)
    }
  }
  const empty=renderReunion({observation:undefined})
  assert.match(empty,/현재 관계 상태 미입력/)
  assert.match(empty,/<b>실제 첫 연락<\/b> · 미기록/)
})

test('a dated meeting does not confirm an initiator or agreement to resume dating',()=>{
  const html=renderReunion({observation:{state:'met',initiator:'unknown',events:[{kind:'meeting',date:'2025-09-14'}]}})
  assert.match(html,/두 사람이 실제로 다시 만났어요/)
  assert.match(html,/실제 첫 연락<\/b> · 확인 어려움/)
  assert.match(html,/직접 만난 날 · <time dateTime="2025-09-14">/)
  assert.doesNotMatch(html,/다시 교제하기로 합의<\/span><strong>확인됨/)
})
