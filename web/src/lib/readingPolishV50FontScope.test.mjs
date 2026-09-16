import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const css = readFileSync(new URL('../reading-polish-v50.css', import.meta.url), 'utf8')

test('serif is scoped to reading conclusions, not tabs and score labels', () => {
  assert.doesNotMatch(css, /system-switcher[^\{]*\{[^}]*font-family:\s*'Noto Serif KR'/)
  assert.doesNotMatch(css, /system-topic-selector[^\{]*\{[^}]*font-family:\s*'Noto Serif KR'/)
  assert.doesNotMatch(css, /western-score-topline[^\{]*\{[^}]*font-family:\s*'Noto Serif KR'/)
})
