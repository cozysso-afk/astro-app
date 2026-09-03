import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildDeterministicTopicAnalysis, buildExternalPrompt, buildPromptPacket, promptBudget, stabilizeCoreForQuality } from './costGuardV21.ts';
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
    evidence_ledger.push({id:`W:daily:2027-04-11:${topic}:1`,system:'western',scope:'daily_actual',topic,direction:'supportive',date:'2027-04-11',score:69,text:`${topic} 실제 일별 애스펙트 근거`});
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
  assert.match(src,/stabilizeCoreForQuality/);
  assert.match(src,/quality_report:r\.quality_report\?\?null/);
  assert.match(src,/if\(!\(await jobActive\(id\)\)\)\{/);
  assert.match(src,/update\(\{usage_json:usageJson,updated_at:/);
  const usageBuild=src.indexOf('const usageJson=');
  const inactiveCheck=src.indexOf('if(!(await jobActive(id)))');
  assert.ok(usageBuild>=0 && inactiveCheck>usageBuild,'usage must be built before canceled-job early return');
});

test('fortune UI is wired only to the V21 cost-guarded function and exposes prompt/cancel controls',()=>{
  const app=fs.readFileSync(new URL('../../../web/src/AppNext.tsx',import.meta.url),'utf8');
  assert.match(app,/FORTUNE_AI_FUNCTION = 'fortune-interpret-v21-preview'/);
  assert.doesNotMatch(app,/supabase\.functions\.invoke\('fortune-interpret-v6-preview'/);
  assert.match(app,/action:'prompt'/);
  assert.match(app,/action:'cancel'/);
  assert.match(app,/captureCanceledAiUsage/);
  assert.match(app,/AI용 압축 프롬프트 복사/);
  assert.match(app,/정상 경로 1회/);
});




test('V21.2 deterministic wording uses correct Korean particles and topic-specific extreme dates',()=>{
  const rows=buildDeterministicTopicAnalysis(packet());
  assert.match(rows.find(x=>x.topic==='연애').verdict,/^연애는 /);
  assert.match(rows.find(x=>x.topic==='직장').verdict,/^직장은 /);
  assert.equal(rows.find(x=>x.topic==='연애').timing,'2026-11-19');
});

test('V21.2 local stabilizer softens overclaim and investment prediction language without Gemini',()=>{
  const p=packet();
  const core={headline:'2027년 완벽 해설',overall:{summary:'짧은 총평',dominant_pattern:'패턴',best_phase:'활용',caution_phase:'주의',evidence_refs:['W:overall:직장']},key_windows:[{label:'재회 최적기',start:'2027-04-11',end:'2027-04-11',signal:'활용',topics:['연애'],summary:'대길의 시기이자 가장 완벽한 시기',action:'확인',avoid:'절대 금물이다',evidence_refs:['W:date:2027-04-11:연애:best']}],year_phases:[],cross_checks:[{label:'교차',start:'2027-04-11',end:'2027-04-11',mode:'복수체계',western:'Western 직접 근거가 존재한다.',saju:'사주 독립 맥락이 존재한다.',thai:'Thai 독립 맥락이 존재한다.',synthesis:'삼박자로 맞아떨어져 매우 긍정적인 시너지를 발휘하는 완벽한 합일',evidence_refs:['W:date:2027-04-11:직장:best','S:annual:1:2027-01-01','T:taksajorn:1:2027-01-01']}],decisions:[],clusters:{relationship:'',work_study:'',money_news:'',investment:'',condition:''},relationship_reading:{context:'관계 맥락을 충분히 설명하는 테스트 문장이다.',flow:'관계 흐름을 충분히 설명하고 실제 행동 신호를 확인하는 테스트 문장이다.',focus_timing:'2027-04-11 직접 관계 근거를 본다.',watch:'실제 연락과 약속 제안을 확인한다.',avoid:'속마음이나 관계 결과를 미리 확정하지 않는다.',evidence_refs:['W:date:2027-04-11:연애:best']},contact_flow:{incoming:'상대 반응을 확인한다.',outgoing:'내 행동을 확인한다.',reconnection:'이뤄질 가능성이 높다.'},investment_reading:{psychology:'과열',realization:'수익에 유리',entry:'매수 적기',risk:'절대 보수적 태도를 유지해야 한다'},systems:{western:'w',saju:'s',thai:'t'},priorities:[],limits:'점수는 확률이 아니다'};
  const fixed=stabilizeCoreForQuality(core,p);
  const prose=JSON.stringify(fixed);
  assert.doesNotMatch(prose,/완벽|대길|시너지|삼박자|절대 금물|이뤄질 가능성이 높다/);
  assert.match(fixed.cross_checks[0].synthesis,/합산하지/);
  assert.match(fixed.investment_reading.realization,/실제 수익 가능성이나 매도 적기를 뜻하지/);
  assert.match(fixed.investment_reading.entry,/매수 신호가 아니며/);
});

test('V21 local stabilizer repairs evidence links and minimum prose without Gemini',()=>{
  const p=packet();
  const core={headline:'테스트',overall:{summary:'짧은 총평',dominant_pattern:'패턴',best_phase:'활용',caution_phase:'주의',evidence_refs:['W:overall:직장']},key_windows:[{label:'직장 날짜',start:'2027-04-11',end:'2027-04-11',signal:'활용',topics:['직장'],summary:'짧음',action:'확인',avoid:'주의',evidence_refs:['W:date:2027-04-11:직장:best']}],year_phases:[],cross_checks:[{label:'교차',start:'2027-04-11',end:'2027-04-11',mode:'복수체계',western:'짧음',saju:'',thai:'',synthesis:'짧음',evidence_refs:['W:date:2027-04-11:직장:best']}],decisions:[{action:'직장 확인',timing:'2027-04-11',reason:'짧음',watch:'짧음',avoid:'짧음',evidence_refs:['W:overall:직장']}],clusters:{relationship:'',work_study:'',money_news:'',investment:'',condition:''},relationship_reading:{context:'',flow:'',focus_timing:'',watch:'',avoid:'',evidence_refs:[]},contact_flow:{incoming:'',outgoing:'',reconnection:''},investment_reading:{psychology:'',realization:'',entry:'',risk:''},systems:{western:'w',saju:'s',thai:'t'},priorities:[],limits:'점수는 확률이 아니다'};
  const fixed=stabilizeCoreForQuality(core,p);
  assert.ok(fixed.overall.summary.length>=240);
  assert.ok(fixed.overall.evidence_refs.length>=3);
  assert.ok(fixed.key_windows[0].evidence_refs.some(ref=>ref.startsWith('W:daily:2027-04-11:직장')));
  assert.ok(fixed.key_windows[0].summary.length>=45);
  assert.ok(fixed.decisions[0].evidence_refs.some(ref=>fixed.key_windows[0].evidence_refs.includes(ref)));
  assert.ok(fixed.decisions[0].watch.length>=14);
  assert.ok(fixed.cross_checks[0].evidence_refs.includes('S:annual:1:2027-01-01'));
  assert.ok(fixed.cross_checks[0].evidence_refs.includes('T:taksajorn:1:2027-01-01'));
  assert.ok(fixed.cross_checks[0].synthesis.length>=45);
  assert.ok(fixed.priorities.length>=3);
  assert.equal(fixed.year_phases.length,4);
});
