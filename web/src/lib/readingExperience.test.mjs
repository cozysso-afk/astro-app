import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import postcss from 'postcss'
import { buildFortuneUserSummary } from './fortuneUserSummary.ts'
import { buildRelationshipUserSummary, rankRelationshipAspects, aspectRole } from './relationshipUserSummary.ts'

import { topics, stat, fortuneFixture, aspects, timing } from './readingExperience.fixtures.mjs'
const relationship = mode => buildRelationshipUserSummary({aspects,partnerExact:false,mode,timing})

test('all 15 topics participate; extreme reference with evidence beats near-neutral core', () => {
  const {data,context}=fortuneFixture()
  data.topic_analysis.학업.importance='핵심'
  data.topic_analysis.시험.evidence_refs=['W:exam']
  context.calculation.western.overall.시험=stat(91)
  const view=buildFortuneUserSummary(data,context)
  assert.equal(view.bestFlow[0],'시험')
  assert.equal(view.focusTopics[0].topic,'시험')
  assert.equal(view.focusTopics.length+view.referenceTopics.length,15)
  assert.equal(view.favorableCards[0].score,91)
  assert.equal(context.calculation.western.overall.시험.average,91)
})
test('no relationship domain bonus; investment risk polarity is caution only', () => {
  const {data,context}=fortuneFixture()
  data.topic_analysis.연애.importance='핵심'
  data.topic_analysis.투자주의.evidence_refs=['W:risk']
  context.calculation.western.overall.연애=stat(51)
  context.calculation.western.overall.투자주의=stat(95)
  const view=buildFortuneUserSummary(data,context)
  assert.deepEqual(view.bestFlow,['대인관계','이직'])
  assert.equal(view.cautionFlow[0],'투자주의')
  assert.ok(!view.favorableCards.some(x=>x.topic==='투자주의'))
  assert.match(view.headline,/사람 관계와 이직 조건/)
})
test('compact flow cards have score, band and one topic-specific meaning; overflow stays available', () => {
  const {data,context}=fortuneFixture()
  const view=buildFortuneUserSummary(data,context)
  assert.deepEqual(view.favorableCards.map(x=>[x.topic,x.score]),[['대인관계',67],['이직',64]])
  assert.notEqual(view.favorableCards[0].meaning,view.favorableCards[1].meaning)
  const css=readFileSync(new URL('../reading-experience.css',import.meta.url),'utf8')
  assert.match(css,/\.flow-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
  assert.match(css,/prefers-reduced-motion:\s*reduce/)
  assert.match(css,/min-height:\s*44px/)
  const panel=readFileSync(new URL('../FortuneFlowCards.tsx',import.meta.url),'utf8')
  assert.match(panel,/items\.slice\(0, 2\)/)
  assert.match(panel,/items\.slice\(2\)/)
})
test('personal aspects outrank tighter outer/outer; meaningful roles and no mutation', () => {
  const original=JSON.stringify(aspects)
  const ranked=rankRelationshipAspects(aspects,false)
  assert.equal(ranked[0].a,'Venus')
  assert.equal(ranked.at(-1).a,'Neptune')
  assert.equal(aspectRole(aspects[1]),'attraction')
  assert.equal(aspectRole(aspects[2]),'communication')
  assert.equal(aspectRole(aspects[3]),'stability')
  assert.equal(aspectRole(aspects[4]),'power')
  assert.equal(JSON.stringify(aspects),original)
})
test('reunion has independent directions, stability, friction, timing and unique paragraphs', () => {
  const view=relationship('reunion')
  assert.match(view.headline,/재접촉/)
  assert.equal(view.incoming.band,'약함')
  assert.equal(view.outgoing.band,'강함')
  assert.equal(view.reconnection.band,'강함')
  assert.equal(view.sustainability,'불안정')
  assert.ok(view.windows.length)
  assert.ok(view.friction.length)
  const paragraphs=[...view.friction,...view.patterns].map(p=>p.reason)
  assert.equal(new Set(paragraphs).size,paragraphs.length)
  assert.doesNotMatch(paragraphs.join(' '),/orb|W:|S:|T:|0\.40/)
})
test('compatibility has strengths, friction, intimacy, communication, boundaries and stability', () => {
  const view=relationship('compatibility')
  assert.equal(view.title,'한눈에 궁합')
  assert.ok(view.strengths.length && view.friction.length)
  for(const id of ['attraction','communication','power','stability']) assert.ok(view.sections.find(s=>s.id===id).rows.length)
  const visible=JSON.stringify([view.headline,view.sections,view.sustainabilityText,view.practical])
  assert.doesNotMatch(visible,/재회|재접촉|결혼 전|배우자/)
})
test('unmarried marriage focuses on suitability, practical responsibility and conflict', () => {
  const view=relationship('marriage_unmarried')
  assert.equal(view.title,'결혼 궁합 한눈에')
  assert.match(view.headline,/결혼 상대로서의 안정성/)
  assert.ok(view.sections.some(s=>s.title==='책임 · 현실 생활'))
  assert.ok(view.sections.some(s=>s.title==='갈등 해결'))
  assert.equal(view.practicalTitle,'결혼 전 확인할 것')
  assert.equal(view.stabilityTitle,'결혼 유지력')
  assert.doesNotMatch(JSON.stringify(view.sections),/재회|재접촉|미래 배우자|결혼 확정/)
})
test('married mode is current marriage and repair; no future-spouse or marriage-prediction language', () => {
  const view=relationship('marriage_married')
  assert.equal(view.title,'지금 우리 부부')
  assert.match(view.headline,/현재 부부관계/)
  assert.equal(view.stabilityTitle,'관계 회복력 · 장기 안정성')
  assert.equal(view.practicalTitle,'지금 함께 바꿔볼 것')
  assert.doesNotMatch(JSON.stringify([view.headline,view.sections,view.practical,view.practicalTitle]),/미래 배우자|결혼 전|재회|재접촉|결혼할|결혼 가능성/)
})
test('unverified time excludes sensitive aspects and absent direction remains unknown', () => {
  const unsafe=[...aspects,{a:'Moon',b:'Venus',aspect:'trine',orb:0,tone:'supportive'},{a:'ASC',b:'Mars',aspect:'conjunction',orb:0,tone:'mixed'}]
  const view=buildRelationshipUserSummary({aspects:unsafe,partnerExact:false,mode:'reunion'})
  assert.ok(view.ranked.every(a=>!['Moon','ASC'].includes(a.a)))
  assert.equal(view.incoming.band,'정보 부족')
  assert.equal(view.outgoing.band,'정보 부족')
  assert.equal(view.windows.length,0)
})
test('logout exists only in settings and AuthGate retains the actual logout implementation', () => {
  const gate=readFileSync(new URL('../AuthGate.tsx',import.meta.url),'utf8')
  assert.doesNotMatch(gate,/private-auth-logout/)
  assert.match(gate,/await signOutSupabase\(\)/)
  assert.match(gate,/AccountActionsContext.Provider/)
  const settings=readFileSync(new URL('../SettingsView.tsx',import.meta.url),'utf8')
  assert.match(settings,/<AccountActions\/>/)
})

test('hour windows require explicit exact readiness and remain absent for provisional display', () => {
  const {data,context}=fortuneFixture()
  context.calculation.western.detail_days=[{date:'2026-09-12',topics:{대인관계:{best_window:{start:'07:00',end:'08:30',score:75}}}}]
  assert.equal(buildFortuneUserSummary(data,context).importantWindows.length,0)
  const exact=buildFortuneUserSummary(data,{...context,allowIntraday:true})
  assert.equal(exact.importantWindows[0].date,'07:00–08:30')
  assert.match(exact.importantWindows[0].guidance,/대인관계/)
  const panel=readFileSync(new URL('../PeriodAiInterpretationPanel.tsx',import.meta.url),'utf8')
  assert.match(panel,/allowIntraday: readiness.ok && readiness.mode === 'exact'/)
})

test('every mode is restrained with missing relationship evidence', () => {
  for(const mode of ['compatibility','reunion','marriage_unmarried','marriage_married']) {
    const view=buildRelationshipUserSummary({aspects:[],partnerExact:false,mode})
    assert.equal(view.sustainability,'정보 부족')
    assert.equal(view.friction.length,0)
    assert.equal(view.strengths.length,0)
    assert.match(view.headline,/부족/)
  }
})

test('topic depth adds distinct scope to actual direction and keeps all scores immutable',()=>{
  const fixture=fortuneFixture();const before=JSON.stringify(fixture)
  const view=buildFortuneUserSummary(fixture.data,fixture.context)
  for(const topic of view.focusTopics) {
    assert.ok(topic.conclusion.split(/[.!?]/).filter(s=>s.trim()).length>=2)
    assert.ok(topic.reason.length>35)
    assert.doesNotMatch(topic.conclusion+topic.reason,/orb|W:|S:|T:|상대활성도|경계 압력/)
  }
  assert.equal(new Set(view.focusTopics.map(t=>t.conclusion)).size,view.focusTopics.length)
  assert.equal(JSON.stringify(fixture),before)
})
test('repeated relationship roles merge without losing raw aspect traceability',()=>{
  const input=[...aspects,{a:'Mercury',b:'Jupiter',aspect:'trine',orb:1.2,tone:'supportive'}]
  const view=buildRelationshipUserSummary({aspects:input,partnerExact:false,mode:'compatibility'})
  const communication=view.sections.find(s=>s.id==='communication').rows
  assert.equal(communication.length,1)
  assert.match(communication[0].reason,/천왕성/)
  assert.match(communication[0].reason,/목성/)
  assert.match(communication[0].conclusion,/함께/)
  assert.equal(view.ranked.length,input.length)
  const displayed=view.sections.flatMap(s=>s.rows)
  assert.equal(new Set(displayed.map(p=>p.title)).size,displayed.length)
})
test('relationship reasons distinguish Mercury/Uranus, Venus/Mars, and Saturn rather than swapping names',()=>{
  const view=relationship('compatibility')
  assert.match(view.sections.find(s=>s.id==='communication').rows[0].reason,/예측하기 어려운 속도/)
  assert.match(view.sections.find(s=>s.id==='attraction').rows[0].reason,/애정 표현.*다가가는 힘/)
  assert.match(view.sections.find(s=>s.id==='stability').rows[0].reason,/오래 이어지는 것과 편안하게 유지되는 것/)
})


test('same-direction evidence is grouped once; opposing evidence and raw payload survive',()=>{
  const f=fortuneFixture()
  f.calculation.western.daily_scores[0].evidence.push({source_topics:['대인관계'],transit:'Moon',contribution:2})
  const before=JSON.stringify(f)
  let reason=buildFortuneUserSummary(f.data,f.context).focusTopics.find(t=>t.topic==='대인관계').reason
  assert.match(reason,/수성과 목성/); assert.match(reason,/달/)
  assert.equal((reason.match(/힘이 실려/g)||[]).length,1)
  assert.doesNotMatch(reason,/과정에 힘을 보태는|orb|W:/)
  assert.equal(JSON.stringify(f),before)
  f.calculation.western.daily_scores[0].evidence.push({source_topics:['대인관계'],transit:'Saturn',contribution:-4})
  reason=buildFortuneUserSummary(f.data,f.context).focusTopics.find(t=>t.topic==='대인관계').reason
  assert.match(reason,/토성/); assert.match(reason,/마찰이나 부담/); assert.match(reason,/힘이 실려/)
})
for(const period of ['today','week','month','year']) test(`repeated ${period} presentation never increases scores or mutates calculation`,()=>{
  const f=fortuneFixture(period), original=JSON.stringify(f)
  const first=buildFortuneUserSummary(f.data,f.context)
  for(let i=0;i<5;i++) {
    const next=buildFortuneUserSummary(f.data,f.context)
    assert.deepEqual(next.favorableCards,first.favorableCards)
    assert.deepEqual(next.cautionCards,first.cautionCards)
    for(const card of [...next.favorableCards,...next.cautionCards]) assert.equal(card.score,f.calculation.western.overall[card.topic].average)
    assert.equal(JSON.stringify(f),original)
  }
})

test('reading headline declarations override legacy important Gothic and billboard size',()=>{
  const main=readFileSync(new URL('../main.tsx',import.meta.url),'utf8')
  const imports=[...main.matchAll(/import ['"]\.\/([^'"]+\.css)['"]/g)].map(m=>m[1])
  assert.equal(imports.at(-1),'reading-experience.css')
  const css=postcss.parse(readFileSync(new URL('../reading-experience.css',import.meta.url),'utf8'))
  const declarations={}
  css.walkRules(rule=>{
    if(rule.selector.split(',').map(x=>x.trim()).includes('.fortune-experience .period-ai-head h3')) {
      rule.walkDecls(d=>{declarations[d.prop]={value:d.value,important:Boolean(d.important)}})
    }
  })
  assert.deepEqual(declarations['font-family'],{value:'var(--reading-display)',important:true})
  assert.deepEqual(declarations['font-size'],{value:'19px',important:true})
  assert.deepEqual(declarations['font-weight'],{value:'600',important:true})
  assert.deepEqual(declarations['line-height'],{value:'1.75',important:true})
  const source=css.toString()
  assert.match(source,/family=Noto\+Serif\+KR:wght@600&display=swap/)
  assert.match(source,/--reading-display: 'Noto Serif KR'/)
  assert.doesNotMatch(source,/body[^{}]*\{[^}]*font-family:\s*var\(--reading-display\)/)
})

for (const period of ['today','week','month','year']) test(`observed contact reference in caution flow is split for ${period}`,()=>{
  const f=fortuneFixture(period)
  f.calculation.western.overall.연락=stat(44)
  f.data.topic_analysis.연락.evidence_refs=['W:contact']
  // Stronger salience keeps contact out of the three detailed topics.
  f.calculation.western.overall.재회=stat(83)
  f.data.topic_analysis.재회.evidence_refs=['W:reconnection']
  const before=JSON.stringify(f)
  const v=buildFortuneUserSummary(f.data,f.context)
  assert.ok(v.cautionFlow.includes('연락'))
  assert.ok(!v.focusTopics.some(t=>t.topic==='연락'))
  assert.equal(v.relationship.incomingBand,'약함')
  assert.equal(v.relationship.outgoingBand,'강함')
  assert.notEqual(v.relationship.incoming,v.relationship.outgoing)
  assert.equal(JSON.stringify(f),before)
  f.calculation.western.relationship_signals.수신신호=null
  const absent=buildFortuneUserSummary(f.data,f.context)
  assert.equal(absent.relationship.incomingBand,'정보 부족')
  assert.equal(absent.relationship.outgoingBand,'강함')
})

test('evidence depth names only linked symbols and explains meaning, not raw identifiers',()=>{
  const f=fortuneFixture(); const v=buildFortuneUserSummary(f.data,f.context)
  const topic=v.focusTopics.find(t=>t.topic==='대인관계')
  assert.match(topic.reason,/수성.*생각을 정리/)
  assert.match(topic.reason,/목성.*기대/)
  assert.doesNotMatch(topic.reason,/해왕성|orb|W:|S:|T:/)
  assert.ok(topic.conclusion.split('.').filter(Boolean).length>=2)
  assert.ok(topic.action && topic.observe && topic.caution)
  f.calculation.western.daily_scores=[]
  const missing=buildFortuneUserSummary(f.data,f.context).focusTopics.find(t=>t.topic==='대인관계')
  assert.match(missing.reason,/부족|적어|없어/)
  assert.doesNotMatch(missing.reason,/수성|목성/)
})

test('actual week, month and year progressions differ and never fill missing dates',()=>{
  const views={}
  for(const period of ['today','week','month','year']) {
    const f=fortuneFixture(period)
    const n=f.calculation.period.day_count
    const start=Date.parse(f.calculation.period.start+'T00:00:00Z')
    f.calculation.western.daily_scores=Array.from({length:n},(_,i)=>({date:new Date(start+i*86400000).toISOString().slice(0,10),scores:{대인관계:i<n/2?35:78},evidence:[]}))
    if(period==='year') f.calculation.western.months=[{start:'2026-10-01',end:'2026-10-31',calendar_month:'2026-10',topics:{대인관계:stat(80)}},{start:'2026-11-01',end:'2026-11-30',calendar_month:'2026-11',topics:{대인관계:stat(30)}}]
    const original=JSON.stringify(f)
    views[period]=buildFortuneUserSummary(f.data,f.context).focusTopics.find(t=>t.topic==='대인관계').timing
    assert.equal(JSON.stringify(f),original)
  }
  assert.equal(views.today,undefined)
  assert.match(views.week,/후반.*초반/)
  assert.match(views.month,/이번 달.*구간.*주별/)
  assert.match(views.year,/2026-10-01~2026-10-31.*2026-11-01~2026-11-30.*장기/)
  const f=fortuneFixture('month');f.calculation.western.daily_scores=[];f.calculation.western.overall.대인관계=stat(67)
  assert.equal(buildFortuneUserSummary(f.data,f.context).focusTopics.find(t=>t.topic==='대인관계').timing,undefined)
})

test('daily utilization and caution windows both survive, investment risk never becomes upside',()=>{
  const f=fortuneFixture();f.context.allowIntraday=true
  f.calculation.western.detail_days=[{date:'2026-09-12',topics:{대인관계:{best_window:{start:'07:00',end:'08:30'},caution_window:{start:'21:00',end:'22:00'}}}}]
  const v=buildFortuneUserSummary(f.data,f.context)
  assert.ok(v.importantWindows.some(w=>w.kind==='favorable'&&w.date==='07:00–08:30'))
  assert.ok(v.importantWindows.some(w=>w.kind==='caution'&&w.date==='21:00–22:00'))
  f.context.allowIntraday=false
  assert.deepEqual(buildFortuneUserSummary(f.data,f.context).importantWindows,[])
})

test('many communication aspects cannot crowd out stability and mixed role copy is specific',()=>{
  const input=[...['Sun','Venus','Mars','Jupiter','Uranus','Neptune','Pluto'].map((b,i)=>({a:'Mercury',b,aspect:'trine',orb:.1+i/10,tone:'supportive'})),{a:'Mercury',b:'Sun',aspect:'square',orb:1,tone:'challenging'},{a:'Saturn',b:'Jupiter',aspect:'square',orb:4,tone:'challenging'}]
  const v=buildRelationshipUserSummary({aspects:input,partnerExact:false,mode:'compatibility'})
  const rows=[...v.patterns,...v.friction]
  assert.ok(rows.some(p=>p.role==='stability'))
  assert.equal(rows.filter(p=>p.role==='communication').length,1)
  assert.match(rows.find(p=>p.role==='communication').conclusion,/말이 어긋나는/)
  assert.equal(new Set(rows.map(p=>p.title)).size,rows.length)
})
