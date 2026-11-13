import assert from 'node:assert/strict'
import test,{before,after} from 'node:test'
import {createServer} from 'vite'
import {createElement as h} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {fileURLToPath} from 'node:url'
import {fortuneFixture} from './readingExperience.fixtures.mjs'
import {archetypeFixtures,archetypeContext,visualSettings} from './datingArchetype.fixtures.mjs'
let server,systems,Views,fields,summary,compact,dating
before(async()=>{
 server=await createServer({root:fileURLToPath(new URL('../..',import.meta.url)),optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false},appType:'custom'})
 systems=await server.ssrLoadModule('/src/lib/systemReading.ts')
 Views=(await server.ssrLoadModule('/src/SystemReadingViews.tsx')).SystemReadingViews
 fields=(await server.ssrLoadModule('/src/lib/fortuneFields.ts')).FORTUNE_FIELDS
 summary=await server.ssrLoadModule('/src/lib/fortuneUserSummary.ts')
 compact=await server.ssrLoadModule('/src/lib/compactDeepPrompt.ts')
 dating=await server.ssrLoadModule('/src/lib/datingArchetype.ts')
})
after(async()=>server?.close())
function fixture(period='today',provisional=false){
 const f=fortuneFixture(period),c=f.calculation,a=!provisional
 c.precision={contract_version:'integrated-precision-v2',status:a?'exact':'provisional',time_available:true,time_exact:a,time_source:a?'official_record':'family_memory',time_confidence:a?'exact':'medium',scoring_mode:a?'full_exact':'planet_only_provisional',...Object.fromEntries(['allow_natal_moon_scoring','allow_angles_houses_scoring','allow_house_ruler_bonus','allow_intraday_timing','allow_saju_ai','allow_thai_ai'].map(k=>[k,a])),layer_policy:Object.fromEntries(['natal_moon','angles_houses','house_ruler_bonus','intraday_timing','saju_ai','thai_ai'].map(k=>[k,a?'allow':'exclude']))}
 const row=(god,start='2026-09-01T00:00:00+09:00',end='2026-10-08T12:00:00+09:00')=>({ganzhi:'甲子',stem_ten_god:god,branch_links:['일주 寅와 六合(육합)'],segment_start:start,segment_end_exclusive:end})
 c.saju={ok:true,pillars:{year:'甲子',month:'乙丑',day:'丙寅',hour:'丁卯'},day_master:'丙',elements:{火:2},dayun:[{start_year:2020,end_year:2029,ganzhi:'乙未'}],annual:[{year:2026,...row('正官(정관)','2026-02-04T04:00:00+09:00','2027-02-04T10:00:00+09:00')}],monthly:[row('正印(정인)'),row('正財(정재)','2026-10-08T12:00:00+09:00','2026-11-07T12:00:00+09:00')],not_calculated:['용신 미계산']}
 const wheel=Object.keys(systems.BHUMI_LENSES).map(k=>({bhumi_key:k,bhumi_label:systems.BHUMI_LENSES[k].title,planet:{key:'venus',label:'금성'}}))
 c.thai={ok:true,thai_day:'목요일',mahathaksa:{available:true,wheel},taksajorn:{available:true,segments:[{start:'2026-01-01',end:'2026-09-14',age_in_progress:30,annual_boriwan:{label:'목성'},wheel},{start:'2026-09-15',end:'2026-12-31',age_in_progress:31,annual_boriwan:{label:'금성'},wheel}]},predictive_status:'final prediction inactive',not_calculated:[]}
 return f
}
for(const period of ['today','week','month','year'])test(`${period}: independent system output and immutable scores`,()=>{
 const f=fixture(period),before=JSON.stringify(f.calculation),v=systems.buildSystemReading(f.calculation)
 assert.ok(v.contexts.length);assert.match(v.sajuSummary,/정인|학습/);assert.match(v.thaiSummary,/Boriwan|주변 사람/)
 for(const system of ['integrated','western','saju','thai']){
  const html=renderToStaticMarkup(h(Views,{calculation:f.calculation,initialSystem:system},h('p',{},'Western fixture')))
  assert.ok(html.includes(f.calculation.period.start))
  if(system==='saju'){assert.match(html,/乙未|甲子/);assert.match(html,/정인/);assert.match(html,/六合/);assert.doesNotMatch(html,/class="system-score-grid"/)}
  if(system==='thai'){for(const key of Object.keys(systems.BHUMI_LENSES))assert.ok(html.includes(key));assert.doesNotMatch(html,/class="system-score-grid"/)}
 }
 assert.equal(JSON.stringify(f.calculation),before)
})
for(const period of ['today','week','month','year'])test(`${period}: ten field mappings and focused compact packets`,()=>{
 for(const field of fields){
  const f=fixture(period),entries=Object.entries(f.data.topic_analysis).filter(([topic])=>field.topics.includes(topic))
  const v=summary.buildFortuneUserSummary(f.data,{...f.context,focusTopics:field.topics,topicEntries:entries})
  assert.deepEqual(new Set(v.focusTopics.map(r=>r.topic)),new Set(field.topics))
  assert.ok([...v.favorableCards,...v.cautionCards].every(r=>field.topics.includes(r.topic)))
  const prompt=compact.buildExternalCompactPrompt(f.calculation,f.data,false,field.topics)
  assert.ok(prompt.length<=7500)
  const packet=JSON.parse(prompt.split('\nCALCULATED_DATA=')[1])
  assert.deepEqual(packet.focus_topics,field.topics)
  assert.ok(packet.topics.every(r=>field.topics.includes(r.topic)))
  if(field.id==='investment')assert.ok(!packet.favorable.some(r=>r.topic==='투자주의'))
  if(field.id==='contact'){assert.ok(v.relationship?.incoming);assert.ok(v.relationship?.outgoing);assert.ok(packet.relationship_signals.incoming);assert.ok(packet.relationship_signals.outgoing)}
 }
})
test('today topic headlines stay inside the selected field and overall is not copied from love',()=>{
 const f=fixture('today')
 const day=f.calculation.western.daily_scores.find(row=>row.date===f.calculation.period.start)
 day.evidence=[{source_topics:['연락'],transit:'Mercury',target:'Moon',aspect:'trine',contribution:99,polarity:1,motion:'Applying'}]
 const overall=summary.buildFortuneUserSummary(f.data,{...f.context,topicEntries:Object.entries(f.data.topic_analysis)})
 const loveTopics=['연애','연락','재회']
 const love=summary.buildFortuneUserSummary(f.data,{...f.context,focusTopics:loveTopics,topicEntries:Object.entries(f.data.topic_analysis).filter(([topic])=>loveTopics.includes(topic))})
 const condition=summary.buildFortuneUserSummary(f.data,{...f.context,focusTopics:['컨디션'],topicEntries:Object.entries(f.data.topic_analysis).filter(([topic])=>topic==='컨디션')})
 assert.notEqual(overall.headline,love.headline)
 assert.equal(overall.bestFlow[0],'연락')
 assert.match(overall.headline,/전체 흐름에서 가장 먼저 볼 건 연락/)
 assert.doesNotMatch(overall.headline,/전체 흐름에서 가장 먼저 볼 건 대인관계/)
 assert.match(condition.headline,/컨디션/)
 assert.doesNotMatch(condition.headline,/연락|답장|대화/)
})

test('weekly focused headlines ignore evidence from other life topics',()=>{
 const f=fixture('week')
 for(const day of f.calculation.western.daily_scores) day.evidence=[{source_topics:['연락'],transit:'Mercury',target:'Moon',aspect:'trine',contribution:99,polarity:1,motion:'Applying'}]
 const condition=summary.buildFortuneUserSummary(f.data,{...f.context,focusTopics:['컨디션'],topicEntries:Object.entries(f.data.topic_analysis).filter(([topic])=>topic==='컨디션')})
 assert.doesNotMatch(condition.headline,/연락|답장|대화/)
})

test('crosswalk accepts exact engine names only and never creates missing meanings',()=>{
 assert.equal(systems.tenGodLens('正印(정인)').topic,'학업')
 assert.equal(systems.tenGodLens('正官(정관)').topic,'직업')
 assert.equal(systems.tenGodLens('正財(정재)').topic,'금전')
 assert.equal(systems.tenGodLens('unknown'),undefined)
 assert.equal(systems.tenGodLens('신강'),undefined)
 assert.equal(systems.BHUMI_LENSES.ayu.topic,'컨디션')
 assert.equal(systems.BHUMI_LENSES.mula.topic,'금전')
 assert.equal(systems.BHUMI_LENSES.boriwan.topic,'대인')
})
test('provisional system views exclude all disallowed source data',()=>{
 const f=fixture('week',true),v=systems.buildSystemReading(f.calculation)
 assert.equal(v.saju,undefined);assert.equal(v.thai,undefined)
 for(const system of ['saju','thai']){const html=renderToStaticMarkup(h(Views,{calculation:f.calculation,initialSystem:system}));assert.match(html,/현재 입력으로 확인된 .* 계산 자료가 없어/);assert.doesNotMatch(html,/甲子|乙未|Boriwan|금성/)}
})
test('Thai birthday segments remain separate; Saju solar-term segments are not calendar-merged',()=>{
 const f=fixture('year'),v=systems.buildSystemReading(f.calculation)
 assert.equal(v.wheels.length,2);assert.notEqual(v.wheels[0].annual_boriwan.label,v.wheels[1].annual_boriwan.label)
 assert.equal(v.monthly.length,2);assert.notEqual(v.monthly[0].segment_start,v.monthly[1].segment_start)
 assert.equal(v.state,'서로 다른 층')
 const compactPacket=JSON.parse(compact.buildExternalCompactPrompt(f.calculation,f.data).split('\nCALCULATED_DATA=')[1])
 assert.ok(compactPacket.saju.length);assert.ok(compactPacket.thai.segments.length)
})
test('dating V2 is separate from spouse and excludes names and exact measurements from image copy',()=>{
 const model=dating.buildDatingArchetypeV2(archetypeFixtures[0].natal,archetypeContext)
 assert.equal(model.kind,'dating_partner');assert.equal(model.version,'dating-appearance-v2')
 for(const language of ['ko','en'])for(const style of ['real','dream','illustration']){
  const text=dating.datingPortraitPromptV2(model,{...visualSettings,style,celebrity:'FORBIDDEN_NAME'},language)
  assert.doesNotMatch(text,/FORBIDDEN_NAME|정유미|공유|Gong Yoo|Jung Yu|\d+\s*cm/)
 }
})
test('solar-term end is exclusive at midnight and intraday transitions remain visible',()=>{
 const p={start:'2026-09-12',end:'2026-09-12'}
 assert.equal(systems.overlapsSegment({segment_start:'2026-08-01T00:00:00+09:00',segment_end_exclusive:'2026-09-12T00:00:00+09:00'},p),false)
 assert.equal(systems.overlapsSegment({segment_start:'2026-08-01T00:00:00+09:00',segment_end_exclusive:'2026-09-12T12:00:00+09:00'},p),true)
})
test('Thai routes and numeric Lagna use the existing product validator, never eligibility labels alone',()=>{
 const f=fixture();f.calculation.thai.suriyayat={available:true,lagna:{available:true,display:'UNSAFE_LAGNA'},ai_safe_packet_product:{eligible_for_gemini:true,research_only:false,routes:[{route_key:'UNSAFE_ROUTE'}]}}
 const v=systems.buildSystemReading(f.calculation)
 assert.equal(v.suriyayat.lagna.available,false)
 assert.equal(v.suriyayat.ai_safe_descriptive_packet,undefined)
})

test('V2 portrait copy respects explicit subject and natural skin texture in both languages',()=>{
 const model=dating.buildDatingArchetypeV2(archetypeFixtures[0].natal,archetypeContext)
 for(const [gender,ko,en] of [['male','성인 남성','adult man'],['female','성인 여성','adult woman'],['neutral','성인 인물','adult person']]){
  const kr=dating.datingPortraitPromptV2(model,{...visualSettings,gender},'ko')
  const english=dating.datingPortraitPromptV2(model,{...visualSettings,gender},'en')
  assert.ok(kr.includes(ko));assert.ok(english.includes(en))
  assert.match(kr,/좌우 비대칭/);assert.match(english,/Natural skin texture/)
  assert.doesNotMatch(kr+english,/정유미|공유|Jung Yu|Gong Yoo/)
 }
})
test('Thai overview translates placement labels without adding planetary predictions',()=>{
 assert.equal(systems.thaiPlanetLabel('Saturn(토성)'),'토성')
 assert.equal(systems.thaiPlanetLabel('Jupiter'),'목성')
 const text=systems.thaiLifeSummary(['boriwan','montri','kalakini'])
 assert.match(text,/도움/);assert.match(text,/막히는 조건/)
 assert.doesNotMatch(text,/Taksajorn|Boriwan|Saturn|확률|반드시/)
})

test('dating default follows the calculation profile, not a fixed male subject',()=>{
 assert.equal(dating.defaultDatingPartnerGender('female'),'male')
 assert.equal(dating.defaultDatingPartnerGender('male'),'female')
 for(const missing of [undefined,null,'unknown',''])assert.equal(dating.defaultDatingPartnerGender(missing),'neutral')
 const options={...visualSettings,gender:dating.defaultDatingPartnerGender('male')}
 const model=dating.buildDatingArchetypeV2(archetypeFixtures[0].natal,archetypeContext)
 assert.match(dating.datingPortraitPromptV2(model,options,'ko'),/성인 여성/)
 assert.match(dating.datingPortraitPromptV2(model,options,'en'),/adult woman/)
})

for(const period of ['today','week','month','year'])test(`${period}: single/couple context preserves evidence and neutral contact does not presume replies`,async()=>{
 const f=fixture(period),before=JSON.stringify(f.calculation)
 const v=summary.buildFortuneUserSummary(f.data,{...f.context,focusTopics:['연애','연락'],topicEntries:Object.entries(f.data.topic_analysis).filter(([t])=>['연애','연락'].includes(t))})
 const contact=v.focusTopics.find(t=>t.topic==='연락')
 assert.ok(contact)
 assert.match(contact.conclusion,/외부 연락 반응 신호/)
 assert.match(contact.conclusion,/특정 상대의 연락 여부를 판단하지 않아/)
 assert.match(contact.conclusion,/내 연락 실행 적합도/)
 assert.match(contact.conclusion,/상대의 답장 의향은 아니야/)
 assert.doesNotMatch(JSON.stringify([...v.favorableCards,...v.cautionCards]),/답장을 재촉/)
 const {applyLoveContext,lovePromptContext}=await server.ssrLoadModule('/src/lib/loveReadingContext.ts')
 for(const status of ['single','flirting','intimate_uncommitted','couple']){
  const lens=applyLoveContext(v,f.calculation,status)
  assert.ok(lens.focusTopics.every(t=>['연애','연락'].includes(t.topic)))
  if(status==='flirting'){assert.match(lens.summary,/썸|연인으로 합의/);assert.doesNotMatch(lens.focusTopics[0].action,/소개를 부탁/)}
  if(status==='intimate_uncommitted'){assert.match(lens.summary,/신체적 친밀감/);assert.match(lens.focusTopics[0].action,/원하는 관계/);assert.doesNotMatch(lens.summary,/커플의 현재/)}
  if(status==='single'){assert.match(lens.focusTopics.find(t=>t.topic==='연애').action,/소개팅 제의/);assert.doesNotMatch(lens.summary,/현재 연인과|답장을 재촉/)}
  for(const t of lens.focusTopics)assert.equal(t.reason,v.focusTopics.find(x=>x.topic===t.topic).reason)
  assert.match(lovePromptContext(status),status==='single'?/현재 연인이 있다고 전제하지 말고/:status==='flirting'?/썸·알아가는/:status==='intimate_uncommitted'?/신체적 친밀감/:/현재 연인/)
  const text=compact.buildExternalCompactPrompt(f.calculation,f.data,false,['연애','연락'],lovePromptContext(status))
  assert.ok(text.length<=7500);assert.match(text,new RegExp('LOVE_STATUS='+status))
 }
 assert.equal(JSON.stringify(f.calculation),before)
})
test('field hub exposes all ten choices without opening a disclosure',async()=>{
 const Hub=(await server.ssrLoadModule('/src/FortuneFieldHub.tsx')).FortuneFieldHub
 const html=renderToStaticMarkup(h(Hub,{onSelect:()=>{}}))
 assert.doesNotMatch(html,/<details|<summary/)
 for(const f of fields)assert.ok(html.includes(f.label))
 assert.match(html,/오늘·주간·월간·연간/)
})

for(const period of ['today','week','month','year'])test(`${period}: single contexts coexist, preserve timing and gate past evidence`,async()=>{
 const f=fixture(period), mod=await server.ssrLoadModule('/src/lib/loveReadingContext.ts')
 const base=summary.buildFortuneUserSummary(f.data,{...f.context,focusTopics:['연애','연락','재회']})
 const before=JSON.stringify(f.calculation)
 const lens=mod.applyLoveContext(base,f.calculation,'single')
 assert.deepEqual(lens.importantWindows,base.importantWindows)
 assert.deepEqual(lens.focusTopics.map(t=>[t.topic,t.reason,t.timing]),base.focusTopics.filter(t=>['연애','연락','재회'].includes(t.topic)).map(t=>[t.topic,t.reason,t.timing]))
 assert.equal(mod.singleLoveScenarios(f.calculation).length,4)
 assert.match(mod.lovePromptContext('single'),/동시에|여러 상황/)
 for(const c of [...lens.favorableCards,...lens.cautionCards])assert.ok(c.meaning.length<50)
 assert.equal(JSON.stringify(f.calculation),before)
 const missing=structuredClone(f.calculation);missing.western.relationship_signals={}
 assert.match(mod.singleLoveScenarios(missing)[3].text,/정보가 부족/)
 assert.equal(mod.applyLoveContext({...base,relationship:{...base.relationship,reconnection:'stale'}},missing,'single').relationship.reconnection,undefined)
 const actual=structuredClone(f.calculation);actual.western.relationship_signals={'과거인연접점':{average:64,band:'보통 이상'}}
 const withPast={...base,relationship:{...base.relationship,reconnection:'실제 근거',reconnectionTiming:'2026-09-12'}}
 assert.equal(mod.applyLoveContext(withPast,actual,'single').relationship.reconnection,'실제 근거')
 assert.equal(mod.applyLoveContext(withPast,actual,'single').relationship.reconnectionTiming,'2026-09-12')
})
test('period home and independent field navigation are separate',async()=>{
 const Home=(await server.ssrLoadModule('/src/HomeControls.tsx')).HomeControls
 const props={birthProfile:{},hasProfile:false,queryDate:'2026-09-12',period:'today',selectedTool:null,apiStatus:'ready',apiLabel:'',fieldHub:h('div',null,'FIELD_ONLY'),onOpenProfile(){},onQueryDateChange(){},onPeriodSelect(){},onToolSelect(){}}
 const home=renderToStaticMarkup(h(Home,{...props,workspace:'period'}))
 assert.doesNotMatch(home,/FIELD_ONLY/)
 for(const label of ['전체 기간운세','분야별 운세','사주','태국점성술'])assert.ok(home.includes(label))
 const field=renderToStaticMarkup(h(Home,{...props,workspace:'field'}))
 assert.match(field,/FIELD_ONLY/);assert.match(field,/전체 기간운세로 돌아가기/)
 assert.doesNotMatch(field,/독립 운세 선택/)
})

test('relationship heroes use the selected Saju lens and retain all three Western scores',()=>{
 const f=fixture('today'), field=fields.find(item=>item.id==='love')
 for(const [name,average,band] of [['연애',53,'보통'],['연락',29,'매우 약함'],['재회',46,'다소 약함']]){
   f.calculation.western.overall[name]={average,band,spread:0,best_days:[],caution_days:[]}
 }
 const render=initialSystem=>renderToStaticMarkup(h(Views,{calculation:f.calculation,field,initialSystem}))
 const saju=render('saju'), western=render('western')
 assert.match(saju,/사주 계산 근거/)
 assert.match(saju,/이 기간에 저장된 체계별 Gemini 원고가 없어/)
 for(const [topic,value] of [['연애',53],['연락',29],['재회',46]]) assert.ok(western.includes('<strong>'+topic+'</strong><b>'+value+'</b>'))
 assert.doesNotMatch(western,/<strong>투자|<strong>수익/)
})

test('Saju displays the source month and its exact transition only when the period overlaps',()=>{
 const {calculation}=fixture('today'), field=fields.find(row=>row.id==='love')
 const markup=()=>renderToStaticMarkup(h(Views,{calculation,initialSystem:'saju',field}))
 assert.match(markup(),/正印\(정인\)/)
 assert.doesNotMatch(markup(),/正財\(정재\)|마음을 받아들이는 방식/)
 calculation.period={start:'2026-10-01',end:'2026-10-31',day_count:31,month_segments:2}
 assert.match(markup(),/正財\(정재\)/)
 assert.ok(markup().includes('2026-10-08T12:00:00+09:00'))
})

test('Thai love shows only the relevant Bhumi placements without locally authored advice',()=>{
 const {calculation}=fixture(), field=fields.find(row=>row.id==='love')
 const html=renderToStaticMarkup(h(Views,{calculation,initialSystem:'thai',field}))
 assert.deepEqual(new Set([...html.matchAll(/data-bhumi="([^"]+)"/g)].map(match=>match[1])),new Set(systems.THAI_LIFE_KEYS['애정']))
 for(const key of systems.THAI_LIFE_KEYS['애정']){
  assert.ok(html.includes(systems.BHUMI_LENSES[key].title))
  assert.ok(!html.includes(systems.thaiLensForTopic(key,'애정').action))
 }
 assert.match(html,/금성/)
})

test('Saju keeps supported topics selectable without a matching monthly lens',()=>{
 const {calculation}=fixture('today')
 const render=field=>renderToStaticMarkup(h(Views,{calculation,initialSystem:'saju',field}))
 const tabs=render().match(/aria-label="생활 분야 선택"[^>]*>([\s\S]*?)<\/div>/)[1]
 assert.match(tabs,/<button(?![^>]*disabled)[^>]*>금전<\/button>/)
 assert.match(tabs,/<button[^>]*disabled[^>]*>컨디션<\/button>/)
 const noMoney=render(fields.find(row=>row.id==='money'))
 assert.match(noMoney,/사주 계산 근거/)
 assert.match(noMoney,/저장된 체계별 Gemini 원고가 없어/)
 assert.doesNotMatch(noMoney,/正財|正印|正官/)
})

test('Saju daily love explains the selected day and separates monthly context',()=>{
 const {calculation}=fixture('today'), field=fields.find(row=>row.id==='love')
 calculation.saju.daily=[{date:calculation.period.start,ganzhi:'庚申',stem_ten_god:'食神(식신)',branch_links:[]},{date:'2000-01-01',ganzhi:'丙午',stem_ten_god:'正財(정재)',branch_links:[]}]
 const html=renderToStaticMarkup(h(Views,{calculation,initialSystem:'saju',field}))
 assert.match(html,/날짜별 일진/)
 assert.match(html,/2026-09-12 · [^<]*식신/)
 assert.match(html,/정인/)
 assert.doesNotMatch(html,/2000-01-01|正財|호감과 의사를 표현하는 방식/)

})

test('Saju samples the selected week and month and skips days without topic evidence',()=>{
 const day=(date,god)=>({date,ganzhi:'甲子',stem_ten_god:god,branch_links:[]})
 for(const [count,end] of [[7,'2026-11-07'],[30,'2026-11-30']]){
  const period={start:'2026-11-01',end,day_count:count}
  const data=[day('2026-10-31','正財(정재)'),day('2026-11-01','正財(정재)'),day('2026-11-04','正官(정관)'),day(end,'偏財(편재)')]
  const rows=systems.sajuDayExamples(data,'금전',period)
  assert.deepEqual(rows.map(row=>row.date),['2026-11-01',end])
  assert.ok(rows.every(row=>row.lens.key==='재성'))
 }
})

test('Thai reads only the active field planet inside the selected annual segment',()=>{
 const {calculation}=fixture('week'), field=fields.find(row=>row.id==='love')
 const sample=(date,sign)=>({date,positions:{venus:{sign_ko:sign},mars:{sign_ko:'처녀자리'}}})
 calculation.thai.suriyayat_daily=[sample('2026-09-11','사자자리'),sample('2026-09-12','황소자리'),sample('2026-09-14','쌍둥이자리'),sample('2026-09-15','전갈자리')]
 const html=renderToStaticMarkup(h(Views,{calculation,initialSystem:'thai',field}))
 assert.match(html,/2026-09-12 · 금성 · 황소자리/)
 assert.match(html,/2026-09-14 · 금성 · 쌍둥이자리/)
 assert.doesNotMatch(html,/사자자리|전갈자리|처녀자리/)
 delete calculation.thai.taksajorn
 const natal=renderToStaticMarkup(h(Views,{calculation,initialSystem:'thai',field}))
 assert.doesNotMatch(natal,/선택한 구간의 날짜별 행성 위치|쌍둥이자리|황소자리/)

})


test('a solar boundary between two distinct ten-gods in the same family is still visible',()=>{
 const row=(stem_ten_god,segment_start)=>({layer:'월운',stem_ten_god,segment_start})
 const text=systems.sajuRelationshipSummary([row('偏印(편인)','2026-11-01'),row('正印(정인)','2026-11-07')])
 assert.match(text,/11월 7일.*편인에서 정인 월운으로.*인성.*이어져/)
})

test('standalone love prompts retain all six contexts even when large input is trimmed',()=>{
 for(const system of ['western','saju','thai']){
   const {calculation}=fixture('today')
   const markup=renderToStaticMarkup(h(Views,{calculation,initialSystem:system,field:fields.find(row=>row.id==='love')}))
   assert.match(markup,/선택 체계 심층 프롬프트 복사/)
   const packet={system,observations:Array.from({length:16},()=> '기'.repeat(1800))}
   const data=systems.compactSystemPrompt(packet,'애정').split('CALCULATED_DATA=')[1]
   const parsed=JSON.parse(data)
   assert.ok(parsed.observations.length < 16)
   for(const label of ['솔로','짝사랑','썸','애매한 관계','연애 중','재회']) assert.ok(parsed.relationship_contexts.includes(label),label)
   assert.equal(parsed.love_status,undefined)
   assert.equal(JSON.parse(systems.compactSystemPrompt(packet,'금전').split('CALCULATED_DATA=')[1]).relationship_contexts,undefined)
 }
})


test('integrated overview renders day-only Saju evidence and no bare zero without evidence',()=>{
 const {calculation}=fixture()
 calculation.saju.monthly=[]
 calculation.saju.annual=[]
 const view=initialSystem=>renderToStaticMarkup(h(Views,{calculation,initialSystem},h('p',{},'저장된 통합 원고')))
 assert.match(view('integrated'),/저장된 통합 원고/)
 assert.doesNotMatch(view('integrated'),/>0<|일진의 주제/)
 assert.doesNotMatch(view('saju'),/날짜별 일진/)
 calculation.saju.daily=[{date:calculation.period.start,ganzhi:'己丑',stem_ten_god:'正印(정인)',branch_links:[]}]
 assert.match(view('saju'),/날짜별 일진/)
 assert.match(view('saju'),/正印\(정인\)/)
 assert.doesNotMatch(view('integrated'),/正印|일진의 주제/)
})
