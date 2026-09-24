import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const fortune=readFileSync(new URL('./fortuneUserSummary.ts',import.meta.url),'utf8')
const fallback=readFileSync(new URL('./basicFortuneReading.ts',import.meta.url),'utf8')
const panel=readFileSync(new URL('../ReunionHierarchyPanel.tsx',import.meta.url),'utf8')
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
  assert.ok(panel.indexOf('지금 두 사람 사이에서 살아 있는 흐름') < panel.indexOf('앞으로의 후보 시기'))
})

test('rich reunion prose has a new cache contract and explicit depth instruction',()=>{
  assert.match(edge,/REUNION_VERSION="relationship-v12\.9-grounding-false-negative"/)
  assert.match(cache,/relationship-v12\.9-grounding-false-negative-v1/)
  assert.match(edge,/summary는 5~7문장/)
  assert.match(edge,/why_reconnect는 conclusion\+interpretation을 합쳐 6~9문장/)
  assert.match(edge,/오브와 전문용어 나열은 기술 근거로 밀어라/)
})


test('display bands separate nearby scores without changing ranking thresholds',()=>{
  assert.match(fortune,/FLOW_BAND_V26/)
  assert.match(fortune,/score >= 52.*다소 강함/)
  assert.match(fortune,/score >= 38.*다소 약함/)
  assert.match(fortune,/WEEKLY_ARC_HUMAN_V28/)
  assert.doesNotMatch(fortune,/beat\.label\}에는 .*두드러져/)
})

test('reunion dates are framed as candidate windows and QA labels stay minimal',()=>{
  assert.match(panel,/앞으로의 후보 시기/)
  assert.match(panel,/사건 확정일 아님/)
  assert.doesNotMatch(panel,/핵심 날짜 \{w\.date\}/)
  assert.match(qa,/2026-10-21 전후/)
  assert.match(qa,/해당 단계의 장기·중기·사건 촉발 근거가 함께 통과하는 기간/)
  assert.doesNotMatch(qa,/QA fixture · 재회운 사람말 본문/)
})

test('daily and weekly hero copy never leaks internal shorthand or checklist nouns',()=>{
  assert.doesNotMatch(fortune,/DAILY_SYMBOL_FOCUS/)
  assert.doesNotMatch(fortune,/말·정리 자극|목표·주도권 자극|책임·제약 자극/)
  assert.match(fortune,/누가 무엇을 언제까지 맡을지 분명히 하는 것/)
  assert.doesNotMatch(fortune,/요청·담당자·마감을 구체화하는 쪽/)
})

test('hierarchy numeric support uses stage-gated candidates rather than generic direction scores',()=>{
  assert.match(panel,/reunion-stage-status/)
  assert.match(panel,/contact_recontact/)
  assert.match(panel,/미래 후보 \$\{stage\.candidate_count\}개/)
  assert.match(panel,/사건 확률이나 현재 감정 세기가 아니라/)
  assert.doesNotMatch(panel,/재접촉 활성도<\/b><strong>\{view\.reconnection\.score/)
})

test('reunion prose contract is score-aware and validates every major human section',()=>{
  assert.match(edge,/candidate_count가 0이거나 activation이 null/)
  assert.match(edge,/generic incoming\/outgoing\/reconnection 점수로 hierarchy gate를 덮어쓰지 마라/)
  assert.match(edge,/why\.length<need\(420\)/)
  assert.match(edge,/timing\?\.conclusion.*need\(220\)/s)
  assert.match(edge,/rebuild\?\.conclusion.*need\(240\)/s)
  assert.match(edge,/repeat_risks\?\.conclusion.*need\(140\)/s)
})
