import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./index.ts', import.meta.url), 'utf8')

test('served relationship output is never rewritten with local glossary copy', () => {
  assert.doesNotMatch(source, /return deep\(out\)/)
  assert.match(source, /return out;}/)
})

test('reunion output cache and provenance use V14.3', () => {
  assert.match(source, /REUNION_VERSION="relationship-v14\.3-gemini-single-author"/)
})
