import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readingDateSemantics } from './readingDateSemantics.ts'

test('a selected fortune date is not mislabeled as today', () => {
  assert.deepEqual(readingDateSemantics('2026-10-22', '2026-10-24'), {
    selectedDate: '2026-10-22',
    actualToday: '2026-10-24',
    isActualToday: false,
    dayLabel: '선택한 운세일',
    subjectLabel: '선택한 운세일에는',
  })
})

test('today wording is used only when the selected date equals actual today', () => {
  assert.equal(readingDateSemantics('2026-10-24', '2026-10-24').dayLabel, '오늘')
  assert.equal(readingDateSemantics('2026-10-24', '2026-10-24').subjectLabel, '오늘은')
})

test('system overview does not render an array length as a bare zero', () => {
  const source = readFileSync(new URL('../SystemReadingViews.tsx', import.meta.url), 'utf8')
  assert.match(source, /view\.contexts\.length > 0 \? <p>/)
  assert.doesNotMatch(source, /view\.contexts\.length\s*&&\s*<p>/)
})
