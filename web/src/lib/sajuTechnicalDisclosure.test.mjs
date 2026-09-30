import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('../SystemReadingViews.tsx', import.meta.url)), 'utf8')
const css = readFileSync(fileURLToPath(new URL('../system-reading-ux-v40.css', import.meta.url)), 'utf8')

assert.match(source, /function sajuHeadline\(/, 'Saju should build a reader-facing takeaway from validated life lenses')
assert.match(source, /function sajuOverviewText\(/, 'integrated overview should translate Saju lenses into reader-facing prose')
assert.match(source, /function sajuLeadSentence\(/, 'Saju headline and overview should share one action-first lead sentence')
assert.match(source, /const sajuOverviewSummary = topic==='전체'/, 'integrated Saju overview should use the reader-facing summary helper')
assert.match(source, /<p>\{sajuOverviewSummary\}<\/p><small>간지·십성은 사주 탭의 계산 근거에서 따로 확인할 수 있어\.<\/small>/, 'Saju overview should lead with plain-language advice and keep technical labels secondary')
assert.doesNotMatch(source, /selectedLenses\.map\(l=>l\.title\)\.join\(', '\)/, 'integrated Saju overview must not expose bare internal lens-title lists')
for (const internalCopy of [
  '현재 사주 계산 계약에는 이 분야를 직접 읽을 안전한 근거가 없어',
  '탭을 막지는 않고, 직접 근거가 적다는 상태로 보여줘',
  '생활 언어로 연결할 수 있는 사주 주제가 충분하지 않아',
  '세 체계를 같이 보면 · {view.state}',
]) assert.ok(!source.includes(internalCopy), `reader-facing Saju copy must not expose internal wording: ${internalCopy}`)
for (const staleSummaryCopy of [
  '무게를 둬',
  '평가받는 부분',
  '무게가 실려',
  '같이 확인할 건',
  '하루 한 번의 사건보다 며칠 동안 반복되는 역할과 반응을 기준으로 보면',
  '월초·중순·말까지 이어지는 책임과 생활 패턴을 기준으로 보면',
  '생활 기반의 재배치를 기준으로 보면',
]) assert.ok(!source.includes(staleSummaryCopy), `Saju summary should not fall back to classification-style prose: ${staleSummaryCopy}`)
for (const actionFirstCopy of [
  '먼저 맡은 일의 완료 기준과 기한을 적어.',
  '새 자료를 늘리기보다 이미 배운 내용을 한 번 설명해봐.',
  '예상 수입보다 지금 확실한 예산·고정지출·쓸 수 있는 시간을 먼저 적어.',
  '전하려는 내용을 짧은 제안이나 작은 결과물로 보여줘.',
  '함께 하는 일은 내 몫과 상대 몫을 나눠 적어.',
  '이어서 ${secondary}도 확인해.',
]) assert.ok(source.includes(actionFirstCopy), `Saju summary should keep concrete action-first copy: ${actionFirstCopy}`)
assert.match(source, /이번 기간에는 \{topic\}을 바로 설명할 사주 근거가 많지 않아\./, 'empty Saju topic state should explain missing evidence in user language')
assert.match(source, /className="system-hero saju-reader-hero"/, 'Saju independent view should have a reader-first hero')
assert.match(source, /<span>사주 · \{sajuPeriod\}<\/span><h3>\{sajuReaderHeadline\}<\/h3>/, 'Saju hero should show the period label and plain-language takeaway before technical data')
assert.doesNotMatch(source, /<header className="system-hero"><span>사주 · \{period\}<\/span><h3>\{view\.sajuSummary\}<\/h3>/, 'raw period and legacy technical summary must not lead the Saju view')

const readerTopics = source.indexOf('className="saju-reader-topics"')
const calculationDetail = source.indexOf('className="system-raw saju-calculation-detail"')
assert.ok(readerTopics >= 0 && calculationDetail > readerTopics, 'plain-language topics must appear before calculation disclosure')

assert.match(source, /className="system-lens-evidence"><b>근거<\/b><span>\{evidence \|\|/, 'compact evidence should remain visible without becoming the headline')
assert.match(source, /ganzhiWithReading\(r\.ganzhi\)/, 'Ganzhi evidence should include Korean readings')
assert.match(source, /<summary>사주 계산 근거 자세히 보기<\/summary>/, 'technical Saju data should live behind one clear disclosure')
assert.match(source, /적용 기간 · \{r\.segment_start\}부터 \{r\.segment_end_exclusive\} 직전까지/, 'exact solar-term boundaries must remain available inside calculation detail in reader-facing wording')
assert.doesNotMatch(source, /open=\{i<2\}/, 'technical Saju segments must not open by default')
assert.doesNotMatch(source, /<small>\{r\.segment_start\}\s*→\s*\{r\.segment_end_exclusive\}\s*미만<\/small>/, 'raw ISO boundaries must not appear in the default summary')

assert.match(css, /system-saju \.saju-reader-hero > h3[\s\S]*font-size:\s*clamp\(19px, 5vw, 23px\)/, 'Saju takeaway should have a clear headline hierarchy')
assert.match(css, /system-saju \.system-lens-evidence[\s\S]*font-size:\s*11px/, 'technical evidence should be visually secondary')

console.log('Saju disclosure contract: overview and hero use plain-language takeaways; Ganzhi, ten-god and exact boundaries stay secondary.')
