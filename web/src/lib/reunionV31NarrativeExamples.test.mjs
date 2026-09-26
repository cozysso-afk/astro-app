import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const panel = readFileSync(new URL('../ReunionHierarchyPanel.tsx', import.meta.url), 'utf8')

test('known awkward engine phrases have explicit reader-language replacements', () => {
  for (const phrase of [
    '현재 조회 시점 기준으로',
    '가장 먼저 활성화되는 단계는',
    '상위 관문',
    '미충족 상태',
    '국소\\s*피크',
    '유효 후보',
    '오프라인 대면',
  ]) assert.match(panel, new RegExp(`replace\\(\\/${phrase}`))
  assert.match(panel, /replace\(\/\\\(\(\?:emotional_reactivation\|contact_recontact\|in_person_meeting\|relationship_rebuilding\|initiative_gate\)\\\)\/g, ''\)/)
  assert.match(panel, /강한 후보들이 형성되어 있/)
  assert.match(panel, /실제 대면 만남/)
  assert.match(panel, /관계 재정의/)
})

test('calculated timing fallback groups same-stage dates instead of repeating one sentence per date', () => {
  assert.match(panel, /const grouped = new Map<string, ReunionPeriod\[\]>/)
  assert.doesNotMatch(panel, /return rows\.map\(\(row\)=>`\$\{row\.start\}~\$\{row\.end\}에는 \$\{row\.label\}과 관련된 흐름을 눈여겨볼 수 있어/)
})
