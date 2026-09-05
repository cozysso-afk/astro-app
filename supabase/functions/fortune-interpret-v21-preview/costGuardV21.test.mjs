import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildDeterministicTopicAnalysis, buildExternalPrompt, buildLocalQualityFallbackCore, buildPromptPacket, promptBudget, stabilizeCoreForQuality } from './costGuardV21.ts';
import { TOPICS, REL, validateOutput } from '../fortune-interpret-v6-preview/integratedInterpretationV2.ts';
import { inspectInterpretationQuality } from '../fortune-interpret-v6-preview/qualityV2.ts';

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

test('V21 prompt reserves Saju and Thai evidence even when Western candidates exceed the annual cap',()=>{
  const p=packet();
  const stressTopics=[...TOPICS,...REL];
  for(const topic of stressTopics){
    for(let i=0;i<8;i++)p.evidence_ledger.push({id:`W:daily:stress:${topic}:${i}`,system:'western',scope:'daily_actual',topic,direction:'supportive',date:`2027-01-${String(i+1).padStart(2,'0')}`,score:60+i,text:`${topic} stress western ${i}`});
  }
  p.key_dates=Array.from({length:8},(_,i)=>{
    const date=`2027-01-${String(i+1).padStart(2,'0')}`;
    const ref=`W:date:stress:${date}`;
    p.evidence_ledger.push({id:ref,system:'western',scope:'best_day',direction:'supportive',date,score:70,text:`stress key date ${date}`});
    return {date,topics:['직장'],western_refs:[ref]};
  });
  p.cross_system_timeline=p.key_dates.map(row=>({date:row.date,western_refs:row.western_refs,saju_context_refs:['S:annual:1:2027-01-01'],thai_context_refs:['T:taksajorn:1:2027-01-01']}));
  const compact=buildPromptPacket(p);
  assert.ok(compact.evidence_ledger.length<=110);
  assert.ok(compact.evidence_ledger.some(x=>x.system==='saju'),'Saju context must survive the cap');
  assert.ok(compact.evidence_ledger.some(x=>x.system==='thai'),'Thai context must survive the cap');
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
  assert.match(src,/supabase-ai-v21\.4-e2e-evidence/);
  assert.match(src,/MAX_USER_NEW_JOBS_10M=6/);
  assert.match(src,/MAX_USER_NEW_JOBS_24H=20/);
  assert.match(src,/MAX_GLOBAL_NEW_JOBS_10M=18/);
  assert.match(src,/MAX_GLOBAL_NEW_JOBS_24H=60/);
  assert.match(src,/checkRollingJobBudget/);
  assert.match(src,/rolling_job_guard:true/);
  assert.doesNotMatch(src,/generatePart\(.*topics/);
  assert.doesNotMatch(src,/Promise\.all\(\[\s*generate/);
  assert.match(src,/buildThaiOutputFallback/);
  assert.match(src,/usage_json:usageJson/);
  assert.match(src,/stabilizeCoreForQuality/);
  assert.match(src,/quality_report:r\.quality_report\?\?null/);
  assert.match(src,/if\(!\(await jobActive\(id\)\)\)\{/);
  assert.match(src,/if\(b\?\.action!==\"start\"\)return res/);
  assert.doesNotMatch(src,/calculate\(payload,preferred,key,async\(\)=>true\)/);
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
  assert.equal(rows.find(x=>x.topic==='연애').timing,'2027-04-11');
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


test('V21.3 structurally neutralizes model-generated trade timing actions without Gemini',()=>{
  const p=packet();
  const core={headline:'투자 후처리 테스트',overall:{summary:'상대활성도 요약을 충분한 길이로 설명하는 테스트 문장이다.',dominant_pattern:'패턴',best_phase:'2027-04 수익실현 지표 강세',caution_phase:'주의',evidence_refs:['W:overall:금전']},key_windows:[{label:'봄철 금전 및 실현 지수 피크 구간',start:'2027-04-11',end:'2027-04-11',signal:'활용',topics:['금전','수익실현'],summary:'수익실현 관련 지수가 높아 실리적 결과를 점검하기 좋다.',action:'보유 자산을 현금화해.',avoid:'매도 시점을 늦추지 마.',evidence_refs:['W:date:2027-04-11:수익실현:best']}],year_phases:[],cross_checks:[],decisions:[{action:'자산 수익 정리 및 회수',timing:'2027-04-11',reason:'수익실현 상대지수가 높은 날짜다.',watch:'체결 가격',avoid:'고점 추가 상승을 기대한 과도한 보유 유지',evidence_refs:['W:date:2027-04-11:수익실현:best']}],clusters:{relationship:'',work_study:'',money_news:'',investment:'1~4월 투자에 우호적',condition:''},investment_reading:{psychology:'과열',realization:'수익에 유리',entry:'매수 적기',risk:'보수적'},systems:{western:'w',saju:'s',thai:'t'},priorities:['봄철 자산 실현 및 재정 정비'],limits:'점수는 확률이 아니다'};
  const fixed=stabilizeCoreForQuality(core,p);
  assert.match(fixed.key_windows[0].action,/점성 상대지수는 매매 신호가 아니므로/);
  assert.doesNotMatch(fixed.key_windows[0].action,/현금화해|매도 시점/);
  assert.match(fixed.key_windows[0].summary,/매매 적기를 뜻하지 않아/);
  assert.match(fixed.decisions[0].action,/실제 가격·거래량·밸류에이션/);
  assert.match(fixed.decisions[0].reason,/매매 적기를 뜻하지 않아/);
  assert.match(fixed.decisions[0].watch,/실제 시장 데이터/);
  assert.doesNotMatch(fixed.priorities.join(' '),/자산 실현|매수|매도|현금화/);
  assert.match(fixed.clusters.investment,/매매시점을 뜻하지 않/);
  assert.match(fixed.investment_reading.realization,/실제 수익 가능성이나 매도 적기를 뜻하지/);
  assert.match(fixed.investment_reading.entry,/매수 신호가 아니며/);
});


test('V21.3.2 relationship directions are distinct and grounded without Gemini',()=>{
  const p=packet();
  for(const topic of ['연애','연락','재회']){ p.western.overall[topic].average=88; p.western.overall[topic].spread=52; p.western.daily_pattern_digest[topic].volatility=28; }
  p.western.relationship_signals.수신신호={average:72,band:'강함',spread:30,best_days:[{date:'2027-03-12',score:84}],caution_days:[{date:'2027-01-19',score:31}]};
  p.western.relationship_signals.발신적합={average:48,band:'보통',spread:18,best_days:[{date:'2027-04-07',score:68}],caution_days:[{date:'2027-02-02',score:36}]};
  p.western.relationship_signals.과거인연접점={average:61,band:'강함',spread:25,best_days:[{date:'2027-05-18',score:79}],caution_days:[{date:'2027-03-03',score:34}]};
  for(const [topic,date] of [['수신신호','2027-03-12'],['발신적합','2027-04-07'],['과거인연접점','2027-05-18']]) p.evidence_ledger.push({id:`W:date:${date}:${topic}:depth`,system:'western',scope:'relationship_best_day',topic,direction:'supportive',date,score:78,text:`${topic} 방향별 직접 날짜 근거`});
  const core={headline:'관계 방향 테스트',overall:{summary:'관계 흐름을 충분한 길이로 설명하는 테스트 요약이다.',dominant_pattern:'관계 방향을 서로 구분해 본다.',best_phase:'활용',caution_phase:'주의',evidence_refs:['W:overall:연애']},key_windows:[],year_phases:[],cross_checks:[],decisions:[],clusters:{relationship:'관계 종합',work_study:'',money_news:'',investment:'',condition:''},relationship_reading:{context:'기존 관계 문장',flow:'기존 흐름',focus_timing:'기존 시기',watch:'실제 반응을 확인한다.',avoid:'속마음을 확정하지 않는다.',evidence_refs:[]},contact_flow:{incoming:'같은 문장',outgoing:'같은 문장',reconnection:'같은 문장'},systems:{western:'w',saju:'s',thai:'t'},priorities:[],limits:'점수는 확률이 아니다'};
  const fixed=stabilizeCoreForQuality(core,p);
  assert.match(fixed.relationship_reading.flow,/상대 → 나|나 → 상대|과거 인연 재접점/);
  assert.match(fixed.relationship_reading.focus_timing,/상대 → 나 2027-03-12/);
  assert.match(fixed.relationship_reading.focus_timing,/나 → 상대 2027-04-07/);
  assert.match(fixed.relationship_reading.focus_timing,/과거 인연 재접점 2027-05-18/);
  assert.match(fixed.contact_flow.incoming,/2027-03-12/);
  assert.match(fixed.contact_flow.incoming,/답변·먼저 온 연락/);
  assert.match(fixed.contact_flow.outgoing,/2027-04-07/);
  assert.match(fixed.contact_flow.outgoing,/상대가 받아준다는 뜻은 아니야/);
  assert.match(fixed.contact_flow.reconnection,/2027-05-18/);
  assert.match(fixed.contact_flow.reconnection,/재회나 관계 재성립을 확정하지 않아/);
  assert.notEqual(fixed.contact_flow.incoming,fixed.contact_flow.outgoing);
  assert.notEqual(fixed.contact_flow.outgoing,fixed.contact_flow.reconnection);
  const topics=buildDeterministicTopicAnalysis(p);
  assert.notEqual(topics.find(x=>x.topic==='연애').action,topics.find(x=>x.topic==='연락').action);
  assert.notEqual(topics.find(x=>x.topic==='연락').action,topics.find(x=>x.topic==='재회').action);
});

test('V21.3.3 local fallback keeps paid jobs from becoming zero-content when critical validation can pass',()=>{
  const p=packet();
  const core=buildLocalQualityFallbackCore(p);
  const stabilized=stabilizeCoreForQuality(core,p);
  const validated=validateOutput(stabilized);
  assert.ok(validated,'local fallback must satisfy output schema');
  const report=inspectInterpretationQuality(validated,p);
  for(const stage of [1,2,3,4]){
    const row=report.stages.find(x=>x.stage===stage);
    assert.equal(row?.passed,true,`critical quality stage ${stage} must pass: ${(row?.issues??[]).join(' / ')}`);
  }
  assert.ok(Array.isArray(validated.key_windows));
  assert.ok(Array.isArray(validated.decisions));
  const depth=report.stages.find(x=>x.stage===5);
  assert.ok(depth,'stage 5 must remain observable even when degraded fallback is shown');
  assert.match(validated.limits,/안전 보정본/);
});

test('V21/V11 runtime preserves paid usage and exposes local fallback instead of zero content',()=>{
  const src=fs.readFileSync(new URL('./index.ts',import.meta.url),'utf8');
  assert.match(src,/supabase-ai-v21\.4-e2e-evidence/);
  assert.match(src,/buildLocalQualityFallbackCore/);
  assert.match(src,/allow_degraded_quality:true/);
  assert.match(src,/local_quality_fallback:true/);
  assert.match(src,/criticalQualityPassed/);
  assert.match(src,/usage:\{\.\.\.combined,quality_validation:/);
});


test('V11 E2E prompt keeps complete bounded Saju baseline/months and Thai limitations',()=>{
  const p=packet();
  p.saju.pillars={year:'庚午',month:'戊子',day:'丙寅',hour:'甲午'};
  p.saju.elements={wood:2,fire:3,earth:1,metal:1,water:1};
  p.saju.true_solar={legal_local_time:'1990-01-01T12:00:00',true_solar_time:'1990-01-01T11:56:00',total_correction_minutes:-4};
  p.saju.dayun=Array.from({length:5},(_,i)=>({start_year:1995+i*10,end_year:2004+i*10,start_age:5+i*10,end_age:14+i*10,ganzhi:`D${i}`}));
  p.saju.monthly=Array.from({length:13},(_,i)=>({calendar_month:`2026-${String((i%12)+1).padStart(2,'0')}`,ganzhi:`M${i}`,stem_ten_god:'context',branch_links:[],segment_start:`2026-${String((i%12)+1).padStart(2,'0')}-01`,segment_end_exclusive:`2026-${String((i%12)+1).padStart(2,'0')}-28`,evidence_id:`S:month:${i+1}`}));
  p.saju.pillar_boundary_policy='absolute Jie for year/month; true-solar for day/hour';
  p.saju.yun_policy='bounded test policy';
  p.saju.not_calculated=['unsupported historic timezone inference'];
  p.thai.rule='06:00 traditional day boundary';
  p.thai.not_calculated=['research-only predictive route'];

  const compact=buildPromptPacket(p);
  assert.deepEqual(compact.saju.pillars,p.saju.pillars);
  assert.deepEqual(compact.saju.elements,p.saju.elements);
  assert.equal(compact.saju.dayun.length,5);
  assert.equal(compact.saju.annual.length,p.saju.annual.length);
  assert.equal(compact.saju.monthly.length,p.saju.monthly.length,'Saju months must not be filtered by Western key dates');
  assert.deepEqual(compact.saju.not_calculated,p.saju.not_calculated);
  assert.equal(compact.thai.rule,p.thai.rule);
  assert.deepEqual(compact.thai.not_calculated,p.thai.not_calculated);
  const budget=promptBudget(p);
  assert.equal(budget.ok,true,`expanded V11 evidence must remain inside ${budget.max_bytes} byte budget; got ${budget.bytes}`);
});

test('V11 server interpreter version and browser fortune AI cache contract stay identical',()=>{
  const runtime=fs.readFileSync(new URL('./index.ts',import.meta.url),'utf8');
  const cache=fs.readFileSync(new URL('../../../web/src/lib/readingCache.ts',import.meta.url),'utf8');
  const runtimeVersion=runtime.match(/const VERSION=\"([^\"]+)\";/)?.[1];
  const cacheVersion=cache.match(/FORTUNE_AI_CACHE_CONTRACT = '([^']+)'/)?.[1];
  assert.ok(runtimeVersion);
  assert.equal(cacheVersion,runtimeVersion,'browser cache must break whenever the fortune interpreter contract changes');
});


test('V11.1 exact relationship timing refs survive the final evidence cap',()=>{
  const p=packet();
  for(const topic of ['연애','연락','재회']){
    p.western.overall[topic].average=96;
    p.western.overall[topic].spread=70;
    p.western.daily_pattern_digest[topic].volatility=48;
  }
  const dates={수신신호:'2027-06-12',발신적합:'2027-04-19',과거인연접점:'2027-07-03'};
  for(const [key,date] of Object.entries(dates)){
    p.western.relationship_signals[key]={average:key==='수신신호'?82:key==='발신적합'?71:76,band:'강함',spread:32,best_days:[{date,score:88}],caution_days:[]};
  }
  for(let i=0;i<12;i++){
    p.evidence_ledger.push({id:`W:daily:noise:${i}`,system:'western',scope:'daily_actual',topic:'수신신호',direction:'supportive',date:`2027-03-${String(i+1).padStart(2,'0')}`,score:60+i,text:`관계 잡음 직접 근거 ${i}`});
  }
  for(const [key,date] of Object.entries(dates)){
    p.evidence_ledger.push({id:`W:date:${date}:${key}:v11-1`,system:'western',scope:'relationship_best_day',topic:key,direction:'supportive',date,score:88,text:`${key} ${date} 직접 날짜 근거`});
  }
  const fixed=stabilizeCoreForQuality(buildLocalQualityFallbackCore(p),p);
  const validated=validateOutput(fixed);
  assert.ok(validated);
  const report=inspectInterpretationQuality(validated,p);
  for(const stage of [1,2,3,4]){
    const row=report.stages.find(x=>x.stage===stage);
    assert.equal(row?.passed,true,`critical stage ${stage} failed: ${(row?.issues??[]).join(' / ')}`);
  }
  const refs=new Set(validated.relationship_reading.evidence_refs);
  for(const date of Object.values(dates)){
    assert.match(validated.relationship_reading.focus_timing,new RegExp(date));
    const direct=p.evidence_ledger.find(row=>refs.has(row.id)&&row.date===date);
    assert.ok(direct,`focus_timing date ${date} must keep an exact direct evidence ref inside the final capped list`);
  }
});

test('V11.1 cross-check mode is derived from the final capped evidence refs',()=>{
  const p=packet();
  const date='2027-04-11';
  const westernRefs=[];
  for(let i=0;i<12;i++){
    const id=`W:cross:${i}`;
    westernRefs.push(id);
    p.evidence_ledger.push({id,system:'western',scope:'daily_actual',topic:'직장',direction:'supportive',date,score:60+i,text:`Western 교차 잡음 ${i}`});
  }
  const saju='S:cross:v11-1',thai='T:cross:v11-1';
  p.evidence_ledger.push({id:saju,system:'saju',scope:'annual_segment',direction:'context',start:'2027-01-01',end:'2028-01-01',text:'사주 교차 직접 맥락'});
  p.evidence_ledger.push({id:thai,system:'thai',scope:'taksajorn_context',direction:'context',start:'2027-01-01',end:'2027-12-31',text:'Thai 교차 직접 맥락'});
  p.cross_system_timeline=[{date,western_refs:westernRefs,saju_context_refs:[saju],thai_context_refs:[thai]}];
  const core=buildLocalQualityFallbackCore(p);
  core.cross_checks=[{label:`${date} 체계 교차확인`,start:date,end:date,mode:'복수체계',western:'',saju:'',thai:'',synthesis:'',evidence_refs:westernRefs}];
  const fixed=stabilizeCoreForQuality(core,p);
  const x=fixed.cross_checks[0];
  const systems=new Set(x.evidence_refs.map(ref=>p.evidence_ledger.find(row=>row.id===ref)?.system).filter(Boolean));
  assert.ok(x.evidence_refs.length<=8);
  assert.equal(x.mode,'복수체계');
  assert.ok(systems.has('western'));
  assert.ok(systems.has('saju'));
  assert.ok(systems.has('thai'));
  assert.ok(x.saju.length>0);
  assert.ok(x.thai.length>0);
  const validated=validateOutput(fixed);
  assert.ok(validated);
  const report=inspectInterpretationQuality(validated,p);
  const stage4=report.stages.find(row=>row.stage===4);
  assert.equal(stage4?.passed,true,`stage 4 failed: ${(stage4?.issues??[]).join(' / ')}`);
});
