import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement as h, Fragment } from 'react'
import { renderSystem, systemFixture, systemResponse } from './systemReadingView.fixtures.mjs'

test('integrated results pass their selected field through fragment and wrapper children', () => {
  const child=({field})=>h('b',null,'통합 원고 '+field?.id)
  const tree=h(Fragment,null,h('div',null,h(child)))
  const html=renderSystem('integrated',{field:'exam',children:tree})
  assert.match(html,/<div><b>통합 원고 exam<\/b><\/div>/)
})

test('each independent system displays only its own verified manuscript and never the integrated child', () => {
  const systems={western:'서양에서 쓴 문장',saju:'사주에서 쓴 문장',thai:'태국에서 쓴 문장'}
  for(const [selected,expected] of Object.entries(systems)) {
    const html=renderSystem(selected,{interpretation:systemResponse(systems),children:h('b',null,'통합 원고 별도')})
    assert.ok(html.includes(expected))
    assert.ok(Object.values(systems).filter(t=>t!==expected).every(t=>!html.includes(t)))
    assert.doesNotMatch(html,/통합 원고 별도/)
  }
})

test('generation and retry controls accurately reflect the service state', () => {
  const generate=()=>{}
  const loading=renderSystem('western',{onGenerate:generate,generating:true})
  assert.match(loading,/role="status">Gemini 해설을 생성하고 있어/)
  assert.match(loading,/<button[^>]*disabled[^>]*>해설 생성/)
  const failed=renderSystem('western',{onGenerate:generate,generationError:'생성 요청에 실패했어.'})
  assert.match(failed,/role="status">생성 요청에 실패했어/)
  assert.match(failed,/>해설 다시 생성<\/button>/)
})

test('system subjects route by authorship and evidence, including sparse archived readings',()=>{
  const systems={western:'전체 서양 원고',saju:'전체 사주 원고',thai:'전체 태국 원고'}
  const data={systems,clusters:{work_study:{study:{conclusion:'학업 결론',real_scene:'학업 상황',action:'학업 행동',change_condition:'',applicability:'direct',evidence_refs:['W:detail:1']}},money_news:{money:{conclusion:'혼합 근거',real_scene:'상황',action:'행동',applicability:'direct',evidence_refs:['W:detail:1','T:daily:1']}}},
    topic_analysis:{금전:{verdict:'금전 결론',reason:'금전 근거',evidence_refs:['W:detail:9']}},
    system_field_readings:[{system:'saju',topic:'학업',reading:'사주 학업 원고',evidence_refs:['S:daily:1']},{system:'thai',topic:'학업',reading:'태국 학업 원고',evidence_refs:['T:taksajorn:1']}]}
  const interpretation=systemResponse(systems,{data,interpreter_version:'supabase-ai-v23.26-question-evidence'})
  for(const period of ['today','week','month','year']){
    const calculation=systemFixture(period)
    for(const [system,expected] of [['western','학업 결론'],['saju','사주 학업 원고'],['thai','태국 학업 원고']]){
      const html=renderSystem(system,{calculation,interpretation,field:'study'})
      assert.ok(html.includes(expected));assert.ok(!html.includes(systems[system]))
    }
    const money=renderSystem('western',{calculation,interpretation,field:'money'})
    assert.match(money,/금전 결론/);assert.doesNotMatch(money,/학업 결론|혼합 근거|전체 서양 원고/)
    const overall=renderSystem('western',{calculation,interpretation})
    // The system overview shows that system's own reading; integrated field
    // conclusions live on the integrated page and are not repeated here.
    assert.ok(overall.includes('전체 서양 원고'))
    for(const s of ['학업 결론','금전 결론'])assert.ok(!overall.includes(s))
    const thaiOverall=renderSystem('thai',{calculation,interpretation})
    for(const s of ['전체 태국 원고','태국 학업 원고'])assert.ok(thaiOverall.includes(s))
    const older=renderSystem('western',{calculation,field:'money',interpretation:{...interpretation,interpreter_version:'supabase-ai-v23.25-period-split-evidence-v1'}})
    assert.match(older,/data-reading-state="missing"/);assert.doesNotMatch(older,/금전 결론|혼합 근거/)
  }
})
