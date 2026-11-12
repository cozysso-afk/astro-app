import test from 'node:test'
import {candidate,hierarchy,renderHierarchy,renderReunion} from './fixtures/reunionPanel.mjs'
import {buildRelationshipReadingDocument} from './authoredReadingDocument.ts'
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
  const v=server.match(/REUNION_VERSION="([^"]+)"/)?.[1]
  const stable=server.match(/,VERSION="([^"]+)"/)?.[1]
  const cache=readFileSync(new URL('./readingCache.ts',import.meta.url),'utf8')
  assert.ok(v && stable && v!==stable)
  assert.ok(cache.includes(`RELATIONSHIP_REUNION_AI_CACHE_CONTRACT = '${v}'`))
  assert.ok(cache.includes(`RELATIONSHIP_AI_CACHE_CONTRACT = '${stable}'`))
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
  assert.match(server,/const reunionSchema=\{\.\.\.REUNION_V2_SCHEMA,properties\}/)
  assert.match(server,/reunion_synthesis_v2:reunionSchema/)
  assert.match(grounding,/invalid_question_evidence_refs/)
  assert.match(grounding,/values\.every\(item => valid\.has\(item\)\)/)
  assert.match(publicError,/publicReunionV2/)
})

test('web routes reunion v2 into the single-author hierarchy view',()=>{
  assert.match(types,/reunion_synthesis_v2\?:/)
  const options={ok:true,origin:'gemini',provenance_verified:true,data:{
    headline:'다시 대화를 시작한 두 사람',core_summary:'같은 글이 두 번 표시되는지 확인해요.',
    core_reason:'관계 기록을 확인했어요.',core_action:'다음 약속을 함께 정해 봐요.',core_conditions:[],
    reunion_synthesis_v2:{summary:'그 뒤에 오간 대화를 함께 돌아봐요.'},
  }}
  const html=renderReunion({ai:options})
  assert.equal(html.split(options.data.reunion_synthesis_v2.summary).length,2)
  assert.match(html,/관계가 어디까지 왔는지/)
  assert.doesNotMatch(renderReunion({ai:{...options,provenance_verified:false}}),/그 뒤에 오간 대화를 함께 돌아봐요/)
  assert.doesNotMatch(hierarchyPanel,/manuscriptFor|readingV4\.manuscript/)
})

test('reunion reading breaks long prose and exposes calculated day highlights',()=>{
  const evidence={...hierarchy,top_periods:[candidate('2027-01-09')]}
  const html=renderReunion({hierarchy:evidence})
  assert.match(html,/다음 단계의 계산상 참고 시기[\s\S]*2027-01-09[\s\S]*만남을 살펴볼 시기/)
  assert.match(html,/수신 · 상대 → 나[\s\S]*발신 · 나 → 상대/)
  assert.match(html,/<details[^>]*><summary>계산 근거와 점수 보기/)
  assert.match(html,/점수는 계산 신호의 상대적 강도이며 연락·만남·재회 확률이 아니에요/)
  const result=buildRelationshipReadingDocument({ok:true,origin:'gemini',provenance_verified:true,data:{
    core_summary:'다시 안부를 주고받았어요.',core_reason:'두 번 모두 상대가 먼저 말을 꺼냈어요.',
    reunion_synthesis_v2:{timing:{conclusion:'연간·월간 배경과 개별 날짜를 함께 봐요.',windows:[{period:'2027-01-09',meaning:'실제 약속이 정해지는지 봐요.'}]}}
  }},'reunion','')
  assert.equal(result.sections.find(s=>s.id==='timing:0').blocks[0].text,'실제 약속이 정해지는지 봐요.')
  assert.equal(result.sections.find(s=>s.id==='timing:conclusion').blocks[0].text,'연간·월간 배경과 개별 날짜를 함께 봐요.')
})

test('reunion hierarchy puts concise consultation answers before technical engine state',()=>{
  const html=renderHierarchy({hierarchyData:{...hierarchy,top_periods:[candidate('2027-01-09')]},reunionV2:{summary:'저장한 실제 관계 상태를 먼저 살펴봐요.',consultation_answer:{next_stage_up_conditions:['만날 날짜를 약속했는지 살펴봐요.']}}})
  const headingMarkup=['현재 판정','관계가 어디까지 왔는지','다음 단계의 계산상 참고 시기','연락 방향 참고값','다음 단계로 넘어가는 변화','<summary>지난 시기와 실제 기록 비교</summary>','<summary>계산 근거와 점수 보기</summary>']
  let cursor=-1
  for(const markup of headingMarkup) {
    const next=html.indexOf(markup)
    assert.ok(next>cursor,`${markup} order`)
    cursor=next
  }
  assert.doesNotMatch(hierarchyPanel,/왜 아직 서로를 신경 쓰기 쉬운가/)
  assert.doesNotMatch(hierarchyPanel,/이번 리딩의 결론/)
  assert.match(hierarchyPanel,/이미 지난 날짜의 비교 자료예요\. 예측 적중률을 뜻하지 않아요/)
  assert.match(hierarchyPanel,/점수는 계산 신호의 상대적 강도이며 연락·만남·재회 확률이 아니에요/)
  assert.match(hierarchyPanel,/차트 활성도만으로 수신·발신 행동이나 먼저 연락할 사람을 정할 수 없어요/)
  assert.match(panel,/이전 계산 저장본/)
  const legacy=renderReunion({hierarchy:null})
  assert.match(legacy,/과거 날짜를 현재나 미래의 추천 시기로 읽지 마/)
  assert.doesNotMatch(legacy,/다음 단계의 계산상 참고 시기/)
  const oldDate='2023-01-01',when='2027-01-09'
  const combined=renderReunion({hierarchy:{...hierarchy,top_periods:[candidate(oldDate),candidate(when)]},
    historyHierarchy:{...hierarchy,past_windows:[candidate(oldDate)]},historyCalculated:true})
  assert.ok(combined.indexOf(when)<combined.indexOf('지난 시기와 실제 기록 비교'))
  assert.ok(combined.indexOf(oldDate)>combined.indexOf('지난 시기와 실제 기록 비교'))
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
  const ai={ok:true,origin:'gemini',provenance_verified:true,data:{chemistry:'호감이 오가는 표현',marriage_reading:{commitment_or_current_cycle:'둘이 합의한 생활 조건'},reunion_synthesis_v2:{consultation_answer:{meeting_gate:'다음 약속의 조건'}}}}
  const expected={
    compatibility:['궁합 해설','서로 끌리는 지점','호감이 오가는 표현'],
    marriage_unmarried:['결혼궁합 해설','약속과 결혼의 조건','둘이 합의한 생활 조건'],
    marriage_married:['결혼생활 해설','현재 관계의 과제','둘이 합의한 생활 조건'],
    reunion:['재회 해설','만남으로 넘어갈 조건','다음 약속의 조건'],
  }
  for(const [mode,[title,label,body]] of Object.entries(expected)) {
    const doc=buildRelationshipReadingDocument(ai,mode,'')
    assert.equal(doc.title,title)
    assert.equal(doc.sections.find(section=>section.label===label)?.blocks[0].text,body)
    for(const [other,[,otherLabel]] of Object.entries(expected)) if(other!==mode)
      assert.ok(!doc.sections.some(section=>section.label===otherLabel))
  }
  assert.match(relationshipSummary,/같은 다툼이 시작되는 말과 시간을 함께 적어봐/)
  assert.match(relationshipSummary,/이전에 대화가 끊긴 문제를 한 가지씩/)
  assert.match(relationshipSummary,/편안한 연락 빈도와 함께 보내고 싶은 시간을 서로 맞춰봐/)
})

test('archive filter guards iOS date controls from widening the page',()=>{
  assert.match(reunionCss,/\.archive-filter-grid input\[type='date'\]/)
  assert.match(reunionCss,/max-inline-size:\s*100%\s*!important/)
  assert.match(reunionCss,/@media \(max-width: 480px\)/)
  assert.match(reunionCss,/\.archive-filter-grid\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)\s*!important/)
})
