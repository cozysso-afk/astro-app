import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source=readFileSync(fileURLToPath(new URL('../FortuneFlowCards.tsx',import.meta.url)),'utf8')

test('reference flow uses a distinct lavender opal tint',()=>{
  assert.match(source,/title === '참고할 흐름'/)
  assert.match(source,/--opal-tint':'#e6ddf6'/)
  assert.match(source,/is-reference-flow/)
})
