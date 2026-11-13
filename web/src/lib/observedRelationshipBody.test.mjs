import test, {before,after} from 'node:test'
import assert from 'node:assert/strict'
import {fileURLToPath} from 'node:url'
import {createServer} from 'vite'
import {createElement as h} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {observedRelationshipPassage, observedContactCore} from './contactOutcomeReading.ts'

const record={date:'2020-11-08',event:'received',past_connection:true,channel:'in_person',note:'저녁에 전화가 먼저 와서 직접 만남 (A)'}
const scores={overall:{연애:{average:54,band:'보통'},재회:{average:46.9,band:'다소 약함'}},relationship_signals:{과거인연접점:{average:42,band:'약함'}}}
const periods={today:['2020-11-11','2020-11-11'],week:['2020-11-09','2020-11-15'],month:['2020-11-01','2020-11-30']}
const calc=p=>({western:scores,period:{start:periods[p][0],end:periods[p][1]}})
const love={id:'love',label:'애정',topics:['연애','연락','재회']}
const contact={id:'contact',label:'연락',topics:['연락','소식']}
const authored=(answer)=>({conclusion:answer,real_scene:'약속이 구체적인지 확인해.',action:'다음 일정을 정해.',evidence_refs:['W:synthetic']})
const data={clusters:{relationship:{love_general:authored('호감을 나누는 분위기가 있어.'),contact_activation:authored('전화가 올지 기다려 봐.')}}}
let server,Daily,Panel,Scope,documents,exporters
before(async()=>{
  server=await createServer({root:fileURLToPath(new URL('../..',import.meta.url)),optimizeDeps:{noDiscovery:true},server:{middlewareMode:true},appType:'custom'})
  Daily=(await server.ssrLoadModule('/src/DailyReadingPanel.tsx')).DailyReadingPanel
  Panel=(await server.ssrLoadModule('/src/AuthoredReadingPanel.tsx')).AuthoredReadingPanel
  Scope=(await server.ssrLoadModule('/src/ContactObservationScope.tsx')).ContactObservationScope
  documents=await server.ssrLoadModule('/src/lib/authoredReadingDocument.ts')
  exporters=await server.ssrLoadModule('/src/lib/readingImageExport.ts')
})
after(async()=>{await server?.close()})

function render(period, field, records) {
  const calculation=calc(period)
  const doc=documents.buildPeriodReadingDocument(data,period,calculation.period.start,calculation.period.end,field,true)
  const supplements=[{id:'relationship.love_reunion_interest',text:'예전 인연에게서 소식이 올 기대로 한 주를 잡아 두기엔 흐름이 약해.',evidence:'재회 46.9점'}]
  const reading=period==='today' ? h(Daily,{data,date:calculation.period.start,field,verified:true,calculation}) : h(Panel,{doc,supplements,period})
  return renderToStaticMarkup(h(Scope,{calculation,field,localRecords:records},reading))
}

for (const period of Object.keys(periods)) test(period+' opens reunion body with the dated meeting and a period-specific follow-up',()=>{
  const saved=JSON.stringify([scores,data,record])
  const html=render(period,love,[record])
  if(period==='today'){
    const note=html.split('<aside')[1].split('</aside>')[0]
    assert.ok(note.includes('aria-label="내가 기록한 연락"'))
    assert.ok(note.includes('2020-11-08에는 과거 인연에게서 먼저 전화가 왔고, 두 사람은 직접 만났어요.'))
    assert.ok(html.includes('<h3 class="daily-reading-headline">호감을 나누는 분위기가 있어.</h3>'))
    assert.doesNotMatch(html,/42점|그날 나눈 이야기/)
    assert.equal(JSON.stringify([scores,data,record]),saved)
    return
  }
  const scenario=html.split(/data-(?:daily-slot|reading-section)="relationship.love_reunion_interest"/)[1].split('</details>')[0]
  assert.match(scenario,/2020-11-08에는 과거 인연에게서 먼저 전화가 왔고, 두 사람은 직접 만났어요/)
  assert.match(scenario,{today:/그날 나눈 이야기/,week:/이번 주에는 만난 뒤/,month:/이달에는 만남 직후/}[period])
  assert.match(scenario,period==='today'?/42점/:/46\.9점/)
  assert.doesNotMatch(scenario,/소식이 올 기대|아직 연락이 끊긴/)
  assert.equal(JSON.stringify([scores,data,record]),saved)
  const noRecord=render(period,love,[])
  assert.doesNotMatch(noRecord,/2020-11-08/)
  if(period==='today')assert.equal(html.match(/<summary>재회<\/summary>/g)?.length,1)
})

test('latest unrelated, future, corrected and ambiguous notes do not change the factual starting point',()=>{
  const weekly=render('week',love,[record,{...record,date:'2020-11-10',past_connection:false,note:'다른 사람'},{...record,date:'2020-11-16'}])
  assert.match(weekly,/2020-11-08에는 과거 인연에게서 먼저 전화가 왔고/)
  assert.doesNotMatch(weekly,/2020-11-10에는|2020-11-16에는/)
  const edited=render('week',love,[{...record,channel:'call',note:'직접 만남 취소',met_in_person:false}])
  assert.doesNotMatch(edited,/직접 만났어요|먼저 전화가/)
  assert.match(edited,/연락이 만남으로 이어질까/)
  for(const channel of ['in_person','call']) assert.match(observedRelationshipPassage([{...record,channel} ],calc('week'),'week','love').fact,/먼저 전화가/)
  assert.doesNotMatch(observedRelationshipPassage([{...record,channel:'call',note:''}],calc('week'),'week','love').fact,/먼저/)
})

test('contact presentation and its export carry the same recorded stage while retaining the original report',()=>{
  for(const period of ['today','week','month']){
    const calculation=calc(period)
    const passage=observedRelationshipPassage([record],calculation,period,'contact')
    const original='전화가 올지 기다려 봐.'
    const blocks=observedContactCore(passage,original,[])
    const html=render(period,contact,[record])
    if(period==='today'){
      const doc={state:'ready',headline:original,blocks:[{id:'scene',label:'생활에서 보면',text:'약속이 구체적인지 확인해.'},{id:'action',label:'지금 할 일',text:'다음 일정을 정해.'}],title:'연락',date:record.date}
      const image=exporters.dailyReadingExportModel(doc)
      for(const card of image.sections[0].cards)assert.ok(html.includes(card.body))
      assert.match(html,/<aside[^>]*aria-label="내가 기록한 연락"/)
      assert.ok(html.includes(passage.fact))
      assert.ok(!image.sections[0].cards.some(c=>c.body===passage.fact))
      continue
    }
    const model=exporters.authoredReadingExportModel({state:'ready',headline:passage.fact,core:blocks,exportBlockIds:blocks.map(b=>b.id),title:'연락',date:record.date})
    for(const card of model.sections[0].cards)assert.ok(html.includes(card.body))
    assert.ok(html.indexOf(passage.fact)<html.indexOf(original))
  }
})

test('dated evidence stays inside the selected week, monthly segments require enough observations',()=>{
  const seven=Array.from({length:7},(_,i)=>({date:'2020-11-'+String(i+9).padStart(2,'0'),scores:{연락:30+5*i}}))
  const outside={date:record.date,scores:{연락:99}}
  const weekly={...calc('week'),western:{...scores,daily_scores:[outside,...seven]}}
  const reading=observedRelationshipPassage([record],weekly,'week','love')
  assert.match(reading.followUp,/11월 15일에 60점, 11월 9일에 30점/)
  assert.doesNotMatch(reading.followUp,/99점|11월 8일/)
  const thirty=Array.from({length:30},(_,i)=>({date:'2020-11-'+String(i+1).padStart(2,'0'),scores:{연락:30+10*Math.floor(i/10)}}))
  const monthly={...calc('month'),western:{...scores,daily_scores:thirty}}
  assert.match(observedRelationshipPassage([record],monthly,'month','love').followUp,/초순 30점, 중순 40점, 하순 50점/)
  monthly.western.daily_scores=seven
  assert.doesNotMatch(observedRelationshipPassage([record],monthly,'month','love').followUp,/초순.*점/)
})

test('weekly overview reads only dated contact and reunion facts that were recorded',()=>{
  const field=undefined
  const calculation=calc('week')
  calculation.period.day_count=7
  const original=documents.buildPeriodReadingDocument(data,'week',...periods.week,field,true)
  const names=['question:연락:continuity','question:재회:stage_progression','question:재회:rebuilding_timing']
  const doc={...original,sections:names.map(id=>({id,label:id.split(':')[2],state:'insufficient',blocks:[]}))}
  function overview(records,source=doc){
    return renderToStaticMarkup(h(Scope,{calculation,field,localRecords:records},h(Panel,{doc:source,period:'week'})))
  }
  const beforeWeek=overview([record])
  assert.match(beforeWeek,/이번 주가 시작되기 전인 2020-11-08/)
  assert.match(beforeWeek,/그날 직접 만났어요/)
  assert.match(beforeWeek,/다시 얼굴을 본 단계/)
  assert.doesNotMatch(beforeWeek,/재회가 확정|\(A\)/)
  assert.equal(doc.sections[0].state,'insufficient')
  const latest=overview([{...record,date:'2020-11-11',event:'both',channel:'message',note:'',met_in_person:false}])
  assert.match(latest,/2020-11-11에는 서로 연락을 주고받았어요/)
  assert.doesNotMatch(latest,/직접 만났어요|이번 주가 시작되기 전인/)
  const unrelated=overview([{...record,past_connection:false},{...record,date:'2020-11-16'},{...record,date:'2020-09-01'}])
  assert.doesNotMatch(unrelated,/다시 얼굴을 본 단계|2020-09-01|2020-11-16/)
  const oneWay=overview([{...record,event:'sent',channel:'message',note:'직접 만남 취소',met_in_person:false}])
  assert.match(oneWay,/먼저 안부를 건넨 단계/)
  assert.doesNotMatch(oneWay,/서로 연락을 주고받았어요|다시 얼굴을 본 단계|연락이 다시 닿은 단계/)
  const ready={...doc,sections:[{...doc.sections[1],state:'ready',blocks:[{id:'saved',label:'기존 해설',text:'저장한 원고 그대로'}]}]}
  assert.match(overview([record],ready),/저장한 원고 그대로/)
  assert.doesNotMatch(overview([record],ready),/날짜가 확인된 기록/)
})

test('an explicitly quiet day changes rereading without erasing a previous meeting or attributing silence to an ex',()=>{
  const quiet={...record,date:'2020-11-11',event:'none',past_connection:false,channel:'',note:''}
  for (const period of ['today','week','month']) {
    for (const field of [love,contact]) {
      const empty=render(period,field,[])
      const quietOnly=render(period,field,[quiet])
      const datedFact='2020-11-11에는 연락을 주고받지 않았다고 기록했어요.'
      assert.ok(!empty.includes(datedFact))
      assert.ok(quietOnly.includes(datedFact))
      if(period!=='today') assert.match(quietOnly,/연락이 없었던 날은 어떻게 읽을까/)
      assert.doesNotMatch(quietOnly,/과거 인연과 연락을 주고받지/)
      const both=render(period,field,[quiet,record])
      assert.ok(both.includes(datedFact))
      assert.ok(both.includes('2020-11-08에는 과거 인연에게서 먼저 전화가 왔고, 두 사람은 직접 만났어요.'))
      if(period!=='today') assert.match(both,/만남 뒤, 다음 약속도 함께 잡을까/)
    }
  }
  const clean={...record,channel:'message',note:''}
  for(const past_connection of [true,false]) {
    const partner=past_connection?'과거 인연과':'상대와'
    for (const [event,met_in_person,ending] of [['both',false,'서로 연락을 주고받았어요.'],['received',true,'직접 만났어요.']]) {
      const passage=observedRelationshipPassage([{...clean,past_connection,event,met_in_person}],calc('week'),'week','contact')
      assert.ok(passage.fact.endsWith(partner+' '+ending))
    }
  }
})
