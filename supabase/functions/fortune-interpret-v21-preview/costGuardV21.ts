import { TOPICS, REL } from "../fortune-interpret-v6-preview/integratedInterpretationV2.ts";

const enc = new TextEncoder();
const INVESTMENT_RISK = "투자주의";
const RELATION_TOPICS = new Set(["대인관계","연애","연락","재회"]);
const INVESTMENT_TOPICS = new Set(["투자심리","수익실현","신규진입","투자주의"]);

function num(v: unknown){ const n=Number(v??0); return Number.isFinite(n)?n:0; }
function uniq<T>(xs:T[]){ return [...new Set(xs)]; }
function scoreText(v:unknown){ return Number.isFinite(Number(v)) ? Number(v).toFixed(1) : "-"; }
function pointScoreText(v:unknown){ const n=Number(v); return Number.isFinite(n)?n.toFixed(1).replace(/\.0$/,""):"-"; }
function jsonBytes(v:any){ return enc.encode(JSON.stringify(v)).byteLength; }
function periodLimit(kind:string){ return kind==="annual"?8:kind==="month"?6:kind==="week"?5:2; }
function calendarDate(v:unknown){ return String(v??"").match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0]??""; }

function isSingleDayPeriod(payload:any){
  const start=calendarDate(payload?.period?.start),end=calendarDate(payload?.period?.end);
  if(start&&end)return start===end;
  if(Number(payload?.period?.day_count)===1)return true;
  const dates=new Set<string>();
  if(start)dates.add(start);if(end)dates.add(end);
  for(const row of payload?.western?.daily_score_matrix?.rows??[]){const date=calendarDate(Array.isArray(row)?row[0]:row?.date);if(date)dates.add(date);}
  return dates.size===1;
}

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

function relatedTopicsFromEvidence(row:any){
  const match=String(row?.text??"").match(/관련분야\s+(.+)$/);
  return match?match[1].split(/[,·/]/).map((value:string)=>value.trim()).filter(Boolean):[];
}

function readableTopicEvidence(payload:any,topic:string,singleDay:boolean){
  const rows=Array.isArray(payload?.evidence_ledger)?payload.evidence_ledger:[];
  const unambiguousLinkedIds=new Set<string>();
  for(const keyDate of Array.isArray(payload?.key_dates)?payload.key_dates:[]){
    const topics=kdTopics(keyDate);
    if(topics.length!==1||topics[0]!==topic)continue;
    for(const ref of keyDate?.western_refs??[])unambiguousLinkedIds.add(String(ref));
  }
  const periodDate=calendarDate(payload?.period?.start);
  const supportsTopic=(row:any)=>{
    if(String(row?.topic??"")===topic)return true;
    const related=relatedTopicsFromEvidence(row);
    if(related.length)return related.includes(topic);
    return !row?.topic&&unambiguousLinkedIds.has(String(row?.id??""));
  };
  const aggregate=(row:any)=>/(?:period_average|month_average|best_day|caution_day|relationship_average)/.test(String(row?.scope??""));
  const priority=(row:any)=>{const scope=String(row?.scope??"");const id=String(row?.id??"");if(/intraday_evidence/.test(scope)||id.startsWith("W:detail:"))return 0;if(/daily_actual/.test(scope)||id.startsWith("W:daily:"))return 1;if(/intraday_window/.test(scope)||id.startsWith("W:window:"))return 2;if(id.startsWith("W:date:"))return 4;if(id.startsWith("W:month:"))return 5;if(id.startsWith("W:overall:"))return 6;return 3;};
  const candidates=rows.filter(supportsTopic).filter((row:any)=>{
    if(!singleDay)return true;
    const date=calendarDate(row?.date);
    if(date&&periodDate&&date!==periodDate)return false;
    return !aggregate(row);
  }).sort((a:any,b:any)=>priority(a)-priority(b));
  const summaries:string[]=[];const usedRows:any[]=[];
  for(const row of candidates){
    let detail=String(row?.text??row?.label??"")
      .replace(/\b(?:W|S|T):[^\s),;\]}]+/g,"")
      .replace(/\s*·\s*관련분야\s+.+$/,"")
      .replace(/\s{2,}/g," ").trim();
    if(singleDay&&periodDate)detail=detail.replace(new RegExp(`^${periodDate}\\s*[·:–—-]?\\s*`),"").trim();
    detail=detail.replace(/^[·,;:\s]+|[·,;:\s]+$/g,"");
    if(!detail)continue;
    if(detail.length>120)detail=`${detail.slice(0,117).trim()}…`;
    const system=String(row?.system??"")==="western"?"서양점성술":String(row?.system??"")==="saju"?"사주":String(row?.system??"")==="thai"?"태국점성술":"";
    const direction=row?.direction==="supportive"?"활성 방향":row?.direction==="caution"?"주의 방향":"";
    const date=!singleDay?calendarDate(row?.date):"";
    const summary=uniq([system,detail,date,`${topic} 연결`,direction].filter(Boolean)).join(" · ");
    if(!summary||summaries.includes(summary))continue;
    summaries.push(summary);usedRows.push(row);
    if(summaries.length>=3)break;
  }
  return {rows:usedRows,summaries};
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

function topicRealityCheck(topic:string){
  if(topic==="연애")return "이날은 호감 표현, 만남의 지속성, 관계를 구체화하는 행동이 실제로 이어지는지 확인해.";
  if(topic==="연락")return "이날은 연락 횟수보다 답변의 구체성, 대화의 지속, 다음 약속으로 이어지는지를 확인해.";
  if(topic==="재회")return "이날은 과거 인연의 실제 재접촉이나 대화 재개가 있는지를 확인하되 재회 결과로 단정하지 마.";
  if(topic==="대인관계")return "이날은 상대별 반응과 약속 이행처럼 관찰 가능한 관계 행동을 구분해서 확인해.";
  if(topic==="직장")return "이날은 업무 요청, 협의, 일정 진행처럼 실제로 확인되는 직장 흐름을 기준으로 봐.";
  if(topic==="이직")return "이날은 제안, 공고, 면담, 조건 확인처럼 구체적인 이직 움직임이 있는지를 확인해.";
  if(topic==="학업")return "이날은 집중 지속 시간과 과제 진척처럼 확인 가능한 학업 반응을 기준으로 봐.";
  if(topic==="시험")return "이날은 준비도와 실수 점검처럼 실제 시험 대응에 필요한 신호를 확인해.";
  if(topic==="금전")return "이날은 입금, 지출, 계약처럼 확인 가능한 금전 변화를 먼저 점검해.";
  if(topic==="소식")return "이날은 안내의 출처, 전달 내용, 후속 일정이 구체적인지를 확인해.";
  if(topic==="컨디션")return "이날은 수면, 회복, 일정 소화처럼 확인 가능한 몸 상태를 기준으로 봐.";
  if(INVESTMENT_TOPICS.has(topic))return "이날은 실제 가격·거래량·손익 기준을 우선하고, 이 상대지수를 매매 신호로 사용하지 마.";
  return "이날 실제로 확인되는 변화가 계산 흐름과 함께 나타나는지를 살펴봐.";
}

export function buildDeterministicTopicAnalysis(payload:any){
  const {core,watch}=topicImportance(payload);
  const singleDay=isSingleDayPeriod(payload);
  return TOPICS.map(topic=>{
    const stat=payload?.western?.overall?.[topic]??{};
    const digest=payload?.western?.daily_pattern_digest?.[topic]??{};
    const avg=num(stat?.average), spread=num(stat?.spread);
    const baseEvidence=topicEvidence(payload,topic);
    const importance=core.has(topic)?"핵심":watch.has(topic)?"주목":"참고";
    const readable=readableTopicEvidence(payload,topic,singleDay);
    const traceRows=[...readable.rows,...baseEvidence].filter((row:any,index:number,all:any[])=>String(row?.id??"")&&all.findIndex((x:any)=>String(x?.id??"")===String(row?.id??""))===index);
    const evidenceLimit=importance==="핵심"?5:importance==="주목"?3:2;
    const refs=traceRows.map((row:any)=>String(row.id)).slice(0,evidenceLimit);
    const risk=topic===INVESTMENT_RISK;
    const direction=risk?(avg>=60?"경계 압력이 상대적으로 높은 편":avg<40?"경계 압력이 상대적으로 낮은 편":"경계 압력이 중간권"):(/약|낮/.test(String(stat?.band??""))?"상대적으로 약한 편":/강|높/.test(String(stat?.band??""))?"상대적으로 강한 편":avg>=60?"상대적으로 강한 편":avg<40?"상대적으로 약한 편":"중간권");
    if(importance==="참고")return {
      topic,importance,
      verdict:`${topicSubject(topic)} ${singleDay?"이날":"이번 기간"} 우선순위로 볼 직접 근거가 상대적으로 약해.`,
      reason:readable.summaries.length?`참고 가능한 직접 근거: ${readable.summaries[0]}. 다른 분야보다 우선순위는 낮게 봐.`:"직접 연결된 세부 계산근거가 제한적이라 핵심 판단에는 사용하지 않아.",
      timing:"",action:"",avoid:"",confidence:"낮음",
      confidence_reason:"핵심 판단이 아닌 제한된 근거만 확인해 확신도를 낮게 두었어.",
      evidence_refs:refs,
    };
    const min=digest?.min, max=digest?.max;
    const backedDateSet=new Set(baseEvidence.flatMap((row:any)=>[row?.date,row?.start,row?.end]).map((value:any)=>String(value??"").slice(0,10)).filter((value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)));
    const reasonParts:string[]=[];
    if(readable.summaries.length)reasonParts.push(`직접 근거: ${readable.summaries.join("; ")}.`);
    else reasonParts.push("점수와 연결해 설명할 세부 계산근거가 충분하지 않아 사건 의미를 덧붙이지 않아.");
    if(singleDay)reasonParts.push(topicRealityCheck(topic));
    else{
      reasonParts.push(`${topic} 기간 평균은 ${scoreText(avg)}점${stat?.band?`(${String(stat.band)})`:""}이고 변동폭은 ${scoreText(spread)}점이라 ${direction}이야.`);
      if(min?.date&&max?.date&&backedDateSet.has(String(min.date).slice(0,10))&&backedDateSet.has(String(max.date).slice(0,10)))reasonParts.push(`직접 근거가 연결된 일별 궤적은 ${min.date} ${scoreText(min.score)}점에서 ${max.date} ${scoreText(max.score)}점 사이를 움직였고 변동성은 ${scoreText(digest?.volatility)}점이야.`);
      else reasonParts.push(`일별 변동성은 ${scoreText(digest?.volatility)}점이며, 날짜를 특정할 때는 계산근거에 직접 연결된 날짜만 사용해.`);
      reasonParts.push(topicRealityCheck(topic).replace(/^이날은/,"현실에서는"));
    }
    const timing=singleDay?"":bestTopicDate(payload,topic);
    if(timing)reasonParts.push(`판단할 때는 ${timing} 전후의 직접 계산근거와 기간 평균을 함께 보는 게 좋아.`);
    const va=topicVerb(topic);
    const confidence=readable.rows.length>=2&&refs.length>=3?"높음":readable.rows.length>=1?"보통":"낮음";
    return {
      topic,importance,
      verdict:singleDay?`${topicSubject(topic)} 이날 활성도가 ${pointScoreText(avg)}점으로 ${direction}이야.`:`${topicSubject(topic)} 이번 기간에서 ${direction}으로 읽혀.`,
      reason:reasonParts.join(" "),
      timing,
      action:va.action,
      avoid:va.avoid,
      confidence,
      confidence_reason:singleDay
        ? readable.summaries.length?`이날 계산에 연결된 근거 ${refs.length}개 중 읽을 수 있는 세부 근거 ${readable.summaries.length}개를 확인했어. 확신도는 사건 가능성이 아니라 근거 연결의 선명도야.`:"세부 계산근거를 내용으로 확인할 수 없어 확신도를 낮게 두었어."
        : `직접 연결된 계산 근거 ${refs.length}개와 여러 날짜의 통계를 함께 확인했어. 확신도는 사건 가능성이 아니라 근거 연결의 선명도야.`,
      evidence_refs:refs,
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
  const singleDay=isSingleDayPeriod(payload);
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
  const evidenceSentence=(values:string[])=>values.map(ref=>map.get(ref)).filter((row:any)=>!singleDay||!/(?:period_average|month_average|relationship_average)/.test(String(row?.scope??""))).map((row:any)=>String(row?.text??"").trim()).filter(Boolean).slice(0,2).join(" ");
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
  const makeWindow=(kd:any)=>{const date=iso(kd?.date);const topics=kdTopics(kd);let linked=valid(kd?.western_refs);linked=uniq([...linked,...refsForDate(date,topics).slice(0,4)]);if(linked.length<2)linked=uniq([...linked,...overallRefs(topics).slice(0,2-linked.length)]);const topic=firstTopic(topics.length?topics:topicsFromRefs(linked)),verb=topicVerb(topic),ev=evidenceSentence(linked);return enrichWindow({label:`${date} ${topic} 주목 구간`,start:date,end:date,signal:directionSignal(linked),topics:topics.length?topics:[topic],summary:`${ev||`${topic} 직접 계산근거가 잡힌 날짜야.`} 이 날짜 자체를 사건 보장으로 보지 말고 ${singleDay?"이날의 실제 반응과":"전후의 실제 변화와"} 함께 확인해.`,action:verb.action,avoid:verb.avoid,evidence_refs:linked});};
  data.key_windows=(Array.isArray(data?.key_windows)?data.key_windows:[]).map(enrichWindow);
  const usedWindowDates=new Set(data.key_windows.flatMap((w:any)=>[iso(w?.start),iso(w?.end)]).filter(Boolean));
  for(const kd of Array.isArray(payload?.key_dates)?payload.key_dates:[]){if(data.key_windows.length>=minimumWindows)break;const date=iso(kd?.date);if(!date||usedWindowDates.has(date))continue;const built=makeWindow(kd);if(!built.evidence_refs.length)continue;data.key_windows.push(built);usedWindowDates.add(date);}
  const windowRefs=new Set<string>(data.key_windows.flatMap((w:any)=>refs(w?.evidence_refs)));
  data.decisions=Array.isArray(data?.decisions)?data.decisions:[];
  data.decisions=data.decisions.map((d:any,index:number)=>{const out={...d};let linked=valid(out?.evidence_refs);const timingDate=iso(out?.timing);let target=data.key_windows.find((w:any)=>timingDate&&iso(w?.start)<=timingDate&&timingDate<=iso(w?.end));if(!target)target=data.key_windows.find((w:any)=>refs(w?.evidence_refs).some((ref:string)=>linked.includes(ref)))??data.key_windows[index%Math.max(1,data.key_windows.length)];if(target&&!linked.some(ref=>windowRefs.has(ref)))linked=uniq([...linked,...refs(target?.evidence_refs).slice(0,1)]);const topic=firstTopic(target?windowTopics(target):[]),verb=topicVerb(topic);out.evidence_refs=linked.slice(0,5);out.action=ensureMinText(out?.action,12,verb.action);out.timing=String(out?.timing??"").trim()||(target?(iso(target.start)===iso(target.end)?iso(target.start):`${iso(target.start)} ~ ${iso(target.end)}`):String(payload?.period?.start??""));out.reason=ensureMinText(out?.reason,24,target?.summary??`${topic} 계산근거와 직접 연결한 행동 가이드야.`);out.watch=ensureMinText(out?.watch,14,"실제 답변·일정·수치처럼 확인 가능한 변화를 먼저 확인해.");out.avoid=ensureMinText(out?.avoid,14,verb.avoid);return out;});
  for(let i=data.decisions.length;i<minimumDecisions&&i<data.key_windows.length;i++){const w=data.key_windows[i],topic=firstTopic(windowTopics(w)),verb=topicVerb(topic);data.decisions.push({action:verb.action,timing:iso(w.start)===iso(w.end)?iso(w.start):`${iso(w.start)} ~ ${iso(w.end)}`,reason:w.summary,watch:"실제 답변·일정·수치처럼 확인 가능한 변화가 계산 흐름과 맞는지 확인해.",avoid:verb.avoid,evidence_refs:refs(w.evidence_refs).slice(0,3)});}
  data.priorities=Array.isArray(data?.priorities)?data.priorities.map(String).filter(Boolean):[];for(const row of [...coreTopics,...important]){if(data.priorities.length>=minimumPriorities)break;const text=`${row.topic}: ${row.action}`;if(!data.priorities.includes(text))data.priorities.push(text);}
  data.overall=data?.overall&&typeof data.overall==="object"?data.overall:{};let overallEvidence=valid(data.overall.evidence_refs);overallEvidence=uniq([...overallEvidence,...data.key_windows.flatMap((w:any)=>refs(w?.evidence_refs)),...coreTopics.flatMap((x:any)=>refs(x?.evidence_refs))]).filter(ref=>map.has(ref));data.overall.evidence_refs=overallEvidence.slice(0,8);const minSummary=kind==="annual"?240:kind==="month"?170:110;const groundedAppend=coreTopics.slice(0,3).map((x:any)=>[String(x.verdict??""),String(x.action??""),x.timing?`확인할 시기는 ${String(x.timing)}이야.`:""].filter(Boolean).join(" ")).filter(Boolean).join(" ");data.overall.summary=ensureMinText(data.overall.summary,minSummary,`${groundedAppend} 이 점수들은 사건 확률이 아니라 ${singleDay?"이날의":"기간 내"} 상대활성도이므로 실제 일정·반응·수치와 대조해서 판단해.`);
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
      ? `세 방향의 ${singleDay?"점수":"평균"} 차이가 ${scoreText(gap)}점으로 크지 않아 한 방향만 앞세우기보다 실제 반응을 함께 확인하는 편이 좋아.`
      : `${ranked[0]?.label??"관계"} 축이 ${ranked[ranked.length-1]?.label??"다른 관계"} 축보다 ${scoreText(gap)}점 높아, ${singleDay?"이날은":"이번 기간에는"} 세 방향의 활성도가 같은 강도로 움직이지 않아.`;
    rr.context=`관계 계산은 상대 → 나 ${scoreText(axes[0].avg)}점, 나 → 상대 ${scoreText(axes[1].avg)}점, 과거 인연 재접점 ${scoreText(axes[2].avg)}점을 서로 다른 축으로 분리해 읽어.`;
    rr.flow=`${compare} 상대 → 나, 나 → 상대, 재접점은 의미가 서로 다르므로 한 축의 상승을 다른 축의 결과로 옮겨 읽지 마.`;
    const timingParts=axes.filter((a:any)=>a.best).map((a:any)=>`${a.label} ${a.best}`);
    rr.focus_timing=timingParts.length?(singleDay?"선택한 날에 세 방향의 직접 계산근거가 연결돼 있어. 실제 답변·약속·만남 제안이 뒤따르는지 확인해.":`${timingParts.join(" · ")}. 각 날짜는 해당 방향의 직접 계산상 두드러지는 시기이며 관계 결과 자체를 뜻하지 않아.`):`${singleDay?"이날":"직접 관계 날짜 근거가 있는 구간에서"} 실제 답변·약속·만남 제안이 뒤따르는지 확인해.`;
    const timingDirectRefs=axes.flatMap((axis:any)=>[axis.best,axis.caution].filter(Boolean).flatMap((date:string)=>relRows.filter((row:any)=>iso(row?.date)===date).map((row:any)=>String(row.id))));
    linked=uniq([...timingDirectRefs,...linked]);
    rr.evidence_refs=linked.slice(0,10);
    rr.watch=ensureMinText(rr?.watch,20,"실제 연락 빈도, 답변의 구체성, 약속 제안, 대화 지속처럼 관찰 가능한 신호가 각 방향의 계산과 함께 움직이는지 확인해.");
    rr.avoid=ensureMinText(rr?.avoid,20,"상대활성도 점수만으로 상대의 속마음이나 연애·재회 결과를 미리 확정하지 마.");

    const axisText=(axis:any,meaning:string)=>{
      if(singleDay)return `${axis.label} 축은 이날 ${pointScoreText(axis.avg)}점(${tone(axis.avg)})이야. ${axis.best?"선택한 날의 직접 계산근거가 연결돼 있어.":"직접 세부 근거가 충분하지 않아."} ${meaning}`;
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
    const metric=(topic:string)=>singleDay?`이날 ${pointScoreText(overall?.[topic]?.average)}점`:`기간 평균 ${scoreText(overall?.[topic]?.average)}점`;
    ir.psychology=`투자심리 상대활성도는 ${metric("투자심리")}이야. 심리적 과열·위축을 점검하는 보조지표이며 시장 가격 방향 예측은 아니야.`;
    ir.realization=`수익실현 상대활성도는 ${metric("수익실현")}이야. 실제 수익 가능성이나 매도 적기를 뜻하지 않으므로 보유 종목의 시장 데이터와 손익 기준을 우선해.`;
    ir.entry=`신규진입 상대활성도는 ${metric("신규진입")}이야. 매수 신호가 아니며 실제 밸류에이션·가격·거래량과 본인 위험 한도를 먼저 확인해.`;
    ir.risk=`투자주의 상대활성도는 ${metric("투자주의")}이야. 높을수록 판단 오류와 변동성 대응을 더 보수적으로 점검하되 실제 투자 결정은 시장 데이터가 우선이야.`;
  }
  return softenObject(sanitizeInvestmentGuidance(data,map));
}

export function buildLocalQualityFallbackCore(payload:any){
  const topics=buildDeterministicTopicAnalysis(payload);
  const singleDay=isSingleDayPeriod(payload);
  const important=topics.filter((x:any)=>x.importance!=="참고");
  const core=topics.filter((x:any)=>x.importance==="핵심");
  const names=(core.length?core:important).slice(0,3).map((x:any)=>String(x.topic));
  const periodStart=String(payload?.period?.start??"");
  const periodEnd=String(payload?.period?.end??"");
  const periodLabel=periodStart&&periodEnd&&periodStart!==periodEnd?`${periodStart}~${periodEnd}`:periodStart||"선택 기간";
  const focus=names.length?names.join(" · "):"핵심 분야";
  const summaryRows=(core.length?core:important).slice(0,3);
  const dayLead=summaryRows[0];
  const daySummary=dayLead?`${dayLead.verdict} ${dayLead.reason}${summaryRows.length>1?` 함께 볼 분야는 ${summaryRows.slice(1).map((row:any)=>row.topic).join(" · ")}야.`:""} 점수는 사건 가능성이 아니라 이날의 상대활성도야.`:"선택한 날은 직접 계산근거와 실제 반응을 함께 확인해.";
  const localPriorities=(core.length?core:important).slice(0,payload?.period_kind==="annual"?3:2).map((row:any)=>`${row.topic}: ${row.action}`).filter((value:string)=>!value.endsWith(": "));
  const topicLine=(wanted:string[])=>{
    const rows=topics.filter((x:any)=>wanted.includes(String(x.topic))).filter((x:any)=>x.importance!=="참고").slice(0,3);
    return rows.length?rows.map((x:any)=>`${x.topic}: ${x.verdict}`).join(" "):`${singleDay?"이날은":"이번 기간에는"} 해당 분야를 우선순위로 볼 직접 근거가 강하지 않아.`;
  };
  const sajuText=payload?.saju?.day_master
    ? `사주는 일간 ${String(payload.saju.day_master)}과 실제 계산된 세운·월운 구간만 Western과 합산하지 않고 독립 맥락으로 참고해.`
    : "사주는 실제 계산된 구간이 있을 때만 Western과 합산하지 않고 독립 맥락으로 참고해.";
  const thaiText=payload?.thai?.thai_day
    ? `Thai는 ${String(payload.thai.thai_day)} 출생요일과 실제 계산된 Mahathaksa·Taksajorn·Suriyayat 범위만 독립 맥락으로 참고해.`
    : "Thai는 실제 계산된 범위만 독립 맥락으로 참고해.";
  const topicMap=Object.fromEntries(topics.map(({topic,...row}:any)=>[topic,row]));
  return {
    headline:singleDay?`${periodLabel} ${focus} 흐름을 계산근거 중심으로 확인하는 날이야.`:`${periodLabel}은 ${focus} 흐름을 계산근거 중심으로 확인하는 기간이야.`,
    overall:{
      summary:singleDay?daySummary:"",
      dominant_pattern:singleDay?`${focus}의 이날 상대활성도가 우선 확인 대상이야. 점수 하나를 사건 결과로 바꾸지 않고 직접 계산근거와 실제 반응을 함께 봐.`:`${focus}의 상대활성도 변화가 이번 기간의 우선 확인 대상이야. 한 날짜나 점수 하나를 사건 결과로 바꾸지 않고 기간 평균·직접 날짜 근거·실제 반응을 함께 봐.`,
      best_phase:singleDay?"":"직접 계산근거가 연결된 상위 날짜·구간에서 실제 일정과 반응이 함께 좋아지는지 확인해.",
      caution_phase:singleDay?"":"하위 날짜·구간에서는 체감만으로 결론을 확대하지 말고 실제 일정·반응·수치를 다시 확인해.",
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
      flow:singleDay?"한 방향의 상대활성도가 높아도 다른 방향의 결과까지 자동으로 뜻하지 않아. 실제 연락·답변·약속·만남 제안이 있는지 확인해.":"한 방향의 상대활성도가 올라가도 다른 방향의 결과까지 자동으로 뜻하지 않아. 실제 연락·답변·약속·만남 제안이 뒤따르는지 확인해.",
      focus_timing:singleDay?"선택한 날의 직접 관계 근거와 실제 연락·답변·약속이 함께 나타나는지 확인해.":"직접 관계 날짜 근거가 연결된 구간만 주목하고, 실제 반응이 함께 나타나는지 확인해.",
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
      western:singleDay?"Western 계산은 선택한 날의 점수와 직접 연결된 계산근거를 중심으로 읽어. 점수는 사건 확률이 아니야.":"Western 계산은 기간 평균·일별 궤적·직접 날짜 근거의 상대활성도 변화를 중심으로 읽어. 점수는 사건 확률이 아니야.",
      saju:sajuText,
      thai:thaiText,
    },
    priorities:localPriorities,
    topic_analysis:topicMap,
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
function instructions(kind: string) {
  const outlines: Record<string, string> = {
  "day": "[오늘 한눈에] 2~4문장\n[가장 활용하기 좋은 흐름] 1~2개\n[가장 조심할 흐름] 1~2개\n[중요 분야 심층해설] 상위 2~3개: 결론·왜 그런지·현실 발현·행동·주의\n[시간대] 실제 intraday 근거가 있고 precision이 허용할 때만\n[관계/연락] 중요할 때만 수신/발신 분리",
  "week": "[이번 주 전체 흐름]\n[초반 → 중반 → 후반] 실제 daily data 변화가 있을 때만\n[밀어볼 분야]\n[속도를 낮출 분야]\n[중요 날짜]\n[핵심 분야 심층해설]\n일간 해설 7개를 붙이지 말고 주간의 전환과 강약을 종합한다.",
  "month": "[이번 달 큰 흐름]\n[초반 / 중반 / 후반] 실제 변화가 있을 때만\n[가장 좋은 구간]\n[주의할 구간]\n[분야별 핵심 변화]\n[중요 날짜]\n[이번 달 현실적 우선순위]\n한 문장으로 끝내지 말고 월간 진행, 꾸준한 분야와 변하는 분야를 구분한다.",
  "annual": "[올해 큰 흐름]\n[주요 phase] 실제 monthly data에 있는 월별 흐름만 사용\n[강한 시기]\n[주의 시기]\n[학업/직업] [관계] [금전] [컨디션]\n[올해 우선순위]\n중립 분야는 짧게, 실제 변동과 근거가 큰 분야는 길게. 일간 문구에 올해만 끼워 넣지 않는다."
}
  return `[EXTERNAL_AI_PROMPT_V2 · 별빛의 운명]
너는 아래 CALCULATED_DATA만을 근거로 읽는 숙련된 점성술·운세 분석가다.
단순 요약하지 말고 기간 전체의 강약과 여러 근거의 상호작용을 실제 상담 수준으로 한국어로 충분히 설명하라.
계산 권위는 별빛의 운명 엔진에 있다. 외부 LLM은 해석자이며 두 번째 계산기가 아니다.
[자료의 한계]
1. 데이터 밖의 행성 위치·애스펙트·사건·상대 속마음·확률을 만들지 않는다.
2. 행성·하우스·사주를 다시 계산하거나 점수를 임의 수정하지 않는다. 미계산 사주·Thai 항목도 추정하지 않는다.
3. score는 사건 확률이 아니라 선택 기간 내부의 상대적 활성도다. 점수를 % 가능성으로 바꾸지 않는다.
4. 출생시간·precision·layer_policy의 제외 조건을 최우선으로 따른다. 빠진 Moon·각도·하우스·진행·정확한 시간대를 복원하지 않는다.
[종합하는 방법]
5. 계산 방향 → 실제 점성학 근거 → 여러 근거의 결합/충돌 → 현실 발현 → 과해석의 한계 → 행동/관찰 → 주의 순서로 연결하라.
6. 행성·evidence 목록만 나열하지 말고 어떤 작용이 같은 방향으로 겹치거나 서로 긴장하는지 종합하라.
7. ranking, 중립에서의 점수 거리, importance, evidence 밀도, daily_pattern_digest, 변동성, key_dates/windows를 함께 본다.
8. 좋은 흐름과 주의 흐름을 각각 고른다. 매우 낮은 점수도 중요한 주의 주제다. 연애·관계에 자동 우선권을 주지 않는다.
9. 중요한 분야는 결론 2~4문장, 근거 2~4문장, 현실 해석 1~3문장, 주의 1~2문장을 목표로 한다.
10. 근거가 적으면 분량을 채우지 말고 “점수 방향은 보이지만 구체적인 점성 근거가 적어 여기서 더 단정하지 않겠다”고 밝혀라.
11. 실제 데이터에 있는 날짜·시간만 쓴다. 하루에는 기간 평균·제로 변동폭·같은 점수 범위·주간 추세를 설명하지 않는다.
[관계와 체계]
12. 연애·연락·재회가 중요할 때만 크게 다룬다. 연락은 수신(상대→나)과 발신(나→상대)을 반드시 별도로 해설한다.
13. 과거 인연 재접촉과 실제 관계 회복을 구분한다. 한 방향의 흐름으로 다른 방향이나 상대 감정을 대신 설명하지 않는다.
14. Western / 사주 / Thai는 독립된 체계다. 점수를 합산하지 않는다. 실제 연결 근거가 있는 같은 시기의 유사한 맥락만 비교한다.
15. 충돌하면 충돌 자체를 설명한다. “세 체계가 완벽히 일치”, “운명 확정”, “삼박자”, “강력한 시너지 확정”을 쓰지 않는다.
[투자와 문체]
16. 투자 활성도는 가격 방향·상승/하락 확률·수익률·매수 적기·매도 적기가 아니다. 투자주의 고점은 높은 주의 강도다.
17. 투자 해석은 심리·판단 강도·위험 관리·계획 준수·시장 데이터 확인으로 제한한다.
18. 자연스러운 상담형 한국어의 연결된 문단으로 쓴다. 전문용어는 뜻을 풀고 행성의 의미는 살린다.
19. 한줄 카드 나열·의미 없는 장황함·같은 결론과 “~편이야/~봐” 반복·evidence ID·JSON 필드명 낭독을 피한다.
20. 사용자가 계산 JSON을 읽지 않아도 왜 이런 흐름인지 이해할 수 있게 하라.
[기간별 해설 구조]
${outlines[kind === 'year' ? 'annual' : kind] ?? outlines.annual}`
}
  const text = instructions(String(packet.period_kind ?? "annual")) + `\n\nCALCULATED_DATA=${JSON.stringify(packet)}`;
  return {text,bytes,max_bytes,estimated_input_tokens};
}
