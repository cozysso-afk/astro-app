import assert from 'node:assert/strict'
import test from 'node:test'
import { renderSystem, systemFixture, systemResponse } from './systemReadingView.fixtures.mjs'

test('Saju discloses the natal pillars, reading, and applied date boundary without writing advice', () => {
  const calculation=systemFixture()
  const html=renderSystem('saju',{calculation})
  assert.match(html,/사주 계산 근거/)
  assert.match(html,/甲子.*갑자/)
  assert.match(html,/일간 · 丙/)
  assert.match(html,/正印\(정인\)/)
  assert.match(html,/2026-10-08T12:00:00\+09:00 직전까지/)
  assert.match(html,/지지 연결 · 六合\(육합\)/)
  assert.match(html,/<details class="system-raw"><summary>날짜별 일진/)
  assert.doesNotMatch(html,/먼저 맡은 일의 완료 기준|class="system-hero"|western-score-card/)
})

test('Saju gives the original generated manuscript ahead of calculation, and guards missing precision', () => {
  const calculation=systemFixture()
  const interpretation=systemResponse({saju:'이달에 적용되는 원고의 고유 문장',western:'서양의 고유 문장'})
  const html=renderSystem('saju',{calculation,interpretation})
  assert.ok(html.includes('이달에 적용되는 원고의 고유 문장'))
  assert.ok(html.indexOf('이달에 적용되는 원고의 고유 문장')<html.indexOf('사주 계산 근거'))
  assert.doesNotMatch(html,/서양의 고유 문장/)
  delete calculation.precision
  const unavailable=renderSystem('saju',{calculation,interpretation})
  assert.match(unavailable,/계산 자료가 없어/)
  assert.doesNotMatch(unavailable,/이달에 적용되는 원고|甲子/)
})
