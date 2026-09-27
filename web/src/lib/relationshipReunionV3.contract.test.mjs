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

test('reunion calculation and AI grounding contracts remain intact',()=>{
  assert.match(server,/REUNION_VERSION="relationship-v12\.9-grounding-false-negative"/)
  assert.match(server,/buildReunionEvidenceV2/)
  assert.match(server,/repairReunionGroundingV2/)
  assert.match(server,/validEvidenceRefs/)
  assert.match(server,/reunion_synthesis_v2:REUNION_V2_SCHEMA/)
  assert.match(publicError,/publicReunionV2/)
  assert.match(types,/reunion_synthesis_v2\?:/)
  assert.match(cache,/relationship-v12\.9-grounding-false-negative-v1-consultation-depth-v3/)
})

test('relationship result routes reunion to the v3 hierarchy product while retaining AI synthesis input',()=>{
  assert.match(panel,/const reunionV2/)
  assert.match(panel,/<ReunionHierarchyPanel/)
  assert.match(wrapper,/ReunionHierarchyPanelV3/)
  assert.match(wrapper,/reunion-v3\.css/)
})

test('reunion v3 starts with user questions instead of technical stage prose',()=>{
  const headings=['지금 이 관계를 한 줄로 보면','연락 자체는 얼마나 열려 있나','굳이 비교하면 누가 먼저인가','상대가 예전과 다르게 움직일 여지가 있나','기억할 시기','재회를 판단할 현실 기준','다시 만나면 반복될 수 있는 문제','내 현재 상황에 맞춰 읽기']
  for(const heading of headings) assert.match(hierarchy,new RegExp(heading))
  assert.doesNotMatch(hierarchy,/현재 계산은 연락 단계까지야/)
  assert.doesNotMatch(hierarchy,/왜 아직 서로를 신경 쓰기 쉬운가/)
  assert.doesNotMatch(hierarchy,/보조지표 활성도/)
})

test('contact parent strength is independent from sender direction',()=>{
  assert.match(hierarchy,/function contactReading\(hierarchy: ReunionHierarchy\)/)
  assert.match(hierarchy,/hierarchy\.stages\?\.contact_recontact\?\.activation/)
  const contactBody=hierarchy.slice(hierarchy.indexOf('function contactReading'),hierarchy.indexOf('function directionRow'))
  assert.doesNotMatch(contactBody,/directionRows/)
  assert.doesNotMatch(contactBody,/incomingBand|outgoingBand/)
  assert.match(hierarchy,/function initiativeReading\(rows: DirectionRow\[\]\)/)
  assert.match(hierarchy,/Math\.abs\(diff\) < 5/)
  assert.match(hierarchy,/뚜렷한 우세 없음/)
})

test('behavior-change question uses meeting and rebuilding evidence, not contact as the answer',()=>{
  const start=hierarchy.indexOf('function behaviorChangeReading')
  const end=hierarchy.indexOf('function conditionalGuides')
  const body=hierarchy.slice(start,end)
  assert.match(body,/relationship_rebuilding/)
  assert.match(body,/in_person_meeting/)
  assert.match(body,/연락이 다시 닿는 것만으로 상대가 달라졌다고 볼 수는 없어/)
  assert.match(body,/약속·사과·조율/)
  assert.doesNotMatch(body,/수신신호|발신적합/)
})

test('reunion result branches for materially different real-world contact states',()=>{
  for(const heading of ['현재 완전 단절·차단 상태라면','가끔 연락하거나 안부를 주고받는 중이라면','이미 다시 만나고 있거나 관계가 애매하다면']) assert.match(hierarchy,new RegExp(heading))
  assert.match(hierarchy,/차단 해제·직접 접촉/)
  assert.match(hierarchy,/안부만 반복되면 재회 단계로 올려 읽지 않아/)
  assert.match(hierarchy,/관계 정의와 반복 문제/)
})

test('reunion keeps one concise disclaimer and puts calculation detail behind disclosure',()=>{
  assert.match(hierarchy,/reunion-single-disclaimer/)
  assert.equal((hierarchy.match(/실제 행동이나 상대의 속마음을 확정하지 않아/g)||[]).length,1)
  assert.match(hierarchy,/data-reading-export-ignore="true"/)
  assert.match(hierarchy,/계산 근거 자세히 보기/)
  assert.match(hierarchy,/reunion-stage-activation-list/)
})

test('reunion v3 uses translucent aurora jelly cards with mobile spacing',()=>{
  assert.match(css,/--rv3-lilac/)
  assert.match(css,/--rv3-mint/)
  assert.match(css,/--rv3-sky/)
  assert.match(css,/--rv3-blush/)
  assert.match(css,/backdrop-filter:blur\(22px\)/)
  assert.match(css,/@media\(max-width:640px\)/)
  assert.match(css,/grid-template-columns:1fr/)
})
