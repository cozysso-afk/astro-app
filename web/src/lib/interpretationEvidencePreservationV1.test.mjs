import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { compactReunionHierarchyForExternal, compactReunionTimingForExternal } from './reunionCompactEvidence.ts'

const edge = readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/index.ts', import.meta.url), 'utf8')
const panel = readFileSync(new URL('../ReunionHierarchyPanelV3.tsx', import.meta.url), 'utf8')
const readingV4 = readFileSync(new URL('./reunionReadingV4.ts', import.meta.url), 'utf8')
const grounding = readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/reunionGroundingV2.ts', import.meta.url), 'utf8')
const cache = readFileSync(new URL('./readingCache.ts', import.meta.url), 'utf8')

function hierarchyWindow(date, stage, final, temporal_status) {
  return {
    date, start:date, end:date, stage, label:stage, final, temporal_status,
    components:{ long_term:20, mid_term:15, event_trigger:10, cross_system:5 },
  }
}

function compactPayload() {
  const hierarchy={
    version:'reunion-hierarchy-v2-test',
    as_of_date:'2026-10-07',
    validation:{status:'PASS',checks:[]},
    stages:{
      emotional_reactivation:{label:'의식',activation:58,candidate_count:2,gate_pass_count:2,hierarchy_pass_count:2},
      contact_recontact:{label:'연락',activation:null,candidate_count:0,gate_pass_count:0,hierarchy_pass_count:0},
      in_person_meeting:{label:'만남',activation:61,candidate_count:1,gate_pass_count:1,hierarchy_pass_count:1},
      relationship_rebuilding:{label:'재구축',activation:null,candidate_count:0,gate_pass_count:0,hierarchy_pass_count:0},
    },
    top_periods:[hierarchyWindow('2027-02-20','in_person_meeting',61,'future')],
    nearest_window:hierarchyWindow('2027-02-20','in_person_meeting',61,'future'),
    past_windows:[hierarchyWindow('2026-08-17','contact_recontact',55,'past')],
    current_windows:[hierarchyWindow('2026-10-07','emotional_reactivation',48,'current')],
    initiative:{available:false,verdict:'undetermined',reason:'independent action gate absent'},
    coverage:{western:true,saju:false},
    limitations:['test limitation'],
    score_meaning:'relative activation, not event probability',
  }
  return {
    reunion_hierarchy:compactReunionHierarchyForExternal(hierarchy,0),
    reunion_timing_windows:compactReunionTimingForExternal({
      windows:[{date:'2027-02-20',start:'2027-02-19',end:'2027-02-20',stage:'in_person_meeting',label:'만남'}],
      policy:'future gate only',
    },0),
  }
}

test('external compact relationship packet preserves structured past/current/future chronology', () => {
  const payload=compactPayload()
  assert.equal(payload.reunion_hierarchy.past_windows[0].date,'2026-08-17')
  assert.equal(payload.reunion_hierarchy.current_windows[0].date,'2026-10-07')
  assert.equal(payload.reunion_hierarchy.top_periods[0].date,'2027-02-20')
  assert.equal(payload.reunion_hierarchy.nearest_window.date,'2027-02-20')
  assert.equal(payload.reunion_hierarchy.stages.contact_recontact.candidate_count,0)
  assert.equal(payload.reunion_timing_windows.windows[0].date,'2027-02-20')
  assert.match(payload.reunion_hierarchy.temporal_policy,/사후 비교용/)
})

test('production Gemini packet preserves history/current context but keeps future-date ownership strict', () => {
  const packet=edge.slice(edge.indexOf('function hierarchyPacket'),edge.indexOf('function aspect'))
  assert.match(packet,/past_windows:/)
  assert.match(packet,/current_windows:/)
  assert.match(packet,/contextLimit=level===0\?3:level===1\?2:1/)
  assert.match(edge,/current_windows는 현재 단계 설명에만 사용하고/)
  assert.match(edge,/past_windows는 지난 활성 구간·사후 비교에만 사용한다/)
  assert.match(edge,/미래 후보로 승격하지 않는다/)
  assert.match(edge,/계산 자체가 없다는 뜻으로 바꾸지 마라/)
  assert.match(edge,/상대적 활성 방향 자체는 숨기지 말고/)
  assert.match(grounding,/item >= asOf/)
  assert.match(grounding,/unsupported_timing_window/)
})

test('reunion UI distinguishes availability states instead of collapsing no-candidate into no-calculation', () => {
  for (const marker of [
    "observed",
    "current_signal",
    "future_candidate",
    "no_candidate",
    "blocked",
    "not_calculated",
    "뚜렷한 시기 없음",
    "판정 자료 없음",
    "지금 주목",
  ]) assert.ok(readingV4.includes(marker),`missing state marker: ${marker}`)
  assert.match(readingV4,/info\.count === 0/)
  assert.match(readingV4,/stateStatus\(key, state\)/)
  assert.match(panel,/지난 시기와 실제 기록 비교/)
  assert.match(panel,/예측 적중률을 뜻하지 않아요/)
})

test('technical causal prose is never restored just to fill reader-language slots', () => {
  const body=panel.slice(panel.indexOf('function readerSentences'),panel.indexOf('function stageSet'))
  assert.match(body,/return plain\.slice\(0, limit\)\.join\(' '\)/)
  assert.doesNotMatch(body,/selected\.push\(row\)/)
})

test('reunion authored cache is invalidated for the temporal evidence contract', () => {
  assert.match(edge,/REUNION_VERSION="relationship-v14\.3-gemini-single-author"/)
  assert.match(cache,/relationship-v14\.3-gemini-single-author/)
})
