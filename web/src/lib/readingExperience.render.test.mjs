import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { fortuneFixture, personalMarriageFixture, aspects, timing } from './readingExperience.fixtures.mjs'

let server, Fortune, Relationship, Account, Personal, portraitConcept, Formatters
before(async () => {
  server=await createServer({root:fileURLToPath(new URL('../..',import.meta.url)),server:{middlewareMode:true},appType:'custom'})
  Formatters=await server.ssrLoadModule('/src/lib/resultFormatters.ts')
  Fortune=(await server.ssrLoadModule('/src/PeriodAiInterpretationPanel.tsx')).PeriodAiInterpretationPanel
  Relationship=(await server.ssrLoadModule('/src/RelationshipInterpretationPanel.tsx')).RelationshipInterpretationPanel
  Account=await server.ssrLoadModule('/src/AccountActions.tsx')
  const personal=await server.ssrLoadModule('/src/PersonalMarriagePanel.tsx'); Personal=personal.PersonalMarriagePanel; portraitConcept=personal.buildPortraitConcept
})
after(async()=>{await server?.close()})
const noAction=()=>{throw new Error('Rendering must never call a provider or account action')}

for(const period of ['today','week','month','year']) test(`actual Fortune ${period} markup preserves structure and hides raw data`,()=>{
  const fixture=fortuneFixture(period)
  const html=renderToStaticMarkup(createElement(Fortune,{period,calculation:fixture.calculation,result:{ok:true,model:'deterministic-provisional-v2',data:fixture.data},loading:false,error:'',cacheSource:'local',onRetry:noAction,onCopyPrompt:noAction,onCancel:noAction,canCancel:false}))
  const visible=html.split('<details class="period-ai-details"')[0]
  assert.equal((visible.match(/class="flow-tile"/g)||[]).length,3)
  assert.match(visible,/대인관계/)
  assert.match(visible,/왜 이렇게 보냐면/)
  assert.match(visible,/수성과 목성/)
  assert.doesNotMatch(visible.replace(/<[^>]*>/g,''),/orb|W:fixture|기술 원문|private-auth-logout/)
  assert.match(html,/<details class="period-ai-details"><summary>계산 근거 자세히 보기/)
  if(period==='today') assert.doesNotMatch(visible,/2026-09-14|2026-09-17/)
  else assert.match(visible,/2026-09-14/)
})

for(const mode of ['compatibility','reunion','marriage_unmarried','marriage_married']) test(`actual ${mode} markup has only its own question structure`,()=>{
  const html=renderToStaticMarkup(createElement(Relationship,{aspects,partnerExact:false,analysisMode:mode,timing,ai:null,aiLoading:false,aiError:'',onAi:noAction,timeSensitivePoints:new Set(['Moon','ASC']),formatAspect:a=>`${a.a} ${a.aspect} ${a.b}`}))
  const visible=html.split('<details class="relationship-enrichment"')[0]
  assert.match(html,/<details class="relationship-technical"><summary>기술 근거 자세히 보기/)
  assert.doesNotMatch(visible.replace(/<[^>]*>/g,''),/orb|Neptune|Uranus|W:|S:|T:/)
  if(mode==='reunion') {
    for(const title of ['상대 → 나','나 → 상대','과거 인연 재접점','다시 붙었을 때 유지력','반복될 가능성이 높은 문제','주요 시기']) assert.ok(visible.includes(title))
    assert.match(visible,/약함/);assert.match(visible,/강함/)
  } else {
    assert.doesNotMatch(visible,/재접촉|재회|상대 → 나|나 → 상대/)
    for(const title of ['감정 · 친밀감','관계의 힘의 균형']) assert.ok(visible.includes(title))
    if(mode==='compatibility') assert.doesNotMatch(visible,/결혼 전|우리 부부|결혼 궁합/)
    if(mode==='marriage_unmarried') assert.match(visible,/결혼 전 확인할 것/)
    if(mode==='marriage_married') { assert.match(visible,/지금 우리 부부/);assert.doesNotMatch(visible,/미래 배우자|결혼 전|결혼 가능성/) }
  }
  const reasons=[...visible.matchAll(/<article class="relationship-pattern">.*?<p>(.*?)<\/p>/g)].map(m=>m[1])
  assert.equal(new Set(reasons).size,reasons.length)
})
test('settings account action renders without executing sign-out',()=>{
  const html=renderToStaticMarkup(createElement(Account.AccountActionsContext.Provider,{value:{logout:noAction,busy:false}},createElement(Account.AccountActions)))
  assert.match(html,/로그아웃/)
  assert.doesNotMatch(html,/private-auth-logout/)
})

test('personal marriage renders creative hints with no future certainty or generated metrics',()=>{
  const fixture=personalMarriageFixture();const before=JSON.stringify(fixture)
  const html=renderToStaticMarkup(createElement(Personal,{data:fixture}))
  const visible=html.split('<details class="relationship-technical"')[0].replace(/<[^>]*>/g,'')
  assert.match(visible,/나의 관계 성향/);assert.match(visible,/목성/)
  assert.match(visible,/AI 초상 콘셉트 프롬프트 복사/)
  assert.doesNotMatch(visible,/62|orb|Taurus|결혼 가능성 지수|178|181/)
  assert.match(html,/<details class="portrait-concept">/)
  assert.equal(JSON.stringify(fixture),before)
})
test('portrait prompt is only existing hints plus explicit creative art direction',()=>{
  const fixture=personalMarriageFixture()
  const prompt=portraitConcept(fixture.result.spouse_archetype)
  assert.match(prompt,/차분한 인상/);assert.match(prompt,/정돈된 스타일/)
  assert.match(prompt,/미래 배우자 예측이 아니라/)
  assert.doesNotMatch(prompt,/178|181|동양인 남성|계란형|고양이상/)
  fixture.result.spouse_archetype.appearance_hints=[]
  assert.equal(portraitConcept(fixture.result.spouse_archetype),'')
})
test('reason action and caution render as separately labelled accessible layers',()=>{
  const f=fortuneFixture()
  const html=renderToStaticMarkup(createElement(Fortune,{period:'today',calculation:f.calculation,result:{ok:true,model:'deterministic-provisional-v2',data:f.data},loading:false,error:'',cacheSource:'local',onRetry:noAction,onCopyPrompt:noAction,onCancel:noAction,canCancel:false}))
  for(const kind of ['reason','practice','caution']) assert.match(html,new RegExp('reading-explanation is-'+kind))
  assert.match(html,/reading-hero-subtitle/)
  assert.match(html,/reading-period-date/)
})

for(const period of ['today','week','month','year']) test(`rendered ${period} caution contact directions precede long interpretation`,()=>{
  const f=fortuneFixture(period)
  f.calculation.western.overall.연락={...f.calculation.western.overall.연락,average:44}
  f.data.topic_analysis.연락.evidence_refs=['W:contact']
  const html=renderToStaticMarkup(createElement(Fortune,{period,calculation:f.calculation,result:{ok:true,model:'deterministic-provisional-v2',data:f.data},loading:false,error:'',cacheSource:'local',onRetry:noAction,onCopyPrompt:noAction,onCancel:noAction,canCancel:false}))
  const visible=html.split('<details class="period-ai-details"')[0]
  assert.match(visible, /signal-incoming[\s\S]*?상대가 먼저 오는 흐름[\s\S]*?약함/)
  assert.match(visible, /signal-outgoing[\s\S]*?내가 먼저 연락하기[\s\S]*?강함/)
  assert.ok(visible.indexOf('상대가 먼저 오는 흐름')<visible.indexOf('period-ai-user-focus'))
})
test('personal spouse route uses existing hints without manufacturing a meeting or a person',()=>{
  const f=personalMarriageFixture();f.result.spouse_archetype.meeting_route='반복해서 참여하는 모임에서 천천히 알아가는 방식';f.result.spouse_archetype.identity_clues=['생활 리듬을 맞추는 관계']
  const html=renderToStaticMarkup(createElement(Personal,{data:f})).split('<details class="relationship-technical"')[0]
  assert.match(html,/반복해서 참여하는 모임/);assert.match(html,/배우자로 정해진 건 아니야/)
  assert.doesNotMatch(html,/178|181|연예인|고양이상/)
})

test('same date groups utilization and caution without losing either meaning',()=>{
  const f=fortuneFixture('week');f.data.key_windows=[{start:'2026-09-14',end:'2026-09-14',topics:['대인관계'],signal:'활용'},{start:'2026-09-14',end:'2026-09-14',topics:['컨디션'],signal:'주의'}]
  const html=renderToStaticMarkup(createElement(Fortune,{period:'week',calculation:f.calculation,result:{ok:true,model:'deterministic-provisional-v2',data:f.data},loading:false,error:'',cacheSource:'local',onRetry:noAction,onCopyPrompt:noAction,onCancel:noAction,canCancel:false}))
  const visible=html.split('<details class="period-ai-details"')[0]
  assert.equal((visible.match(/<time>2026-09-14<\/time>/g)||[]).length,1)
  assert.match(visible,/reading-event signal-favorable/)
  assert.match(visible,/reading-event signal-caution/)
})

for(const [period,title] of [['today','오늘 한눈에'],['week','이번 주 전체 흐름'],['month','이번 달 큰 흐름'],['year','올해 큰 흐름']]) test(`external integrated and precision ${period} instructions preserve raw calculation`,()=>{
  const f=fortuneFixture(period); const request={period_kind:period}; const original=JSON.stringify(f.calculation,null,2)
  for(const build of [Formatters.integratedPromptText,Formatters.precisionPromptText]) {
    const prompt=build(request,f.calculation)
    assert.match(prompt,/EXTERNAL_AI_PROMPT_V2/);assert.ok(prompt.includes(title))
    assert.equal(prompt.split('[CALCULATED_DATA · 원본 계산 JSON]\n')[1],original)
  }
})
for(const [kind,mode,title] of [['compatibility','compatibility','궁합 한눈에'],['reunion','reunion','재접촉 vs 관계 회복'],['marriage','marriage_unmarried','결혼 전에 확인할 현실 조건'],['marriage','marriage_married','현재 부부 흐름']]) test(`external relationship ${mode} has its own consultation structure and keeps birth-time limits`,()=>{
  const calculation={engine:'synthetic',period:{start:'2026-09-12',end:'2026-09-30'},result:{natal_synastry:{aspects},months:[],limitations:[]}}
  const before=JSON.stringify(calculation)
  const prompt=Formatters.relationshipPromptText(kind,{analysis_mode:mode,relationship_status:mode==='marriage_married'?'married':'single'},calculation,kind==='reunion'?timing:null)
  assert.ok(prompt.includes(title));assert.match(prompt,/결론 2~4문장/);assert.match(prompt,/생시 제한.*Davison.*Marks/)
  assert.ok(prompt.length<=28000)
  assert.equal(JSON.stringify(calculation),before)
  assert.doesNotThrow(()=>JSON.parse(prompt.split(/\[COMPACT_CALCULATED_DATA · 압축단계 \d\]\n/)[1]))
  if(kind==='reunion') for(const label of ['상대 → 나','나 → 상대','과거 인연 재접점','유지력','reunion_dimensions','reunion_directional_context','reunion_transits','secondary support']) assert.ok(prompt.includes(label))
  else assert.ok(!prompt.includes('[재회 흐름 한눈에]'))
  if(mode==='marriage_married') {assert.ok(!prompt.includes('[결혼 전에 확인할 현실 조건]'));assert.match(prompt,/미래 결혼 가능성을 예측하지 않는다/)}
})
