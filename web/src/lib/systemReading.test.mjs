import assert from 'node:assert/strict'
import test,{before,after} from 'node:test'
import {createServer} from 'vite'
import {createElement as h} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {fileURLToPath} from 'node:url'
import {fortuneFixture} from './readingExperience.fixtures.mjs'
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
 for(const system of ['saju','thai']){const html=renderToStaticMarkup(h(Views,{calculation:f.calculation,initialSystem:system}));assert.match(html,/제외/);assert.doesNotMatch(html,/甲子|乙未|Boriwan|금성/)}
})
test('Thai birthday segments remain separate; Saju solar-term segments are not calendar-merged',()=>{
 const f=fixture('year'),v=systems.buildSystemReading(f.calculation)
 assert.equal(v.wheels.length,2);assert.notEqual(v.wheels[0].annual_boriwan.label,v.wheels[1].annual_boriwan.label)
 assert.equal(v.monthly.length,2);assert.notEqual(v.monthly[0].segment_start,v.monthly[1].segment_start)
 assert.equal(v.state,'서로 다른 층')
 const compactPacket=JSON.parse(compact.buildExternalCompactPrompt(f.calculation,f.data).split('\nCALCULATED_DATA=')[1])
 assert.ok(compactPacket.saju.length);assert.ok(compactPacket.thai.segments.length)
})
test('dating and spouse models remain separate; portrait options never accept names or exact measurements',()=>{
 const f=fixture('today',true),v=dating.buildDatingArchetype(f.calculation)
 assert.equal(v.kind,'dating_partner');assert.equal(v.appearanceSupported,false)
 assert.match(v.precision,/제한/)
 for(const language of ['ko','en'])for(const style of ['real','dream','illustration']){
  const text=dating.datingPortraitPrompt({style,frame:'full',outfit:'date',celebrity:'FORBIDDEN_NAME'},language)
  assert.doesNotMatch(text,/FORBIDDEN_NAME|\d+\s*cm/);assert.ok(text.length>80)
 }
})
test('dating visual crosswalk is explicitly creative and celebrity references never reach either image prompt',()=>{
 const f=fixture('today')
 f.calculation.western.daily_scores[0].evidence.push({source_topics:['연애'],transit:'Venus',target:'Mars',aspect:'trine',contribution:2})
 const v=dating.buildDatingArchetype(f.calculation)
 assert.equal(v.style,'Venus');assert.ok(v.visual);assert.equal(v.appearanceSupported,false)
 assert.match(v.visualPolicy,/오락용 연출/)
 for(const language of ['ko','en'])for(const style of ['Venus','Mars']){
  const text=dating.datingPortraitPrompt({style:'dream',frame:'full',outfit:'date'},language,style)
  assert.doesNotMatch(text,/정유미|공유|Gong Yoo|Jung Yu|\d+\s*cm/)
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
