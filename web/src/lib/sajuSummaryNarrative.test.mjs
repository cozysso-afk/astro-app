import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./systemReading.ts', import.meta.url), 'utf8')

test('saju hero summary leads with life guidance instead of repeating raw ten-god labels', () => {
  assert.match(source, /선택 기간의 핵심 생활 주제는/)
  assert.match(source, /active\.slice\(0, 2\)\.map\(lens=>lens\.action\)/)
  assert.doesNotMatch(source, /contexts\.map\(row=>`\$\{row\.layer\} \$\{ganzhiWithReading\(row\.ganzhi\)\}의 \$\{row\.stem_ten_god\}/)
})
