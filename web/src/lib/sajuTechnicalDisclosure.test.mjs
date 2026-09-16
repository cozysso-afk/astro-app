import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('../SystemReadingViews.tsx', import.meta.url)), 'utf8')

assert.match(source, /function sajuSegmentHint\(/, 'Saju cards should use a reader-facing period hint')
assert.match(source, /<small>\{sajuSegmentHint\(c\.period\.start,c\.period\.end\)\}<\/small>/, 'default card summary should show the compact period hint')
assert.doesNotMatch(source, /<small>\{r\.segment_start\}\s*→\s*\{r\.segment_end_exclusive\}\s*미만<\/small>/, 'raw ISO boundaries must not appear in the default summary')
assert.match(source, /<details className="system-segment-technical"><summary>계산 상세<\/summary><p>정확 구간 · \{r\.segment_start\} → \{r\.segment_end_exclusive\} 미만<\/p>\{r\.boundary_note&&<p>\{r\.boundary_note\}<\/p>\}<\/details>/, 'exact boundaries and engine boundary notes should remain available inside calculation detail')
assert.doesNotMatch(source, /\$\{r\.layer\} \$\{r\.ganzhi\} · \$\{r\.stem_ten_god\} \(\$\{r\.segment_start\}부터/, 'life-area explanation should not surface raw timestamps')

console.log('Saju disclosure contract: reader surface is compact; exact boundaries remain available in calculation detail.')
