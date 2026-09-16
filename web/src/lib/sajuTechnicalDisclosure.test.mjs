import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('../SystemReadingViews.tsx', import.meta.url)), 'utf8')
const css = readFileSync(fileURLToPath(new URL('../system-reading-ux-v40.css', import.meta.url)), 'utf8')

assert.match(source, /function sajuHeadline\(/, 'Saju should build a reader-facing takeaway from validated life lenses')
assert.match(source, /className="system-hero saju-reader-hero"/, 'Saju independent view should have a reader-first hero')
assert.match(source, /<span>사주 · \{sajuPeriod\}<\/span><h3>\{sajuReaderHeadline\}<\/h3>/, 'Saju hero should show the period label and plain-language takeaway before technical data')
assert.doesNotMatch(source, /<header className="system-hero"><span>사주 · \{period\}<\/span><h3>\{view\.sajuSummary\}<\/h3>/, 'raw period and legacy technical summary must not lead the Saju view')

const readerTopics = source.indexOf('className="saju-reader-topics"')
const calculationDetail = source.indexOf('className="system-raw saju-calculation-detail"')
assert.ok(readerTopics >= 0 && calculationDetail > readerTopics, 'plain-language topics must appear before calculation disclosure')

assert.match(source, /className="system-lens-evidence"><b>근거<\/b><span>\{evidence \|\|/, 'compact evidence should remain visible without becoming the headline')
assert.match(source, /ganzhiWithReading\(r\.ganzhi\)/, 'Ganzhi evidence should include Korean readings')
assert.match(source, /<summary>사주 계산 근거 자세히 보기<\/summary>/, 'technical Saju data should live behind one clear disclosure')
assert.match(source, /정확 구간 · \{r\.segment_start\} → \{r\.segment_end_exclusive\} 미만/, 'exact solar-term boundaries must remain available inside calculation detail')
assert.doesNotMatch(source, /open=\{i<2\}/, 'technical Saju segments must not open by default')
assert.doesNotMatch(source, /<small>\{r\.segment_start\}\s*→\s*\{r\.segment_end_exclusive\}\s*미만<\/small>/, 'raw ISO boundaries must not appear in the default summary')

assert.match(css, /system-saju \.saju-reader-hero > h3[\s\S]*font-size:\s*clamp\(19px, 5vw, 23px\)/, 'Saju takeaway should have a clear headline hierarchy')
assert.match(css, /system-saju \.system-lens-evidence[\s\S]*font-size:\s*11px/, 'technical evidence should be visually secondary')

console.log('Saju disclosure contract: plain-language takeaway and action first; Ganzhi, ten-god and exact boundaries stay secondary.')
