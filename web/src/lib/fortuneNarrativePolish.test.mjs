import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  distinctNarrativeParts,
  inspectKoreanNarrative,
  narrativeClaimFamily,
  polishKoreanSentence,
} from './fortuneNarrativePolish.ts'

const periodResults = readFileSync(new URL('../PeriodFortuneResults.tsx', import.meta.url), 'utf8')
const narrativeV2 = readFileSync(new URL('../PeriodFortuneNarrativeV2.tsx', import.meta.url), 'utf8')
const editorialV3 = readFileSync(new URL('./fortuneEditorialV3.ts', import.meta.url), 'utf8')

test('work headline is rewritten into natural subject-predicate Korean', () => {
  const source = '말로만 오가던 요청을 담당자·마감·완료 기준까지 구체화하기 좋은 날이야.'
  assert.equal(
    polishKoreanSentence(source),
    '말로만 오가던 요청은 담당자를 정하고, 마감일과 완료 기준까지 분명하게 정리하는 게 좋아.',
  )
})

test('generic motion filler is removed instead of repeated across every sector', () => {
  const source = '직장에서 오늘 가장 눈에 띄는 건 업무 범위야. 이 흐름은 아직 강해지는 중이라 첫 반응 하나보다 실제 변화가 이어지는지를 봐.'
  const polished = polishKoreanSentence(source)
  assert.doesNotMatch(polished, /이 흐름은 아직 강해지는 중|첫 반응 하나보다 실제 변화/)
  assert.match(polished, /업무 범위/)
})

test('semantic families dedupe paraphrased repetition, not only exact strings', () => {
  const rows = distinctNarrativeParts([
    '답장 속도 하나를 관계의 결론으로 확대하지 마.',
    '한 번의 반응만 보고 관계 전체를 단정하지 마.',
    '다음 약속이 실제로 잡히는지를 확인해.',
  ])
  assert.equal(rows.length, 2)
  assert.equal(narrativeClaimFamily(rows[0]), 'single-reaction')
  assert.equal(narrativeClaimFamily(rows[1]), 'follow-through')
})

test('Korean QA catches semantic predicate mismatch and repeated claims', () => {
  const issues = inspectKoreanNarrative([
    '변화 욕구를 직무·보상·일정 비교로 바꾸는 것이야.',
    '답장 뒤 실제 변화가 이어지는지를 봐.',
    '말보다 실제 행동이 이어지는지를 봐.',
    '다음 약속이 실제 만남으로 이어지는지를 봐.',
  ])
  assert.ok(issues.some(issue => /의미 호응 오류/.test(issue)))
  assert.ok(issues.some(issue => /동일 의미 반복/.test(issue)))
})

test('love UI exposes six conditional contexts at once instead of requiring a preselected status', () => {
  for (const marker of ['솔로 · 새 인연','짝사랑 · 마음 가는 사람','썸 · 알아가는 중','관계가 애매한 사이','연애 중','재회를 생각하는 경우']) {
    assert.match(editorialV3, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.doesNotMatch(periodResults, /LOVE_STATUS_OPTIONS\.map/)
  assert.match(periodResults, /솔로·짝사랑·썸·애매한 관계·연애 중·재회 관심/)
  assert.match(narrativeV2, /editorial\.loveContexts\.map/)
  assert.match(narrativeV2, /내 상황에 맞춰 읽기/)
})

test('completed period results route through editorial v3 and remain exportable', () => {
  assert.match(periodResults, /PeriodFortuneNarrativeV2/)
  assert.match(periodResults, /data-reading-export-root="period-fortune"/)
  assert.match(periodResults, /결과 이미지 저장/)
  assert.match(narrativeV2, /buildFortuneEditorialV3/)
  assert.match(narrativeV2, /전 분야를 통틀어 보면/)
  assert.match(narrativeV2, /기억할 시기/)
})
