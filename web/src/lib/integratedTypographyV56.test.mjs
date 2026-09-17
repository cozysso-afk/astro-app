import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const finalCss = readFileSync(new URL('../reading-font-fix-v54.css', import.meta.url), 'utf8')
const polishCss = readFileSync(new URL('../reading-polish-v50.css', import.meta.url), 'utf8')

test('integrated headline is bold serif while its supporting sentence is sans-serif', () => {
  assert.match(finalCss, /\.period-ai-card\.period-ai-v18 \.period-ai-head h3[\s\S]*font-family:\s*'Noto Serif KR'/)
  assert.match(finalCss, /\.period-ai-card\.period-ai-v18 \.period-ai-head h3[\s\S]*font-weight:\s*700\s*!important/)
  assert.match(finalCss, /\.period-ai-card\.period-ai-v18 \.reading-hero-subtitle[\s\S]*font-family:\s*-apple-system/)
  assert.match(polishCss, /\.fortune-experience \.period-ai-head \.reading-hero-subtitle[\s\S]*font-family:\s*-apple-system/)
})
