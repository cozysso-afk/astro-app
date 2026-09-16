import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const index = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')

test('Noto Serif KR is loaded from document head for iOS standalone mode', () => {
  assert.match(index, /rel="preconnect" href="https:\/\/fonts\.googleapis\.com"/)
  assert.match(index, /rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin/)
  assert.match(index, /family=Noto\+Serif\+KR:wght@500;600;700&display=swap/)
})
