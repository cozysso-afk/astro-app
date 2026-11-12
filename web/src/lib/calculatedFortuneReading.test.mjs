import assert from 'node:assert/strict'
import {after,before,test} from 'node:test'
import {fileURLToPath} from 'node:url'
import {createServer} from 'vite'
import {createElement as h} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {fortuneFixture} from './readingExperience.fixtures.mjs'

let server,Panel,groups,exportModel
before(async()=>{
  server=await createServer({root:fileURLToPath(new URL('../..',import.meta.url)),optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false},appType:'custom'})
  Panel=(await server.ssrLoadModule('/src/PeriodAiInterpretationPanel.tsx')).PeriodAiInterpretationPanel
  exportModel=(await server.ssrLoadModule('/src/lib/readingImageExport.ts')).authoredReadingExportModel
  groups=(await server.ssrLoadModule('/src/lib/fortuneFields.ts')).fortuneGroup
})
after(()=>server?.close())
function fixture(period) {
  const f=fortuneFixture(period), c=f.calculation
  const days=period==='week'?7:31
  c.period={start:'2026-10-01',end:period==='week'?'2026-10-07':'2026-10-31',day_count:days}
  c.western.daily_scores=Array.from({length:days},(_,i)=>({date:'2026-10-'+String(i+1).padStart(2,'0'),
    scores:Object.fromEntries(Object.keys(c.western.overall).map(topic=>[topic,49+i])),evidence:[]}))
  return c
}
const noCall=()=>assert.fail('render requested an external action')
function render(period,field,more={}) {
  return renderToStaticMarkup(h(Panel,{period,calculation:fixture(period),field:groups(field),result:null,loading:false,error:'',
    onRetry:noCall,onCopyPrompt:noCall,onCancel:noCall,...more}))
}
for(const period of ['week','month']){
  test(period+' renders six calculated love situations with no provider and retains explicit generation controls',()=>{
    const html=render(period,'애정')
    assert.match(html,/계산값으로 읽는 (주간|월간) 애정운/)
    assert.equal((html.match(/data-reading-section="relationship.love_(?:single|crush|flirting|ambiguous|couple|reunion_interest)"/g)??[]).length,6)
    assert.match(html,/해설 생성/)
    assert.match(html,/핵심 이미지 저장/)
    assert.doesNotMatch(html,/이미 저장|이 저장본의 핵심|아직 작성되지 않은/)
  })
  test(period+' keeps own data and scope on untrusted, error, loading and unavailable paths',()=>{
    const fake={ok:true,origin:'gemini',provenance_verified:false,data:{headline:'NEVER_RENDER_UNVERIFIED'},usage:{quality_validation:{score:100}}}
    for(const extra of [{result:fake},{result:fake,error:'사용 한도 도달'},{loading:true},{result:{ok:false},error:'서버 오류'}]){
      const html=render(period,'학업',extra)
      assert.match(html,/계산값으로 읽는 (주간|월간) 학업운/)
      assert.match(html,/시험|문제/)
      assert.doesNotMatch(html,/NEVER_RENDER_UNVERIFIED|내 상황에 맞춰 보기/)
      if(extra.error) assert.ok(html.includes(extra.error))
    }
    const c=fixture(period)
    c.western.daily_scores=[];c.western.overall={};c.western.relationship_signals={}
    const empty=render(period,'애정',{calculation:c})
    assert.match(empty,/계산 자료가 부족해/)
    assert.doesNotMatch(empty,/핵심 이미지 저장/)
    assert.doesNotMatch(render(period,'애정',{westernOnly:true}),/계산값으로 읽는/)
  })
}

test('calculated PNG uses exactly the visible core and rejects incomplete or unverified input',()=>{
  const row={id:'week:dates',label:'학업 · 날짜별 차이',text:'10월 7일 수요일에 복습 흐름을 살펴봐.'}
  const doc={state:'calculated',title:'계산값으로 읽는 주간 학업운',date:'2026-10-01 → 2026-10-07',headline:'',core:[row],exportBlockIds:[row.id]}
  const cards=exportModel(doc).sections[0].cards
  assert.deepEqual(cards.map(({title,body})=>[title,body]),[[row.label,row.text]])
  for(const patch of [{state:'unverified'},{state:'partial'},{core:[]},{exportBlockIds:['absent']}]){
    assert.throws(()=>exportModel({...doc,...patch}))
  }
})

test('a week without a manuscript can answer a tagged question in the correct field',()=>{
  const c=fixture('week')
  c.western.daily_scores[0].evidence=[{kind:'aspect',source_topics:['직장'],transit:'Mercury',target:'Saturn',aspect:'사분위',polarity:-1}]
  const work=render('week','직업',{calculation:c})
  assert.match(work,/data-reading-section="question:직장:coordination_responsibility"/)
  assert.match(work,/10월 1일에 직장 계산/)
  assert.doesNotMatch(render('week','애정',{calculation:c}),/초안을 보낼 날/)
})

for(const period of ['today','week','month']) {
  test(period+' free reader pairs the selected subject with its actual dated aspects',()=>{
    const calc=fixture(period)
    if(period==='today') {
      calc.period={start:'2026-10-01',end:'2026-10-01',day_count:1}
      calc.western.daily_scores=calc.western.daily_scores.slice(0,1)
    }
    const study={kind:'aspect',source_topics:['학업'],transit:'Mercury',target:'Saturn',aspect:'사분위',contribution:4,polarity:-0.8}
    const opposite={...study,transit:'Venus',target:'Moon',aspect:'trine',contribution:2,polarity:0.65}
    const first=calc.western.daily_scores[0],last=calc.western.daily_scores.at(-1)
    first.evidence=[study,{...opposite,source_topics:['직장'],transit:'Pluto',contribution:15}]
    last.evidence.push(opposite)
    const actual=render(period,'학업',{calculation:calc})
    if(period==='today') {
      assert.match(actual,/책을 덮고 첫 단계의 이유를 설명할 때 막힐 수 있어[\s\S]*10월 1일 학업 49점 · 운행 수성 · 출생 토성 사각 \/ 운행 금성 · 출생 달 삼각/)
    } else {
      assert.match(actual,/10월 1일 학업 지표는 49점.*운행 중인 수성과 출생차트의 토성/)
      assert.match(actual,/운행 중인 금성과 출생차트의 달/)
    }
    assert.doesNotMatch(actual,/운행(?: 중인)? 명왕성/)
    if(period==='week') assert.match(actual,/10월 7일 학업 지표는 55점.*주간 평균은 52점/)
    if(period==='month') assert.match(actual,/10월 31일 학업 지표는 79점.*월간 평균은 52점/)
    first.evidence=[];last.evidence=[]
    assert.doesNotMatch(render(period,'학업',{calculation:calc}),/운행(?: 중인)? 수성(?:과 출생차트의| · 출생) 토성/)
  })
}
