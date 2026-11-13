import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../reading-font-fix-v54.css', import.meta.url), 'utf8')
const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')
import { createElement as h } from 'react'
import { renderSystem } from './systemReadingView.fixtures.mjs'

test('live integrated daily headline and summary share the Myeongjo owner', () => {
  assert.match(css, /#root \.app-shell \.fortune-experience \.system-reading\.system-integrated[\s\S]*?\.period-ai-head h3[\s\S]*?font-family:\s*'Nanum Myeongjo'/)
  assert.match(css, /\.system-reading\.system-integrated[\s\S]*?\.period-ai-head h3[\s\S]*?font-weight:\s*700\s*!important/)
  assert.match(css, /period-today[\s\S]*?\.system-reading\.system-integrated[\s\S]*?\.reading-hero-subtitle[\s\S]*?font-family:\s*'Nanum Myeongjo'/)
  assert.ok(main.indexOf("import './reading-experience.css'") < main.indexOf("import './reading-font-fix-v54.css'"))
})

test('focused integrated readings pass the selected field to the generated-reading surface', () => {
  const child = ({field}) => h('span', {className:'selected-field'}, field?.id ?? 'overall')
  assert.match(renderSystem('integrated',{field:'study',children:h(child)}), /class="selected-field">study</)
  assert.match(renderSystem('integrated',{children:h(child)}), /class="selected-field">overall</)
})
