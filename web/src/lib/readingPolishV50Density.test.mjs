import assert from 'node:assert/strict'
import test from 'node:test'
import { renderSystem, systemFixture } from './systemReadingView.fixtures.mjs'

test('Western scores start collapsed and preserve available fields without inventing missing scores', () => {
  const calculation = systemFixture()
  calculation.western.overall.재회 = null
  const html = renderSystem('western',{calculation})
  const cards = [...html.matchAll(/<details class="western-score-card"([^>]*)><summary><span class="western-score-topline"><strong>([^<]+)/g)]
  assert.deepEqual(new Set(cards.map(m=>m[2])), new Set(Object.keys(calculation.western.overall).filter(key=>key!=='재회')))
  assert.ok(cards.every(m=>!m[1].includes('open')))
})
