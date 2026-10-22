import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const fortune=readFileSync(new URL('./fortuneUserSummary.ts',import.meta.url),'utf8')
const fallback=readFileSync(new URL('./basicFortuneReading.ts',import.meta.url),'utf8')
const panel=readFileSync(new URL('../ReunionHierarchyPanelV3.tsx',import.meta.url),'utf8')
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
  assert.match(panel,/재회 흐름 한눈에/)
  assert.match(panel,/받는 연락 · 보내는 연락/)
  assert.match(panel,/앞으로 주목할 시기/)
  assert.match(panel,/지금 확인할 것/)
  assert.match(panel,/왜 다시 연결됐나/)
  assert.match(panel,/재회로 넘어가려면/)
  assert.match(panel,/다시 깨질 수 있는 지점/)
  assert.ok(panel.indexOf('재회 흐름 한눈에') < panel.indexOf('계산 근거와 점수 보기'))
})

test('rich reunion prose has a new cache contract and explicit depth instruction',()=>{
  assert.match(edge,/REUNION_VERSION="relationship-v13\.3-stage-answer"/)
  assert.match(cache,/relationship-v13\.3-stage-answer-v1/)
  assert.match(edge,/summary는 2~3문장/)
  assert.match(edge,/why_reconnect는 conclusion\+interpretation을 합쳐 6~9문장/)
  assert.match(edge,/오브와 전문용어 나열은 기술 근거로 밀어라/)
  assert.match(edge,/reunion_observation\.state가 messaging이면 연락 발생은 이미 끝난 질문이다/)
})


test('display bands separate nearby scores without changing ranking thresholds',()=>{
  assert.match(fortune,/FLOW_BAND_V26/)
  assert.match(fortune,/score >= 52.*다소 강함/)
  assert.match(fortune,/score >= 38.*다소 약함/)
  assert.match(fortune,/WEEKLY_ARC_HUMAN_V28/)
  assert.doesNotMatch(fortune,/beat\.label\}에는 .*두드러져/)
})

test('reunion dates are framed as candidate windows and QA labels stay minimal',()=>{
  assert.match(panel,/앞으로 주목할 시기/)
  assert.match(panel,/표시된 날짜는 해당 단계의 계산 신호가 있는 시기예요/)
  assert.match(panel,/event\.stage === nextObserved/)
  assert.doesNotMatch(panel,/핵심 날짜/)
})

test('daily and weekly hero copy never leaks internal shorthand or checklist nouns',()=>{
  assert.doesNotMatch(fortune,/DAILY_SYMBOL_FOCUS/)
  assert.doesNotMatch(fortune,/말·정리 자극|목표·주도권 자극|책임·제약 자극/)
  assert.match(fortune,/누가 무엇을 언제까지 맡을지 분명히 하는 것/)
  assert.doesNotMatch(fortune,/요청·담당자·마감을 구체화하는 쪽/)
})

test('hierarchy numeric support uses stage-gated candidates rather than generic direction scores',()=>{
  assert.match(panel,/const stageState/)
  assert.match(panel,/return 'blocked'/)
  assert.match(panel,/앞 단계 미확인/)
  assert.match(panel,/활성도 \$\{displayScore\(score\)\}/)
  assert.match(panel,/실제 선연락이나 답장 여부를 뜻하는 확률은 아니에요/)
})

test('reunion prose contract is score-aware and validates every major human section',()=>{
  assert.match(edge,/candidate_count가 0이면 그 단계에는 공개할 미래 후보가 없다고 써라/)
  assert.match(edge,/generic incoming\/outgoing\/reconnection 점수로 hierarchy gate를 덮어쓰지 마라/)
  assert.match(edge,/whyConclusion\.length<12/)
  assert.match(edge,/whyInterpretation\.length<24/)
  assert.match(edge,/timing\?\.conclusion.*length<12/s)
  assert.match(edge,/rebuild\?\.conclusion.*length<12/s)
  assert.match(edge,/repeat_risks\?\.conclusion.*length<12/s)
})
