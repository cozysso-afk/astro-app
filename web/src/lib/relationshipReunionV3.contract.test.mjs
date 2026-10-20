import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const server=readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/index.ts',import.meta.url),'utf8')
const publicError=readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/publicError.ts',import.meta.url),'utf8')
const panel=readFileSync(new URL('../RelationshipInterpretationPanel.tsx',import.meta.url),'utf8')
const hierarchy=readFileSync(new URL('../ReunionHierarchyPanelV3.tsx',import.meta.url),'utf8')
const wrapper=readFileSync(new URL('../ReunionHierarchyPanel.tsx',import.meta.url),'utf8')
const css=readFileSync(new URL('../reunion-v3.css',import.meta.url),'utf8')
const types=readFileSync(new URL('../appTypes.ts',import.meta.url),'utf8')
const cache=readFileSync(new URL('./readingCache.ts',import.meta.url),'utf8')
const observation=readFileSync(new URL('./reunionObservation.ts',import.meta.url),'utf8')

test('reunion calculation and AI grounding contracts remain intact',()=>{
  assert.match(server,/REUNION_VERSION="relationship-v13\.2-contact-history"/)
  assert.match(server,/buildReunionEvidenceV2/)
  assert.match(server,/repairReunionGroundingV2/)
  assert.match(server,/validEvidenceRefs/)
  assert.match(server,/reunion_synthesis_v2:REUNION_V2_SCHEMA/)
  assert.match(publicError,/publicReunionV2/)
  assert.match(types,/reunion_synthesis_v2\?:/)
  assert.match(cache,/relationship-v13\.2-contact-history-v1-consultation-depth-v3/)
})

test('relationship result routes reunion to the hierarchy product while retaining AI synthesis input',()=>{
  assert.match(panel,/const reunionV2/)
  assert.match(panel,/<ReunionHierarchyPanel/)
  assert.match(wrapper,/ReunionHierarchyPanelV3/)
  assert.match(wrapper,/reunion-v3\.css/)
})

test('reunion v4 starts with an answer and explicit stage ladder before supporting detail',()=>{
  for(const heading of ['이번 조회의 답','재회 단계 한눈에','연락 자체는 얼마나 열려 있나','수신·발신 계산값 비교','선택한 과거 기간','상대가 예전과 다르게 움직일 여지가 있나','그래서 지금 무엇을 보면 되나','기억할 시기','재회를 판단할 현실 기준','내 현재 상황에 맞춰 읽기']) assert.match(hierarchy,new RegExp(heading))
  assert.match(observation,/현재 관계 상태 미입력/)
  assert.match(hierarchy,/생각·연락·만남·재구축은 단계별로 따로 봐/)
  assert.match(hierarchy,/연락은 살펴볼 수 있지만, 아직 재회 단계는 아님/)
  assert.match(hierarchy,/생각날 배경은 있어도, 연락을 기다릴 근거는 약함/)
  assert.match(hierarchy,/이번 조회에서는 재회 진행 단계를 뚜렷하게 잡기 어려움/)
  assert.doesNotMatch(hierarchy,/현재 계산은 연락 단계까지야/)
  assert.doesNotMatch(hierarchy,/왜 아직 서로를 신경 쓰기 쉬운가/)
})

test('reunion reader-facing section labels stay Korean instead of internal English markers',()=>{
  for(const label of ['현재 단계','연락 흐름','방향별 상대 활성도','행동 변화','다음 확인']) assert.match(hierarchy,new RegExp(label))
  for(const marker of ['CURRENT STATE','CONTACT','DIRECTION','BEHAVIOR CHANGE','NEXT CHECK']) assert.doesNotMatch(hierarchy,new RegExp(marker))
})

test('contact strength stays separate from relative initiative and even a small edge is shown',()=>{
  assert.match(hierarchy,/function contactReading\(hierarchy: ReunionHierarchy\)/)
  assert.match(hierarchy,/const stage = hierarchy\.stages\?\.contact_recontact/)
  assert.match(hierarchy,/stage\?\.activation/)
  const contactBody=hierarchy.slice(hierarchy.indexOf('function contactReading'),hierarchy.indexOf('function directionRow'))
  assert.doesNotMatch(contactBody,/directionRows/)
  assert.doesNotMatch(contactBody,/incomingBand|outgoingBand/)
  assert.match(hierarchy,/function initiativeReading\(rows: DirectionRow\[\]\)/)
  assert.match(hierarchy,/Math\.abs\(diff\) < 5/)
  assert.match(hierarchy,/근소 우세/)
  assert.match(hierarchy,/연락 자체 강도와 별개로 상대 비교에서는/)
  assert.doesNotMatch(hierarchy,/판정상 동률권/)
  assert.match(hierarchy,/const initiativeText = initiative\.text/)
  assert.doesNotMatch(hierarchy,/readerSentences\(consultation\?\.initiative/)
})

test('stage board separates emotional reactivation contact meeting and rebuilding',()=>{
  assert.match(hierarchy,/function stageVerdicts\(hierarchy: ReunionHierarchy\)/)
  for(const stage of ['emotional_reactivation','contact_recontact','in_person_meeting','relationship_rebuilding']) assert.match(hierarchy,new RegExp(stage))
  assert.match(hierarchy,/계산됨 · 미래 후보 없음/)
  assert.match(hierarchy,/미래 후보 \$\{candidateCount\}개 · 핵심 TOP 미포함/)
  assert.match(hierarchy,/reunion-v4-stage-grid/)
})

test('behavior-change question uses meeting and rebuilding evidence, not contact as the answer',()=>{
  const start=hierarchy.indexOf('function behaviorChangeReading')
  const end=hierarchy.indexOf('function nextActionReading')
  const body=hierarchy.slice(start,end)
  assert.match(body,/relationship_rebuilding/)
  assert.match(body,/in_person_meeting/)
  assert.match(body,/연락이 다시 닿는 것만으로 상대가 달라졌다고 볼 수는 없어/)
  assert.match(body,/약속·사과·조율/)
  assert.doesNotMatch(body,/수신신호|발신적합/)
})

test('reunion result applies only the selected observed state and advances to the next unanswered stage',()=>{
  for(const marker of ['observationReading','contextualGuide']) assert.match(hierarchy,new RegExp(marker))
  for(const marker of ['관측 사실 · 재접촉은 이미 발생','관측 사실 · 실제 만남 발생','관측 사실 · 친밀하지만 관계는 미정','관측 사실 · 관계 재정립 또는 재결합 합의']) assert.match(observation,new RegExp(marker))
  assert.match(hierarchy,/선택한 한 상태만 적용하고 다른 가정을 함께 붙이지 않아/)
  assert.doesNotMatch(hierarchy,/굳이 비교하면 누가 먼저인가/)
  assert.match(hierarchy,/실제로 누가 먼저 연락할지를 예측하지 않아/)
})

test('reunion keeps one concise disclaimer and puts calculation detail behind disclosure',()=>{
  assert.match(hierarchy,/reunion-single-disclaimer/)
  assert.equal((hierarchy.match(/실제 행동이나 상대의 속마음을 확정하지 않아/g)||[]).length,1)
  assert.match(hierarchy,/data-reading-export-ignore="true"/)
  assert.match(hierarchy,/계산 근거 자세히 보기/)
  assert.match(hierarchy,/reunion-stage-activation-list/)
})

test('reunion v4 keeps translucent aurora jelly cards and a mobile stage layout',()=>{
  assert.match(css,/--rv3-lilac/)
  assert.match(css,/--rv3-mint/)
  assert.match(css,/--rv3-sky/)
  assert.match(css,/--rv3-blush/)
  assert.match(css,/backdrop-filter:blur\(22px\)/)
  assert.match(css,/\.reunion-v4-stage-grid/)
  assert.match(css,/\.reunion-v4-answer/)
  assert.match(css,/@media\(max-width:640px\)/)
  assert.match(css,/\.reunion-v4-stage-grid\{grid-template-columns:1fr/)
})
