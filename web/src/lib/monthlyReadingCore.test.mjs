import test from 'node:test'
import assert from 'node:assert/strict'
import {monthlyReadingCore} from './monthlyReadingCore.ts'

const date=n=>'2026-11-'+String(n).padStart(2,'0')
const doc={state:'ready',date:date(1)+' → '+date(30),core:[{id:'original',text:'원고'}],revision:'original',exportBlockIds:['original']}
const period={start:date(1),end:date(30)}
const days=Array.from({length:30},(_,i)=>({date:date(i+1),scores:{연애:i<10?32:i<20?64:48,시험:i<25?30:90}}))

test('month display uses the selected topic, real ten-day means and retains authored prose and exports',()=>{
  const calc={period,western:{daily_scores:days}}
  const love=monthlyReadingCore(doc,calc,{topics:['연애']})
  assert.match(love.core[1].text,/초순 32점, 중순 64점, 하순 48점.*중순에.*호감/)
  assert.deepEqual(love.exportBlockIds,['original','month:segments:연애'])
  assert.equal(doc.core.length,1)
  const exam=monthlyReadingCore(doc,calc,{topics:['시험']})
  assert.match(exam.core[1].text,/하순 60점.*실전/)
  assert.doesNotMatch(exam.core[1].text,/호감/)
})
test('leaves sparse and unverified results untouched, and does not invent timing for ties',()=>{
  assert.equal(monthlyReadingCore(doc,{period,western:{daily_scores:days.slice(2,8)}}),doc)
  const calculation={period,western:{daily_scores:days.map(day=>({...day,scores:{연애:44}}))}}
  assert.match(monthlyReadingCore(doc,calculation,{topics:['연애']}).core[1].text,/평균이 같아/)
  const unverified={...doc,state:'unverified'}
  assert.equal(monthlyReadingCore(unverified,calculation),unverified)
})

test('the verified monthly report preserves authored timing and labels unanswered fields without filling them from numbers',async()=>{
  const {createServer}=await import('vite')
  const {createElement}=await import('react')
  const {renderToStaticMarkup}=await import('react-dom/server')
  const {fileURLToPath}=await import('node:url')
  const server=await createServer({root:fileURLToPath(new URL('../..',import.meta.url)),optimizeDeps:{noDiscovery:true},server:{middlewareMode:true},appType:'custom'})
  try {
    const {PeriodFortuneNarrativeV2}=await server.ssrLoadModule('/src/PeriodFortuneNarrativeV2.tsx')
    const names=['학업','직장','금전','대인관계']
    const daily_scores=days.map((row,i)=>({...row,scores:{학업:i<10?34:56,직장:i<20?60:20,금전:40,대인관계:i<20?30:45}}))
    const stat={band:'보통',average:50,best_days:[],caution_days:[]}
    const calculation={period:{...period,day_count:30},western:{overall:Object.fromEntries(names.map(topic=>[topic,stat])),daily_scores}}
    const domain_answers=['학업:timing','직장:change_timing','금전:timing','금전:contract_recovery'].map(key=>{
      const [topic,question_key]=key.split(':')
      return {topic,question_key,label:key,status:'not_calculated',answer:'',evidence_refs:[]}
    })
    const result={ok:true,model:'gemini-3.7-flash',provenance_verified:true,origin:'gemini',usage:{quality_validation:{score:100}},data:{headline:'월간 원고',overall:{summary:'저장된 종합 해설',evidence_refs:['W:original']},domain_answers}}
    const show=field=>renderToStaticMarkup(createElement(PeriodFortuneNarrativeV2,{result,period:'month',calculation,field}))
    const overall=show()
    assert.match(overall,/저장된 종합 해설/)
    assert.match(overall,/data-reading-section="question:금전:contract_recovery" data-section-state="insufficient"/)
    assert.doesNotMatch(overall,/data-calculated-section|점수를 나눠 보면|가장 먼저 살필/)
    const study=show({id:'study',label:'학업',topics:['학업']})
    assert.match(study,/data-reading-section="question:학업:timing" data-section-state="insufficient"/)
    assert.doesNotMatch(study,/직장 점수를|금전 점수를/)
  } finally { await server.close() }
})

test('month resolves the missing contact direction question only when both matching scores exist',()=>{
  const id='question:연락:activation_direction'
  const source={...doc,sections:[{id,label:'연락 · 방향',state:'insufficient',blocks:[]}]}
  const calc={period,western:{relationship_signals:{수신신호:{average:39},발신적합:{average:38}}}}
  const overview=monthlyReadingCore(source,calc)
  assert.equal(overview.sections[0].state,'ready')
  assert.match(overview.sections[0].blocks[0].text,/1점 높아/)
  assert.ok(!overview.core.some(b=>b.id==='month:contact-direction'))
  delete calc.western.relationship_signals.발신적합
  assert.equal(monthlyReadingCore(source,calc).sections[0].state,'insufficient')
})
