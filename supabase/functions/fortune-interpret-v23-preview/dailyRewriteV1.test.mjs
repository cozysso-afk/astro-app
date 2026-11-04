import test from 'node:test'
import assert from 'node:assert/strict'
import {buildDailyRewriteRequest,applyDailyRewrite} from './dailyRewriteV1.ts'
const data={headline:'제목은 그대로야.',overall:{summary:'요약은 그대로야.'},clusters:{condition:{condition:{conclusion:'이 결론도 유지해.',change_condition:'밤 시간에 피로하면 쉬어.',evidence_refs:['W:test']}}}}
const quality={stages:[{stage:6,passed:false}],daily_editorial:{issues:[{path:'clusters.condition.condition.change_condition',code:'daypart_without_local_window_evidence'}]}}
const payload={period_kind:'day',time_context:{today_word_allowed:false},evidence_ledger:[{id:'W:test',direction:'context',text:'실제 계산 근거'}]}
test('targeted repair retains all unrelated prose and evidence',()=>{
  const request=buildDailyRewriteRequest(data,quality,payload)
  const result=applyDailyRewrite(data,request,{patches:[{path:request.paths[0],text:'피로가 느껴진다면 현재 활동량을 기준으로 다시 판단해.'}]})
  assert.equal(result.headline,data.headline);assert.deepEqual(result.overall,data.overall)
  assert.equal(result.clusters.condition.condition.conclusion,data.clusters.condition.condition.conclusion)
  assert.deepEqual(result.clusters.condition.condition.evidence_refs,['W:test'])
  assert.equal(data.clusters.condition.condition.change_condition,'밤 시간에 피로하면 쉬어.')
  assert.deepEqual(request.targets[0].evidence,payload.evidence_ledger)
})
test('patch cannot write outside the failed field or omit its correction',()=>{
  const request=buildDailyRewriteRequest(data,quality,payload)
  for(const patches of [[],[{path:'headline',text:'다른 제목'}],[{path:request.paths[0],text:''}]])assert.throws(()=>applyDailyRewrite(data,request,{patches}))
})
test('structural or directional failures cannot take the prose-only repair path',()=>{
  assert.equal(buildDailyRewriteRequest(data,{...quality,stages:[{stage:3,passed:false}]},payload),null)
  assert.equal(buildDailyRewriteRequest(data,quality,{...payload,period_kind:'week'}),null)
})
test('a located today-word error is prose repair even when the generic gate puts it in stage three',()=>{
  const q={stages:[{stage:3,passed:false,issues:["선택 운세일이 실제 오늘과 다른데 '오늘' 표현 사용"]}],daily_editorial:{issues:[{path:'headline',code:'today_word_without_current_date'}]}}
  assert.ok(buildDailyRewriteRequest({...data,headline:'오늘 쓸 내용을 정해봐.'},q,payload))
  q.stages[0].issues.push('방향 근거 불일치')
  assert.equal(buildDailyRewriteRequest(data,q,payload),null)
})
test('a generic stage-six error outside the requested text paths prevents partial repair',()=>{
  const q={...quality,stages:[{stage:6,passed:false,issues:['clusters.condition.condition.change_condition: daypart_without_local_window_evidence','work_study.work 사용자 행동 누락']}]}
  assert.equal(buildDailyRewriteRequest(data,q,payload),null)
})
