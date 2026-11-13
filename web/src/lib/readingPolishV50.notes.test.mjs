import assert from 'node:assert/strict'
import test from 'node:test'
import { renderSystem, systemFixture } from './systemReadingView.fixtures.mjs'

test('Western raw detail follows the life question selected by the reader', () => {
  const calculation = systemFixture()
  for (const [field, remaining] of [['love',['연애','연락','재회']], ['exam',['시험']], ['money',['금전']], ['investment',['투자심리','신규진입','수익실현','투자주의']]]) {
    const html = renderSystem('western',{calculation,field})
    const cards = Array.from(html.matchAll(/class="western-score-topline"><strong>([^<]+)<\/strong>/g), match => match[1])
    assert.deepEqual(new Set(cards), new Set(remaining))
  }
})
