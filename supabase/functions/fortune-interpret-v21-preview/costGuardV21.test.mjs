import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildDeterministicTopicAnalysis, buildExternalPrompt, buildLocalQualityFallbackCore, buildPromptPacket, promptBudget, stabilizeCoreForQuality } from './costGuardV21.ts';
import { TOPICS, REL, validateOutput } from '../fortune-interpret-v6-preview/integratedInterpretationV2.ts';
import { inspectInterpretationQuality } from '../fortune-interpret-v6-preview/qualityV2.ts';
import { normalizeProxiedFortuneResponse, publicCallTrace, publicFortuneError, publicJobUsage, storedFortuneJobError } from '../_shared/fortuneAiPublicError.ts';

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

function singleDayPacket(){
  const p=structuredClone(packet());
  const date='2026-09-12';
  const emphasized=new Set(['연애','연락','직장']);
  p.period={start:date,end:date,day_count:1};
  p.period_kind='day';
  p.ranking={strongest:['연애','연락','직장'].map(topic=>({topic,average:37})),weakest:[]};
  p.western.months=[];
  p.western.detail_days=[];
  p.western.daily_score_matrix={topic_order:[...TOPICS,...REL],rows:[[date,...Array(TOPICS.length+REL.length).fill(37)]]};
  p.western.daily_evidence_coverage={days:1,days_with_evidence:1};
  p.evidence_ledger=[];
  const dateRefs=[];
  for(const topic of TOPICS){
    const average=emphasized.has(topic)?37:50;
    p.western.overall[topic]={average,band:average<40?'약함':'보통',spread:0,best_days:[{date,score:average}],caution_days:[{date,score:average}]};
    p.western.daily_pattern_digest[topic]={days:1,mean:average,min:{date,score:average},max:{date,score:average},volatility:0,peak_7d:{start:date,end:date,average},low_7d:{start:date,end:date,average}};
    p.evidence_ledger.push({id:`W:overall:${topic}`,system:'western',scope:'period_average',topic,direction:'neutral',score:average,text:`${topic} 기간 평균 ${average.toFixed(1)} · 변동폭 0.0`});
    if(emphasized.has(topic)){
      const id=`W:date:${date}:${topic}:best`;
      dateRefs.push(id);
      p.evidence_ledger.push({id,system:'western',scope:'best_day',topic,direction:'supportive',date,score:average,text:`${date} ${topic} 단일일 상대지수 ${average.toFixed(1)}`});
    }
  }
  const direct=[
    {id:`W:daily:${date}:1`,topic:'연애',text:'금성과 화성의 조화 각이 감정 표현 축에 연결됨 · 관련분야 연애'},
    {id:`W:daily:${date}:2`,topic:'연애',text:'달과 금성의 접점이 만남 반응 축에 연결됨 · 관련분야 연애'},
    {id:`W:daily:${date}:3`,topic:'연락',text:'수성의 조화 각이 대화 지속 축에 연결됨 · 관련분야 연락'},
    {id:`W:daily:${date}:4`,topic:'연락',text:'수성과 목성의 접점이 응답 흐름 축에 연결됨 · 관련분야 연락'},
    {id:`W:daily:${date}:5`,topic:'직장',text:'태양과 토성의 접점이 업무 책임 축에 연결됨 · 관련분야 직장'},
    {id:`W:daily:${date}:6`,topic:'직장',text:'수성의 각이 일정 조율 축에 연결됨 · 관련분야 직장'},
  ];
  for(const row of direct)p.evidence_ledger.push({id:row.id,system:'western',scope:'daily_actual_aspect_house',direction:'context',date,text:row.text});
  for(const [index,topic] of REL.entries()){
    const average=41+index*4;
    p.western.relationship_signals[topic]={average,band:'보통',spread:0,best_days:[{date,score:average}],caution_days:[{date,score:average}]};
    p.evidence_ledger.push({id:`W:overall:${topic}`,system:'western',scope:'relationship_average',topic,direction:'neutral',score:average,text:`${topic} 기간 평균 ${average.toFixed(1)}`});
    const id=`W:date:${date}:${topic}:best`;
    p.evidence_ledger.push({id,system:'western',scope:'relationship_best_day',topic,direction:'supportive',date,score:average,text:`${date} ${topic} 방향 계산근거`});
  }
  p.key_dates=[{date,topics:['연애','연락','직장'],western_refs:[...direct.map(row=>row.id),...dateRefs]}];
  p.cross_system_timeline=[];
  return p;
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

test('V21 single-day synthesis uses point-in-time semantics and never emits zero-variation filler',()=>{
  const p=singleDayPacket();
  const direct=buildLocalQualityFallbackCore(p);
  const stabilized=stabilizeCoreForQuality(direct,p);
  const validated=validateOutput(stabilized);
  const forbidden=/기간 평균|변동폭(?:은)?\s*0(?:\.0)?|37(?:\.0)?점에서\s*37(?:\.0)?점 사이|일별 변동성(?:은)?\s*0|(?:상승|하락)\s*추세/;
  assert.equal(Array.isArray(direct.topic_analysis),false,'direct provisional output must use the public topic map shape');
  assert.deepEqual(Object.keys(direct.topic_analysis),[...TOPICS]);
  assert.ok(validated,'single-day result must preserve the complete backend schema');
  assert.equal(Object.keys(validated.topic_analysis).length,TOPICS.length);
  const report=inspectInterpretationQuality(validated,p);
  for(const stage of [1,2,3,4])assert.equal(report.stages.find(row=>row.stage===stage)?.passed,true,`single-day critical quality stage ${stage} must pass`);
  assert.doesNotMatch(JSON.stringify(direct),forbidden);
  assert.doesNotMatch(JSON.stringify(stabilized),forbidden);
  assert.match(direct.headline,/확인하는 날/);
  assert.match(direct.overall.summary,/직접 근거|세부 계산근거/);
  assert.ok(direct.priorities.length>=1,'direct provisional output must retain a practical next check');
  assert.equal(direct.overall.best_phase,'');
  assert.equal(direct.overall.caution_phase,'');
});

test('V21 single-day core topics explain actual evidence without exposing opaque refs',()=>{
  const p=singleDayPacket();
  const rows=buildDeterministicTopicAnalysis(p);
  const love=rows.find(row=>row.topic==='연애');
  const contact=rows.find(row=>row.topic==='연락');
  assert.equal(rows.length,TOPICS.length);
  assert.equal(love.importance,'핵심');
  assert.equal(contact.importance,'핵심');
  assert.ok(love.evidence_refs.some(ref=>ref.startsWith('W:daily:')),'readable evidence must keep its trace ref');
  assert.match(love.reason,/서양점성술/);
  assert.match(love.reason,/금성과 화성의 조화 각|달과 금성의 접점/);
  assert.match(contact.reason,/수성의 조화 각|수성과 목성의 접점/);
  assert.doesNotMatch([love.verdict,love.reason,love.timing,love.action,love.avoid,love.confidence_reason].join(' '),/\b(?:W|S|T):/);
  assert.doesNotMatch(love.reason,/사주|태국점성술/,'visible source labels must come from the linked Western rows');
  assert.notEqual(love.reason,contact.reason,'연애 and 연락 must reflect their distinct evidence and real-world checks');
});

test('V21 single-day reference topics remain present but restrained',()=>{
  const rows=buildDeterministicTopicAnalysis(singleDayPacket());
  const reference=rows.find(row=>row.topic==='컨디션');
  assert.equal(rows.length,TOPICS.length);
  assert.equal(reference.importance,'참고');
  assert.ok(reference.reason.length>=18&&reference.reason.length<160);
  assert.equal(reference.timing,'');
  assert.equal(reference.action,'');
  assert.equal(reference.avoid,'');
  assert.equal(reference.confidence,'낮음');
  assert.match(reference.confidence_reason,/제한된 근거|확신도를 낮게/);
  assert.ok(reference.evidence_refs.length>=1,'reference topic traceability must remain intact');
});

test('V21 multi-day synthesis retains useful period statistics and distinct dates',()=>{
  const p=packet();
  p.evidence_ledger.push({id:'W:date:2026-11-19:연애:caution',system:'western',scope:'caution_day',topic:'연애',direction:'caution',date:'2026-11-19',score:34,text:'2026-11-19 연애 하위 날짜 · 상대지수 34.0'});
  const rows=buildDeterministicTopicAnalysis(p);
  const love=rows.find(row=>row.topic==='연애');
  assert.match(love.reason,/기간 평균/);
  assert.match(love.reason,/변동폭/);
  assert.match(love.reason,/최저점은 2026-11-19 .*점, 최고점은 2027-04-11 .*점/);
  assert.match(love.reason,/변동성/);
  assert.ok(['2026-11-19','2027-04-11'].includes(love.timing),'timing must remain one of the directly backed distinct dates');
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

test('V21 public failures and stored failed jobs never retain raw internal error text',()=>{
  const secret='Authorization: Bearer TEST_SECRET_DO_NOT_EXPOSE';
  const response=publicFortuneError('JOB_CREATE_FAILED',new Error(secret));
  const serialized=JSON.stringify(response);
  assert.equal(response.error_code,'JOB_CREATE_FAILED');
  assert.equal(response.stage,'db_write');
  assert.doesNotMatch(serialized,/TEST_SECRET_DO_NOT_EXPOSE|Authorization/);
  assert.equal(storedFortuneJobError('JOB_GENERATION_FAILED'),'AI 해설 생성에 실패했어.');

  const proxied=normalizeProxiedFortuneResponse({ok:true,status:'failed',error:secret,job_id:'job-test',usage:{total_tokens:21,call_trace:[{error:secret}]}},200,'status');
  assert.equal(proxied.body.error_code,'JOB_GENERATION_FAILED');
  assert.deepEqual(proxied.body.usage,{total_tokens:21});
  assert.doesNotMatch(JSON.stringify(proxied),/TEST_SECRET_DO_NOT_EXPOSE|Authorization/);

  const src=fs.readFileSync(new URL('./index.ts',import.meta.url),'utf8');
  assert.doesNotMatch(src,/const failed=\{[^\n;]*error:r\.error/);
  assert.doesNotMatch(src,/status:"failed",error:e instanceof Error/);
  assert.match(src,/storedFortuneJobError\("JOB_GENERATION_FAILED"\)/);
  assert.match(src,/data\.status==="failed"\?publicFailedUsage\(data\.usage_json\)/);
});

test('V21 stored call trace preserves accounting metadata without internal errors',()=>{
  const secret='Authorization: Bearer TEST_SECRET_DO_NOT_EXPOSE';
  const trace=publicCallTrace([{call:1,model:'gemini-2.5-flash',kind:'http_error',prompt_bytes:123,elapsed_ms:45,http_status:500,usage:{total_tokens:7},error:secret}]);
  assert.equal(trace[0].http_status,500);
  assert.equal(trace[0].usage.total_tokens,7);
  assert.doesNotMatch(JSON.stringify(trace),/TEST_SECRET_DO_NOT_EXPOSE|Authorization/);
  const historical=publicJobUsage({total_tokens:7,call_trace:[{call:1,error:secret}]});
  assert.equal(historical.total_tokens,7);
  assert.doesNotMatch(JSON.stringify(historical),/TEST_SECRET_DO_NOT_EXPOSE|Authorization/);
});

test('V21 public job usage fails closed for non-object and corrupt historical values',()=>{
  const secret='Authorization: Bearer TEST_SECRET_DO_NOT_EXPOSE';
  assert.equal(publicJobUsage(secret),undefined);
  assert.equal(publicJobUsage(['client_secret=TEST_SECRET_DO_NOT_EXPOSE']),undefined);
  assert.equal(publicJobUsage(null),undefined);

  const valid=publicJobUsage({
    prompt_tokens:11,candidate_tokens:7,total_tokens:18,attempt_count:2,
    local_thai_scrub:true,cost_guard_version:'supabase-ai-v21.4-e2e-evidence',
    prompt_budget:{bytes:123,max_bytes:456,estimated_input_tokens:31},
    call_trace:[{call:1,model:'gemini-2.5-flash',kind:'http_error',error:secret}],
    unexpected_secret:secret,
  });
  assert.equal(valid.total_tokens,18);
  assert.equal(valid.local_thai_scrub,true);
  assert.equal(valid.cost_guard_version,'supabase-ai-v21.4-e2e-evidence');
  assert.deepEqual(valid.prompt_budget,{bytes:123,max_bytes:456,estimated_input_tokens:31});
  assert.doesNotMatch(JSON.stringify({ok:true,status:'done',usage:valid}),/TEST_SECRET_DO_NOT_EXPOSE|Authorization|client_secret/);

  const src=fs.readFileSync(new URL('./index.ts',import.meta.url),'utf8');
  assert.match(src,/data\.status==="failed"\?publicFailedUsage\(data\.usage_json\):publicJobUsage\(data\.usage_json\)/);
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

test('quality_validation preserves real UI summary and excludes arbitrary diagnostics',()=>{
  const p=packet();
  const report=inspectInterpretationQuality(validateOutput(stabilizeCoreForQuality(buildLocalQualityFallbackCore(p),p)),p);
  const expected={version:report.version,score:report.score,stages:report.stages.map(({stage,name,passed})=>({stage,name,passed}))};
  const polluted={...report,secret:'TEST_CANARY_7788',stages:report.stages.map(s=>({...s,headers:{authorization:'TEST_CANARY_7788'}}))};
  const usage=publicJobUsage({total_tokens:42,quality_validation:polluted,quality_report:polluted,first_quality_report:polluted});
  assert.deepEqual(usage.quality_validation,expected);
  assert.doesNotMatch(JSON.stringify(usage),/TEST_CANARY_7788|headers|issues|quality_report/);
  const badge=q=>q.score===100||Boolean(q.stages.length)&&q.stages.every(s=>s.passed);
  assert.equal(badge(usage.quality_validation),badge(expected));
  for(const bad of [null,[],{...expected,score:Infinity},{...expected,version:'client_secret=TEST_CANARY_7788'},
    {...expected,stages:[...expected.stages,...expected.stages]},
    {...expected,stages:expected.stages.map((s,i)=>i===0?{...s,name:'TEST_CANARY_7788'}:s)},
    {...expected,stages:expected.stages.map((s,i)=>i===0?{...s,stage:NaN}:s)},
    {...expected,stages:expected.stages.map((s,i)=>i===0?{...s,passed:'true'}:s)}]) {
    assert.equal(publicJobUsage({quality_validation:bad}).quality_validation,undefined);
  }
});

test('job-table migration removes client grants and policy without changing server access',()=>{
  const migrationDir=new URL('../../migrations/',import.meta.url);
  const filenames=fs.readdirSync(migrationDir).filter(n=>/^\d{14}_lock_down_ai_interpret_jobs_client_access\.sql$/.test(n));
  assert.equal(filenames.length,1);
  const sql=fs.readFileSync(new URL(filenames[0],migrationDir),'utf8').replace(/--[^\n]*/g,'');
  assert.match(sql,/REVOKE ALL ON TABLE public\.ai_interpret_jobs FROM anon, authenticated;/i);
  assert.match(sql,/DROP POLICY IF EXISTS ai_interpret_jobs_select_own ON public\.ai_interpret_jobs;/i);
  assert.doesNotMatch(sql,/service_role|DISABLE ROW LEVEL SECURITY|DROP TABLE|DELETE FROM|UPDATE public|CREATE (?:VIEW|FUNCTION)/i);
  const root=new URL('../../../',import.meta.url);
  const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(new URL(d.name+'/',dir)):[new URL(d.name,dir)]);
  const clientFiles=[...walk(new URL('web/src/',root)),...walk(new URL('mobile/',root))]
    .filter(p=>/\.(?:tsx?|jsx?|html)$/.test(p.pathname)&&!p.pathname.includes('.test.'));
  for(const file of clientFiles)assert.doesNotMatch(fs.readFileSync(file,'utf8'),/ai_interpret_jobs/,file.pathname);
  for(const name of ['fortune-interpret-v21-preview','fortune-interpret-v22-preview','relationship-interpret-v9-preview']) {
    const src=fs.readFileSync(new URL(`../${name}/index.ts`,import.meta.url),'utf8');
    assert.match(src,/SERVICE=\(Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/);
    assert.match(src,/createClient\(SUPABASE_URL,SERVICE,\{auth:\{persistSession:false,autoRefreshToken:false\}\}\)/);
    assert.match(src,/\.from\("ai_interpret_jobs"\)/);
    assert.doesNotMatch(src,/createClient\(SUPABASE_URL,SERVICE,\{global:/);
  }
});

for (const [kind, section] of [['day','오늘 한눈에'],['week','초반 → 중반 → 후반'],['month','분야별 핵심 변화'],['annual','주요 phase']]) test(`external V2 ${kind} instruction preserves exact calculated packet and budget`,()=>{
  const p=packet();p.period_kind=kind
  const before=JSON.stringify(p);const budget=promptBudget(p);const result=buildExternalPrompt(p)
  assert.equal(result.text.split('CALCULATED_DATA=')[1],JSON.stringify(buildPromptPacket(p)))
  assert.equal(result.bytes,budget.bytes);assert.equal(result.max_bytes,budget.max_bytes);assert.equal(result.estimated_input_tokens,budget.estimated_input_tokens)
  assert.equal(JSON.stringify(p),before)
  const instruction=result.text.split('CALCULATED_DATA=')[0]
  for(const phrase of [section,'사건 확률이 아니라','결합/충돌','분량을 채우지','상대→나','나→상대','독립된 체계','가격 방향','두 번째 계산기가 아니다']) assert.ok(instruction.includes(phrase),phrase)
  if(kind==='day') assert.ok(!instruction.includes('[올해 큰 흐름]'))
  if(kind==='week') assert.ok(instruction.includes('일간 해설 7개를 붙이지'))
  assert.ok(Buffer.byteLength(instruction)<9000)
})
