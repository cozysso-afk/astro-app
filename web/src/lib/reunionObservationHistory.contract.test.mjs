import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { compareObservedEvents, nextUnconfirmedStage, observationReading } from './reunionObservation.ts'

const app=readFileSync(new URL('../AppNext.tsx',import.meta.url),'utf8')
const panel=readFileSync(new URL('../ReunionHierarchyPanelV3.tsx',import.meta.url),'utf8')
const helper=readFileSync(new URL('./reunionObservation.ts',import.meta.url),'utf8')
const css=readFileSync(new URL('../reunion-v3.css',import.meta.url),'utf8')
const compact=readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/index.ts',import.meta.url),'utf8')
const fixture=JSON.parse(readFileSync(new URL('./fixtures/reunion-observation-history.json',import.meta.url),'utf8'))

test('all optional observed relationship states remain distinct and no-input does not infer reality',()=>{
  for(const state of ['disconnected','recontacted','messaging','met','intimate_undefined','reunited']) assert.match(helper,new RegExp(`value:'${state}'`))
  assert.match(helper,/현재 상태 입력 안 함/)
  assert.match(helper,/실제 연락·만남 여부를 입력하지 않았으므로/)
  assert.equal(fixture.expected.next_stage,'relationship_rebuilding')
  assert.equal(nextUnconfirmedStage(fixture.observation.state),fixture.expected.next_stage)
  assert.match(observationReading({state:'',initiator:'',events:[]}).text,/추정하지 않아/)
  assert.match(observationReading(fixture.observation).text,/관계 정의·다음 만남·지속 행동/)
})

test('observed facts never enter the astrology calculation request and do enter interpretation context',()=>{
  const calculationBody=app.slice(app.indexOf('const body = {',app.indexOf('const runRelationship =')),app.indexOf('setRelationshipLoading',app.indexOf('const runRelationship =')))
  assert.doesNotMatch(calculationBody,/reunionObserved|reunion_observation/)
  assert.match(app,/reunionContextForAi/)
  assert.match(compact,/reunion_observation/)
  assert.match(compact,/관측 사실이며 점성 계산값이 아니다/)
})

test('past analysis reuses the existing reunion endpoint as an independent bounded calculation',()=>{
  assert.match(app,/const runReunionHistory/)
  assert.match(app,/fetchAuthorizedReunionRelationship/)
  assert.match(app,/start_date:reunionHistoryStart,end_date:reunionHistoryEnd/)
  assert.match(app,/과거 분석 범위는 한 번에 1~365일/)
  assert.match(panel,/선택한 과거 기간을 계산했지만 비교할 시기 신호를 찾지 못했어요/)
  assert.match(panel,/과거 분석을 실행하면 기록과 비교할 수 있어요/)
})

test('event fixture preserves match mismatch no-evidence and uncalculated outcomes',()=>{
  for(const status of ['match','mismatch','no_evidence','uncalculated']) assert.match(helper,new RegExp(`'${status}'`))
  const recontact=fixture.history.past_windows.find(row=>row.stage==='contact_recontact')
  const meeting=fixture.history.past_windows.find(row=>row.stage==='in_person_meeting')
  assert.ok(recontact.start<=fixture.observation.events[0].date&&fixture.observation.events[0].date<=recontact.end)
  assert.ok(!(meeting.start<=fixture.observation.events[1].date&&fixture.observation.events[1].date<=meeting.end))
  const compared=compareObservedEvents(fixture.observation,fixture.history,true)
  assert.deepEqual(compared.map(row=>row.status),['match','mismatch'])
  assert.deepEqual(compareObservedEvents(fixture.observation,null,false).map(row=>row.status),['uncalculated','uncalculated'])
  const withoutEvidence=compareObservedEvents({state:'met',initiator:'',events:[{kind:'rebuilding',date:'2026-06-24'}]},fixture.history,true)
  assert.equal(withoutEvidence[0].status,'no_evidence')
})

test('initiative comparison remains visible but is separate from observed first contact',()=>{
  assert.match(panel,/받는 연락 · 보내는 연락/)
  assert.match(panel,/차트 활성도만으로 수신·발신 행동이나 먼저 연락할 사람을 정할 수 없어요/)
  assert.match(panel,/입력한 실제 첫 연락/)
  assert.equal(fixture.expected.actual_initiator_is_observation,true)
})

test('iphone portrait keeps reunion cards within width without horizontal swipe clipping',()=>{
  assert.match(css,/reunion-observation-dates/)
  assert.match(css,/@media\(max-width:640px\)/)
  assert.match(css,/grid-template-columns:1fr/)
})
