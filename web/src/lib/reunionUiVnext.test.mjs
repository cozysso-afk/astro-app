import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const panel = readFileSync(new URL('../ReunionHierarchyPanel.tsx', import.meta.url), 'utf8')
const host = readFileSync(new URL('../RelationshipInterpretationPanel.tsx', import.meta.url), 'utf8')

test('reunion vNext is present-first, directional, retrospective, future-gated, and rebuild-aware', () => {
  const headings = ['지금 두 사람은 어디에 있나','서로에게 걸리는 방향','관계 자체의 현재 단계','지난 활성기 · 사후 확인용','앞으로의 후보 시기','연락 ≠ 재회','관계를 다시 이어가려면','계산 근거 보기']
  let cursor = -1
  for (const heading of headings) {
    const next = panel.indexOf(heading)
    assert.ok(next > cursor, `${heading} order`)
    cursor = next
  }
  assert.match(panel, /실제 속마음이나 실제 선연락 행동을 관측한 값은 아니야/)
  assert.match(panel, /과거와 맞아 보인다는 사실만으로 엔진 정확도가 증명되는 것은 아니야/)
  assert.match(panel, /사건 확정일 아님/)
  assert.match(panel, /진행 컴포짓을 포함한 관계층/)
})

test('hierarchy reading does not require a paid AI call for base inspection', () => {
  assert.match(host, /추가 자연어 해설 · 선택/)
  assert.match(host, /위 계산 결과 확인에는 필요 없어/)
  assert.match(host, /reunion && hierarchyData && ai\?\.ok && ai\.data/)
  assert.match(host, /<ReunionHierarchyPanel/)
})
