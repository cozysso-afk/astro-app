import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const server=readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/index.ts',import.meta.url),'utf8')
const publicError=readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/publicError.ts',import.meta.url),'utf8')
const panel=readFileSync(new URL('../RelationshipInterpretationPanel.tsx',import.meta.url),'utf8')
const hierarchyPanel=readFileSync(new URL('../ReunionHierarchyPanel.tsx',import.meta.url),'utf8')
const types=readFileSync(new URL('../appTypes.ts',import.meta.url),'utf8')
const reunionCss=readFileSync(new URL('../reunion-reading-product-v13.css',import.meta.url),'utf8')

test('reunion v2 is reunion-only and preserves other relationship cache version',()=>{
  assert.match(server,/REUNION_VERSION="relationship-v12\.9-grounding-false-negative"/)
  assert.match(server,/versionForPurpose=\(purpose:Purpose\)=>purpose==="reunion"\?REUNION_VERSION:VERSION/)
  assert.match(server,/stable\(\{version:versionForPurpose\(purpose\),purpose,preferred,payload\}\)/)
})

test('server compiles question-first evidence and validates returned evidence refs',()=>{
  assert.match(server,/buildReunionEvidenceV2/)
  assert.match(server,/repairReunionGroundingV2/)
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

test('web prefers v2 question flow while retaining old reunion fallback',()=>{
  assert.match(types,/reunion_synthesis_v2\?:/)
  assert.match(panel,/const reunionV2/)
  assert.match(panel,/다시 연결될 여지가 있는 이유/)
  assert.match(panel,/누가 먼저 움직일 흐름인가/)
  assert.match(panel,/접점이 강해지는 시기/)
  assert.match(panel,/다시 붙었을 때 관계 구조/)
  assert.match(panel,/다시 깨뜨릴 수 있는 반복 패턴/)
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

test('reunion hierarchy vNext keeps deterministic timing and a present-first stage-grounded UI',()=>{
  const cache=readFileSync(new URL('./readingCache.ts',import.meta.url),'utf8')
  const hierarchy=readFileSync(new URL('./reunionHierarchy.ts',import.meta.url),'utf8')
  const grounding=readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/reunionGroundingV2.ts',import.meta.url),'utf8')
  assert.match(cache,/relationship-v12\.9-grounding-false-negative-v1/)
  const headings=['지금 두 사람은 어디에 있나','서로에게 걸리는 방향','관계 자체의 현재 단계','지난 활성기 · 사후 확인용','앞으로의 후보 시기','연락 ≠ 재회','관계를 다시 이어가려면','계산 근거 보기']
  let cursor=-1
  for(const heading of headings){
    const next=hierarchyPanel.indexOf(heading)
    assert.ok(next>cursor,`${heading} order`)
    cursor=next
  }
  assert.match(hierarchyPanel,/가장 가까운 후보/)
  assert.match(hierarchyPanel,/실제 메시지·만남·관계 변화 기록과 비교하는 개인 사후 확인용/)
  assert.match(hierarchyPanel,/과거와 맞아 보인다는 사실만으로 엔진 정확도가 증명되는 것은 아니야/)
  assert.match(hierarchyPanel,/실제 속마음이나 실제 선연락 행동을 관측한 값은 아니야/)
  assert.match(hierarchyPanel,/진행 컴포짓을 포함한 관계층/)
  assert.match(hierarchyPanel,/다시 멀어질 수 있는 지점/)
  assert.match(hierarchyPanel,/보조지표 활성도/)
  assert.match(hierarchyPanel,/사건 확정일 아님/)
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
  assert.match(server,/이미 지난 날짜를 미래 핵심 시기처럼/)
  assert.match(server,/카르마적 인연/)
  assert.match(server,/summary는 첫 2~3문장 안에서 현재 가장 가까운 단계/)
  assert.match(server,/repeat_risks는 현재 단계와 직접 연결되는 근거가 있는 문제만 최대 2개/)
  assert.match(server,/counterpart_to_user=상대 진행차트가 사용자 출생차트를 자극하는 방향/)
  assert.match(server,/계산 근거 → 쉬운 뜻 → 실제 관계에서 나타날 수 있는 장면 → 함께 걸리는 반대\/제약 근거 → 종합/)
  assert.match(server,/applying은 앞으로 강해지는 배경/)
  assert.match(grounding,/카르마적 인연/)
})

test('archive filter guards iOS date controls from widening the page',()=>{
  assert.match(reunionCss,/\.archive-filter-grid input\[type='date'\]/)
  assert.match(reunionCss,/max-inline-size:\s*100%\s*!important/)
  assert.match(reunionCss,/@media \(max-width: 480px\)/)
  assert.match(reunionCss,/\.archive-filter-grid\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)\s*!important/)
})
