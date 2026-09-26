import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app=readFileSync(new URL('../AppNext.tsx',import.meta.url),'utf8')
const host=readFileSync(new URL('../RelationshipInterpretationPanel.tsx',import.meta.url),'utf8')
const panel=readFileSync(new URL('../ReunionHierarchyPanel.tsx',import.meta.url),'utf8')

test('reunion renders normalized progression evidence locally without requiring Gemini prose',()=>{
  assert.match(app,/evidenceContract=\{relationshipResult\.result\.reunion_evidence_contract \?\? null\}/)
  assert.match(host,/evidence=\{evidenceContract\?\.evidence \?\? \[\]\}/)
  assert.match(panel,/상대의 현재 진행 → 나/)
  assert.match(panel,/나의 현재 진행 → 상대/)
  assert.match(panel,/현재의 나 ↔ 현재의 상대 · 진행↔진행/)
  assert.match(panel,/진행 컴포짓 · 관계 자체/)
  assert.match(panel,/오브가 더 좁아지는 흐름/)
  assert.match(panel,/가장 가까운 구간을 지난 흐름/)
  assert.match(panel,/정확일/)
  assert.match(panel,/target_house/)
  assert.doesNotMatch(panel,/상대가 나를 생각하고 있다/)
  assert.doesNotMatch(panel,/재회 확률/)
})
