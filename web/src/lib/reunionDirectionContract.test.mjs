import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const panel = readFileSync(new URL('../ReunionHierarchyPanelV3.tsx', import.meta.url), 'utf8')

test('contact activation uses hierarchy stage values, never incoming or outgoing direction scores', () => {
  const body=panel.slice(panel.indexOf('function contactReading'),panel.indexOf('function directionRow'))
  assert.match(body,/hierarchy\.stages\?\.contact_recontact/)
  assert.match(body,/stage\?\.activation/)
  assert.doesNotMatch(body,/incoming|outgoing|directionRows/)
})

test('direction score difference remains visible without claiming the actual first-contact actor', () => {
  assert.match(panel,/function initiativeReading\(rows: DirectionRow\[\]\)/)
  assert.match(panel,/Math\.abs\(diff\) < 5/)
  assert.match(panel,/근소 우세/)
  assert.match(panel,/실제 선연락 주체를 확정한다는 뜻은 아니야/)
  assert.match(panel,/실제로 누가 먼저 연락할지를 예측하지 않아/)
  assert.match(panel,/계산값과 별도 기록/)
})

test('reunion UI exposes relative activation and a separate behavior-change outlook', () => {
  assert.match(panel,/수신·발신 계산값 비교/)
  assert.match(panel,/상대가 예전과 다르게 움직일 여지가 있나/)
  assert.match(panel,/function behaviorChangeReading/)
  assert.match(panel,/실제 만남이나 관계 재구축 단계가 약하므로/)
  assert.doesNotMatch(panel,/상대는 예전과 달라졌을까/)
})
