import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { fortuneFixture, topics, aspects, timing, stat } from './readingExperience.fixtures.mjs'
let server, compact, formatters, Copy
before(async()=>{
  server=await createServer({root:fileURLToPath(new URL('../..',import.meta.url)),optimizeDeps:{noDiscovery:true},server:{middlewareMode:true},appType:'custom'})
  compact=await server.ssrLoadModule('/src/lib/compactDeepPrompt.ts')
  formatters=await server.ssrLoadModule('/src/lib/resultFormatters.ts')
  Copy=(await server.ssrLoadModule('/src/ExternalPromptCopy.tsx')).ExternalPromptCopy
})
after(async()=>server?.close())
const parse=text=>JSON.parse(text.split('\nCALCULATED_DATA=')[1])
function precision(provisional=false) {
  const allowed=!provisional
  return {contract_version:'integrated-precision-v2',status:provisional?'provisional':'exact',time_available:true,time_exact:allowed,time_source:provisional?'family_memory':'official_record',time_confidence:provisional?'medium':'exact',scoring_mode:provisional?'planet_only_provisional':'full_exact',...Object.fromEntries(['allow_natal_moon_scoring','allow_angles_houses_scoring','allow_house_ruler_bonus','allow_intraday_timing','allow_saju_ai','allow_thai_ai'].map(k=>[k,allowed])),layer_policy:Object.fromEntries(['natal_moon','angles_houses','house_ruler_bonus','intraday_timing','saju_ai','thai_ai'].map(k=>[k,allowed?'allow':'exclude']))}
}
function richFortune(kind) {
  const f=fortuneFixture(kind), c=f.calculation
  c.precision=precision()
  c.western.relationship_signals.과거인연접점=stat(63)
  const days={today:1,week:7,month:30,year:365}[kind]
  c.period={start:'2026-01-01',end:new Date(Date.UTC(2026,0,days)).toISOString().slice(0,10),day_count:days,month_segments:kind==='year'?12:1}
  c.western.daily_scores=Array.from({length:days},(_,i)=>({date:new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10),scores:Object.fromEntries(topics.map((t,j)=>[t,30+(i+j)%45])),evidence:topics.flatMap(topic=>[
    {source_topics:[topic],transit:'Mercury',target:'Jupiter',aspect:'trine',contribution:3,text:'수성과 목성의 조화는 표현과 생각의 확장에 관련된다.'},
    {source_topics:[topic],transit:'Mars',target:'Saturn',aspect:'square',contribution:-2,text:'화성과 토성 사이의 긴장 배치.'},
    {source_topics:[topic],transit:'Venus',target:'Sun',aspect:'sextile',contribution:2,text:'동일 주제 보조 근거'},
  ])}))
  for(const [topic,s] of Object.entries(c.western.overall)) {s.best_days=[{date:c.period.start,score:s.average+2}];s.caution_days=[{date:c.period.end,score:s.average-2}]; if(topic==='연락')s.average=25}
  c.western.detail_days=c.western.daily_scores.map(d=>({date:d.date,topics:Object.fromEntries(topics.map(topic=>[topic,{best_window:{start:'07:00',end:'08:30',score:66},caution_window:{start:'21:00',end:'22:00',score:30}}]))}))
  c.western.months=Array.from({length:kind==='year'?12:1},(_,i)=>({calendar_month:`2026-${String(i+1).padStart(2,'0')}`,start:new Date(Date.UTC(2026,i,1)).toISOString().slice(0,10),end:new Date(Date.UTC(2026,i+1,0)).toISOString().slice(0,10),topics:Object.fromEntries(topics.map(t=>[t,stat(35+i*3,12)]))}))
  return f
}
for(const [kind,outline] of [['today','오늘 한눈에'],['week','초반 → 중반 → 후반'],['month','이번 달 큰 흐름'],['year','주요 phase']]) test(`Compact ${kind}: rich input fits, instructions and actual evidence survive`,()=>{
  const f=richFortune(kind), before=JSON.stringify(f)
  const text=compact.buildExternalCompactPrompt(f.calculation,f.data), p=parse(text)
  assert.ok(text.length<=7500,text.length)
  assert.equal(JSON.stringify(f),before)
  assert.match(text,new RegExp(outline));assert.match(text,/사건 확률이 아니라/)
  for(const rule of ['결합/충돌','현실 발현','과해석','수신(상대→나)','발신(나→상대)','독립된 체계','가격 방향'])assert.ok(text.includes(rule))
  assert.ok(p.topics.length<=4 && p.topics.length>=3)
  assert.ok(p.topics.some(t=>t.evidence.some(e=>e.transit==='Mercury'&&e.target==='Jupiter')))
  assert.ok(p.topics.every(t=>t.evidence.length<=2))
  assert.equal(p.relationship_signals.incoming.average,30);assert.equal(p.relationship_signals.outgoing.average,70);assert.equal(p.relationship_signals.reconnection.average,63)
  assert.ok(p.windows.length<=4);assert.ok(p.key_dates.length<=4)
  assert.ok(!('daily_scores' in p));assert.ok(!('months' in p));assert.ok(!('evidence_ledger' in p))
  if(kind==='today'){assert.equal(p.phase_digest,undefined);assert.ok(p.topics.every(t=>!('spread' in t)))}
  else if(kind==='year')assert.ok(p.phase_digest.every(t=>t.observed_months===12 && t.strongest.start!==t.weakest.start))
  else assert.ok(p.phase_digest.every(t=>t.phases.length===3 && t.phases.every(x=>x.observed_days>0)))
  console.log(`SAMPLE ${kind}: ${text.length} chars / ${Math.ceil(Buffer.byteLength(text)/2.6)} estimated tokens`)
})
function relationshipFixture() {
  const dimension={incoming:stat(30,12),outgoing:stat(70,12),reconnection:stat(60,12),top_evidence:[{date:'2026-09-14',score:60,user_evidence:[aspects[1]],counterpart_evidence:[aspects[2]]}],months:Array(12).fill(timing)}
  return {relationship_status:'unmarried',period:timing.period,result:{natal_synastry:{partner_time_exact:false,aspects:[...aspects,...aspects,...aspects]},reunion_dimensions:{contact_recontact:dimension,emotional_reactivation:dimension,relationship_rebuilding:dimension},reunion_transits:{available:true,top_days:Array.from({length:30},(_,i)=>({date:`2026-09-${String(i+1).padStart(2,'0')}`,score:65,user_score:70,counterpart_score:60,hits:[{person:'user',transit:'Venus',target:'Mars',aspect:'trine',tone:'supportive'}]})),top_months:[]},months:[],limitations:['출생시간 미확인']}}
}
for(const mode of ['compatibility','reunion','marriage','marriage_married']) test(`Compact ${mode}: separate axes, safe aspects and mode structure`,()=>{
  const kind=mode==='marriage_married'?'marriage':mode, c=relationshipFixture(), request={analysis_mode:mode,relationship_status:mode==='marriage_married'?'married':'unmarried'}
  const text=formatters.relationshipPromptText(kind,request,c,timing,'compact'),p=parse(text)
  assert.ok(text.length<=7500,text.length)
  assert.ok(p.patterns.length<=10)
  assert.ok(p.patterns.findIndex(a=>a.a==='Venus')<p.patterns.findIndex(a=>a.a==='Neptune'))
  for(const role of ['communication','attraction','stability','power'])assert.ok(p.patterns.some(a=>a.role===role))
  assert.match(text,/생시.*미검증/)
  if(mode==='reunion'){
    assert.equal(p.reunion_directional_context.incoming.average,30);assert.equal(p.reunion_directional_context.outgoing.average,70)
    for(const key of ['contact_recontact','emotional_reactivation','relationship_rebuilding']) {assert.equal(p.reunion_dimensions[key].incoming.average,30);assert.equal(p.reunion_dimensions[key].outgoing.average,70);assert.ok(!p.reunion_dimensions[key].months)}
    assert.match(text,/재접촉 vs 관계 회복/)
  }else assert.equal(p.reunion_dimensions,undefined)
  if(mode==='marriage_married')assert.match(text,/현재 부부 흐름/)
  console.log(`SAMPLE ${mode}: ${text.length} chars / ${Math.ceil(Buffer.byteLength(text)/2.6)} estimated tokens`)
})
test('Full V2 remains default builder behavior; explicit compact precision preserves same scores',()=>{
  const f=richFortune('week'),request={period_kind:'week'}
  const full=formatters.integratedPromptText(request,f.calculation)
  assert.equal(full,formatters.integratedPromptText(request,f.calculation,'full'))
  assert.ok(full.includes(JSON.stringify(f.calculation,null,2)))
  const text=formatters.precisionPromptText(request,f.calculation,'compact')
  assert.match(text,/새 점수 생성 금지/);assert.ok(text.length<=7500)
  parse(text).topics.forEach(t=>assert.equal(t.average,f.calculation.western.overall[t.topic].average))
})
test('copy control exposes compact primary and collapsed full; no provider invoked by render',()=>{
  const html=renderToStaticMarkup(createElement(Copy,{onCopy:()=>{throw Error('not during render')}}))
  assert.match(html,/AI 심층해설 프롬프트 복사/);assert.match(html,/<details><summary>전체 근거 프롬프트/)
  assert.match(html,/전체 근거 프롬프트 복사/)
  assert.match(compact.promptCopyNotice('가나다'),/3자.*tokens/)
})
test('provisional copy cannot reintroduce excluded systems, natal Moon, houses or intraday',()=>{
  const f=richFortune('week');f.calculation.precision=precision(true)
  f.calculation.saju={ok:true,annual:[{segment_start:'2026-01-01',segment_end_exclusive:'2027-01-01',ganzhi:'unsafe-saju'}]}
  f.calculation.thai={ok:true,taksajorn:{segments:[{start:'2026-01-01',end:'2027-01-01',annual_boriwan:{label:'unsafe-thai'}}]}}
  f.calculation.western.daily_scores[0].evidence.push({source_topics:['연락'],target:'Moon',transit:'Mercury',aspect:'trine',contribution:9})
  const text=compact.buildExternalCompactPrompt(f.calculation,f.data),p=parse(text)
  assert.equal(p.saju,undefined);assert.equal(p.thai,undefined);assert.deepEqual(p.windows,[])
  assert.ok(p.topics.every(t=>t.evidence.every(e=>e.target!=='Moon')))
  assert.doesNotMatch(text,/unsafe-saju|unsafe-thai|07:00/)
  delete f.calculation.precision
  assert.throws(()=>compact.buildExternalCompactPrompt(f.calculation),/검증 정보/)
})
test('dedup preserves supportive and contradictory evidence; investment caution is never favorable',()=>{
  const f=richFortune('month');f.calculation.western.overall.투자주의.average=99
  const p=parse(compact.buildExternalCompactPrompt(f.calculation,f.data))
  assert.ok(!p.favorable.some(t=>t.topic==='투자주의'));assert.ok(p.caution.some(t=>t.topic==='투자주의'))
  assert.ok(p.topics.every(t=>t.evidence.some(e=>e.contribution>0)&&t.evidence.some(e=>e.contribution<0)))
})
test('oversized optional text is omitted whole, not sliced; compact output stays parseable',()=>{
  const f=richFortune('year')
  for(const d of f.calculation.western.daily_scores)for(const e of d.evidence)e.text='아주 긴 중복 설명'.repeat(1000)
  const text=compact.buildExternalCompactPrompt(f.calculation,f.data)
  assert.ok(text.length<=7500);assert.ok(parse(text).topics.length>=3)
  assert.doesNotMatch(text,/아주 긴 중복 설명/)
})
