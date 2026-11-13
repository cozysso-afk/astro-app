import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildPeriodReadingDocument } from './authoredReadingDocument.ts'
import { fortuneField } from './fortuneFields.ts'
import { createElement as h } from 'react'
import { renderSystem, systemFixture, systemResponse } from './systemReadingView.fixtures.mjs'

const view = readFileSync(new URL('../SystemReadingViews.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../system-reading-ux-v40.css', import.meta.url), 'utf8')
const finalFont = readFileSync(new URL('../reading-font-fix-v54.css', import.meta.url), 'utf8')
const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')

test('Western raw dates and scores belong to the selected period and remain untouched by rendering', () => {
  const calculation=systemFixture('week')
  calculation.western.overall.금전={average:44,band:'다소 약함',spread:20,
    best_days:[{date:'2026-09-13',score:54},{date:'2026-12-01',score:100}],
    caution_days:[{date:'2026-09-17',score:34}]}
  const original=structuredClone(calculation)
  const html=renderSystem('western',{calculation,field:'money'})
  assert.match(html,/2026-09-12~2026-09-18 평균 44점/)
  assert.match(html,/2026-09-13\(54점\).*2026-09-17\(34점\)/)
  assert.doesNotMatch(html,/2026-12-01/)
  assert.deepEqual(calculation,original)
})

test('a failed quality check never promotes nominal Gemini text into a Western hero', () => {
  const response=systemResponse({western:'검수에 실패한 초안'},{usage:{quality_validation:{score:100,stages:[{passed:false}]}}})
  const html=renderSystem('western',{interpretation:response,onGenerate:()=>{}})
  assert.doesNotMatch(html,/검수에 실패한 초안|class="system-hero"/)
  assert.match(html,/western-score-card/)
  assert.match(html,/해설 생성<\/button>/)
})

function periodFixture(){
  const section={conclusion:'직업의 고유 판단',real_scene:'직업의 적용 장면 원문',action:'맡은 일의 범위를 확인해.',change_condition:'동의한 범위가 달라지면 다시 판단해.',evidence_refs:['W:work'],applicability:'conditional'}
  return {headline:'기간 전체 판단',overall:{summary:'기간 전체 요약 원문',dominant_pattern:'기간의 이유 원문',evidence_refs:['W:work']},clusters:{work_study:{work:section}},
    decisions:[{action:'기간 행동 원문',reason:'기간 이유 원문',timing:'조건이 확인된 뒤',watch:'조건이 바뀌면 다시 판단해.',avoid:'확인 전에는 확정하지 마.',evidence_refs:['W:work']}],
    limits:'기간 해석의 제한 원문',
    key_windows:[{start:'2026-11-05',end:'2026-11-05',topics:['직장'],summary:'직업 시기의 원문',action:'직업 시기의 행동 원문',avoid:'직업 시기의 조건 원문',evidence_refs:['W:work']},{start:'2026-11-08',end:'2026-11-08',topics:['금전'],summary:'금전 시기의 원문',action:'금전 시기의 행동 원문',avoid:'금전 시기의 조건 원문',evidence_refs:['W:money']}],
    year_phases:[{label:'근거 있는 구간',start:'2026-11-01',end:'2026-11-30',theme:'구간 흐름 원문',change:'구간 차이 원문',evidence_refs:['W:period']}],
    priorities:['기간 우선순위 원문'],cross_checks:[{label:'독립 체계 비교',start:'2026-11-05',end:'2026-11-05',western:'서양 원문',saju:'사주 원문',thai:'태국 원문',synthesis:'통합의 제한을 설명한 원문',evidence_refs:['W:work','S:period']}],
  }
}
const documentTexts=doc=>[doc.headline,...doc.core.map(b=>b.text),...doc.sections.flatMap(s=>s.blocks.map(b=>b.text))]

test('important windows retain authored actions and conditions and obey the selected topic', () => {
  const data=periodFixture(),before=structuredClone(data)
  const overview=buildPeriodReadingDocument(data,'month','2026-11-01','2026-11-30',undefined,true)
  for(const window of data.key_windows)for(const key of ['summary','action','avoid'])assert.ok(documentTexts(overview).includes(window[key]))
  assert.equal(overview.sections.find(s=>s.id==='window:0').label,'2026-11-05')
  const work=buildPeriodReadingDocument(data,'month','2026-11-01','2026-11-30',fortuneField('work'),true)
  assert.ok(documentTexts(work).includes(data.key_windows[0].action))
  assert.ok(!documentTexts(work).includes(data.key_windows[1].action))
  assert.deepEqual(data,before)
})

test('month and year preserve period decisions, conditions and phases without substituting them for field prose', () => {
  const data=periodFixture()
  for(const period of ['month','year']){
    const doc=buildPeriodReadingDocument(data,period,'2026-01-01','2026-12-31',undefined,true)
    assert.equal(doc.state,'ready')
    for(const key of ['action','reason','timing','watch','avoid'])assert.ok(doc.core.some(b=>b.text===data.decisions[0][key]))
    assert.ok(doc.core.some(b=>b.text===data.limits))
    for(const key of ['theme','change'])assert.ok(doc.sections.find(s=>s.id==='phase:0').blocks.some(b=>b.text===data.year_phases[0][key]))
    const work=buildPeriodReadingDocument(data,period,'2026-01-01','2026-12-31',fortuneField('work'),true)
    assert.equal(work.headline,data.clusters.work_study.work.conclusion)
    for(const text of [data.overall.summary,data.decisions[0].action,data.year_phases[0].theme])assert.ok(!documentTexts(work).includes(text))
    const unverified=buildPeriodReadingDocument(data,period,'2026-01-01','2026-12-31',undefined,false)
    assert.equal(unverified.state,'unverified');assert.deepEqual(unverified.core,[]);assert.deepEqual(unverified.sections,[])
  }
})

test('period priorities and each independent cross-check explanation survive without leaking into topic tabs', () => {
  const data=periodFixture()
  const overview=buildPeriodReadingDocument(data,'week','2026-11-04','2026-11-10',undefined,true)
  assert.ok(documentTexts(overview).includes(data.priorities[0]))
  for(const key of ['western','saju','thai','synthesis'])assert.ok(overview.sections.find(s=>s.id==='cross:0').blocks.some(b=>b.text===data.cross_checks[0][key]))
  const field=buildPeriodReadingDocument(data,'week','2026-11-04','2026-11-10',fortuneField('work'),true)
  assert.equal(field.sections.some(s=>s.id.startsWith('priority:')||s.id.startsWith('cross:')),false)
})

test('the integrated child cannot leak into the Western independent system', () => {
  const child=h('p',{},'통합 탭에서만 보이는 원고')
  assert.match(renderSystem('integrated',{children:child}),/통합 탭에서만 보이는 원고/)
  assert.doesNotMatch(renderSystem('western',{children:child}),/통합 탭에서만 보이는 원고/)
})

test('mobile Western results expose the generation action outside any hidden integrated-reading class', () => {
  const html=renderSystem('western',{onGenerate:()=>{}})
  const card=html.match(/<section class="([^"]+)"[^>]*><h3>서양점성술 Gemini 해설<\/h3>/)
  assert.ok(card,'Independent Western generation card is missing')
  assert.doesNotMatch(card[1], /(?:^| )(?:period-ai-card|fortune-experience|period-deep-reading)(?: |$)/)
  assert.match(html,/해설 생성<\/button>/)
})

test('mobile integrated reading uses the same Myeongjo family for headline and summary', () => {
  assert.match(finalFont, /period-ai-head h3\.period-ai-hero-title-v4\s*\{[\s\S]*?font-family:\s*'Nanum Myeongjo'/)
  assert.match(finalFont, /period-ai-head h3\.period-ai-hero-title-v4\s*\{[\s\S]*?font-weight:\s*700\s*!important/)
  assert.match(finalFont, /period-ai-head h3\.period-ai-hero-title-v4\s*\{[\s\S]*?font-synthesis:\s*none\s*!important/)
  assert.match(finalFont, /period-today[\s\S]*?period-ai-head \.reading-hero-subtitle[\s\S]*?font-family:\s*'Nanum Myeongjo'/)
  assert.match(finalFont, /period-today[\s\S]*?period-ai-head \.reading-hero-subtitle[\s\S]*?font-weight:\s*500\s*!important/)
})

test('top-level life topics use a fixed two-row mobile grid instead of horizontal clipping', () => {
  assert.match(view, /system-topic-selector system-topic-selector-fixed/)
  assert.match(css, /system-topic-selector\.system-topic-selector-fixed[\s\S]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/)
  assert.match(css, /system-topic-selector\.system-topic-selector-fixed[\s\S]*overflow:\s*visible\s*!important/)
  assert.doesNotMatch(css, /system-topic-selector\.system-topic-selector-fixed[\s\S]*overflow-x:\s*auto/)
})

test('scoped system UX loads before the shared reading owner, which stays below system UX', () => {
  const western = main.indexOf("import './system-reading-ux-v40.css'")
  const owner = main.indexOf("import './reading-experience.css'")
  assert.ok(western >= 0 && owner > western)
})
