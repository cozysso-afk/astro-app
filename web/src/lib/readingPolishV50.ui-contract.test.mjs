import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../reading-polish-v50.css', import.meta.url), 'utf8')

test('V50 polish loads before the shared owner and targets only reading conclusions', () => {
  const imports = [...main.matchAll(/import ['"]\.\/([^'"]+\.css)['"]/g)].map(match => match[1])
  assert.ok(imports.indexOf('reading-polish-v50.css') >= 0)
  assert.ok(imports.indexOf('reading-polish-v50.css') < imports.indexOf('reading-experience.css'))
  assert.equal(imports.at(-1), 'reading-experience.css')
  assert.match(css, /font-synthesis:\s*none/)
  assert.match(css, /\.period-ai-head h3/)
  assert.match(css, /\.system-hero h3/)
})
