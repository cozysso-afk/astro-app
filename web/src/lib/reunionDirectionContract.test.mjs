import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const panel = readFileSync(new URL('../ReunionHierarchyPanel.tsx', import.meta.url), 'utf8')

test('contact signal does not become medium from a timing window when both directions are weak', () => {
  assert.match(panel, /function contactSignalBand\(hierarchyData: ReunionHierarchy, directionRows: DirectionRow\[\]\)/)
  assert.match(panel, /if \(bothDirectionsWeak\(directionRows\)\) return '낮음'/)
  assert.doesNotMatch(panel, /if \(hasContactWindow\) return '보통'/)
})

test('first-contact direction only resolves after a contact timing window opens', () => {
  assert.match(panel, /if \(!contactWindow\) return \{\s*label: '판정 보류'/)
  assert.match(panel, /RELATIVE_DIRECTION_MARGIN = 5/)
  assert.match(panel, /CLEAR_DIRECTION_MARGIN = 10/)
  assert.match(panel, /상대 쪽 약우세/)
  assert.match(panel, /나 쪽 약우세/)
  assert.match(panel, /양쪽 모두 절대 강도는 약하지만/)
  assert.match(panel, /연락이 생긴다면 어느 쪽이 상대적으로 앞서는지를 본 값/)
})

test('reunion UI exposes relative initiative and a useful behavior-change outlook', () => {
  assert.match(panel, /상대적 선연락 방향: \{initiative\.label\}/)
  assert.match(panel, /상대가 예전과 다르게 움직일 여지가 있나\?/)
  assert.match(panel, /변화 행동 신호: \{change\.label\}/)
  assert.match(panel, /실제 만남이나 관계 회복 단계가 뚜렷하지 않아서, 상대가 예전과 다르게 행동할 근거는 아직 약해/)
  assert.doesNotMatch(panel, /상대는 예전과 달라졌을까\?/) 
})
