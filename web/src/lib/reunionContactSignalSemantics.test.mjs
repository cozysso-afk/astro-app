import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const panel = readFileSync(new URL('../ReunionHierarchyPanel.tsx', import.meta.url), 'utf8')

test('contact stage is labeled as a timing signal, not a realized event', () => {
  assert.match(panel, /\['contact_recontact', '연락 흐름 신호'\]/)
  assert.match(panel, /연락 흐름 신호는 실제 연락 확률이 아니고/)
  assert.match(panel, /stageDisplayLabel\(row\.stage,row\.label\)/)
  assert.doesNotMatch(panel, /\['contact_recontact', '실제 연락·재접촉'\]/)
})

test('contact answer explicitly says the engine does not calculate high or low event probability', () => {
  assert.match(panel, /실제 연락 확률을 높음·낮음으로 산출하지 않아/)
  assert.match(panel, /확률을 낮게 계산했다는 뜻이 아니라/)
  assert.doesNotMatch(panel, /실제 연락 가능성이 높다고 말할 근거는 아직 부족해/)
  assert.doesNotMatch(panel, /지금 당장 실제 연락 가능성이 높다고 말할 근거는 부족해/)
})

test('reader language removes event-like recontact wording from AI prose', () => {
  assert.match(panel, /replace\(\/연락·재접촉\/g, '연락 흐름'\)/)
  assert.match(panel, /replace\(\/재접촉\/g, '연락·대화 재개'\)/)
  assert.match(panel, /과거 인연 관련 보조신호/)
})
