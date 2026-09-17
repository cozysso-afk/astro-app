import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const finalCss = readFileSync(new URL('../reading-font-fix-v54.css', import.meta.url), 'utf8')
const polishCss = readFileSync(new URL('../reading-polish-v50.css', import.meta.url), 'utf8')

test('integrated headline is bold Myeongjo while its supporting sentence is sans-serif', () => {
  assert.match(finalCss, /\.system-reading\.system-integrated[\s\S]*?\.period-ai-card\.period-ai-v18 \.period-ai-head h3[\s\S]*?font-family:\s*'Nanum Myeongjo'/)
  assert.match(finalCss, /\.system-reading\.system-integrated[\s\S]*?\.period-ai-card\.period-ai-v18 \.period-ai-head h3[\s\S]*?font-weight:\s*700\s*!important/)
  assert.match(finalCss, /\.system-reading\.system-integrated[\s\S]*?\.reading-hero-subtitle[\s\S]*?font-family:\s*-apple-system/)
  assert.match(polishCss, /\.fortune-experience \.period-ai-head \.reading-hero-subtitle[\s\S]*font-family:\s*-apple-system/)
})

test('integrated final owner does not restyle independent system heroes', () => {
  assert.doesNotMatch(finalCss, /\.system-hero h3/)
  assert.doesNotMatch(finalCss, /\.system-reading\.system-(?:western|saju|thai)/)
})
