import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
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
