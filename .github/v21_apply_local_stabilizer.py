from pathlib import Path

cost = Path('supabase/functions/fortune-interpret-v21-preview/costGuardV21.ts')
s = cost.read_text()
anchor = '\nexport function buildPromptPacket(payload:any){\n'
assert anchor in s, 'cost guard insertion anchor missing'
assert 'export function stabilizeCoreForQuality' not in s
stabilizer = r'''
function iso(v:any){return String(v??"").match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0]??"";}
function refs(v:any){return Array.isArray(v)?v.map(String).filter(Boolean):[];}
function rowCovers(row:any,date:string){if(!date)return false;const d=iso(row?.date);if(d===date)return true;const start=iso(row?.start),end=iso(row?.end);return Boolean(start&&end&&start<=date&&date<=end);}
function kdTopics(kd:any){if(Array.isArray(kd?.topics))return kd.topics.map(String);if(kd?.topics&&typeof kd.topics==="object")return Object.keys(kd.topics);return [];}
function ensureMinText(value:any,min:number,fallback:string){const base=String(value??"").trim();if(base.length>=min)return base;return `${base}${base?" ":""}${fallback}`.trim();}

export function stabilizeCoreForQuality(core:any,payload:any){
  const data=structuredClone(core??{});
  const rows=Array.isArray(payload?.evidence_ledger)?payload.evidence_ledger:[];
  const map=new Map<string,any>(rows.map((row:any)=>[String(row?.id??""),row]));
  const valid=(values:any)=>uniq(refs(values).filter(ref=>map.has(ref)));
  const deterministic=buildDeterministicTopicAnalysis(payload);
  const important=deterministic.filter((x:any)=>x.importance!=="참고");
  const coreTopics=deterministic.filter((x:any)=>x.importance==="핵심");
  const kind=String(payload?.period_kind??"annual");
  const minimumWindows=kind==="annual"?5:kind==="month"?3:kind==="week"?2:1;
  const minimumDecisions=kind==="annual"?3:kind==="month"?2:kind==="week"?2:1;
  const minimumPriorities=kind==="annual"?3:kind==="month"?2:kind==="week"?2:1;
  const rowPriority=(row:any)=>{const id=String(row?.id??"");if(id.startsWith("W:daily:"))return 0;if(id.startsWith("W:window:"))return 1;if(id.startsWith("W:detail:"))return 2;if(id.startsWith("W:date:"))return 3;if(id.startsWith("W:month:"))return 4;if(id.startsWith("W:overall:"))return 5;if(row?.system==="saju")return 6;if(row?.system==="thai")return 7;return 9;};
  const refsForDate=(date:string,topics:string[]=[])=>{
    if(!date)return [] as string[];
    let matches=rows.filter((row:any)=>rowCovers(row,date));
    if(topics.length){const specific=matches.filter((row:any)=>topics.includes(String(row?.topic??"")));if(specific.length)matches=specific;}
    return uniq([...matches].sort((a:any,b:any)=>rowPriority(a)-rowPriority(b)).map((row:any)=>String(row?.id??"")).filter(Boolean));
  };
  const overallRefs=(topics:string[]=[])=>uniq(rows.filter((row:any)=>String(row?.id??"").startsWith("W:overall:")&&(!topics.length||topics.includes(String(row?.topic??"")))).map((row:any)=>String(row.id)));
  const topicsFromRefs=(values:string[])=>uniq(values.map(ref=>String(map.get(ref)?.topic??"")).filter(Boolean));
  const directionSignal=(values:string[])=>{const linked=values.map(ref=>map.get(ref)).filter(Boolean);const pos=linked.some((r:any)=>r?.direction==="supportive"),neg=linked.some((r:any)=>r?.direction==="caution");return pos&&neg?"혼합":neg?"주의":pos?"활용":"배경";};
  const evidenceSentence=(values:string[])=>values.map(ref=>String(map.get(ref)?.text??"").trim()).filter(Boolean).slice(0,2).join(" ");
  const windowTopics=(w:any)=>{const direct=Array.isArray(w?.topics)?w.topics.map(String):[];return uniq([...direct,...topicsFromRefs(valid(w?.evidence_refs))]);};
  const firstTopic=(topics:string[])=>topics.find(topic=>TOPICS.includes(topic as any))??topics[0]??String(coreTopics[0]?.topic??TOPICS[0]);
  const enrichWindow=(w:any)=>{
    const out={...w};let topicList=windowTopics(out);const start=iso(out?.start),end=iso(out?.end)||start;let linked=valid(out?.evidence_refs);
    if(start)linked=uniq([...linked,...refsForDate(start,topicList).slice(0,3)]);
    if(end&&end!==start)linked=uniq([...linked,...refsForDate(end,topicList).slice(0,2)]);
    if(kind==="annual"&&!linked.some(ref=>ref.startsWith("W:daily:"))&&start){const daily=rows.find((row:any)=>String(row?.id??"").startsWith("W:daily:")&&iso(row?.date)>=start&&iso(row?.date)<=end&&(!topicList.length||topicList.includes(String(row?.topic??""))));if(daily?.id)linked=uniq([...linked,String(daily.id)]);}
    topicList=uniq([...topicList,...topicsFromRefs(linked)]);if(linked.length<2)linked=uniq([...linked,...overallRefs(topicList).slice(0,2-linked.length)]);
    const topic=firstTopic(topicList),verb=topicVerb(topic),ev=evidenceSentence(linked);out.topics=topicList.length?topicList:[topic];out.evidence_refs=linked.slice(0,6);out.signal=directionSignal(out.evidence_refs);
    out.summary=ensureMinText(out?.summary,45,`${ev||`${topic} 계산근거가 이 시기에 모여 있어.`} 사건 확정이 아니라 상대활성도 변화로 보고 실제 일정과 반응을 함께 확인해.`);
    out.action=ensureMinText(out?.action,18,verb.action);out.avoid=ensureMinText(out?.avoid,18,verb.avoid);return out;
  };
  const makeWindow=(kd:any)=>{const date=iso(kd?.date);const topics=kdTopics(kd);let linked=valid(kd?.western_refs);linked=uniq([...linked,...refsForDate(date,topics).slice(0,4)]);if(linked.length<2)linked=uniq([...linked,...overallRefs(topics).slice(0,2-linked.length)]);const topic=firstTopic(topics.length?topics:topicsFromRefs(linked)),verb=topicVerb(topic),ev=evidenceSentence(linked);return enrichWindow({label:`${date} ${topic} 주목 구간`,start:date,end:date,signal:directionSignal(linked),topics:topics.length?topics:[topic],summary:`${ev||`${topic} 직접 계산근거가 잡힌 날짜야.`} 이 날짜 자체를 사건 보장으로 보지 말고 전후의 실제 변화와 함께 확인해.`,action:verb.action,avoid:verb.avoid,evidence_refs:linked});};
  data.key_windows=(Array.isArray(data?.key_windows)?data.key_windows:[]).map(enrichWindow);
  const usedWindowDates=new Set(data.key_windows.flatMap((w:any)=>[iso(w?.start),iso(w?.end)]).filter(Boolean));
  for(const kd of Array.isArray(payload?.key_dates)?payload.key_dates:[]){if(data.key_windows.length>=minimumWindows)break;const date=iso(kd?.date);if(!date||usedWindowDates.has(date))continue;const built=makeWindow(kd);if(!built.evidence_refs.length)continue;data.key_windows.push(built);usedWindowDates.add(date);}
  const windowRefs=new Set<string>(data.key_windows.flatMap((w:any)=>refs(w?.evidence_refs)));
  data.decisions=Array.isArray(data?.decisions)?data.decisions:[];
  data.decisions=data.decisions.map((d:any,index:number)=>{const out={...d};let linked=valid(out?.evidence_refs);const timingDate=iso(out?.timing);let target=data.key_windows.find((w:any)=>timingDate&&iso(w?.start)<=timingDate&&timingDate<=iso(w?.end));if(!target)target=data.key_windows.find((w:any)=>refs(w?.evidence_refs).some((ref:string)=>linked.includes(ref)))??data.key_windows[index%Math.max(1,data.key_windows.length)];if(target&&!linked.some(ref=>windowRefs.has(ref)))linked=uniq([...linked,...refs(target?.evidence_refs).slice(0,1)]);const topic=firstTopic(target?windowTopics(target):[]),verb=topicVerb(topic);out.evidence_refs=linked.slice(0,5);out.action=ensureMinText(out?.action,12,verb.action);out.timing=String(out?.timing??"").trim()||(target?(iso(target.start)===iso(target.end)?iso(target.start):`${iso(target.start)} ~ ${iso(target.end)}`):String(payload?.period?.start??""));out.reason=ensureMinText(out?.reason,24,target?.summary??`${topic} 계산근거와 직접 연결한 행동 가이드야.`);out.watch=ensureMinText(out?.watch,14,"실제 답변·일정·수치처럼 확인 가능한 변화를 먼저 확인해.");out.avoid=ensureMinText(out?.avoid,14,verb.avoid);return out;});
  for(let i=data.decisions.length;i<minimumDecisions&&i<data.key_windows.length;i++){const w=data.key_windows[i],topic=firstTopic(windowTopics(w)),verb=topicVerb(topic);data.decisions.push({action:verb.action,timing:iso(w.start)===iso(w.end)?iso(w.start):`${iso(w.start)} ~ ${iso(w.end)}`,reason:w.summary,watch:"실제 답변·일정·수치처럼 확인 가능한 변화가 계산 흐름과 맞는지 확인해.",avoid:verb.avoid,evidence_refs:refs(w.evidence_refs).slice(0,3)});}
  data.priorities=Array.isArray(data?.priorities)?data.priorities.map(String).filter(Boolean):[];for(const row of [...coreTopics,...important]){if(data.priorities.length>=minimumPriorities)break;const text=`${row.topic}: ${row.action}`;if(!data.priorities.includes(text))data.priorities.push(text);}
  data.overall=data?.overall&&typeof data.overall==="object"?data.overall:{};let overallEvidence=valid(data.overall.evidence_refs);overallEvidence=uniq([...overallEvidence,...data.key_windows.flatMap((w:any)=>refs(w?.evidence_refs)),...coreTopics.flatMap((x:any)=>refs(x?.evidence_refs))]).filter(ref=>map.has(ref));data.overall.evidence_refs=overallEvidence.slice(0,8);const minSummary=kind==="annual"?240:kind==="month"?170:110;const groundedAppend=coreTopics.slice(0,3).map((x:any)=>String(x.reason??x.verdict??"")).filter(Boolean).join(" ");data.overall.summary=ensureMinText(data.overall.summary,minSummary,`${groundedAppend} 이 점수들은 사건 확률이 아니라 기간 내 상대활성도이므로 실제 일정·반응·수치와 대조해서 판단해.`);
  const timeline=Array.isArray(payload?.cross_system_timeline)?payload.cross_system_timeline:[];const timelineFor=(start:string,end:string)=>timeline.find((x:any)=>{const d=iso(x?.date);return d&&start&&end&&start<=d&&d<=end;});
  const enrichCross=(x:any)=>{const out={...x};const start=iso(out?.start),end=iso(out?.end)||start,t=timelineFor(start,end);let linked=valid(out?.evidence_refs);if(t)linked=uniq([...linked,...valid(t?.western_refs),...valid(t?.saju_context_refs),...valid(t?.thai_context_refs)]);const linkedRows=linked.map(ref=>map.get(ref)).filter(Boolean),systems=new Set(linkedRows.map((r:any)=>String(r?.system??"")));out.evidence_refs=linked.slice(0,8);out.mode=systems.has("western")&&systems.size>=2?(out?.mode==="상반맥락"?"상반맥락":"복수체계"):"Western단독";const western=linkedRows.filter((r:any)=>r?.system==="western").map((r:any)=>String(r?.text??"")).filter(Boolean).slice(0,2).join(" "),saju=linkedRows.filter((r:any)=>r?.system==="saju").map((r:any)=>String(r?.text??"")).filter(Boolean).slice(0,2).join(" "),thai=linkedRows.filter((r:any)=>r?.system==="thai").map((r:any)=>String(r?.text??"")).filter(Boolean).slice(0,2).join(" ");out.western=ensureMinText(out?.western,25,western||"Western 계산은 해당 시기의 상대활성도 변화를 직접 추적해.");out.saju=String(out?.saju??"").trim()||(saju?`${saju} 사주는 Western 점수에 합산하지 않고 독립 맥락으로만 참고해.`:"");out.thai=String(out?.thai??"").trim()||(thai?`${thai} Thai는 위치·기간 맥락만 독립적으로 참고해.`:"");const others=[out.saju,out.thai].filter(Boolean).join(" ");out.synthesis=ensureMinText(out?.synthesis,45,others?`Western의 직접 시기 근거와 비Western의 독립 맥락을 나란히 비교해. ${others} 서로 점수를 합산하지 말고 실제 변화가 겹치는지만 확인해.`:"다른 체계의 독립 근거가 충분하지 않아 Western 직접 계산을 중심으로 보고, 실제 변화가 나타나는지 확인해.");return out;};
  data.cross_checks=(Array.isArray(data?.cross_checks)?data.cross_checks:[]).map(enrichCross);
  if(kind==="annual"){const usedCrossDates=new Set(data.cross_checks.map((x:any)=>iso(x?.start)).filter(Boolean));const candidates=[...timeline,...(Array.isArray(payload?.key_dates)?payload.key_dates:[])];for(const t of candidates){if(data.cross_checks.length>=3)break;const date=iso(t?.date);if(!date||usedCrossDates.has(date))continue;let linked=uniq([...valid(t?.western_refs),...valid(t?.saju_context_refs),...valid(t?.thai_context_refs)]);if(!linked.length)linked=refsForDate(date,kdTopics(t)).slice(0,4);if(!linked.length)continue;const linkedRows=linked.map(ref=>map.get(ref)).filter(Boolean),systems=new Set(linkedRows.map((r:any)=>String(r?.system??"")));data.cross_checks.push(enrichCross({label:`${date} 체계 교차확인`,start:date,end:date,mode:systems.has("western")&&systems.size>=2?"복수체계":"Western단독",western:"",saju:"",thai:"",synthesis:"",evidence_refs:linked}));usedCrossDates.add(date);}}
  if(kind==="annual"){data.year_phases=Array.isArray(data?.year_phases)?data.year_phases:[];const months=Array.isArray(payload?.western?.months)?payload.western.months:[];for(let q=data.year_phases.length;q<4&&months.length;q++){const startIndex=Math.min(months.length-1,Math.floor(q*months.length/4)),endIndex=Math.min(months.length-1,Math.floor((q+1)*months.length/4)-1),first=months[startIndex],last=months[Math.max(startIndex,endIndex)],start=iso(first?.start)||`${String(first?.calendar_month??"")}-01`.slice(0,10),end=iso(last?.end)||start,topic=String(coreTopics[q%Math.max(1,coreTopics.length)]?.topic??TOPICS[q%TOPICS.length]);let linked=rows.filter((row:any)=>String(row?.id??"").startsWith("W:month:")&&rowCovers(row,start)&&String(row?.topic??"")===topic).map((row:any)=>String(row.id));if(!linked.length)linked=refsForDate(start,[topic]);data.year_phases.push({label:`연간 흐름 ${q+1}`,start,end,theme:`${topic} 흐름을 중심으로 보는 구간`,change:String(coreTopics[q%Math.max(1,coreTopics.length)]?.reason??`${topic} 기간 변화가 두드러지는 구간이야.`),evidence_refs:linked.slice(0,4)});}data.year_phases=data.year_phases.map((p:any)=>{const out={...p};let linked=valid(out?.evidence_refs);if(!linked.length)linked=refsForDate(iso(out?.start),[]);out.evidence_refs=linked.slice(0,5);return out;});}
  const relationshipSalient=important.some((x:any)=>["연애","연락","재회"].includes(String(x.topic)));
  if(relationshipSalient){const relTopicSet=new Set(["수신신호","발신적합","과거인연접점","연애","연락","재회"]),relRows=rows.filter((row:any)=>relTopicSet.has(String(row?.topic??"")));data.relationship_reading=data?.relationship_reading&&typeof data.relationship_reading==="object"?data.relationship_reading:{};const rr=data.relationship_reading,focusDates=[...String(rr?.focus_timing??"").matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)].map((m:any)=>m[0]);let linked=valid(rr?.evidence_refs);for(const date of focusDates)linked=uniq([...linked,...relRows.filter((row:any)=>iso(row?.date)===date).map((row:any)=>String(row.id))]);linked=uniq([...linked,...relRows.sort((a:any,b:any)=>rowPriority(a)-rowPriority(b)).map((row:any)=>String(row.id))]).slice(0,8);rr.evidence_refs=linked;const sig=payload?.western?.relationship_signals??{},incoming=scoreText(sig?.수신신호?.average),outgoing=scoreText(sig?.발신적합?.average),reconnect=scoreText(sig?.과거인연접점?.average),exact=relRows.find((row:any)=>iso(row?.date)&&String(row?.id??"").startsWith("W:date:")),exactDate=iso(exact?.date);rr.context=ensureMinText(rr?.context,35,`관계 계산에서 수신 ${incoming}점, 발신 ${outgoing}점, 과거인연 재접점 ${reconnect}점이 서로 다른 축으로 움직여.`);rr.flow=ensureMinText(rr?.flow,55,"상대→나 신호와 나→상대 행동 적합도를 분리해서 보고, 과거 인연 재접점은 별도 축으로 확인해야 해. 한 축의 상승만으로 관계 결과를 확정하지 마.");rr.focus_timing=ensureMinText(rr?.focus_timing,20,exactDate?`${exactDate}의 직접 관계 근거를 우선 확인하고, 실제 답변·약속·만남 제안이 뒤따르는지 봐.`:"직접 관계 날짜 근거가 있는 구간에서 실제 답변·약속·만남 제안이 뒤따르는지 확인해.");if(exactDate&&![...String(rr.focus_timing).matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)].length)rr.focus_timing=`${exactDate} · ${rr.focus_timing}`;if(exactDate)rr.evidence_refs=uniq([...rr.evidence_refs,...relRows.filter((row:any)=>iso(row?.date)===exactDate).map((row:any)=>String(row.id))]).slice(0,8);rr.watch=ensureMinText(rr?.watch,20,"실제 연락 빈도, 답변의 구체성, 약속 제안처럼 관찰 가능한 신호가 함께 움직이는지 확인해.");rr.avoid=ensureMinText(rr?.avoid,20,"상대활성도 점수만으로 상대의 속마음이나 재회·연애 결과를 미리 확정하지 마.");data.contact_flow=data?.contact_flow&&typeof data.contact_flow==="object"?data.contact_flow:{};data.contact_flow.incoming=ensureMinText(data.contact_flow.incoming,15,`수신신호 평균 ${incoming}점의 상대활성도를 실제 상대의 반응과 대조해.`);data.contact_flow.outgoing=ensureMinText(data.contact_flow.outgoing,15,`발신적합 평균 ${outgoing}점의 흐름을 내 행동 타이밍과 대조해.`);data.contact_flow.reconnection=ensureMinText(data.contact_flow.reconnection,15,`과거인연접점 평균 ${reconnect}점은 재회 보장이 아니라 재접점 활성도야.`);}
  const investmentSalient=important.some((x:any)=>INVESTMENT_TOPICS.has(String(x.topic)));
  if(investmentSalient){data.investment_reading=data?.investment_reading&&typeof data.investment_reading==="object"?data.investment_reading:{};const ir=data.investment_reading,overall=payload?.western?.overall??{};const fill=(field:string,topic:string)=>{ir[field]=ensureMinText(ir?.[field],20,`${topic} 상대활성도 평균 ${scoreText(overall?.[topic]?.average)}점이야. 실제 시장 데이터와 본인 위험 한도를 함께 확인해.`);};fill("psychology","투자심리");fill("realization","수익실현");fill("entry","신규진입");fill("risk","투자주의");}
  return data;
}
'''
s = s.replace(anchor, '\n' + stabilizer + anchor, 1)
cost.write_text(s)

idx = Path('supabase/functions/fortune-interpret-v21-preview/index.ts')
s = idx.read_text()
old_import = 'import { buildDeterministicTopicAnalysis, buildExternalPrompt, buildPromptPacket, promptBudget } from "./costGuardV21.ts";'
new_import = 'import { buildDeterministicTopicAnalysis, buildExternalPrompt, buildPromptPacket, promptBudget, stabilizeCoreForQuality } from "./costGuardV21.ts";'
assert old_import in s
s = s.replace(old_import, new_import, 1)
s = s.replace('const VERSION="supabase-ai-v21-single-core-cost-guard";', 'const VERSION="supabase-ai-v21.1-single-core-local-stabilizer";', 1)
old_merged = 'const merged={...core,topic_analysis:buildDeterministicTopicAnalysis(payload)};'
assert old_merged in s
s = s.replace(old_merged, 'const merged=stabilizeCoreForQuality({...core,topic_analysis:buildDeterministicTopicAnalysis(payload)},payload);', 1)
old_usage = 'cost_guard_version:VERSION,local_thai_scrub:Boolean(r.local_thai_scrub)};'
assert old_usage in s
s = s.replace(old_usage, 'cost_guard_version:VERSION,local_thai_scrub:Boolean(r.local_thai_scrub),quality_report:r.quality_report??null};', 1)
old_meta = 'prompt_budget_guard:true,prompt_copy:true,thai_contract:THAI_CONTRACT_VERSION'
assert old_meta in s
s = s.replace(old_meta, 'prompt_budget_guard:true,prompt_copy:true,local_quality_stabilizer:true,quality_failure_observability:true,thai_contract:THAI_CONTRACT_VERSION', 1)
idx.write_text(s)

test = Path('supabase/functions/fortune-interpret-v21-preview/costGuardV21.test.mjs')
s = test.read_text()
old_test_import = "import { buildDeterministicTopicAnalysis, buildExternalPrompt, buildPromptPacket, promptBudget } from './costGuardV21.ts';"
assert old_test_import in s
s = s.replace(old_test_import, "import { buildDeterministicTopicAnalysis, buildExternalPrompt, buildPromptPacket, promptBudget, stabilizeCoreForQuality } from './costGuardV21.ts';", 1)
daily_anchor = "    evidence_ledger.push({id:`W:date:2027-04-11:${topic}:best`,system:'western',scope:'best_day',topic,direction:'supportive',date:'2027-04-11',score:72,text:`${topic} 직접 날짜 근거 ${'x'.repeat(100)}`});"
assert daily_anchor in s
s = s.replace(daily_anchor, daily_anchor + "\n    evidence_ledger.push({id:`W:daily:2027-04-11:${topic}:1`,system:'western',scope:'daily_actual',topic,direction:'supportive',date:'2027-04-11',score:69,text:`${topic} 실제 일별 애스펙트 근거`});", 1)
extra = r'''

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
'''
s += extra
marker = "  assert.match(src,/usage_json:usageJson/);"
assert marker in s
s = s.replace(marker, marker + "\n  assert.match(src,/stabilizeCoreForQuality/);\n  assert.match(src,/quality_report:r\\.quality_report\\?\\?null/);", 1)
test.write_text(s)
