import assert from 'node:assert/strict'
import test from 'node:test'
import { renderSystem, systemFixture, systemResponse } from './systemReadingView.fixtures.mjs'
import { stat } from './readingExperience.fixtures.mjs'

test('the relationship scores stay independently accessible without generating a forecast or outreach advice', () => {
  for (const period of ['today','week','month']) {
    const calculation = systemFixture(period)
    calculation.western.overall.재회 = stat(58)
    calculation.western.overall.연락 = stat(42)
    const original = structuredClone(calculation)
    const html = renderSystem('western',{calculation,field:'love'})
    assert.match(html,/<strong>재회<\/strong><b>58<\/b>/)
    assert.match(html,/<strong>연락<\/strong><b>42<\/b>/)
    assert.doesNotMatch(html,/다시 연결될 조건은|먼저 연락할 이유|class="system-hero"/)
    assert.doesNotMatch(renderSystem('western',{calculation,field:'study'}),/<strong>재회<\/strong>/)
    assert.deepEqual(calculation, original)
  }
})

test('only verified provider text answers a relationship question on an independent tab', () => {
  const calculation = systemFixture('week')
  const systems = {western:'연락과 만남을 구분한 원고', saju:'사주에서 읽은 원고'}
  assert.match(renderSystem('western',{calculation,field:'love',interpretation:systemResponse(systems)}), /연락과 만남을 구분한 원고/)
  assert.doesNotMatch(renderSystem('western',{calculation,field:'love',interpretation:systemResponse(systems,{origin:'deterministic_safe'})}), /연락과 만남을 구분한 원고/)
  assert.doesNotMatch(renderSystem('saju',{calculation,field:'love',interpretation:systemResponse(systems)}), /연락과 만남을 구분한 원고/)
})
