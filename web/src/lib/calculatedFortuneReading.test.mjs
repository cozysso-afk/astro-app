import assert from 'node:assert/strict'
import {after,before,test} from 'node:test'
import {fileURLToPath} from 'node:url'
import {createServer} from 'vite'
import {createElement as h} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {fortuneFixture} from './readingExperience.fixtures.mjs'

let server,Panel,field,exportModel
before(async()=>{
  server=await createServer({root:fileURLToPath(new URL('../..',import.meta.url)),optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false},appType:'custom'})
  Panel=(await server.ssrLoadModule('/src/PeriodAiInterpretationPanel.tsx')).PeriodAiInterpretationPanel
  exportModel=(await server.ssrLoadModule('/src/lib/readingImageExport.ts')).authoredReadingExportModel
  field=(await server.ssrLoadModule('/src/lib/fortuneFields.ts')).fortuneField
})
after(()=>server?.close())
const noCall=()=>assert.fail('render requested an external action')
for(const period of ['today','week','month','year']) {
  test(period+' keeps dated source data available on missing, untrusted, loading and failed interpretations',()=>{
    const {calculation}=fortuneFixture(period)
    const date=calculation.period.start
    calculation.western.daily_scores=[{date,scores:{학업:47.5},evidence:[{kind:'aspect',source_topics:['학업'],transit:'Mercury',target:'Saturn',aspect:'square',topic_contributions:{학업:{contribution:4,polarity:-.8}}},{source_topics:['직장'],transit:'Pluto',target:'Mars',aspect:'square'}],score_components:{학업:{activation:75,favorability:39}}}]
    const before=JSON.stringify(calculation)
    const fake={ok:true,model:'gemini-3.7-flash',origin:'gemini',provenance_verified:false,usage:{quality_validation:{score:100}},data:{headline:'UNVERIFIED'}}
    const render=extra=>renderToStaticMarkup(h(Panel,{period,calculation,field:field('study'),result:null,loading:false,error:'',canCancel:true,onCancel:noCall,onRetry:noCall,onCopyPrompt:noCall,...extra}))
    for(const extra of [{},{result:fake},{error:'사용 한도 도달'},{loading:true}]){
      const html=render(extra)
      assert.match(html,/학업 · 47\.5점/)
      assert.match(html,/<details><summary>활성도와 유리도는 어떻게 달라[?]<\/summary>/)
      assert.match(html,/학업 · 활성도 75 · 유리도 39/)
      assert.equal((html.match(/data-score-topic="학업"/g)??[]).length,1)
      if(period==='today')assert.doesNotMatch(html,/분야별 기간 평균|점수가 높은 날과 낮은 날/)
      assert.match(html,/수성 · 사분위 · 토성/)
      assert.match(html,/학업 기여도 4 · 방향 -0\.8/)
      assert.ok(html.includes(date))
      assert.doesNotMatch(html,/명왕성|UNVERIFIED|핵심 이미지 저장|계산값으로 읽는|data-reading-section=/)
      assert.ok(html.includes(extra.loading?'생성 취소':extra.error?'해설 다시 확인':'해설 생성'))
    }
    assert.equal(JSON.stringify(calculation),before)
    delete calculation.western.daily_scores[0].score_components
    delete calculation.western.daily_scores[0].evidence[0].topic_contributions
    const legacy=render({})
    assert.match(legacy,/학업 · 47\.5점/)
    assert.doesNotMatch(legacy,/유리도|학업 기여도/)
  })
}

test('one-day score report merges repeat measurements and keeps topic-specific hourly evidence',()=>{
  const {calculation}=fortuneFixture('today')
  const date=calculation.period.start
  calculation.western.daily_scores=[{date,scores:{학업:30,수신신호:30},score_components:{학업:{activation:23.56,favorability:36.03}}}]
  calculation.western.overall={학업:{average:30,band:'약함',best_days:[{date,score:30}],caution_days:[{date,score:30}]}}
  calculation.western.relationship_signals={수신신호:{average:30}}
  calculation.western.detail_days=[{date,topics:{학업:{evidence:['학업 원자료']},금전:{evidence:['금전 원자료']}}}]
  const render=field=>renderToStaticMarkup(h(Panel,{period:'today',calculation,field,result:null,loading:false,error:'',onRetry:noCall,onCopyPrompt:noCall}))
  const overall=render()
  assert.equal(overall.split('학업 · 30점').length-1,1)
  assert.equal(overall.split('외부 연락 반응 신호 · 30점').length-1,1)
  assert.doesNotMatch(overall,/분야별 기간 평균|상대적 주의 흐름|높은 날/)
  assert.match(overall,/활성도 23.56 · 유리도 36.03/)
  assert.match(overall,/높을수록 도움 쪽/)
  const study=render(field('study'))
  assert.match(study,/학업 원자료/)
  assert.doesNotMatch(study,/금전 원자료|외부 연락 반응 신호/)
})

test('image export rejects earlier calculated advice even if it has a headline and block IDs',()=>{
  const core=[{id:'week:dates',label:'학업',text:'로컬 조언'}]
  const doc={state:'calculated',title:'주간 학업운',date:'2026-10-01 → 2026-10-07',headline:'로컬 요약',core,exportBlockIds:['week:dates']}
  for(const state of ['calculated','unverified','partial','missing']) assert.throws(()=>exportModel({...doc,state}))
})
