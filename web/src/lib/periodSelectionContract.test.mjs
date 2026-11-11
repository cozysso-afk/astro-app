import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { fortuneFixture } from './readingExperience.fixtures.mjs'
import test from 'node:test'
const app=readFileSync(new URL('../AppNext.tsx',import.meta.url),'utf8')
const home=readFileSync(new URL('../HomeControls.tsx',import.meta.url),'utf8')
const css=readFileSync(new URL('../ux-readability-v22.css',import.meta.url),'utf8')
test('calendar periods use Monday-Sunday, calendar month and calendar year',()=>{assert.match(app,/function startOfWeekMonday/);assert.match(app,/const periodSelectionStart = periodStart\(queryDate, period\)/);assert.match(app,/startDate=\{periodSelectionStart\}/);assert.match(app,/return `\$\{start\.slice\(0,4\)\}-12-31`/)})
test('week month year have direct pickers',()=>{assert.match(home,/월요일~일요일/);assert.match(home,/type="month"/);assert.match(home,/연간 선택 · 달력 연도/);assert.match(home,/이전 기간/);assert.match(home,/다음 기간/)})
test('period AI always exposes generation and both prompt copy modes in idle state',async t=>{
  const server=await createServer({root:fileURLToPath(new URL('../..',import.meta.url)),optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false},appType:'custom'})
  t.after(()=>server.close())
  const {PeriodAiInterpretationPanel}=await server.ssrLoadModule('/src/PeriodAiInterpretationPanel.tsx')
  const html=renderToStaticMarkup(h(PeriodAiInterpretationPanel,{period:'month',calculation:fortuneFixture('month').calculation,result:null,loading:false,error:'',onCopyPrompt:()=>{}}))
  for(const label of ['AI 해설 추가하기','해설 생성','AI 심층해설 프롬프트 복사','전체 근거 프롬프트 복사'])assert.ok(html.includes(label),label)
})
test('fixed star dots are removed and typography is normalized',()=>{assert.match(css,/\.app-shell::before\{display:none!important\}/);assert.match(css,/period-ai-v21-controls button/);assert.match(css,/uxCardRise/)})
test('married compatibility is explicitly distinct from married marriage fortune',()=>{assert.match(app,/기혼 · 일반 궁합/);assert.match(app,/결혼운 → 기혼/)})

test('calendar range labels never hardcode 31 or 365 days',()=>{assert.match(app,/return '달력 월'/);assert.match(app,/return '달력 연도'/);assert.doesNotMatch(app,/if \(period === 'month'\) return '31일'/)})
test('daily, weekly, monthly and annual saved readings retain prose and provenance while hiding internal references',async t=>{
  const server=await createServer({root:fileURLToPath(new URL('../..',import.meta.url)),optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false},appType:'custom'})
  t.after(()=>server.close())
  const {PeriodFortuneNarrativeV2}=await server.ssrLoadModule('/src/PeriodFortuneNarrativeV2.tsx')
  const {AiInterpretationPanel}=await server.ssrLoadModule('/src/AiInterpretationPanel.tsx')
  const ids=['W:window:2026-09-12:직장:best','S:period:day','T:mahathaksa:natal']
  for(const period of ['today','week','month','year']) {
    const {data,calculation}=fortuneFixture(period)
    data.headline='오늘 약속을 다시 확인해.'
    data.overall={summary:'약속의 조건을 차분히 정리해.',evidence_refs:ids}
    data.decisions=[{action:'만날 시간을 먼저 정해 '+ids.join(' · ')+'.',reason:'19:30에 확인해 ('+ids.join(', ')+').',evidence_refs:ids}]
    data.key_windows=[{start:calculation.period.start,end:calculation.period.start,topics:['직장'],signal:'활용',label:'약속을 정할 날',summary:'오후에 일정에 여유가 있어 ('+ids[0]+').',evidence_refs:ids}]
    const before=JSON.stringify(data)
    const result={ok:true,origin:'gemini',provenance_verified:true,usage:{quality_validation:{score:100}},data}
    const pages=[renderToStaticMarkup(h(PeriodFortuneNarrativeV2,{period,calculation,result}))]
    if(period==='year')pages.push(renderToStaticMarkup(h(AiInterpretationPanel,{topics:[],result})))
    for(const html of pages) {
      assert.ok(html.includes('19:30에 확인해.'), period)
      assert.ok(html.includes('만날 시간을 먼저 정해.'), period)
      if(period!=='today')assert.ok(html.includes('오후에 일정에 여유가 있어.'),period)
      for(const id of ids)assert.ok(!html.includes(id),period+' leaked '+id)
    }
    assert.equal(JSON.stringify(data),before)
  }
})

test('opening day, week and month calculations only restores saved prose until the reader chooses generation',()=>{
  for (const args of ['cached.result, cached.request','cachedCalculation.result, cachedCalculation.request','calculation, body as unknown as Record<string,unknown>']) {
    assert.ok(app.includes("runAiInterpretation("+args+", 'open')"))
  }
  assert.match(app,/cacheOnly = intent === 'open' && period !== 'year'/)
  const open=app.indexOf('if (cacheOnly)')
  const start=app.indexOf("action: 'start', calculation: calculationForInterpretation")
  assert.ok(open>0 && start>open)
  assert.match(app.slice(open,start),/setAiLoading\(false\)\s+return/)
  assert.match(app,/refreshMonthlyGaps \? 'refresh' : 'generate'/)
})
