import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../SystemReadingViews.tsx', import.meta.url), 'utf8')
const fallback = readFileSync(new URL('../PeriodAiInterpretationPanel.tsx', import.meta.url), 'utf8')

test('topic context reaches nested reading children instead of being attached to a Fragment', () => {
  assert.match(source, /function injectReadingContext\(/)
  assert.match(source, /Children\.map\(/)
  assert.doesNotMatch(source, /cloneElement\(children,/)
  const integrated = source.slice(source.indexOf("system==='integrated'"), source.indexOf("system==='western' ? <>", source.indexOf("system==='integrated'")))
  assert.match(integrated, /injectReadingContext\(children/)
})

test('western gets scoped reading context while Saju and Thai do not append integrated AI reading children', () => {
  const westernStart = source.indexOf("system==='western' ? <>")
  const unavailableStart = source.indexOf('!view.allowed', westernStart)
  const western = source.slice(westernStart, unavailableStart)
  assert.match(western, /injectReadingContext\(children/)
  const sajuStart = source.indexOf("system==='saju' ? <>", unavailableStart)
  const thaiStart = source.indexOf(': <>', sajuStart)
  const saju = source.slice(sajuStart, thaiStart)
  assert.doesNotMatch(saju, /injectReadingContext\(children|\{children\}/)
})

test('fallback copy is reader language, not implementation language', () => {
  assert.match(fallback, /<summary>계산 근거 자세히 보기<\/summary>/)
  assert.doesNotMatch(fallback, /계산 기반 보조 해설/)
})

test('switching systems preserves the selected life topic', () => {
  const controls=source.slice(source.indexOf('className="system-switcher"'),source.indexOf('aria-label="생활 분야 선택"'))
  assert.match(controls, /onClick=\{\(\)=>setSystem\(id\)\}/)
  assert.doesNotMatch(controls, /setTopic\(/)
})
