import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement as h, Fragment } from 'react'
import { renderSystem, systemResponse } from './systemReadingView.fixtures.mjs'

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
