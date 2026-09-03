import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildDeterministicTopicAnalysis, buildExternalPrompt, buildPromptPacket, promptBudget } from './costGuardV21.ts';
import { TOPICS, REL } from '../fortune-interpret-v6-preview/integratedInterpretationV2.ts';

function packet(){
  const overall={},digest={};
  for(let i=0;i<TOPICS.length;i++){
    const topic=TOPICS[i]; const avg=42+(i%7)*4;
    overall[topic]={average:avg,band:avg>=60?'강함':avg<40?'약함':'보통',spread:12+i,best_days:[{date:'2027-04-11',score:70+i%8}],caution_days:[{date:'2026-11-19',score:28+i%5}]};
    digest[topic]={days:365,mean:avg,min:{date:'2026-11-19',score:28+i%5},max:{date:'2027-04-11',score:70+i%8},volatility:8+i%4,peak_7d:{start:'2027-04-08',end:'2027-04-14',average:68},low_7d:{start:'2026-11-16',end:'2026-11-22',average:33}};
  }
  const relationship_signals={};
  for(const [i,topic] of REL.entries())relationship_signals[topic]={average:45+i*5,band:'보통',spread:17,best_days:[{date:'2027-05-18',score:68+i}],caution_days:[{date:'2027-02-17',score:25+i}]};
  const months=Array.from({length:12},(_,i)=>({calendar_month:`202${i<4?'6':'7'}-${String((i+9-1)%12+1).padStart(2,'0')}`,start:'2026-09-01',end:'2027-09-01',topics:Object.fromEntries(TOPICS.map(t=>[t,{average:overall[t].average+(i%3)-1,band:'보통',spread:10}])),relationship_signals:Object.fromEntries(REL.map(t=>[t,{average:relationship_signals[t].average+(i%3),band:'보통',spread:12}]))}));
  const daily_score_matrix={topic_order:[...TOPICS,...REL],rows:Array.from({length:365},(_,i)=>[`2026-09-${String(i%30+1).padStart(2,'0')}`,...Array(TOPICS.length+REL.length).fill(50+i%20)])};
  const evidence_ledger=[];
  for(const topic of TOPICS){
    evidence_ledger.push({id:`W:overall:${topic}`,system:'western',scope:'period_average',topic,direction:'neutral',score:overall[topic].average,text:`${topic} 기간 평균 ${overall[topic].average}`});
    evidence_ledger.push({id:`W:date:2027-04-11:${topic}:best`,system:'western',scope:'best_day',topic,direction:'supportive',date:'2027-04-11',score:72,text:`${topic} 직접 날짜 근거 ${'x'.repeat(100)}`});
    evidence_ledger.push({id:`W:month:2027-04:${topic}`,system:'western',scope:'month_average',topic,direction:'supportive',start:'2027-04-01',end:'2027-05-01',score:61,text:`${topic} 월 근거 ${'y'.repeat(100)}`});
  }
  for(const topic of REL){
    evidence_ledger.push({id:`W:overall:${topic}`,system:'western',scope:'relationship_average',topic,direction:'neutral',score:relationship_signals[topic].average,text:`${topic} 평균`});
    evidence_ledger.push({id:`W:date:2027-05-18:${topic}:best`,system:'western',scope:'relationship_best_day',topic,direction:'supportive',date:'2027-05-18',score:70,text:`${topic} 직접 날짜 근거`});
  }
  evidence_ledger.push({id:'S:annual:1:2027-01-01',system:'saju',scope:'annual_segment',direction:'context',start:'2027-01-01',end:'2028-01-01',text:'세운 독립 맥락'});
  evidence_ledger.push({id:'T:taksajorn:1:2027-01-01',system:'thai',scope:'taksajorn_context',direction:'context',start:'2027-01-01',end:'2027-12-31',text:'Thai 독립 맥락'});
  return {
    packet_version:'v4',period:{start:'2026-09-03',end:'2027-09-02',day_count:365},period_kind:'annual',integration_policy:{score_merging:false},
    ranking:{strongest:TOPICS.slice(0,6).map(topic=>({topic,average:overall[topic].average})),weakest:TOPICS.slice(-6).map(topic=>({topic,average:overall[topic].average}))},
    western:{engine:'test',overall,relationship_signals,months,daily_score_matrix,daily_pattern_digest:digest,daily_evidence_coverage:{days:365,days_with_evidence:365},detail_days:[],market:{has_open_session:true}},
    key_dates:[{date:'2027-04-11',topics:['직장','이직','시험'],western_refs:['W:date:2027-04-11:직장:best']},{date:'2027-05-18',topics:['연애','연락','재회'],western_refs:['W:date:2027-05-18:수신신호:best']}],
    cross_system_timeline:[{date:'2027-04-11',western_refs:['W:date:2027-04-11:직장:best'],saju_context_refs:['S:annual:1:2027-01-01'],thai_context_refs:['T:taksajorn:1:2027-01-01']}],
    saju:{engine:'test',day_master:'甲',annual:[{segment_start:'2027-01-01',segment_end_exclusive:'2028-01-01',ganzhi:'丁未',stem_ten_god:'正官',branch_links:[],evidence_id:'S:annual:1:2027-01-01'}],monthly:[]},
    thai:{engine:'test',thai_day:'Thursday',taksajorn:{available:true,segments:[{start:'2027-01-01',end:'2027-12-31',annual_boriwan:{label:'Jupiter'},landed_center:false,evidence_id:'T:taksajorn:1:2027-01-01'}]},suriyayat:{available:true,lagna:{available:true,display:'양자리 1°00′00″',interpretation_scope:'descriptive_nonpredictive'}}},
    evidence_ledger,
  };
}

test('V21 prompt packet removes 365-row matrix and keeps evidence-backed summary',()=>{
  const full=packet(); const compact=buildPromptPacket(full);
  assert.equal(compact.western.daily_score_matrix,undefined);
  assert.equal(compact.western.months.length,12);
  assert.ok(compact.evidence_ledger.length>0);
  const fullBytes=Buffer.byteLength(JSON.stringify(full));
  const compactBytes=Buffer.byteLength(JSON.stringify(compact));
  assert.ok(compactBytes < fullBytes*0.55,`expected >45% reduction, full=${fullBytes}, compact=${compactBytes}`);
});

test('V21 deterministic topics cover all 15 without a second Gemini call',()=>{
  const rows=buildDeterministicTopicAnalysis(packet());
  assert.equal(rows.length,TOPICS.length);
  assert.deepEqual(new Set(rows.map(x=>x.topic)),new Set(TOPICS));
  assert.ok(rows.filter(x=>x.importance==='핵심').length<=4);
  for(const row of rows){assert.ok(row.reason.length>=25);assert.ok(row.evidence_refs.length>=1);}
});

test('V21 prompt budget and external prompt work without Gemini',()=>{
  const p=packet(); const budget=promptBudget(p); const external=buildExternalPrompt(p);
  assert.equal(budget.ok,true);
  assert.ok(budget.bytes<budget.max_bytes);
  assert.match(external.text,/CALCULATED_DATA=/);
  assert.match(external.text,/사건 확률/);
});

test('V21 runtime source has one generateContent path, hard cap 2, and no split Promise.all',()=>{
  const src=fs.readFileSync(new URL('./index.ts',import.meta.url),'utf8');
  assert.equal((src.match(/:generateContent/g)||[]).length,1);
  assert.match(src,/MAX_GEMINI_CALLS=2/);
  assert.doesNotMatch(src,/generatePart\(.*topics/);
  assert.doesNotMatch(src,/Promise\.all\(\[\s*generate/);
  assert.match(src,/buildThaiOutputFallback/);
  assert.match(src,/usage_json:usageJson/);
});
