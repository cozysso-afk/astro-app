import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { compactReunionHierarchyForExternal, compactReunionTimingForExternal } from './reunionCompactEvidence.ts'

const edge = readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/index.ts', import.meta.url), 'utf8')
const panel = readFileSync(new URL('../ReunionHierarchyPanelV3.tsx', import.meta.url), 'utf8')
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
  assert.match(grounding,/x >= payload\.reunion_hierarchy\.as_of_date/)
})

test('reunion UI distinguishes availability states instead of collapsing no-candidate into no-calculation', () => {
  for (const marker of [
    "not_calculated",
    "calculated_no_candidate",
    "candidate_not_top",
    "current_active",
    "future_candidate",
    "계산됨 · 미래 후보 없음",
    "핵심 TOP 미포함",
    "현재 활성",
  ]) assert.ok(panel.includes(marker),`missing state marker: ${marker}`)
  assert.match(panel,/candidateCount === 0/)
  assert.match(panel,/contact\.status/)
  assert.match(panel,/지난 활성 구간/)
  assert.match(panel,/사후 비교용이고 미래 예측으로 재사용하지 않아/)
})

test('technical causal prose is retained when plain-language sentences do not fill the requested slots', () => {
  const body=panel.slice(panel.indexOf('function readerSentences'),panel.indexOf('function stageSet'))
  assert.match(body,/if \(plain\.length >= limit\)/)
  assert.match(body,/selected\.push\(row\)/)
  assert.doesNotMatch(body,/filter\(row => !TECHNICAL_RE\.test\(row\)\)\.slice/)
})

test('reunion authored cache is invalidated for the temporal evidence contract', () => {
  assert.match(edge,/REUNION_VERSION="relationship-v13\.0-answerability-evidence"/)
  assert.match(cache,/relationship-v13\.0-answerability-evidence-v1-consultation-depth-v3/)
})
