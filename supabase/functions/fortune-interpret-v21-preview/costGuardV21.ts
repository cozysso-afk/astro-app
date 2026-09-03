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
