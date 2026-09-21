import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const fortune=readFileSync(new URL('./fortuneUserSummary.ts',import.meta.url),'utf8')
const fallback=readFileSync(new URL('./basicFortuneReading.ts',import.meta.url),'utf8')
const panel=readFileSync(new URL('../RelationshipInterpretationPanel.tsx',import.meta.url),'utf8')
const edge=readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/index.ts',import.meta.url),'utf8')
const cache=readFileSync(new URL('./readingCache.ts',import.meta.url),'utf8')
const qa=readFileSync(new URL('../EditorialQaPreview.tsx',import.meta.url),'utf8')

test('daily home headline never drops back to the generic topic-list sentence',()=>{
  assert.match(fortune,/DAILY_HEADLINE_SCENE_V25/)
  assert.match(fortune,/function fallbackDayHeadline/)
  assert.match(fortune,/if \(when === '오늘'\) return dayEvidenceHeadline/)
  assert.match(fortune,/daySummary\(bestFlow, cautionFlow\)/)
  assert.doesNotMatch(fallback,/\$\{best\.topic\} 쪽은 활용할 만하고, \$\{watch\.topic\} 쪽은 속도를 낮추는 편이 좋아/)
})

test('hierarchy reunion shows a full human story before technical evidence',()=>{
  assert.match(panel,/지금 두 사람 사이에서 살아 있는 흐름/)
  assert.match(panel,/왜 다시 신경 쓰이거나 연결될 수 있나/)
  assert.match(panel,/지금 어디까지 와 있나/)
  assert.match(panel,/연락이 닿은 뒤, 재회까지는 뭐가 남나/)
  assert.match(panel,/다시 멀어질 수 있는 지점/)
  assert.match(panel,/여러 근거가 같이 가리키는 부분/)
  assert.ok(panel.indexOf('지금 두 사람 사이에서 살아 있는 흐름') < panel.indexOf('오늘 이후 후보 시기'))
})

test('rich reunion prose has a new cache contract and explicit depth instruction',()=>{
  assert.match(edge,/REUNION_VERSION="relationship-v12\.3-rich-human-narrative"/)
  assert.match(cache,/relationship-v12\.3-rich-human-narrative-v1/)
  assert.match(edge,/summary는 4~6문장/)
  assert.match(edge,/why_reconnect는 conclusion\+interpretation을 합쳐 5~8문장/)
  assert.match(edge,/오브와 전문용어 나열은 기술 근거로 밀어라/)
})


test('display bands separate nearby scores without changing ranking thresholds',()=>{
  assert.match(fortune,/FLOW_BAND_V26/)
  assert.match(fortune,/score >= 52.*다소 강함/)
  assert.match(fortune,/score >= 38.*다소 약함/)
  assert.match(fortune,/WEEKLY_ARC_COHERENCE_V27/)
  assert.doesNotMatch(fortune,/beat\.label\}에는 .*두드러져/)
})

test('reunion dates are framed as candidate windows and QA labels stay minimal',()=>{
  assert.match(panel,/오늘 이후 후보 시기/)
  assert.match(panel,/사건 확정일 아님/)
  assert.doesNotMatch(panel,/핵심 날짜 \{w\.date\}/)
  assert.match(qa,/2026-10-21 전후/)
  assert.match(qa,/각 단계 근거가 상대적으로 모이는 시기/)
  assert.doesNotMatch(qa,/QA fixture · 재회운 사람말 본문/)
})