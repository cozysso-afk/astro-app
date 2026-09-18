import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const css = readFileSync(new URL('../reading-font-fix-v54.css', import.meta.url), 'utf8')
const results = readFileSync(new URL('../PeriodFortuneResults.tsx', import.meta.url), 'utf8')

test('fortune reading surface exposes its selected period as a class', () => {
  assert.match(results, /fortune-experience period-\$\{period\}/)
})

test('mobile month and year long-form prose is larger without changing day/week', () => {
  assert.match(css, /fortune-experience\.period-month[\s\S]*reading-hero-subtitle[\s\S]*font-size:\s*16px\s*!important/)
  assert.match(css, /fortune-experience\.period-year[\s\S]*reading-hero-subtitle[\s\S]*font-size:\s*16px\s*!important/)
  assert.match(css, /fortune-experience\.period-month[\s\S]*reading-explanation > p[\s\S]*font-size:\s*15\.5px\s*!important/)
  assert.doesNotMatch(css, /fortune-experience\.period-(?:today|week)[\s\S]*font-size:\s*16px\s*!important/)
})
