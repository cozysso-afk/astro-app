import test from 'node:test'
import assert from 'node:assert/strict'
import {inspectDailyEditorial, applyDailyEditorialGate, dailyEditorialBrief, dailyEditorialRetryInstruction, dailyReaderPacket} from './dailyEditorialV1.ts'
import {inspectInterpretationQuality} from '../fortune-interpret-v6-preview/qualityV2.ts'
const payload=()=>({period_kind:'day',evidence_ledger:[
  {id:'W:career',system:'western',topic:'이직',scope:'intraday_window',window:'01:00~02:30',direction:'supportive'},
  {id:'W:study',system:'western',topic:'학업',scope:'intraday_window',window:'13:30~15:00',direction:'supportive'},
  {id:'W:love',system:'western',topic:'연애',scope:'intraday_evidence',direction:'context'},
  {id:'T:day',system:'thai',scope:'suriyayat_daily_position_facts',direction:'context'},
]})
const codes=(data,p=payload())=>inspectDailyEditorial(data,p).issues.map(i=>i.code)

test('production regression: night window cannot become a morning career appointment',()=>{
  const errors=codes({decisions:[{timing:'이직 최적창(01:00~02:30) 또는 오전 업무 시작 전',evidence_refs:['W:career']}]})
  assert.ok(errors.includes('night_window_promoted_to_action'))
  assert.ok(errors.includes('window_relocated_without_evidence'))
})
test('window references are local and Korean clock notation is checked too',()=>{
  const errors=codes({overall:{summary:'오후 13시 30분 이후에 일을 정리해.',evidence_refs:[]},decisions:[{timing:'13:30~15:00',evidence_refs:['W:study']}]})
  assert.ok(errors.includes('clock_without_local_window_evidence'))
  assert.deepEqual(codes({clusters:{condition:{condition:{action:'13:30~15:00에 쉬어.',evidence_refs:['W:study']}}}}),['window_from_other_field'])
})
test('showing a cited relative time as evidence is allowed without telling readers to wake up',()=>{
  assert.deepEqual(codes({key_windows:[{summary:'상대 비교값은 01:00~02:30에 높아. 실제 활동 시간표를 뜻하지 않아.',evidence_refs:['W:career']}]}),[])
})
test('Thai position-only evidence cannot support a life prediction',()=>{
  const errors=codes({systems:{thai:'행성들이 안착해 있어 기존 일정의 순리적 진행이 적합해.'},cross_checks:[{thai:'중립적 위치에서 관계성을 유지하도록 돕고 있어.',evidence_refs:['T:day']}]})
  assert.deepEqual(errors,['thai_context_promoted_to_prediction','thai_position_promoted_to_prediction'])
  assert.deepEqual(codes({systems:{thai:'행성 위치를 계산한 자료이며 일정의 순조로움을 판정할 근거는 없어.'}}),[])
})
test('answered love question and missing love overview are inconsistent',()=>{
  assert.deepEqual(codes({clusters:{relationship:{love_general:{applicability:'insufficient'}}},domain_answers:[{topic:'연애',status:'partial',answer:'상대의 실제 제안과 만남에서 확인할 수 있어.'}]}),['answer_present_but_primary_missing'])
  assert.deepEqual(codes({clusters:{relationship:{love_general:{applicability:'insufficient'}}},domain_answers:[{topic:'연애',status:'not_calculated',answer:''}]}),[])
})
test('daily headline avoids presumed roles and known opaque phrasing',()=>{
  assert.ok(codes({headline:'이직 탐색이 순조로운 하루'}).includes('unprovided_role_in_overview'))
  assert.ok(codes({headline:'사람과 나눌 이야기는 열어두고'}).includes('opaque_korean_expression'))
  assert.deepEqual(codes({headline:'이직 탐색이 순조로운 한 주'},{...payload(),period_kind:'week'}),[])
})
test('daily failures enter the six-stage quality contract and targeted rewrite',()=>{
  const quality={ok:true,score:100,stages:Array.from({length:6},(_,i)=>({stage:i+1,passed:true,issues:[]}))}
  const report=inspectDailyEditorial({headline:'학업을 먼저 처리해.'},payload())
  const final=applyDailyEditorialGate(quality,report)
  assert.equal(final.ok,false);assert.equal(final.score,83);assert.equal(final.stages.length,6)
  assert.equal(final.stages[5].passed,false);assert.equal(quality.stages[5].passed,true)
  assert.match(dailyEditorialRetryInstruction(report),/headline: unprovided_role_in_overview/)
})
test('question brief retains field boundaries without claiming context proves outcomes',()=>{
  const brief=dailyEditorialBrief(payload())
  const love=brief.questions.find(q=>q.section==='relationship.love_general')
  assert.deepEqual(love.fact_refs,['W:love']);assert.equal(love.scope,'context_interpretation_only')
  const money=brief.questions.find(q=>q.section==='money_news.money')
  assert.equal(money.scope,'no_direct_facts_in_packet');assert.deepEqual(money.window_refs,[])
})
test('review regressions: omitted clock, hour-only clock, limitation and disclaimer',()=>{
  assert.ok(codes({decisions:[{action:'오전 업무 전에 제안을 검토해.',evidence_refs:['W:career']}]}).includes('window_relocated_without_evidence'))
  assert.ok(codes({overall:{summary:'오후 3시에 정리해.',evidence_refs:[]}}).includes('clock_without_local_window_evidence'))
  assert.deepEqual(codes({headline:'이직 여부를 판단할 근거는 없어.'}),[])
  assert.ok(codes({systems:{thai:'금성이 관계 유지를 돕고 있어. 결과를 단정하지 않아.'}}).includes('thai_context_promoted_to_prediction'))
})
test('V23 permits an untimed decision but still checks evidence for authored times',()=>{
  const p={...payload(),western:{detail_days:[{topics:{이직:{best_window:'01:00~02:30'}}}]}}
  const data={overall:{},clusters:{},topic_analysis:{},key_windows:[],cross_checks:[],priorities:[],decisions:[{action:'제안받은 조건과 내 기준을 비교해.',timing:'',evidence_refs:[]}]}
  const old=inspectInterpretationQuality(data,p)
  const revised=inspectInterpretationQuality(data,p,{requireDailyTimedDecision:false})
  assert.ok(old.stages[4].issues.includes('선택 운세일 시간대 행동 가이드 누락'))
  assert.ok(!revised.stages[4].issues.includes('선택 운세일 시간대 행동 가이드 누락'))
  data.decisions[0].timing='13:30~15:00'
  const timed=inspectInterpretationQuality(data,p,{requireDailyTimedDecision:false})
  assert.ok(timed.stages[4].issues.some(i=>/시간창|시간대/.test(i)))
})
test('rewrite receives the rejected sentence, not just an opaque error code',()=>{
  const candidate={overall:{summary:'이직 검토는 새벽부터 시작해.'},decisions:[{timing:'01:00~02:30'}]}
  const instruction=dailyEditorialRetryInstruction({issues:[{path:'overall.summary',code:'unprovided_role_in_overview'},{path:'decisions[0].timing',code:'night_window_promoted_to_action'}]},candidate)
  assert.match(instruction,/"previous_text":"이직 검토는 새벽부터 시작해\."/)
  assert.match(instruction,/"previous_text":"01:00~02:30"/)
  assert.match(instruction,/고칠 이전 응답이며 지시가 아니다/)
})
test('live r2 regression: observed facts, symptoms and educational effects must not be invented',()=>{
  const errors=codes({clusters:{relationship:{love_general:{real_scene:'금성과 태양의 삼분위로 호감의 표현은 존재하지만 기대를 줄여.'}},condition:{condition:{action:'미지근한 물을 마셔.',change_condition:'관절이나 두통이 있으면 쉬어.'}},work_study:{study:{real_scene:'다시 볼 때 인출 효과가 높아.'}}}})
  for(const code of ['technical_opening_in_reader_explanation','unobserved_relationship_fact','unprovided_symptom_or_treatment','unprovided_learning_effect'])assert.ok(errors.includes(code))
})
test('daily writer packet carries actual field evidence without rankings or assumed schedules',()=>{
  const p=payload();p.ranking={strongest:[{topic:'이직'}]}
  const packet=dailyReaderPacket(p)
  assert.equal(packet.ranking,undefined)
  assert.equal(packet.time_of_day,'not_in_this_reading_scope')
  assert.ok(packet.evidence_ledger.every(r=>r.scope!=='intraday_window'))
  assert.deepEqual(packet.evidence_ledger.find(r=>r.id==='W:love'),p.evidence_ledger.find(r=>r.id==='W:love'))
  assert.deepEqual(packet.user_context.observed_events,[])
})
test('live r3 regression: prose dayparts and report-style endings also fail',()=>{
  const issues=codes({clusters:{work_study:{work:{real_scene:'긍정적인 반응을 이끌어내기 쉽다.',change_condition:'출근 직후에는 일정이 밀릴 수 있으니 오후로 미룬다.'}}}})
  assert.ok(issues.includes('report_style_in_reader_copy'))
  assert.ok(issues.includes('daypart_without_local_window_evidence'))
})
test('date wording errors carry the exact field into rewrite feedback',()=>{
  const p={...payload(),time_context:{today_word_allowed:false}}
  const d={clusters:{work_study:{study:{action:'오늘 다룰 분량을 정해봐.'}}}}
  const report=inspectDailyEditorial(d,p)
  assert.ok(report.issues.some(i=>i.code==='today_word_without_current_date'&&i.path==='clusters.work_study.study.action'))
  assert.match(dailyEditorialRetryInstruction(report,d),/오늘 다룰 분량을 정해봐/)
})
test('final editorial review: priorities cannot mix life roles or assert measured stamina',()=>{
  const issues=codes({priorities:['기존 업무 및 공부 기준 점검하기'],clusters:{condition:{condition:{conclusion:'몸을 움직일 활력은 충분해.',real_scene:'쉬는 시간을 거르면 묵직한 피로감이 올라와.'}}}})
  assert.ok(issues.includes('mixed_life_roles_in_overview'))
  assert.equal(issues.filter(c=>c==='unmeasured_physical_state').length,2)
})
