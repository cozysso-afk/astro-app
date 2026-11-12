import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const css = readFileSync(new URL('../reading-font-fix-v54.css', import.meta.url), 'utf8')
const results = readFileSync(new URL('../PeriodFortuneResults.tsx', import.meta.url), 'utf8')

test('fortune reading surface exposes its selected period as a class', () => {
  assert.match(results, /fortune-experience period-\$\{period\}/)
})

test('mobile month and year long-form prose is larger without changing day/week', () => {
  // Examine each selector's own declarations. Earlier day rules share this file.
  const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .flatMap(([,selectors,body]) => selectors.split(',').map(selector => ({selector:selector.trim(), body})))
  const sized = size => rules.filter(rule => rule.body.includes('font-size: '+size+'px !important'))
  for (const period of ['month','year']) {
    const scoped = rule => rule.selector.includes('.fortune-experience.period-'+period+' .system-reading.system-integrated')
    assert.ok(sized(16).some(rule => scoped(rule) && rule.selector.endsWith('.reading-hero-subtitle')))
    assert.ok(sized(15.5).some(rule => scoped(rule) && rule.selector.endsWith('.reading-explanation > p')))
  }
  assert.ok(!sized(16).some(rule => /\.fortune-experience\.period-(?:today|week)\b/.test(rule.selector)))
})
