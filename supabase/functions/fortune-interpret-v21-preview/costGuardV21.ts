import { TOPICS, REL } from "../fortune-interpret-v6-preview/integratedInterpretationV2.ts";

const enc = new TextEncoder();
const INVESTMENT_RISK = "투자주의";
const RELATION_TOPICS = new Set(["대인관계","연애","연락","재회"]);
const INVESTMENT_TOPICS = new Set(["투자심리","수익실현","신규진입","투자주의"]);

function num(v: unknown){ const n=Number(v??0); return Number.isFinite(n)?n:0; }
function uniq<T>(xs:T[]){ return [...new Set(xs)]; }
function scoreText(v:unknown){ return Number.isFinite(Number(v)) ? Number(v).toFixed(1) : "-"; }
function jsonBytes(v:any){ return enc.encode(JSON.stringify(v)).byteLength; }
function periodLimit(kind:string){ return kind==="annual"?8:kind==="month"?6:kind==="week"?5:2; }

function topicEvidence(payload:any, topic:string){
  const rows=Array.isArray(payload?.evidence_ledger)?payload.evidence_ledger:[];
  const direct=rows.filter((row:any)=>String(row?.topic??"")===topic);
  const priority=(row:any)=>{
    const id=String(row?.id??"");
    if(id.startsWith(`W:overall:${topic}`))return 0;
    if(id.startsWith("W:daily:"))return 1;
    if(id.startsWith("W:detail:"))return 2;
    if(id.startsWith("W:window:"))return 3;
    if(id.startsWith("W:date:"))return 4;
    if(id.startsWith("W:month:"))return 5;
    return 9;
  };
  return [...direct].sort((a,b)=>priority(a)-priority(b)).slice(0,8);
}

function topicSalience(payload:any,topic:string){
  const stat=payload?.western?.overall?.[topic]??{};
  const digest=payload?.western?.daily_pattern_digest?.[topic]??{};
  const keyHits=(payload?.key_dates??[]).filter((row:any)=>Array.isArray(row?.topics)&&row.topics.includes(topic)).length;
  const avg=num(stat?.average), spread=num(stat?.spread), volatility=num(digest?.volatility);
  const extreme=Math.abs(avg-50);
  const rankBonus=(payload?.ranking?.strongest??[]).some((x:any)=>x?.topic===topic)?8:(payload?.ranking?.weakest??[]).some((x:any)=>x?.topic===topic)?7:0;
  return extreme*0.9+spread*0.45+volatility*0.65+keyHits*8+rankBonus;
}

function topicImportance(payload:any){
  const scored=TOPICS.map(topic=>({topic,score:topicSalience(payload,topic),refs:topicEvidence(payload,topic)})).sort((a,b)=>b.score-a.score);
  const coreMax=payload?.period_kind==="day"?3:4;
  const core=new Set(scored.filter(x=>x.refs.length>=2).slice(0,coreMax).map(x=>x.topic));
  const watch=new Set(scored.filter(x=>!core.has(x.topic)).slice(0,payload?.period_kind==="annual"?5:4).map(x=>x.topic));
  return {scored,core,watch};
}

function bestTopicDate(payload:any,topic:string){
  const stat=payload?.western?.overall?.[topic]??{};
  const candidates=[...(stat?.best_days??[]),...(stat?.caution_days??[])].filter((x:any)=>x?.date);
  const key=(payload?.key_dates??[]).find((row:any)=>Array.isArray(row?.topics)&&row.topics.includes(topic));
  if(key?.date)return String(key.date);
  return candidates[0]?.date?String(candidates[0].date):String(payload?.period?.start??"");
}

function topicVerb(topic:string){
  if(["직장","이직"].includes(topic))return {action:"조건·일정·문서를 실제 기준과 대조해 우선순위를 정리해.",avoid:"한 번의 고점이나 저점만 보고 커리어 결론을 즉시 확정하지 마."};
  if(["학업","시험"].includes(topic))return {action:"집중력이 상대적으로 나은 구간에 핵심 과제와 점검을 먼저 배치해.",avoid:"낮은 구간의 체감만으로 전체 학습 성과를 단정하지 마."};
  if(["대인관계","연애","연락","재회"].includes(topic))return {action:"실제 답변·약속·만남 제안처럼 관찰 가능한 반응을 확인하며 속도를 조절해.",avoid:"상대지수만 보고 상대의 속마음이나 관계 결과를 미리 확정하지 마."};
  if(["금전","소식"].includes(topic))return {action:"계약·입금·안내처럼 확인 가능한 정보부터 다시 점검해.",avoid:"확인되지 않은 기대만으로 지출이나 결정을 확대하지 마."};
  if(INVESTMENT_TOPICS.has(topic))return {action:"실제 시장 데이터와 본인 리스크 한도를 함께 확인해 규모를 조절해.",avoid:"상대지수를 가격방향·수익률 예측으로 바꾸거나 레버리지를 확대하지 마."};
  return {action:"체감보다 수면·일정·회복 같은 확인 가능한 상태를 기준으로 강도를 조절해.",avoid:"하루의 컨디션 변화를 장기 상태로 단정하지 마."};
}

export function buildDeterministicTopicAnalysis(payload:any){
  const {core,watch}=topicImportance(payload);
  return TOPICS.map(topic=>{
    const stat=payload?.western?.overall?.[topic]??{};
    const digest=payload?.western?.daily_pattern_digest?.[topic]??{};
    const avg=num(stat?.average), spread=num(stat?.spread);
    const refs=topicEvidence(payload,topic).map((row:any)=>String(row?.id??"")).filter(Boolean);
    const importance=core.has(topic)?"핵심":watch.has(topic)?"주목":"참고";
    const risk=topic===INVESTMENT_RISK;
    const direction=risk?(avg>=60?"경계 압력이 상대적으로 높은 편":avg<40?"경계 압력이 상대적으로 낮은 편":"경계 압력이 중간권"):(avg>=60?"상대적으로 강한 편":avg<40?"상대적으로 약한 편":"중간권");
    const min=digest?.min, max=digest?.max;
    const reasonParts=[`${topic} 기간 평균은 ${scoreText(avg)}점${stat?.band?`(${String(stat.band)})`:""}이고 변동폭은 ${scoreText(spread)}점이라 ${direction}이야.`];
    if(min?.date&&max?.date)reasonParts.push(`실제 일별 궤적은 ${min.date} ${scoreText(min.score)}점에서 ${max.date} ${scoreText(max.score)}점 사이를 움직였고 변동성은 ${scoreText(digest?.volatility)}점이야.`);
    const timing=bestTopicDate(payload,topic);
    if(timing)reasonParts.push(`판단할 때는 ${timing} 전후의 직접 계산근거와 기간 평균을 함께 보는 게 좋아.`);
    const va=topicVerb(topic);
    return {
      topic,importance,
      verdict:`${topic}은 이번 기간에서 ${direction}으로 읽혀.`,
      reason:reasonParts.join(" "),
      timing,
      action:va.action,
      avoid:va.avoid,
      confidence:refs.length>=3?"높음":refs.length>=1?"보통":"낮음",
      confidence_reason:`직접 연결된 계산 근거 ${refs.length}개와 기간 통계를 함께 사용했어.`,
      evidence_refs:refs.slice(0,importance==="핵심"?5:3),
    };
  });
}

function salientTopics(payload:any){
  const rows=buildDeterministicTopicAnalysis(payload);
  const important=rows.filter(x=>x.importance!=="참고").map(x=>x.topic);
  const relationImportant=important.some(x=>RELATION_TOPICS.has(x));
  const investmentImportant=important.some(x=>INVESTMENT_TOPICS.has(x));
  return uniq([
    ...important,
    ...(relationImportant?["대인관계","연애","연락","재회"]:[]),
    ...(investmentImportant?["투자심리","수익실현","신규진입","투자주의"]:[]),
  ]).slice(0,10);
}

function compactMonths(payload:any,topics:string[]){
  return (Array.isArray(payload?.western?.months)?payload.western.months:[]).map((m:any)=>({
    calendar_month:m?.calendar_month,start:m?.start,end:m?.end,
    topics:Object.fromEntries(topics.filter(t=>m?.topics?.[t]).map(t=>[t,{average:m.topics[t].average,band:m.topics[t].band,spread:m.topics[t].spread}])),
    relationship_signals:Object.fromEntries(REL.filter(t=>m?.relationship_signals?.[t]).map(t=>[t,{average:m.relationship_signals[t].average,band:m.relationship_signals[t].band,spread:m.relationship_signals[t].spread}])),
  }));
}

function promptEvidence(payload:any,topics:string[],keyDates:any[]){
  const allowed=new Set<string>();
  for(const topic of topics)for(const row of topicEvidence(payload,topic))allowed.add(String(row?.id??""));
  for(const rel of REL)for(const row of topicEvidence(payload,rel))allowed.add(String(row?.id??""));
  for(const kd of keyDates){
    for(const ref of kd?.western_refs??[])allowed.add(String(ref));
    const cross=(payload?.cross_system_timeline??[]).find((x:any)=>x?.date===kd?.date);
    for(const ref of cross?.saju_context_refs??[])allowed.add(String(ref));
    for(const ref of cross?.thai_context_refs??[])allowed.add(String(ref));
  }
  const rows=(Array.isArray(payload?.evidence_ledger)?payload.evidence_ledger:[]).filter((row:any)=>allowed.has(String(row?.id??"")));
  const ordered=[...rows].sort((a:any,b:any)=>{
    const p=(row:any)=>String(row?.id??"").startsWith("W:daily:")?0:String(row?.id??"").startsWith("W:detail:")?1:String(row?.id??"").startsWith("W:window:")?2:String(row?.id??"").startsWith("W:date:")?3:String(row?.id??"").startsWith("W:month:")?4:String(row?.id??"").startsWith("W:overall:")?5:6;
    return p(a)-p(b);
  });
  return ordered.slice(0,payload?.period_kind==="annual"?110:80);
}

function compactThai(thai:any){
  if(!thai)return null;
  return {
    engine:thai?.engine,thai_day:thai?.thai_day,birth_planet:thai?.birth_planet??null,ruler:thai?.ruler,
    mahathaksa:thai?.mahathaksa?{available:thai.mahathaksa.available,method:thai.mahathaksa.method,evidence_id:thai.mahathaksa.evidence_id}:null,
    taksajorn:thai?.taksajorn?{available:thai.taksajorn.available,segments:(thai.taksajorn.segments??[]).map((x:any)=>({start:x.start,end:x.end,annual_boriwan:x.annual_boriwan,landed_center:x.landed_center,evidence_id:x.evidence_id}))}:null,
    suriyayat:thai?.suriyayat?{available:thai.suriyayat.available,lagna:thai.suriyayat.lagna?{available:thai.suriyayat.lagna.available,display:thai.suriyayat.lagna.display,interpretation_scope:thai.suriyayat.lagna.interpretation_scope}:null,interpretation_status:thai.suriyayat.interpretation_status}:null,
    predictive_status:thai?.predictive_status,consensus_policy:thai?.consensus_policy,reliability:thai?.reliability??null,
  };
}


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

export function buildPromptPacket(payload:any){
  const topics=salientTopics(payload);
  const maxDates=periodLimit(String(payload?.period_kind??"annual"));
  const keyDates=(Array.isArray(payload?.key_dates)?payload.key_dates:[]).slice(0,maxDates);
  const selectedDates=new Set(keyDates.map((x:any)=>String(x?.date??"")));
  const topicRows=buildDeterministicTopicAnalysis(payload);
  const overall=Object.fromEntries(TOPICS.filter(t=>payload?.western?.overall?.[t]).map(t=>[t,{average:payload.western.overall[t].average,band:payload.western.overall[t].band,spread:payload.western.overall[t].spread}]));
  const relation=Object.fromEntries(REL.filter(t=>payload?.western?.relationship_signals?.[t]).map(t=>[t,{average:payload.western.relationship_signals[t].average,band:payload.western.relationship_signals[t].band,spread:payload.western.relationship_signals[t].spread}]));
  const digest=Object.fromEntries(topics.filter(t=>payload?.western?.daily_pattern_digest?.[t]).map(t=>[t,payload.western.daily_pattern_digest[t]]));
  const detail=(payload?.western?.detail_days??[]).filter((d:any)=>selectedDates.has(String(d?.date??""))).map((d:any)=>({date:d.date,market_status:d.market_status,topics:Object.fromEntries(Object.entries(d?.topics??{}).filter(([topic])=>topics.includes(topic)).map(([topic,x]:any)=>[topic,{best_window:x?.best_window??null,caution_window:x?.caution_window??null,evidence:(x?.evidence??[]).slice(0,2)}]))}));
  const cross=(payload?.cross_system_timeline??[]).filter((x:any)=>selectedDates.has(String(x?.date??"")));
  const packet={
    packet_version:"fortune-ai-prompt-v21-cost-guard",
    source_packet_version:payload?.packet_version,
    period:payload?.period,period_kind:payload?.period_kind,integration_policy:payload?.integration_policy,
    ranking:payload?.ranking,
    deterministic_topic_summary:topicRows.map(x=>({topic:x.topic,importance:x.importance,verdict:x.verdict,timing:x.timing,evidence_refs:x.evidence_refs.slice(0,3)})),
    western:{
      engine:payload?.western?.engine,overall,relationship_signals:relation,
      months:compactMonths(payload,topics),daily_pattern_digest:digest,detail_days:detail,
      daily_evidence_coverage:payload?.western?.daily_evidence_coverage,market:payload?.western?.market,
    },
    key_dates:keyDates,cross_system_timeline:cross,
    saju:{engine:payload?.saju?.engine,day_master:payload?.saju?.day_master??null,annual:(payload?.saju?.annual??[]).map((x:any)=>({segment_start:x.segment_start,segment_end_exclusive:x.segment_end_exclusive,ganzhi:x.ganzhi,stem_ten_god:x.stem_ten_god,branch_links:x.branch_links,evidence_id:x.evidence_id})),monthly:(payload?.saju?.monthly??[]).filter((x:any)=>keyDates.some((k:any)=>String(k.date)>=String(x.segment_start??"")&&String(k.date)<String(x.segment_end_exclusive??""))).map((x:any)=>({segment_start:x.segment_start,segment_end_exclusive:x.segment_end_exclusive,ganzhi:x.ganzhi,stem_ten_god:x.stem_ten_god,branch_links:x.branch_links,evidence_id:x.evidence_id}))},
    thai:compactThai(payload?.thai),
    evidence_ledger:promptEvidence(payload,topics,keyDates),
  };
  return packet;
}

export function promptBudget(payload:any){
  const packet=buildPromptPacket(payload);
  const bytes=jsonBytes(packet);
  const kind=String(payload?.period_kind??"annual");
  const max_bytes=kind==="annual"?95000:kind==="month"?76000:kind==="week"?62000:52000;
  return {packet,bytes,max_bytes,ok:bytes<=max_bytes,estimated_input_tokens:Math.ceil(bytes/2.6)};
}

export function buildExternalPrompt(payload:any){
  const {packet,bytes,max_bytes,estimated_input_tokens}=promptBudget(payload);
  const text=`아래는 '별빛의 운명' 계산엔진이 만든 압축 근거 패킷이야. 이 자료 밖의 사실·상대 속마음·사건 확률을 만들지 말고, 중요한 것부터 한국어로 이해하기 쉽게 해석해줘.\n\n요구사항:\n- 결론 → 핵심 흐름 → 주목 날짜/시간 → 현실에서 확인할 신호 → 피할 행동 순서로 써.\n- 점수는 사건 확률이 아니라 상대활성도야. 숫자%로 바꾸지 마.\n- 연애·연락·재회가 중요하면 상대→나, 나→상대, 과거인연 재접점을 분리하고 실제 행동으로 확인하게 해.\n- 사주·Thai는 Western 점수에 합산하지 말고 독립 맥락으로 비교해.\n- 중요하지 않은 분야를 억지로 길게 쓰지 마.\n\nCALCULATED_DATA=${JSON.stringify(packet)}`;
  return {text,bytes,max_bytes,estimated_input_tokens};
}
