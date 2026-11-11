import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./systemReading.ts', import.meta.url), 'utf8')

test('saju hero summary leads with life guidance instead of repeating raw ten-god labels', () => {
  assert.match(source, /const lead = active\[0\]/)
  assert.match(source, /return lead\.key === '인성' \? `학습은 \$\{lead\.action\}` : lead\.action/)
  assert.doesNotMatch(source, /contexts\.map\(row=>`\$\{row\.layer\} \$\{ganzhiWithReading\(row\.ganzhi\)\}의 \$\{row\.stem_ten_god\}/)
})
