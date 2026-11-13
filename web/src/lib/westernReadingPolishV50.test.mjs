import assert from 'node:assert/strict'
import test from 'node:test'
import { renderSystem, systemFixture, systemResponse } from './systemReadingView.fixtures.mjs'

test('a verified Western manuscript leads the result and an unverified one stays hidden', () => {
  const systems={western:'서양점성술로 읽은 고유한 기간 해설'}
  const result=systemResponse(systems)
  const verified=renderSystem('western',{interpretation:result})
  assert.ok(verified.indexOf(systems.western)>=0)
  assert.ok(verified.indexOf(systems.western)<verified.indexOf('분야별 계산 점수'))
  const unavailable=renderSystem('western',{interpretation:{...result,provenance_verified:false},onGenerate:()=>{}})
  assert.doesNotMatch(unavailable,/서양점성술로 읽은 고유한 기간 해설/)
  assert.match(unavailable,/해설 생성<\/button>/)
})

test('a Western score of zero remains distinct from missing Western data', () => {
  const calculation=systemFixture()
  calculation.western.overall.금전={average:0,band:'매우 약함',spread:0}
  const zero=renderSystem('western',{calculation,field:'money'})
  assert.match(zero,/<strong>금전<\/strong><b>0<\/b>/)
  calculation.western.overall.금전=null
  const missing=renderSystem('western',{calculation,field:'money'})
  assert.match(missing,/이 분야에 계산된 점수가 없어/)
  assert.doesNotMatch(missing,/western-score-card/)
})
