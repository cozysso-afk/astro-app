import assert from 'node:assert/strict'
import test from 'node:test'
import { renderSystem, systemFixture, systemResponse } from './systemReadingView.fixtures.mjs'

test('Thai results display the actual selected placements without writing a meaning from them', () => {
  const calculation=systemFixture()
  const money=renderSystem('thai',{calculation,field:'money'})
  assert.match(money,/물질적 기반 · 금성/)
  assert.doesNotMatch(money,/생활 리듬 · 토성|class="system-hero"|internal-prediction-status/)
  const health=renderSystem('thai',{calculation,field:'condition'})
  assert.match(health,/생활 리듬 · 토성/)
  assert.doesNotMatch(health,/물질적 기반 · 금성/)
})

test('a verified Thai manuscript precedes the wheel and its own period is preserved', () => {
  const calculation=systemFixture()
  const interpretation=systemResponse({thai:'계산된 배치에 대한 생성 원고',saju:'사용하지 않는 다른 체계 원고'})
  const html=renderSystem('thai',{calculation,interpretation})
  assert.ok(html.includes('계산된 배치에 대한 생성 원고'))
  assert.ok(html.indexOf('계산된 배치에 대한 생성 원고')<html.indexOf('태국점성술 계산 근거'))
  assert.match(html,/>2026-09-12<\/button>/)
  assert.doesNotMatch(html,/2026-09-12–2026-09-12|사용하지 않는 다른 체계 원고|>＋<|>×</)
})
