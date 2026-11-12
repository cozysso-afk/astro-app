import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../reading-polish-v50.css', import.meta.url), 'utf8')

test('V50 polish loads before the shared owner and targets only reading conclusions', () => {
  const imports = [...main.matchAll(/import ['"]\.\/([^'"]+\.css)['"]/g)].map(match => match[1])
  assert.ok(imports.indexOf('reading-polish-v50.css') >= 0)
  assert.ok(imports.indexOf('reading-polish-v50.css') < imports.indexOf('reading-experience.css'))
  const fontOwner='reading-font-fix-v54.css'
  assert.ok(imports.indexOf(fontOwner)>imports.indexOf('reading-experience.css'))
  const finalFonts=readFileSync(new URL('../'+fontOwner,import.meta.url),'utf8')
  assert.match(finalFonts,/\.period-ai-hero-title-v4[^{}]*\{[^}]*font-family:[^;]+serif[^}]*font-synthesis:\s*none/)
  assert.match(css,/\.system-hero h3\s*\{[^}]*font-family:[^;]+serif[^}]*font-synthesis:\s*none/)
  assert.match(css, /font-synthesis:\s*none/)
  assert.match(css, /\.period-ai-head h3/)
  assert.match(css, /\.system-hero h3/)
})
