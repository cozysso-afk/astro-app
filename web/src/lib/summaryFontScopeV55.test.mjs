import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../reading-font-fix-v54.css', import.meta.url), 'utf8')
const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')
const views = readFileSync(new URL('../SystemReadingViews.tsx', import.meta.url), 'utf8')

test('live integrated headline has an integrated-only Myeongjo owner and supporting copy stays sans-serif', () => {
  assert.match(css, /#root \.app-shell \.fortune-experience \.system-reading\.system-integrated[\s\S]*?\.period-ai-head h3[\s\S]*?font-family:\s*'Nanum Myeongjo'/)
  assert.match(css, /\.system-reading\.system-integrated[\s\S]*?\.period-ai-head h3[\s\S]*?font-weight:\s*700\s*!important/)
  assert.match(css, /\.system-reading\.system-integrated[\s\S]*?\.reading-hero-subtitle[\s\S]*?font-family:\s*-apple-system/)
  assert.ok(main.indexOf("import './reading-experience.css'") < main.indexOf("import './reading-font-fix-v54.css'"))
})

test('focused integrated topics use their own summary instead of the overall Saju summary', () => {
  assert.match(views, /injectReadingContext\(children,\{field:focusedField,systemOverview:overview\}\)/)
})

// Keep this contract on the user-authored PR head so all protected checks run normally.
