import test,{before,after} from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {fileURLToPath} from 'node:url'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {fortuneFixture} from './readingExperience.fixtures.mjs'
let server,documents,exporter,fields,Panel,daily
before(async()=>{
  server=await createServer({root:fileURLToPath(new URL('../..',import.meta.url)),optimizeDeps:{noDiscovery:true},server:{middlewareMode:true},appType:'custom'})
  documents=await server.ssrLoadModule('/src/lib/authoredReadingDocument.ts')
  exporter=await server.ssrLoadModule('/src/lib/readingImageExport.ts')
  fields=await server.ssrLoadModule('/src/lib/fortuneFields.ts')
  daily=await server.ssrLoadModule('/src/lib/dailyReadingDocument.ts')
  Panel=(await server.ssrLoadModule('/src/AuthoredReadingPanel.tsx')).AuthoredReadingPanel
})
after(async()=>server?.close())
const authored=(name)=>({conclusion:`${name}의 핵심 답은 이 질문의 조건부터 확인하는 거야.`,real_scene:`${name}의 구체적 생활 장면을 그대로 보존해.`,action:`${name}의 확인할 일을 하나 정해.`,change_condition:`${name}의 조건이 달라지면 결론을 다시 봐.`,evidence_refs:['W:synthetic'],applicability:'direct'})
function fixture(){
  const data=fortuneFixture('week').data
  data.headline='이번 기간에는 확인할 조건을 먼저 정리해.'
  data.overall={summary:'이것은 새 원고 품질 인증이 아닌, 합성 입력의 화면 보존 검사용 요약이야.',dominant_pattern:'이유 원문은 문장 순서와 관계없이 그대로 유지돼.',evidence_refs:['W:synthetic']}
  data.decisions=[{action:'확인한 조건만 실행으로 옮겨.',reason:'조건이 확인되어야 적용 범위를 알 수 있어.',timing:'실제 일정을 확인한 다음',watch:'조건이 달라졌다면 멈춰.',avoid:'미확인 조건을 사실로 쓰지 마.',evidence_refs:['W:synthetic']}]
  data.clusters=Object.fromEntries(Object.entries({relationship:['summary','friends','coworkers','family','new_people','boundaries','love_general','love_single','love_crush','love_flirting','love_ambiguous','love_couple','love_reunion_interest','contact_activation','contact_continuity'],work_study:['study','exam','work','career_change'],money_news:['money','news'],investment:['psychology','realization','entry'],condition:['condition']}).map(([group,keys])=>[group,Object.fromEntries(keys.map(key=>[key,authored(`${group}.${key}`)]))]))
  data.domain_answers=[{topic:'연락',question_key:'contact_specific',label:'연락에서 확인할 점',answer:'이 연락 질문의 답은 다른 분야 총평으로 교체하면 안 돼.',status:'direct',evidence_refs:['W:synthetic']}]
  return data
}
for(const period of ['week','month','year'])test(`${period} keeps authored core conditions and every selected export block`,()=>{
  const data=fixture(),before=JSON.stringify(data)
  const doc=documents.buildPeriodReadingDocument(data,period,'2026-11-04','2026-11-30',undefined,true,'test')
  assert.equal(doc.state,'ready')
  const html=renderToStaticMarkup(createElement(Panel,{doc}))
  const model=exporter.authoredReadingExportModel(doc)
  const exported=model.sections.flatMap(s=>s.cards).map(c=>c.body)
  for(const value of [data.headline,data.overall.summary,data.overall.dominant_pattern,...Object.values(data.decisions[0]).filter(v=>typeof v==='string'),data.limits])if(value)assert.ok(exported.includes(value),value)
  assert.ok(html.indexOf('authored-reading-core')<html.indexOf('authored-reading-details'))
  assert.equal(JSON.stringify(data),before)
})
test('ten entry scopes and seven groups preserve the actual selected subjects',()=>{
  const data=fixture()
  for(const field of fields.FORTUNE_FIELDS){
    const doc=documents.buildPeriodReadingDocument(data,'week','2026-11-04','2026-11-10',field,true)
    assert.equal(doc.state,'ready',field.id)
    assert.notEqual(doc.headline,data.headline)
    assert.ok(!doc.core.some(b=>b.text===data.overall.summary))
  }
  for(const [group,keys] of [['애정',['contact_activation','contact_continuity','love_reunion_interest']],['대인',['news']],['학업',['exam']],['직업',['career_change']],['금전',['psychology','realization','entry']]]){
    const doc=documents.buildPeriodReadingDocument(data,'week','2026-11-04','2026-11-10',fields.fortuneGroup(group),true)
    for(const key of keys)assert.ok(doc.sections.some(s=>s.id.endsWith(`.${key}`)),`${group} ${key}`)
  }
})
test('missing primary field never promotes overall, deterministic topic or a secondary answer',()=>{
  const data=fixture();delete data.clusters.relationship.contact_activation
  const doc=documents.buildPeriodReadingDocument(data,'month','2026-11-01','2026-11-30',fields.fortuneField('contact'),true)
  assert.equal(doc.state,'partial');assert.equal(doc.headline,'');assert.deepEqual(doc.exportBlockIds,[])
  assert.equal(doc.sections.find(s=>s.id==='relationship.contact_activation').state,'missing')
  assert.ok(doc.sections.some(s=>s.id==='relationship.contact_continuity'&&s.state==='ready'))
  assert.throws(()=>exporter.authoredReadingExportModel(doc))
})
test('authored insufficient is distinct from omitted model output in daily and period slots',()=>{
  const data=fixture();data.clusters.relationship.contact_activation={...authored('연락'),applicability:'insufficient'}
  const field=fields.fortuneGroup('애정')
  let doc=documents.buildPeriodReadingDocument(data,'week','a','b',field,true)
  assert.equal(doc.sections.find(s=>s.id==='relationship.contact_activation').state,'missing')
  data.editorial_delivery={'relationship.contact_activation':'authored'}
  doc=documents.buildPeriodReadingDocument(data,'week','a','b',field,true)
  assert.equal(doc.sections.find(s=>s.id==='relationship.contact_activation').state,'insufficient')
  const day=daily.buildDailyReadingDocument(data,'2026-11-04',field,true)
  assert.equal(day.slots.find(s=>s.id==='relationship.contact_activation').state,'insufficient')
  assert.ok(day.details.some(b=>b.id==='relationship.contact_continuity:conclusion'))
  assert.ok(day.details.some(b=>b.id==='relationship.love_reunion_interest:conclusion'))
})
test('long and repeated authored text is preserved rather than silently shortened',()=>{
  const data=fixture();const original='첫 문장. 둘째 문장의 중요한 부정 조건은 절대로 지우지 마. 셋째 문장. 넷째 문장. '.repeat(12)
  data.clusters.work_study.work.real_scene=original
  const doc=documents.buildPeriodReadingDocument(data,'year','a','b',fields.fortuneField('work'),true)
  assert.equal(doc.core.find(b=>b.id.endsWith(':scene')).text,original.trim())
  assert.ok(exporter.authoredReadingExportModel(doc).sections[0].cards.some(c=>c.body===original.trim()))
})
test('relationship new core and old detailed questions remain separate, unchanged and mode specific',()=>{
  const data={headline:'관계의 핵심',overview:'첫 문장. 둘째 문장. 셋째 문장. 넷째 문장. 다섯째 문장.',core_summary:'짧게 작성된 핵심 요약.',core_reason:'근거를 설명한 원문.',core_action:'실제 행동을 확인해.',core_conditions:['조건을 지켜.'],chemistry:'끌림 원문',emotional_dynamic:'정서 원문',communication:'소통 원문',conflict_pattern:'갈등 원문',power_boundaries:'경계 원문',long_term:'지속 원문',timing:'시기 원문',limits:'한계 원문',practical_advice:['확인 원문'],marriage_reading:{bottom_line:'결혼 핵심',bond:'결속 원문',daily_life:'역할 원문'}}
  const ai={ok:true,origin:'gemini',provenance_verified:true,data}
  const doc=documents.buildRelationshipReadingDocument(ai,'compatibility','2026-11-04')
  assert.equal(doc.state,'ready');assert.equal(doc.sections.find(s=>s.id==='overview').blocks[0].text,data.overview)
  for(const key of ['chemistry','emotional_dynamic','communication','conflict_pattern','power_boundaries','long_term'])assert.equal(doc.sections.find(s=>s.id===key).blocks[0].text,data[key])
  const marriage=documents.buildRelationshipReadingDocument(ai,'marriage_married','2026-11-04')
  assert.ok(!marriage.sections.some(s=>s.id==='chemistry'))
  assert.equal(marriage.sections.find(s=>s.id==='marriage:daily_life').blocks[0].text,'역할 원문')
  const legacy=documents.buildRelationshipReadingDocument({...ai,data:{...data,core_summary:undefined}},'compatibility','2026-11-04')
  assert.equal(legacy.state,'partial');assert.deepEqual(legacy.exportBlockIds,[])
  assert.equal(legacy.sections.find(s=>s.id==='overview').blocks[0].text,data.overview)
})
test('unverified source cannot expose prose and export manifest cannot reference a missing block',()=>{
  const doc=documents.buildPeriodReadingDocument(fixture(),'week','a','b',undefined,false)
  assert.equal(doc.state,'unverified');assert.deepEqual(doc.sections,[]);assert.equal(doc.headline,'')
  const ready=documents.buildPeriodReadingDocument(fixture(),'week','a','b',undefined,true)
  assert.throws(()=>exporter.authoredReadingExportModel({...ready,exportBlockIds:['lost']}),/빠졌어/)
})
test('missing questions keep all labels in one collapsed list after available authored details',()=>{
  const data=fixture();delete data.clusters.relationship.contact_activation
  data.domain_answers.push({topic:'소식',question_key:'time',label:'시기',answer:'',status:'not_calculated',evidence_refs:[]},{topic:'연락',question_key:'time',label:'시기',answer:'',status:'not_calculated',evidence_refs:[]})
  const doc=documents.buildPeriodReadingDocument(data,'month','a','b',fields.fortuneField('contact'),true)
  const html=renderToStaticMarkup(createElement(Panel,{doc}))
  assert.match(html,/<details class="authored-reading-coverage"><summary>아직 작성되지 않은 항목 3개/)
  assert.ok(html.includes('소식 · 시기'));assert.ok(html.includes('연락 · 시기'));assert.ok(html.includes('연락 흐름'))
  assert.ok(html.indexOf('data-reading-section="relationship.contact_continuity"')<html.indexOf('authored-reading-coverage'))
  assert.doesNotMatch(html,/이 질문의 해설은 아직 작성되지 않았어/)
})
