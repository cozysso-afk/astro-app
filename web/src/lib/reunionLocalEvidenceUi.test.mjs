import test from 'node:test'
import assert from 'node:assert/strict'
import {renderReunion} from './fixtures/reunionPanel.mjs'

const row={a:'Mercury',aspect:'trine',b:'Venus',tone:'supportive',reference_date:'2025-09-15',
  direction:'counterpart_to_user',source_path:'progressed_synastry.counterpart_to_user',phase:'applying',phase_basis:'monthly_orb_trend',
  exact_at:null,exact_at_basis:'not_resolved_from_monthly_sampling',target_house:{whole_house:4,quadrant_house:5}}
const evidence=[
  ...Array.from({length:7},(_,i)=>({...row,orb:.1+i*.01})),
  {...row,orb:.4,direction:'user_to_counterpart',phase:'separating',target_house:null},
  {...row,orb:.005,direction:'shared',phase:'exact',exact_at:'2025-09-15',exact_at_basis:'sampled_near_exact',target_house:null},
  {...row,orb:.6,direction:'relationship_itself',phase:'indeterminate',target_house:null},
  {...row,orb:null,a:'INVALID'}, {...row,orb:-1,a:'NEGATIVE'},
]
test('all four local progression directions retain separate dates, phase and houses without AI prose',()=>{
  const before=JSON.stringify(evidence)
  for(const props of [{},{hierarchy:null}]) {
    const html=renderReunion({...props,evidenceContract:{available:true,evidence}})
    for(const value of ['상대의 진행 차트 → 내 출생 차트','내 진행 차트 → 상대의 출생 차트','두 사람의 진행 차트','관계 자체의 진행 컴포짓',
      '표본일 2025-09-15','오브가 좁아지는 흐름','오브가 넓어지는 흐름','표본에서 정확한 각도에 근접','오브의 변화 방향 미확인',
      '홀사인 4하우스','사분면 5하우스','수성 · 금성 삼각','&lt;0.01°']) assert.ok(html.includes(value),value)
    assert.doesNotMatch(html,/INVALID|NEGATIVE|정확일|상대가 나를 생각하고 있다/)
    assert.equal((html.match(/data-progression-direction=/g)??[]).length,4)
    assert.equal((html.match(/표본일 2025-09-15/g)??[]).length,5)
  }
  assert.equal(JSON.stringify(evidence),before)
})
test('unknown birth-time excludes houses and unavailable evidence contracts are not displayed',()=>{
  const html=renderReunion({evidenceContract:{available:true,evidence},angleTimeAvailable:false})
  assert.match(html,/표본일 2025-09-15/)
  assert.doesNotMatch(html,/홀사인 4하우스|사분면 5하우스/)
  assert.doesNotMatch(renderReunion({evidenceContract:{available:false,evidence}}),/data-progression-direction=/)
})
