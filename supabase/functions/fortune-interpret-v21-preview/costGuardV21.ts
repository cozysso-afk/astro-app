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

function topicSubject(topic:string){
  const last=topic.charCodeAt(Math.max(0,topic.length-1));
  const hasBatchim=last>=0xAC00&&last<=0xD7A3&&((last-0xAC00)%28)!==0;
  return `${topic}${hasBatchim?"은":"는"}`;
}

function softenClaimText(value:string){
  return value
    .replace(/연중 가장 완벽한 합일/g,"연중에서도 독립 근거가 비교적 뚜렷하게 겹치는 구간")
    .replace(/가장 완벽한 시기/g,"특히 주목할 시기")
    .replace(/완벽 해설/g,"핵심 해설")
    .replace(/완벽한 합일/g,"독립 근거의 시기적 겹침")
    .replace(/완벽한 시기/g,"주목할 시기")
    .replace(/대길의 시기/g,"상대활성도가 높은 시기")
    .replace(/대길/g,"강한 상대활성도")
    .replace(/매우 긍정적인 시너지를 발휘하는 시기/g,"우호적 맥락이 같은 시기에 나타나는 구간")
    .replace(/삼박자로 맞아떨어져/g,"각 체계의 맥락이 같은 시기에 겹쳐")
    .replace(/시너지/g,"시기적 겹침")
    .replace(/절대 보수적 태도를 유지해야 한다/g,"보수적으로 접근하고 실제 시장 데이터를 우선해야 해")
    .replace(/절대 금물이다/g,"피하는 편이 안전해")
    .replace(/절대 금물/g,"피하는 편이 안전해")
    .replace(/관계 확정/g,"관계 재정립 여부 확인")
    .replace(/재회 최적기/g,"재회 주목기")
    .replace(/이뤄질 가능성이 높다/g,"재접점 신호가 상대적으로 강하게 나타난다");
}

function softenObject<T>(value:T):T{
  if(typeof value==="string")return softenClaimText(value) as T;
  if(Array.isArray(value))return value.map(v=>softenObject(v)) as T;
  if(value&&typeof value==="object"){for(const [k,v] of Object.entries(value as any))(value as any)[k]=softenObject(v);}
  return value;
}

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
  const stat=payload?.western?.overall?.[topic]??{},avg=num(stat?.average);
  const evidence=topicEvidence(payload,topic);
  const backedDates=new Set<string>();
  for(const row of evidence){
    for(const value of [row?.date,row?.start,row?.end]){
      const date=String(value??"").slice(0,10);
      if(/^\d{4}-\d{2}-\d{2}$/.test(date))backedDates.add(date);
    }
  }
  const candidates=[...(stat?.best_days??[]),...(stat?.caution_days??[])].filter((x:any)=>x?.date&&Number.isFinite(Number(x?.score))&&backedDates.has(String(x.date).slice(0,10)));
  candidates.sort((a:any,b:any)=>Math.abs(num(b?.score)-avg)-Math.abs(num(a?.score)-avg));
  if(candidates[0]?.date)return String(candidates[0].date).slice(0,10);
  const key=(payload?.key_dates??[]).find((row:any)=>Array.isArray(row?.topics)&&row.topics.includes(topic)&&backedDates.has(String(row?.date??"").slice(0,10)));
  if(key?.date)return String(key.date).slice(0,10);
  const direct=evidence.find((row:any)=>row?.date&&backedDates.has(String(row.date).slice(0,10)));
  if(direct?.date)return String(direct.date).slice(0,10);
  return String(payload?.period?.start??"").slice(0,10);
}

function topicVerb(topic:string){
  if(["직장","이직"].includes(topic))return {action:"조건·일정·문서를 실제 기준과 대조해 우선순위를 정리해.",avoid:"한 번의 고점이나 저점만 보고 커리어 결론을 즉시 확정하지 마."};
  if(["학업","시험"].includes(topic))return {action:"집중력이 상대적으로 나은 구간에 핵심 과제와 점검을 먼저 배치해.",avoid:"낮은 구간의 체감만으로 전체 학습 성과를 단정하지 마."};
  if(topic==="대인관계")return {action:"상대별 실제 반응과 약속 이행 여부를 구분해 관계의 우선순위를 조절해.",avoid:"한 사람과의 긴장이나 호의를 전체 인간관계 흐름으로 확대하지 마."};
  if(topic==="연애")return {action:"호감 표현·만남의 지속성·관계 정의처럼 실제로 확인되는 연애 행동을 기준으로 속도를 조절해.",avoid:"연애 상대활성도만 보고 상대의 감정이나 관계 성립을 미리 확정하지 마."};
  if(topic==="연락")return {action:"상대가 먼저 보낸 연락과 내가 먼저 보내기 좋은 흐름을 구분하고, 답변의 구체성과 지속성을 확인해.",avoid:"발신 적합도가 높다는 이유로 상대의 수신 의향까지 높다고 해석하지 마."};
  if(topic==="재회")return {action:"과거 인연의 실제 재접촉·대화 재개·만남 제안이 생기는지 확인한 뒤 관계 재정립 여부를 판단해.",avoid:"재접점 활성도를 재회 확정이나 상대의 복귀 의사로 바꾸어 읽지 마."};
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
    const backedDateSet=new Set(topicEvidence(payload,topic).flatMap((row:any)=>[row?.date,row?.start,row?.end]).map((value:any)=>String(value??"").slice(0,10)).filter((value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)));
    const reasonParts=[`${topic} 기간 평균은 ${scoreText(avg)}점${stat?.band?`(${String(stat.band)})`:""}이고 변동폭은 ${scoreText(spread)}점이라 ${direction}이야.`];
    if(min?.date&&max?.date&&backedDateSet.has(String(min.date).slice(0,10))&&backedDateSet.has(String(max.date).slice(0,10)))reasonParts.push(`직접 근거가 연결된 일별 궤적은 ${min.date} ${scoreText(min.score)}점에서 ${max.date} ${scoreText(max.score)}점 사이를 움직였고 변동성은 ${scoreText(digest?.volatility)}점이야.`);
    else reasonParts.push(`일별 변동성은 ${scoreText(digest?.volatility)}점이며, 날짜를 특정할 때는 evidence ledger에 직접 연결된 날짜만 사용해.`);
    const timing=bestTopicDate(payload,topic);
    if(timing)reasonParts.push(`판단할 때는 ${timing} 전후의 직접 계산근거와 기간 평균을 함께 보는 게 좋아.`);
    const va=topicVerb(topic);
    return {
      topic,importance,
      verdict:`${topicSubject(topic)} 이번 기간에서 ${direction}으로 읽혀.`,
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
  const limit=payload?.period_kind==="annual"?110:80;
  const context=ordered.filter((row:any)=>String(row?.system??"")!=="western");
  const western=ordered.filter((row:any)=>String(row?.system??"")==="western");
  const reserve=Math.min(context.length,payload?.period_kind==="annual"?16:12,limit);
  return [...western.slice(0,limit-reserve),...context.slice(0,reserve)];
}

function compactSaju(saju:any){
  if(!saju)return null;
  return {
    engine:saju?.engine,
    pillars:saju?.pillars??null,
    day_master:saju?.day_master??null,
    elements:saju?.elements??null,
    true_solar:saju?.true_solar??null,
    dayun:Array.isArray(saju?.dayun)?saju.dayun.slice(0,5):[],
    annual:Array.isArray(saju?.annual)?saju.annual:[],
    monthly:Array.isArray(saju?.monthly)?saju.monthly:[],
    pillar_boundary_policy:saju?.pillar_boundary_policy??null,
    yun_policy:saju?.yun_policy??null,
    not_calculated:Array.isArray(saju?.not_calculated)?saju.not_calculated.slice(0,8):[],
  };
}

function compactThai(thai:any){
  if(!thai)return null;
  return {
    engine:thai?.engine,thai_day:thai?.thai_day,birth_planet:thai?.birth_planet??null,ruler:thai?.ruler,rule:thai?.rule??null,
    mahathaksa:thai?.mahathaksa?{available:thai.mahathaksa.available,method:thai.mahathaksa.method,evidence_id:thai.mahathaksa.evidence_id}:null,
    taksajorn:thai?.taksajorn?{available:thai.taksajorn.available,segments:(thai.taksajorn.segments??[]).map((x:any)=>({start:x.start,end:x.end,annual_boriwan:x.annual_boriwan,landed_center:x.landed_center,evidence_id:x.evidence_id}))}:null,
    suriyayat:thai?.suriyayat?{available:thai.suriyayat.available,lagna:thai.suriyayat.lagna?{available:thai.suriyayat.lagna.available,display:thai.suriyayat.lagna.display,interpretation_scope:thai.suriyayat.lagna.interpretation_scope}:null,interpretation_status:thai.suriyayat.interpretation_status}:null,
    predictive_status:thai?.predictive_status,consensus_policy:thai?.consensus_policy,reliability:thai?.reliability??null,not_calculated:Array.isArray(thai?.not_calculated)?thai.not_calculated.slice(0,8):[],
  };
}


function iso(v:any){return String(v??"").match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0]??"";}
function refs(v:any){return Array.isArray(v)?v.map(String).filter(Boolean):[];}
function rowCovers(row:any,date:string){if(!date)return false;const d=iso(row?.date);if(d===date)return true;const start=iso(row?.start),end=iso(row?.end);return Boolean(start&&end&&start<=date&&date<=end);}
function kdTopics(kd:any){if(Array.isArray(kd?.topics))return kd.topics.map(String);if(kd?.topics&&typeof kd.topics==="object")return Object.keys(kd.topics);return [];}
function ensureMinText(value:any,min:number,fallback:string){const base=String(value??"").trim();if(base.length>=min)return base;return `${base}${base?" ":""}${fallback}`.trim();}

function sanitizeInvestmentGuidance(data:any,map:Map<string,any>){
  const tradingPattern=/(매수|매도|매매|현금화|수익\s*정리|자산\s*실현|신규\s*(?:투자|진입)|투자\s*보류|보유\s*유지|레버리지)/;
  const linkedTopics=(node:any)=>uniq([
    ...(Array.isArray(node?.topics)?node.topics.map(String):[]),
    ...refs(node?.evidence_refs).map(ref=>String(map.get(ref)?.topic??"")).filter(Boolean),
  ]);
  const investmentLinked=(node:any)=>linkedTopics(node).some(topic=>INVESTMENT_TOPICS.has(topic));
  const safeAction="점성 상대지수는 매매 신호가 아니므로 실제 가격·거래량·밸류에이션·손익 기준과 본인 리스크 한도를 확인해.";
  const safeAvoid="이 날짜나 상대지수만으로 매수·매도·보유·현금화 여부를 정하지 마.";
  const safeWatch="실제 시장 데이터와 사전에 정한 손익·리스크 기준이 충족되는지 확인해.";
  const addNoTradeTiming=(value:any)=>{const base=String(value??"").trim();if(!base||/매매 (?:신호|적기)|매매시점|시장 가격방향/.test(base))return base;return `${base} 이 상대지수는 시장 가격방향이나 매매 적기를 뜻하지 않아.`;};
  const sanitizeNode=(node:any)=>{
    if(!node||typeof node!=="object")return node;
    const text=[node?.action,node?.avoid,node?.reason,node?.summary,node?.label].map(x=>String(x??"")).join(" ");
    if(investmentLinked(node)){
      node.action=safeAction;
      node.avoid=safeAvoid;
      if("watch" in node)node.watch=safeWatch;
      if(typeof node.summary==="string")node.summary=addNoTradeTiming(node.summary);
      if(typeof node.reason==="string")node.reason=addNoTradeTiming(node.reason);
      return node;
    }
    if(tradingPattern.test(text)){
      const topic=linkedTopics(node).find(t=>TOPICS.includes(t as any))??"금전";
      const va=topicVerb(topic);
      node.action=va.action;
      node.avoid=va.avoid;
      if("watch" in node)node.watch="실제 일정·문서·수치처럼 확인 가능한 조건을 우선 확인해.";
    }
    return node;
  };
  if(Array.isArray(data?.key_windows))data.key_windows=data.key_windows.map(sanitizeNode);
  if(Array.isArray(data?.decisions))data.decisions=data.decisions.map(sanitizeNode);
  if(data?.clusters&&typeof data.clusters==="object")data.clusters.investment="투자 관련 점수는 심리·행동의 상대활성도 참고값이야. 가격방향·수익률·매매시점을 뜻하지 않으므로 실제 시장 데이터와 손익·리스크 기준을 우선해.";
  if(Array.isArray(data?.priorities))data.priorities=uniq(data.priorities.map((value:any)=>{
    const text=String(value??"").trim();
    return tradingPattern.test(text)?"투자·금전: 실제 시장 데이터·현금흐름·손익 기준·리스크 한도 점검":text;
  }).filter(Boolean));
  if(data?.overall&&typeof data.overall==="object")for(const key of ["best_phase","caution_phase"]){
    const text=String(data.overall[key]??"").trim();
    if(text&&/(수익실현|신규진입|투자|매수|매도|현금화|자산\s*실현)/.test(text)&&!/매매시점/.test(text))data.overall[key]=`${text} · 상대활성도 참고값이며 매매시점을 뜻하지 않음`;
  }
  return data;
}

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
  const balanceCrossRefs=(values:string[])=>{const linked=uniq(values.filter(ref=>map.has(ref)));const firstFor=(system:string)=>linked.find(ref=>String(map.get(ref)?.system??"")===system);return uniq([firstFor("western"),firstFor("saju"),firstFor("thai"),...linked].filter(Boolean) as string[]).slice(0,8);};
  const enrichCross=(x:any)=>{const out={...x};const start=iso(out?.start),end=iso(out?.end)||start,t=timelineFor(start,end);let linked=valid(out?.evidence_refs);if(t)linked=uniq([...linked,...valid(t?.western_refs),...valid(t?.saju_context_refs),...valid(t?.thai_context_refs)]);if(start&&!linked.some(ref=>String(map.get(ref)?.system??"")==="western")){linked=uniq([...linked,...refsForDate(start,[]).filter(ref=>String(map.get(ref)?.system??"")==="western").slice(0,1)]);}linked=balanceCrossRefs(linked);const linkedRows=linked.map(ref=>map.get(ref)).filter(Boolean),systems=new Set(linkedRows.map((r:any)=>String(r?.system??"")));out.evidence_refs=linked;out.mode=systems.has("western")&&systems.size>=2?(out?.mode==="상반맥락"?"상반맥락":"복수체계"):"Western단독";const western=linkedRows.filter((r:any)=>r?.system==="western").map((r:any)=>String(r?.text??"")).filter(Boolean).slice(0,2).join(" "),saju=linkedRows.filter((r:any)=>r?.system==="saju").map((r:any)=>String(r?.text??"")).filter(Boolean).slice(0,2).join(" "),thai=linkedRows.filter((r:any)=>r?.system==="thai").map((r:any)=>String(r?.text??"")).filter(Boolean).slice(0,2).join(" ");out.western=ensureMinText(western?out?.western:"",25,western||"Western 계산은 해당 시기의 상대활성도 변화를 직접 추적해.");out.saju=saju?ensureMinText(out?.saju,25,`${saju} 사주는 Western 점수에 합산하지 않고 독립 맥락으로만 참고해.`):"";out.thai=thai?ensureMinText(out?.thai,25,`${thai} Thai는 위치·기간 맥락만 독립적으로 참고해.`):"";const otherNames=[out.saju?"사주":"",out.thai?"Thai":""].filter(Boolean).join("·");out.synthesis=out.mode==="Western단독"?"다른 체계의 독립 근거가 충분하지 않아 Western 직접 계산을 중심으로 보고, 실제 변화가 나타나는지 확인해.":out.mode==="상반맥락"?`Western 직접 시기 근거와 ${otherNames||"비Western"}의 독립 맥락이 같은 기간에 서로 다르게 나타나는지 비교해. 서로 점수나 인과를 합산하지 말고 실제 관찰에서 어느 맥락이 더 두드러지는지만 확인해.`:`Western 직접 시기 근거와 ${otherNames||"비Western"}의 독립 맥락이 같은 기간에 함께 나타나는지 비교해. 서로 점수나 인과를 합산하지 말고 실제 변화가 각 체계의 맥락과 동시에 관찰되는지만 확인해.`;return out;};
  data.cross_checks=(Array.isArray(data?.cross_checks)?data.cross_checks:[]).map(enrichCross);
  if(kind==="annual"){const usedCrossDates=new Set(data.cross_checks.map((x:any)=>iso(x?.start)).filter(Boolean));const candidates=[...timeline,...(Array.isArray(payload?.key_dates)?payload.key_dates:[])];for(const t of candidates){if(data.cross_checks.length>=3)break;const date=iso(t?.date);if(!date||usedCrossDates.has(date))continue;let linked=uniq([...valid(t?.western_refs),...valid(t?.saju_context_refs),...valid(t?.thai_context_refs)]);if(!linked.length)linked=refsForDate(date,kdTopics(t)).slice(0,4);if(!linked.length)continue;const linkedRows=linked.map(ref=>map.get(ref)).filter(Boolean),systems=new Set(linkedRows.map((r:any)=>String(r?.system??"")));data.cross_checks.push(enrichCross({label:`${date} 체계 교차확인`,start:date,end:date,mode:systems.has("western")&&systems.size>=2?"복수체계":"Western단독",western:"",saju:"",thai:"",synthesis:"",evidence_refs:linked}));usedCrossDates.add(date);}}
  if(kind==="annual"){data.year_phases=Array.isArray(data?.year_phases)?data.year_phases:[];const months=Array.isArray(payload?.western?.months)?payload.western.months:[];for(let q=data.year_phases.length;q<4&&months.length;q++){const startIndex=Math.min(months.length-1,Math.floor(q*months.length/4)),endIndex=Math.min(months.length-1,Math.floor((q+1)*months.length/4)-1),first=months[startIndex],last=months[Math.max(startIndex,endIndex)],start=iso(first?.start)||`${String(first?.calendar_month??"")}-01`.slice(0,10),end=iso(last?.end)||start,topic=String(coreTopics[q%Math.max(1,coreTopics.length)]?.topic??TOPICS[q%TOPICS.length]);let linked=rows.filter((row:any)=>String(row?.id??"").startsWith("W:month:")&&rowCovers(row,start)&&String(row?.topic??"")===topic).map((row:any)=>String(row.id));if(!linked.length)linked=refsForDate(start,[topic]);data.year_phases.push({label:`연간 흐름 ${q+1}`,start,end,theme:`${topic} 흐름을 중심으로 보는 구간`,change:String(coreTopics[q%Math.max(1,coreTopics.length)]?.reason??`${topic} 기간 변화가 두드러지는 구간이야.`),evidence_refs:linked.slice(0,4)});}data.year_phases=data.year_phases.map((p:any)=>{const out={...p};let linked=valid(out?.evidence_refs);if(!linked.length)linked=refsForDate(iso(out?.start),[]);out.evidence_refs=linked.slice(0,5);return out;});}
  const relationshipSalient=important.some((x:any)=>["연애","연락","재회"].includes(String(x.topic)));
  if(relationshipSalient){
    const relTopicSet=new Set(["수신신호","발신적합","과거인연접점","연애","연락","재회"]);
    const relRows=rows.filter((row:any)=>relTopicSet.has(String(row?.topic??"")));
    data.relationship_reading=data?.relationship_reading&&typeof data.relationship_reading==="object"?data.relationship_reading:{};
    const rr=data.relationship_reading;
    let linked=valid(rr?.evidence_refs);
    linked=uniq([...linked,...relRows.sort((a:any,b:any)=>rowPriority(a)-rowPriority(b)).map((row:any)=>String(row.id))]).slice(0,10);
    rr.evidence_refs=linked;

    const sig=payload?.western?.relationship_signals??{};
    const tone=(v:number)=>v>=60?"강한 편":v<40?"약한 편":"중간권";
    const relEvidenceDates=(key:string)=>new Set(relRows.filter((row:any)=>String(row?.topic??"")===key).map((row:any)=>iso(row?.date)).filter(Boolean));
    const backedStatDate=(key:string,stat:any,field:"best_days"|"caution_days")=>{
      const allowed=relEvidenceDates(key);
      const row=(Array.isArray(stat?.[field])?stat[field]:[]).find((item:any)=>allowed.has(String(item?.date??"").slice(0,10)));
      return row?.date?String(row.date).slice(0,10):"";
    };
    const axes=[
      {key:"수신신호",label:"상대 → 나",avg:num(sig?.수신신호?.average),best:backedStatDate("수신신호",sig?.수신신호,"best_days"),caution:backedStatDate("수신신호",sig?.수신신호,"caution_days")},
      {key:"발신적합",label:"나 → 상대",avg:num(sig?.발신적합?.average),best:backedStatDate("발신적합",sig?.발신적합,"best_days"),caution:backedStatDate("발신적합",sig?.발신적합,"caution_days")},
      {key:"과거인연접점",label:"과거 인연 재접점",avg:num(sig?.과거인연접점?.average),best:backedStatDate("과거인연접점",sig?.과거인연접점,"best_days"),caution:backedStatDate("과거인연접점",sig?.과거인연접점,"caution_days")},
    ];
    const ranked=[...axes].sort((a,b)=>b.avg-a.avg);
    const gap=Math.abs((ranked[0]?.avg??0)-(ranked[ranked.length-1]?.avg??0));
    const compare=gap<4
      ? `세 방향의 평균 차이가 ${scoreText(gap)}점으로 크지 않아 한 방향만 앞세우기보다 실제 반응을 함께 확인하는 편이 좋아.`
      : `${ranked[0]?.label??"관계"} 축이 ${ranked[ranked.length-1]?.label??"다른 관계"} 축보다 ${scoreText(gap)}점 높아, 이번 기간에는 세 방향의 활성도가 같은 강도로 움직이지 않아.`;
    rr.context=`관계 계산은 상대 → 나 ${scoreText(axes[0].avg)}점, 나 → 상대 ${scoreText(axes[1].avg)}점, 과거 인연 재접점 ${scoreText(axes[2].avg)}점을 서로 다른 축으로 분리해 읽어.`;
    rr.flow=`${compare} 상대 → 나, 나 → 상대, 재접점은 의미가 서로 다르므로 한 축의 상승을 다른 축의 결과로 옮겨 읽지 마.`;
    const timingParts=axes.filter((a:any)=>a.best).map((a:any)=>`${a.label} ${a.best}`);
    rr.focus_timing=timingParts.length?`${timingParts.join(" · ")}. 각 날짜는 해당 방향의 직접 계산상 두드러지는 시기이며 관계 결과 자체를 뜻하지 않아.`:"직접 관계 날짜 근거가 있는 구간에서 실제 답변·약속·만남 제안이 뒤따르는지 확인해.";
    const timingDirectRefs=axes.flatMap((axis:any)=>[axis.best,axis.caution].filter(Boolean).flatMap((date:string)=>relRows.filter((row:any)=>iso(row?.date)===date).map((row:any)=>String(row.id))));
    linked=uniq([...timingDirectRefs,...linked]);
    rr.evidence_refs=linked.slice(0,10);
    rr.watch=ensureMinText(rr?.watch,20,"실제 연락 빈도, 답변의 구체성, 약속 제안, 대화 지속처럼 관찰 가능한 신호가 각 방향의 계산과 함께 움직이는지 확인해.");
    rr.avoid=ensureMinText(rr?.avoid,20,"상대활성도 점수만으로 상대의 속마음이나 연애·재회 결과를 미리 확정하지 마.");

    const axisText=(axis:any,meaning:string)=>{
      const peak=axis.best?`${axis.best} 전후가 이 방향의 직접 계산상 두드러지는 시기야.`:"직접 최고일 근거가 충분하지 않아.";
      const low=axis.caution&&axis.caution!==axis.best?` ${axis.caution} 전후는 상대적으로 낮은 구간이야.`:"";
      return `${axis.label} 축은 기간 평균 ${scoreText(axis.avg)}점(${tone(axis.avg)})이야. ${peak}${low} ${meaning}`;
    };
    data.contact_flow={
      incoming:axisText(axes[0],"이 축은 상대가 실제로 보이는 반응을 확인하는 용도라서 답변·먼저 온 연락·구체적 만남 제안과 함께 봐."),
      outgoing:axisText(axes[1],"이 축은 내가 먼저 연락하거나 제안할 때의 상대적 적합도를 보는 값이지, 상대가 받아준다는 뜻은 아니야."),
      reconnection:axisText(axes[2],"이 축은 과거 인연의 재접점 활성도를 보는 값이지, 재회나 관계 재성립을 확정하지 않아."),
    };
  }
  const investmentSalient=important.some((x:any)=>INVESTMENT_TOPICS.has(String(x.topic)));
  if(investmentSalient){
    data.investment_reading=data?.investment_reading&&typeof data.investment_reading==="object"?data.investment_reading:{};
    const ir=data.investment_reading,overall=payload?.western?.overall??{};
    ir.psychology=`투자심리 상대활성도 평균 ${scoreText(overall?.투자심리?.average)}점이야. 심리적 과열·위축을 점검하는 보조지표이며 시장 가격 방향 예측은 아니야.`;
    ir.realization=`수익실현 상대활성도 평균 ${scoreText(overall?.수익실현?.average)}점이야. 실제 수익 가능성이나 매도 적기를 뜻하지 않으므로 보유 종목의 시장 데이터와 손익 기준을 우선해.`;
    ir.entry=`신규진입 상대활성도 평균 ${scoreText(overall?.신규진입?.average)}점이야. 매수 신호가 아니며 실제 밸류에이션·가격·거래량과 본인 위험 한도를 먼저 확인해.`;
    ir.risk=`투자주의 상대활성도 평균 ${scoreText(overall?.투자주의?.average)}점이야. 높을수록 판단 오류와 변동성 대응을 더 보수적으로 점검하되 실제 투자 결정은 시장 데이터가 우선이야.`;
  }
  return softenObject(sanitizeInvestmentGuidance(data,map));
}

export function buildLocalQualityFallbackCore(payload:any){
  const topics=buildDeterministicTopicAnalysis(payload);
  const important=topics.filter((x:any)=>x.importance!=="참고");
  const core=topics.filter((x:any)=>x.importance==="핵심");
  const names=(core.length?core:important).slice(0,3).map((x:any)=>String(x.topic));
  const periodStart=String(payload?.period?.start??"");
  const periodEnd=String(payload?.period?.end??"");
  const periodLabel=periodStart&&periodEnd&&periodStart!==periodEnd?`${periodStart}~${periodEnd}`:periodStart||"선택 기간";
  const focus=names.length?names.join(" · "):"핵심 분야";
  const topicLine=(wanted:string[])=>{
    const rows=topics.filter((x:any)=>wanted.includes(String(x.topic))).filter((x:any)=>x.importance!=="참고").slice(0,3);
    return rows.length?rows.map((x:any)=>`${x.topic}: ${x.verdict}`).join(" "):"이번 기간에 해당 분야가 최우선으로 두드러진다는 직접 근거는 강하지 않아.";
  };
  const sajuText=payload?.saju?.day_master
    ? `사주는 일간 ${String(payload.saju.day_master)}과 실제 계산된 세운·월운 구간만 Western과 합산하지 않고 독립 맥락으로 참고해.`
    : "사주는 실제 계산된 구간이 있을 때만 Western과 합산하지 않고 독립 맥락으로 참고해.";
  const thaiText=payload?.thai?.thai_day
    ? `Thai는 ${String(payload.thai.thai_day)} 출생요일과 실제 계산된 Mahathaksa·Taksajorn·Suriyayat 범위만 독립 맥락으로 참고해.`
    : "Thai는 실제 계산된 범위만 독립 맥락으로 참고해.";
  return {
    headline:`${periodLabel}은 ${focus} 흐름을 계산근거 중심으로 확인하는 기간이야.`,
    overall:{
      summary:"",
      dominant_pattern:`${focus}의 상대활성도 변화가 이번 기간의 우선 확인 대상이야. 한 날짜나 점수 하나를 사건 결과로 바꾸지 않고 기간 평균·직접 날짜 근거·실제 반응을 함께 봐.`,
      best_phase:"직접 계산근거가 연결된 상위 날짜·구간에서 실제 일정과 반응이 함께 좋아지는지 확인해.",
      caution_phase:"하위 날짜·구간에서는 체감만으로 결론을 확대하지 말고 실제 일정·반응·수치를 다시 확인해.",
      evidence_refs:[],
    },
    key_windows:[],
    year_phases:[],
    cross_checks:[],
    decisions:[],
    clusters:{
      relationship:topicLine(["대인관계","연애","연락","재회"]),
      work_study:topicLine(["학업","시험","직장","이직"]),
      money_news:topicLine(["금전","소식"]),
      investment:"투자 관련 상대지수는 심리·행동의 참고값이야. 가격방향·수익률·매수·매도 시점을 뜻하지 않으며 실제 시장 데이터와 손익·리스크 기준을 우선해.",
      condition:topicLine(["컨디션"]),
    },
    relationship_reading:{
      context:"관계가 중요 분야일 때 상대 → 나, 나 → 상대, 과거 인연 재접점을 서로 다른 축으로 분리해 확인해.",
      flow:"한 방향의 상대활성도가 올라가도 다른 방향의 결과까지 자동으로 뜻하지 않아. 실제 연락·답변·약속·만남 제안이 뒤따르는지 확인해.",
      focus_timing:"직접 관계 날짜 근거가 연결된 구간만 주목하고, 실제 반응이 함께 나타나는지 확인해.",
      watch:"실제 연락 빈도, 답변의 구체성, 약속 이행, 만남 제안처럼 관찰 가능한 신호를 확인해.",
      avoid:"상대활성도만으로 상대의 속마음이나 연애·재회 결과를 미리 확정하지 마.",
      evidence_refs:[],
    },
    contact_flow:{
      incoming:"상대 → 나는 실제로 먼저 온 연락·답변·구체적 제안이 나타나는지 확인하는 방향축이야.",
      outgoing:"나 → 상대는 내가 먼저 연락하거나 제안할 때의 상대적 적합도이지 상대의 수락을 뜻하지 않아.",
      reconnection:"과거 인연 재접점은 과거 인연이 다시 접촉할 상대적 활성도이지 재회 확정이 아니야.",
    },
    investment_reading:{
      psychology:"투자심리 상대활성도는 과열·위축을 점검하는 보조지표이며 시장 가격 방향 예측이 아니야.",
      realization:"수익실현 상대활성도는 실제 수익 가능성이나 매도 적기를 뜻하지 않아. 시장 데이터와 사전 손익 기준을 우선해.",
      entry:"신규진입 상대활성도는 매수 신호가 아니야. 밸류에이션·가격·거래량과 본인 위험 한도를 먼저 확인해.",
      risk:"투자주의 상대활성도는 판단 오류와 변동성 대응을 더 보수적으로 점검하는 참고값이야.",
    },
    systems:{
      western:"Western 계산은 기간 평균·일별 궤적·직접 날짜 근거의 상대활성도 변화를 중심으로 읽어. 점수는 사건 확률이 아니야.",
      saju:sajuText,
      thai:thaiText,
    },
    priorities:[],
    topic_analysis:topics,
    limits:"Gemini 유료 호출이 끝난 뒤에도 5단계 품질검증을 완전히 통과하지 못한 경우 계산근거만으로 만든 안전 보정본이야. 구조·근거 추적·의미 방향·내부 일관성은 통과해야 표시하고, 깊이·실용성 일부 항목만 부족하면 결과를 숨기지 않고 보정본으로 보여줘. 사건 결과·상대 속마음·가격방향을 미리 확정하지 않아.",
  };
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
    saju:compactSaju(payload?.saju),
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
  const text=`아래는 '별빛의 운명' 계산엔진이 만든 압축 근거 패킷이야. 이 자료 밖의 사실·상대 속마음·사건 확률을 만들지 말고, 중요한 것부터 한국어로 이해하기 쉽게 해석해줘.\n\n요구사항:\n- 결론 → 핵심 흐름 → 주목 날짜/시간 → 현실에서 확인할 신호 → 피할 행동 순서로 써.\n- 점수는 사건 확률이 아니라 상대활성도야. 숫자%로 바꾸지 마.\n- 연애·연락·재회가 중요하면 상대→나, 나→상대, 과거인연 재접점을 분리하고 실제 행동으로 확인하게 해.\n- 사주·Thai는 Western 점수에 합산하지 말고 독립 맥락으로 비교해. 체계가 겹쳐도 시너지·합일·확정 표현을 쓰지 마.\n- 대길·완벽·무조건 같은 과장 표현을 쓰지 마.\n- 투자 관련 지수는 가격방향·수익률·매수매도 적기 예측으로 바꾸지 마.\n- 중요하지 않은 분야를 억지로 길게 쓰지 마.\n\nCALCULATED_DATA=${JSON.stringify(packet)}`;
  return {text,bytes,max_bytes,estimated_input_tokens};
}
