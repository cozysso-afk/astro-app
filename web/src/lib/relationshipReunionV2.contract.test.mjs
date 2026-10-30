import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const server=readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/index.ts',import.meta.url),'utf8')
const publicError=readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/publicError.ts',import.meta.url),'utf8')
const panel=readFileSync(new URL('../RelationshipInterpretationPanel.tsx',import.meta.url),'utf8')
const hierarchyPanel=readFileSync(new URL('../ReunionHierarchyPanelV3.tsx',import.meta.url),'utf8')
const reunionReadingV4=readFileSync(new URL('./reunionReadingV4.ts',import.meta.url),'utf8')
const relationshipSummary=readFileSync(new URL('./relationshipUserSummary.ts',import.meta.url),'utf8')
const types=readFileSync(new URL('../appTypes.ts',import.meta.url),'utf8')
const reunionCss=readFileSync(new URL('../reunion-reading-product-v13.css',import.meta.url),'utf8')
const grounding=readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/reunionGroundingV2.ts',import.meta.url),'utf8')

test('reunion v2 is reunion-only and preserves other relationship cache version',()=>{
  assert.match(server,/REUNION_VERSION="relationship-v14\.2-gemini-single-author"/)
  assert.match(server,/versionForPurpose=\(purpose:Purpose\)=>purpose==="reunion"\?REUNION_VERSION:VERSION/)
  assert.match(server,/stable\(\{version:versionForPurpose\(purpose\),purpose,preferred,payload\}\)/)
})

test('server compiles question-first evidence and validates returned evidence refs',()=>{
  assert.match(server,/buildReunionEvidenceV2/)
  assert.match(server,/validateReunionGroundingV2/)
  assert.match(server,/const reunion_evidence_v2=buildReunionEvidenceV2\(base\)/)
  assert.match(server,/reunion_dimensions:base\.reunion_dimensions/)
  assert.match(server,/reunion_secondary_support:base\.reunion_secondary_support/)
  assert.match(server,/reunion_timing_windows:base\.reunion_timing_windows/)
  assert.match(server,/reunion_return_support:base\.reunion_return_support/)
  assert.match(server,/Solar Return\(태양회귀\)/)
  assert.match(server,/Lunar Return\(달회귀\)/)
  assert.match(server,/reunion_evidence_v2/)
  assert.match(server,/reunion_synthesis_v2:REUNION_V2_SCHEMA/)
  assert.match(server,/validEvidenceRefs/)
  assert.match(server,/refs\.some\(\(x:any\)=>!validEvidenceRefs\.has/)
  assert.match(publicError,/publicReunionV2/)
})

test('web routes reunion v2 into the single-author hierarchy view',()=>{
  assert.match(types,/reunion_synthesis_v2\?:/)
  assert.match(panel,/const reunionV2/)
  assert.match(panel,/<ReunionHierarchyPanel/)
  assert.match(hierarchyPanel,/const aiSummary = readerSentences\(reunionV2\?\.summary/)
  assert.match(hierarchyPanel,/const aiStage = readerSentences\(consultation\?\.current_stage/)
  assert.doesNotMatch(hierarchyPanel,/manuscriptFor|readingV4\.manuscript/)
  assert.match(panel,/reunion && reunionAi/)
})

test('reunion reading breaks long prose and exposes calculated day highlights',()=>{
  assert.match(panel,/function ReadableCopy/)
  assert.match(panel,/reunion-readable-copy/)
  assert.match(panel,/timing\.reconnection/)
  assert.match(panel,/timing\.incoming/)
  assert.match(panel,/timing\.outgoing/)
  assert.match(panel,/best_days/)
  assert.match(panel,/날짜로 좁혀 보면/)
  assert.match(panel,/연간·월간 배경/)
  assert.match(panel,/왜 이렇게 봤어\?/)
  assert.match(panel,/returnSupport/)
  assert.match(panel,/실제 연락·재회 확률이 아니라/)
  assert.match(reunionCss,/\.reunion-v2-window/)
  assert.match(reunionCss,/\.reunion-date-focus-list/)
})

test('reunion hierarchy puts concise consultation answers before technical engine state',()=>{
  const cache=readFileSync(new URL('./readingCache.ts',import.meta.url),'utf8')
  const hierarchy=readFileSync(new URL('./reunionHierarchy.ts',import.meta.url),'utf8')
  assert.match(cache,/relationship-v14\.2-gemini-single-author/)
  const headingMarkup=['현재 판정','관계가 어디까지 왔는지','앞으로 주목할 시기','연락 방향 참고값','다음 단계로 넘어가는 변화','<summary>지난 시기와 실제 기록 비교</summary>','<summary>계산 근거와 점수 보기</summary>']
  let cursor=-1
  for(const markup of headingMarkup){
    const next=hierarchyPanel.indexOf(markup)
    assert.ok(next>cursor,`${markup} order`)
    cursor=next
  }
  assert.doesNotMatch(hierarchyPanel,/왜 아직 서로를 신경 쓰기 쉬운가/)
  assert.doesNotMatch(hierarchyPanel,/이번 리딩의 결론/)
  assert.match(hierarchyPanel,/이미 지난 날짜의 비교 자료예요\. 예측 적중률을 뜻하지 않아요/)
  assert.match(hierarchyPanel,/점수는 계산 신호의 상대적 강도이며 연락·만남·재회 확률이 아니에요/)
  assert.match(hierarchyPanel,/차트 활성도만으로 수신·발신 행동이나 먼저 연락할 사람을 정할 수 없어요/)
  assert.match(panel,/이전 계산 저장본/)
  assert.match(panel,/AI 해설 생성 없이도 지난 활성기 · 현재 흐름 · 앞으로의 후보 시기/)
  assert.match(panel,/이전 저장본 시기 해설 · 현재\/미래 판단용 아님/)
  assert.match(panel,/<ReunionHierarchyPanel/)
  assert.match(panel,/\(!reunion \|\| !hierarchyData\)/)
  assert.match(hierarchy,/top_periods: topPeriods/)
  assert.match(hierarchy,/past_windows: pastWindows/)
  assert.match(hierarchy,/current_windows: currentWindows/)
  assert.match(hierarchy,/slice\(0,3\)/)
  assert.match(hierarchy,/row\.date >= asOf/)
  assert.match(server,/날짜 문자열을 새로 만들거나/)
  assert.match(server,/past_windows 날짜를 쓸 때는 반드시 과거\/지난 구간임을 분명히 하고 미래 후보로 승격하지 않는다/)
  assert.match(server,/카르마적 인연/)
  assert.match(server,/summary는 첫 2~3문장 안에서 현재 가장 가까운 단계/)
  assert.match(server,/repeat_risks는 현재 단계와 직접 연결되는 근거가 있는 문제만 최대 2개/)
  assert.match(server,/counterpart_to_user=상대 진행차트가 사용자 출생차트를 자극하는 방향/)
  assert.match(server,/계산 근거 → 쉬운 뜻 → 실제 관계에서 나타날 수 있는 장면 → 함께 걸리는 반대\/제약 근거 → 종합/)
  assert.match(server,/applying은 앞으로 강해지는 배경/)
  assert.match(grounding,/카르마적 인연/)
})

test('reunion quality guard preserves depth while moving technical detail behind disclosures',()=>{
  assert.match(hierarchyPanel,/const hasObservedState = Boolean\(observation\.state\)/)
  assert.match(hierarchyPanel,/const aiSummary = readerSentences/)
  assert.match(hierarchyPanel,/현재 관계 상태를 먼저 입력해 주세요/)
  assert.match(reunionReadingV4,/앞 단계 미확인/)
  assert.match(hierarchyPanel,/왜 다시 연결됐나/)
  assert.match(hierarchyPanel,/재회로 넘어가려면/)
  assert.match(hierarchyPanel,/다시 만났을 때의 유지력/)
  assert.match(hierarchyPanel,/다시 깨질 수 있는 지점/)
  assert.match(hierarchyPanel,/다음 단계로 보는 변화/)
  assert.match(hierarchyPanel,/현재 단계에 머무는 신호/)
  assert.match(hierarchyPanel,/<details className="reunion-v5-details"><summary>지난 시기와 실제 기록 비교<\/summary>/)
  assert.match(hierarchyPanel,/<details className="reunion-v5-details"><summary>계산 근거와 점수 보기<\/summary>/)
})

test('reunion exposes relative contact direction and behavioral change without statistical probability',()=>{
  assert.match(reunionReadingV4,/수신 · 상대 → 나/)
  assert.match(reunionReadingV4,/발신 · 나 → 상대/)
  assert.match(hierarchyPanel,/실제 첫 연락/)
  assert.match(hierarchyPanel,/실제 첫 연락자는 별도 기록으로 확인해요/)
  assert.match(hierarchyPanel,/next_stage_up_conditions/)
  assert.doesNotMatch(hierarchyPanel,/연락 가능성[^\n]{0,40}\d+%/)
})

test('reunion grounding validates Gemini prose without composing or rewriting its output',()=>{
  assert.doesNotMatch(grounding,/composeSummary|polishV2/)
  assert.match(grounding,/missing_direct_consultation/)
  assert.match(grounding,/unsupported_deterministic_claim/)
  assert.match(grounding,/incomplete_direct_consultation/)
  assert.match(grounding,/insufficient_grounded_content/)
  assert.match(grounding,/return \{ok: true, data\}/)
  assert.doesNotMatch(grounding,/\.filter\(\(w:any\)=>timingWindowAllowed|normalizeRefs|reunion_synthesis_v2:v2/)
})

test('calculated direction axes never become a first-contact prediction',()=>{
  assert.match(reunionReadingV4,/상대 쪽 흐름이 내 관계와 맞물리는 정도예요/)
  assert.match(reunionReadingV4,/내 쪽 흐름이 상대와의 관계를 의식하기 쉬운 정도예요/)
  assert.match(hierarchyPanel,/실제 첫 연락자는 별도 기록으로 확인해요/)
  for(const legacy of ['상대가 먼저 연락할 흐름은 약한 편이야','내가 먼저 짧게 말을 꺼내기 좋은 편이야','재접촉의 움직임은 살아 있어','다시 대화할 여지는 열려 있지만']) {
    assert.equal(hierarchyPanel.includes(legacy),false,`legacy directional copy must stay removed: ${legacy}`)
  }
})

test('all relationship modes keep distinct decision questions instead of one swapped-name template',()=>{
  for(const marker of ['궁합 전체 해설','결혼궁합 전체 해설','결혼생활 전체 해설','재회 흐름 전체 해설']) assert.match(panel,new RegExp(marker))
  assert.match(relationshipSummary,/함께 쓰는 돈, 집안일, 돌봄, 애정 표현, 혼자 쉬는 시간/)
  assert.match(relationshipSummary,/같은 다툼이 시작되는 말과 시간을 함께 적어봐/)
  assert.match(relationshipSummary,/이전에 대화가 끊긴 문제를 한 가지씩/)
  assert.match(relationshipSummary,/편안한 연락 빈도와 함께 보내고 싶은 시간을 서로 맞춰봐/)
  assert.match(panel,/생활비, 집안일, 가족 관계, 혼자 쉴 시간/)
  assert.match(panel,/오래 함께했다는 사실과 지금 편안하게 유지되고 있다는 건 같은 뜻이 아니야/)
  assert.match(panel,/연락이 다시 닿았다는 사실만으로 재결합이나 관계 회복이 확정됐다고 읽지는 마/)
})

test('archive filter guards iOS date controls from widening the page',()=>{
  assert.match(reunionCss,/\.archive-filter-grid input\[type='date'\]/)
  assert.match(reunionCss,/max-inline-size:\s*100%\s*!important/)
  assert.match(reunionCss,/@media \(max-width: 480px\)/)
  assert.match(reunionCss,/\.archive-filter-grid\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)\s*!important/)
})
