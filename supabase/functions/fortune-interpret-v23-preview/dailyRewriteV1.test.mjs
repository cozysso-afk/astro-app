import test from 'node:test'
import assert from 'node:assert/strict'
import {buildDailyRewriteRequest,buildDailyClarityRequest,buildPeriodQualityRewriteRequest,buildPeriodStructureRewriteRequest,buildRoleNeutralHeroRewriteRequest,applyDailyRewrite} from './dailyRewriteV1.ts'
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
  for(const patches of [[],[{path:'headline',text:'다른 제목'}]])assert.throws(()=>applyDailyRewrite(data,request,{patches}))
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

test('daily successful drafts still receive a bounded prose-only clarity edit',()=>{
  const request=buildDailyClarityRequest(data,payload)
  assert.ok(request.paths.includes('headline'))
  assert.ok(request.paths.includes('overall.summary'))
  assert.ok(!request.paths.includes('clusters.condition.condition.conclusion'))
  assert.deepEqual(request.paths,['headline','overall.summary'])
  assert.ok(!request.paths.some(p=>p.includes('evidence_refs')))
  assert.equal(buildDailyClarityRequest(data,{...payload,period_kind:'week'}),null)
  const patched=applyDailyRewrite(data,request,{patches:request.paths.map(path=>({path,text:'근거를 보존한 편집 문장이야.'}))})
  assert.deepEqual(patched.clusters.condition.condition.evidence_refs,data.clusters.condition.condition.evidence_refs)
})
test('editor merges located prose failures without bypassing structural gates',()=>{
  const request=buildDailyClarityRequest(data,payload,quality)
  assert.ok(request.paths.includes('clusters.condition.condition.change_condition'))
  assert.equal(buildDailyClarityRequest(data,payload,{...quality,stages:[{stage:1,passed:false,issues:['bad ref']}]}),null)
})

test('an unsupported exception may be removed, but core prose may not be emptied',()=>{
  const request=buildDailyRewriteRequest(data,quality,payload)
  const edited=applyDailyRewrite(data,request,{patches:[{path:request.paths[0],text:''}]})
  assert.equal(edited.clusters.condition.condition.change_condition,'')
  assert.throws(()=>applyDailyRewrite(data,{paths:['headline']},{patches:[{path:'headline',text:''}]}))
})


test('role-specific hero failure uses a bounded hero-only edit',()=>{
  const candidate={
    headline:'직장 업무와 학업 계획을 신중하게 조율해.',
    overall:{summary:'업무와 공부를 함께 정돈하는 날이야.',best_phase:'업무 검토',caution_phase:'학업 집중'},
    clusters:[{key:'relationship.summary',conclusion:'약속의 범위를 먼저 맞추는 편이 좋아.',real_scene:'요청을 받을 때 완료 기준이 서로 다를 수 있어.',evidence_refs:['W:test'],applicability:'direct'}],
  }
  const request=buildRoleNeutralHeroRewriteRequest(candidate,payload,{issues:['daily_overview_role_specific']})
  assert.deepEqual(request.paths,['headline','overall.summary','overall.best_phase','overall.caution_phase'])
  assert.ok(request.prompt.includes('전체 해설을 다시 쓰지 말고'))
  assert.ok(!request.paths.some(path=>path.startsWith('clusters.')))
  const patched=applyDailyRewrite(candidate,request,{patches:[
    {path:'headline',text:'약속의 범위와 완료 기준을 먼저 맞추기 좋은 날이야.'},
    {path:'overall.summary',text:'요청을 바로 받아들이기보다 서로 생각한 결과가 같은지 먼저 물어봐. 기준이 맞으면 다음 선택도 한결 단순해져.'},
    {path:'overall.best_phase',text:'요청의 범위와 완료 기준을 함께 정할 때'},
    {path:'overall.caution_phase',text:'상대가 원하는 결과를 짐작만 하고 넘어갈 때'},
  ]})
  assert.deepEqual(patched.clusters,candidate.clusters)
})

test('hero editor refuses unrelated structural failures',()=>{
  assert.equal(buildRoleNeutralHeroRewriteRequest(data,payload,{issues:['daily_primary_missing_or_duplicate:relationship.summary']}),null)
  assert.equal(buildRoleNeutralHeroRewriteRequest(data,{...payload,period_kind:'compatibility'},{issues:['daily_overview_role_specific']}),null)
})

test('extended period role and plain-language failures share the same bounded editor',()=>{
  const candidate={headline:'직장 업무의 에너지를 조율해.',overall:{summary:'업무와 학업을 정돈해.'},clusters:[]}
  const request=buildRoleNeutralHeroRewriteRequest(candidate,{...payload,period_kind:'month'},{issues:[
    'headline: period_hero_not_plain_language',
    'headline: period_hero_role_assumption',
  ]})
  assert.deepEqual(request.paths,['headline','overall.summary'])
})


test('extended period date failures repair only the located prose fields',()=>{
  const candidate={headline:'제목 유지',overall:{summary:'요약 유지'},clusters:{relationship:{love_general:{
    real_scene:'10월 5일부터 10월 20일까지 대화가 이어져.',
    conclusion:'대화 기준을 맞추는 과정이 중요해.',action:'서로 원하는 결과를 먼저 말해.',
    evidence_refs:['W:oct-05'],applicability:'direct',
  }}}}
  const q={stages:[{stage:6,passed:false}],period_reading:{issues:[
    {path:'clusters.relationship.love_general.real_scene',code:'claim_date_without_local_evidence'},
    {path:'clusters.relationship.love_general.real_scene',code:'claim_date_without_local_evidence'},
  ]}}
  const periodPayload={period_kind:'month',period:{start:'2026-10-01',end:'2026-10-31'},evidence_ledger:[
    {id:'W:oct-05',date:'2026-10-05',topic:'연애',text:'선택일의 관계 대화 근거'},
  ]}
  const request=buildPeriodQualityRewriteRequest(candidate,periodPayload,q)
  assert.deepEqual(request.paths,['clusters.relationship.love_general.real_scene'])
  const patched=applyDailyRewrite(candidate,request,{patches:[{
    path:request.paths[0],text:'대화가 시작되면 서로 원하는 결과와 지킬 기준을 먼저 맞춰봐.',
  }]})
  assert.equal(patched.headline,candidate.headline)
  assert.equal(patched.clusters.relationship.love_general.conclusion,candidate.clusters.relationship.love_general.conclusion)
  assert.deepEqual(patched.clusters.relationship.love_general.evidence_refs,['W:oct-05'])
})

test('period date repair refuses non-prose or non-stage-six failures',()=>{
  const candidate={headline:'제목',overall:{summary:'요약'}}
  const payload2={period_kind:'month',period:{start:'2026-10-01',end:'2026-10-31'},evidence_ledger:[]}
  assert.equal(buildPeriodQualityRewriteRequest(candidate,payload2,{stages:[{stage:5,passed:false}],period_reading:{issues:[{path:'headline',code:'claim_date_without_local_evidence'}]}}),null)
  assert.equal(buildPeriodQualityRewriteRequest(candidate,payload2,{stages:[{stage:6,passed:false}],period_reading:{issues:[{path:'headline',code:'primary_missing'}]}}),null)
})


test('period structure repair targets technical leads and every date-bearing scene',()=>{
  const candidate={
    headline:'수성의 작용으로 업무를 조율해.',
    overall:{summary:'직장과 학업의 에너지를 정돈해.',best_phase:'업무 검토',caution_phase:'학업 집중'},
    clusters:[
      {key:'relationship.summary',conclusion:'금성의 각이 관계를 자극해.',real_scene:'2026-10-05에 대화 기준을 맞춰.',action:'상대의 의도를 확인해.',evidence_refs:['W:1'],applicability:'direct'},
      {key:'money_news.money',conclusion:'지출 기준이 중요해.',real_scene:'10월 8일에 쓸 돈을 나눠.',action:'필수 지출을 먼저 적어.',evidence_refs:['W:2'],applicability:'direct'},
    ],
  }
  const request=buildPeriodStructureRewriteRequest(candidate,{period_kind:'month',period:{start:'2026-10-01',end:'2026-10-31'}},{issues:[
    'headline: period_hero_not_plain_language',
    'headline: period_hero_role_assumption',
    'clusters.relationship.summary: period_section_not_plain_language',
  ]})
  assert.ok(request.paths.includes('headline'))
  assert.ok(request.paths.includes('clusters.0.conclusion'))
  assert.ok(request.paths.includes('clusters.0.real_scene'))
  assert.ok(request.paths.includes('clusters.0.action'))
  assert.ok(request.paths.includes('clusters.1.real_scene'))
  assert.ok(!request.paths.includes('clusters.1.conclusion'))
  assert.ok(request.prompt.includes('전체 해설을 다시 쓰지 말고'))
})

test('period structure repair refuses structural omissions',()=>{
  assert.equal(buildPeriodStructureRewriteRequest({clusters:[]},{period_kind:'month'},{issues:['clusters.relationship.summary: primary_missing_or_duplicate']}),null)
})


test('root copy findings edit all authored period prose without touching evidence',()=>{
  const candidate={headline:'실무적 변화를 조율해.',overall:{summary:'조율의 흐름이 이어져.'},clusters:[
    {key:'relationship.summary',conclusion:'조율이 필요해.',real_scene:'피로 누적이 수면을 방해해.',action:'신중하게 정돈해.',evidence_refs:['W:1'],applicability:'direct'},
    {key:'money_news.money',conclusion:'지출 기준을 나눠.',real_scene:'2026-10-05에 결제를 검토해.',action:'필수 지출부터 적어.',evidence_refs:['W:2'],applicability:'direct'},
  ],relationship_reading:{watch:'답신이 늦어지니 상대가 먼저 연락할 때까지 기다려.'}}
  const request=buildPeriodStructureRewriteRequest(candidate,{period_kind:'month',period:{start:'2026-10-01',end:'2026-10-31'}},{issues:[
    'root: period_unobserved_event_or_span','root: period_generic_repetition',
  ]})
  assert.ok(request.paths.includes('headline'))
  assert.ok(request.paths.includes('clusters.0.conclusion'))
  assert.ok(request.paths.includes('clusters.0.real_scene'))
  assert.ok(request.paths.includes('clusters.0.action'))
  assert.ok(request.paths.includes('clusters.1.real_scene'))
  assert.ok(request.paths.includes('relationship_reading.watch'))
  assert.ok(request.prompt.includes('피로'))
})


test('field-specific period copy findings repair the exact non-cluster prose',()=>{
  const candidate={headline:'요청 범위를 맞추는 달이야.',overall:{summary:'서로 이해한 조건을 비교해.'},clusters:[],relationship_reading:{watch:'답신이 늦어지니 상대가 먼저 연락할 때까지 기다려.'}}
  const request=buildPeriodStructureRewriteRequest(candidate,{period_kind:'month',period:{start:'2026-10-01',end:'2026-10-31'}},{issues:[
    {path:'relationship_reading.watch',code:'period_unobserved_event_or_span'},
  ]})
  assert.ok(request.paths.includes('relationship_reading.watch'))
  assert.deepEqual(request.targets.find(target=>target.path==='relationship_reading.watch').failures,['period_unobserved_event_or_span'])
})


test('unsupported period detail fields may be removed without allowing other prose to vanish',()=>{
  const candidate={headline:'조건을 확인하는 달이야.',overall:{summary:'약속 범위를 비교해.'},clusters:[],investment_reading:{risk:'변동성이 커질 수 있어.'}}
  const request=buildPeriodStructureRewriteRequest(candidate,{period_kind:'month',period:{start:'2026-10-01',end:'2026-10-31'}},{issues:[
    {path:'investment_reading.risk',code:'period_unsupported_detail_prose'},
  ]})
  assert.deepEqual(request.allowEmptyPaths,['investment_reading.risk'])
  const patched=applyDailyRewrite(candidate,request,{patches:[{path:'investment_reading.risk',text:''}]})
  assert.equal(patched.investment_reading.risk,'')
  assert.throws(()=>applyDailyRewrite(candidate,{paths:['headline'],allowEmptyPaths:[]},{patches:[{path:'headline',text:''}]}))
})


test('period application failures target the exact scene and preserve the conditional instruction',()=>{
  const candidate={headline:'약속 범위를 확인하는 달이야.',overall:{summary:'조건을 비교해.'},clusters:[{key:'relationship.summary',conclusion:'범위를 먼저 말해.',real_scene:'주변에서 역할을 넘기려는 상황이 생겨.',action:'내일 오전에 답해.',evidence_refs:['W:1'],applicability:'direct'}]}
  const request=buildPeriodStructureRewriteRequest(candidate,{period_kind:'month',period:{start:'2026-10-01',end:'2026-10-31'}},{issues:[
    {path:'clusters.0.real_scene',code:'period_real_scene_not_conditional'},
    {path:'clusters.0.action',code:'period_specific_life_detail'},
  ]})
  assert.ok(request.paths.includes('clusters.0.real_scene'))
  assert.ok(request.paths.includes('clusters.0.action'))
  assert.ok(request.prompt.includes("반드시 '만약"))
})

test('mixed daily failures repair only the affected copy and retain evidence',()=>{
 const candidate={headline:'직장 업무',overall:{summary:'계획을 조율해.'},clusters:[
   {key:'relationship.contact_activation',conclusion:'대화에 좋은 에너지가 작용해.',real_scene:'시간을 정하면 이야기를 이어가기 좋아.',evidence_refs:['W:contact']},
 ]}
 const req=buildRoleNeutralHeroRewriteRequest(candidate,payload,{issues:['daily_overview_role_specific','daily_detail_abstract_repetition']})
 assert.deepEqual(req.paths,['headline','overall.summary','clusters.0.conclusion'])
 assert.deepEqual(applyDailyRewrite(candidate,req,{patches:req.paths.map(path=>({path,text:'편집한 문장'}))}).clusters[0].evidence_refs,['W:contact'])
})
