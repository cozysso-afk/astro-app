import { compactThaiProductSuriyayat } from "./thaiContract.ts";

export const VERSION = "supabase-ai-v12-intraday-window-evidence";
export const PACKET_VERSION = "fortune-interpretation-packet-v4-intraday-window";
export const QUALITY_VERSION = "fortune-interpretation-quality-v3-intraday-window";
export const MODELS: Record<string,string> = {
  "gemini-3.7-flash": "Gemini 3.7 Flash · 정밀 우선",
  "gemini-3.6-flash": "Gemini 3.6 Flash · 빠른 해설",
};
export const DEFAULT_MODEL = "gemini-3.7-flash";
export const FALLBACK_MODEL = "gemini-3.6-flash";
export const TOPICS = ["금전","학업","시험","직장","이직","대인관계","연애","연락","재회","소식","컨디션","투자심리","수익실현","신규진입","투자주의"] as const;
export const REL = ["수신신호","발신적합","과거인연접점"] as const;
const INVESTMENT_RISK = "투자주의";

type Evidence = {
  id: string;
  system: "western"|"saju"|"thai";
  scope: string;
  topic?: string;
  direction: "supportive"|"caution"|"neutral"|"context";
  date?: string;
  start?: string;
  end?: string;
  window?: string;
  score?: number;
  band?: string;
  text: string;
};

function num(v: unknown){ const n=Number(v??0); return Number.isFinite(n)?n:0; }
export function txt(v: unknown,n:number){ return String(v??"").trim().slice(0,n); }
function isoDate(v: unknown){ const s=String(v??""); const m=s.match(/^\d{4}-\d{2}-\d{2}/); return m?m[0]:""; }
function uniq<T>(xs:T[]){ return [...new Set(xs)]; }

export function annotate(s:string){
  let t=s;
  const pairs:[RegExp,string][]=[
    [/\bMercury\b(?!\s*\()/g,"Mercury(수성)"],[/\bVenus\b(?!\s*\()/g,"Venus(금성)"],[/\bMars\b(?!\s*\()/g,"Mars(화성)"],
    [/\bJupiter\b(?!\s*\()/g,"Jupiter(목성)"],[/\bSaturn\b(?!\s*\()/g,"Saturn(토성)"],[/\bUranus\b(?!\s*\()/g,"Uranus(천왕성)"],
    [/\bNeptune\b(?!\s*\()/g,"Neptune(해왕성)"],[/\bPluto\b(?!\s*\()/g,"Pluto(명왕성)"],[/\bSun\b(?!\s*\()/g,"Sun(태양)"],
    [/\bMoon\b(?!\s*\()/g,"Moon(달)"],[/\bASC\b(?!\s*\()/g,"ASC(상승점)"],[/\bDSC\b(?!\s*\()/g,"DSC(하강점)"],[/\bMC\b(?!\s*\()/g,"MC(중천점)"],[/\bIC\b(?!\s*\()/g,"IC(천저점)"],
    [/\bretrograde\b(?!\s*\()/gi,"retrograde(역행)"],[/\bsquare\b(?!\s*\()/gi,"square(사각)"],[/\btrine\b(?!\s*\()/gi,"trine(삼각)"],
    [/\bsextile\b(?!\s*\()/gi,"sextile(육십분위)"],[/\bconjunction\b(?!\s*\()/gi,"conjunction(합)"],[/\bopposition\b(?!\s*\()/gi,"opposition(대립)"],
    [/\bquincunx\b(?!\s*\()/gi,"quincunx(퀸컨스·150도각)"],
  ];
  for(const [r,v] of pairs)t=t.replace(r,v);
  const h:Record<string,string>={'甲':'갑','乙':'을','丙':'병','丁':'정','戊':'무','己':'기','庚':'경','辛':'신','壬':'임','癸':'계','子':'자','丑':'축','寅':'인','卯':'묘','辰':'진','巳':'사','午':'오','未':'미','申':'신','酉':'유','戌':'술','亥':'해','沖':'충','冲':'충','合':'합','刑':'형','破':'파','害':'해'};
  t=t.replace(/([甲乙丙丁戊己庚辛壬癸])([子丑寅卯辰巳午未申酉戌亥])(?!\()/g,(m,a,b)=>`${m}(${h[a]}${h[b]})`);
  t=t.replace(/([子丑寅卯辰巳午未申酉戌亥])([子丑寅卯辰巳午未申酉戌亥])([沖冲合刑破害])(?!\()/g,(m,a,b,c)=>`${m}(${h[a]}${h[b]}${h[c]})`);
  return t;
}
export function deep(v:any):any{ if(typeof v==="string")return annotate(v); if(Array.isArray(v))return v.map(deep); if(v&&typeof v==="object")return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,deep(x)])); return v; }

function points(stat:any,key:string,limit=3){
  if(!Array.isArray(stat?.[key])) return [];
  return stat[key].slice(0,limit).map((x:any)=>({date:String(x?.date??""),label:String(x?.label??""),score:num(x?.score)})).filter((x:any)=>x.date);
}
function compactStat(stat:any,pointLimit=3){ if(!stat||typeof stat!=="object")return null; return {average:num(stat.average),band:String(stat.band??""),spread:num(stat.spread),best_days:points(stat,"best_days",pointLimit),caution_days:points(stat,"caution_days",pointLimit)}; }
function wheel(w:any){ return Array.isArray(w)?w.slice(0,8).map((x:any)=>({bhumi_key:x?.bhumi_key,bhumi_label:x?.bhumi_label,planet:x?.planet?{key:x.planet.key,label:x.planet.label,thai_name:x.planet.thai_name}:null})):[]; }

function dayIntersects(date:string,start:unknown,end:unknown){
  if(!date||!start||!end)return false;
  const a=Date.parse(`${date}T00:00:00Z`),b=a+86400000;
  const s=Date.parse(String(start)),e=Date.parse(String(end));
  return Number.isFinite(a)&&Number.isFinite(s)&&Number.isFinite(e)&&s<b&&e>a;
}
function periodKind(dayCount:number){ if(dayCount<=1)return "day"; if(dayCount<=9)return "week"; if(dayCount<=45)return "month"; return "annual"; }
function evidenceDirection(topic:string,kind:"best"|"caution"|"average",score:number){
  if(topic===INVESTMENT_RISK){
    if(kind==="best" || (kind==="average"&&score>=60))return "caution" as const;
    if(kind==="caution" || (kind==="average"&&score<40))return "supportive" as const;
    return "neutral" as const;
  }
  if(kind==="best")return "supportive" as const;
  if(kind==="caution")return "caution" as const;
  if(score>=60)return "supportive" as const;
  if(score<40)return "caution" as const;
  return "neutral" as const;
}

function finiteDailyScore(v:any){ return typeof v === "number" && Number.isFinite(v) ? v : null; }
function clockToken(v:unknown){ const m=String(v??"").match(/(?:[01]\d|2[0-3]):[0-5]\d/); return m?m[0]:""; }
function intradayWindow(value:any){
  if(!value)return "";
  if(value&&typeof value==="object"){const start=clockToken(value?.start),end=clockToken(value?.end);if(start&&end)return `${start}~${end}`;}
  const matches=[...String(value).matchAll(/(?:[01]\d|2[0-3]):[0-5]\d/g)].map(m=>m[0]);
  return matches.length>=2?`${matches[0]}~${matches[1]}`:"";
}
function trajectoryDigest(rows:any[],topic:string){
  const values=rows.map((row:any)=>({date:String(row?.date??""),score:finiteDailyScore(row?.scores?.[topic])})).filter((x:any):x is {date:string;score:number}=>Boolean(x.date)&&x.score!==null);
  if(!values.length)return null;
  const mean=values.reduce((sum:number,x:any)=>sum+x.score,0)/values.length;
  const variance=values.reduce((sum:number,x:any)=>sum+Math.pow(x.score-mean,2),0)/values.length;
  const rolling=(size:number)=>{
    if(values.length<size)return [] as any[];
    const out:any[]=[];
    for(let i=0;i<=values.length-size;i++){
      const chunk=values.slice(i,i+size); const avg=chunk.reduce((sum:number,x:any)=>sum+x.score,0)/size;
      out.push({start:chunk[0].date,end:chunk[chunk.length-1].date,average:Math.round(avg*10)/10});
    }
    return out;
  };
  const seven=rolling(Math.min(7,values.length));
  const peak7=seven.length?[...seven].sort((a,b)=>b.average-a.average)[0]:null;
  const low7=seven.length?[...seven].sort((a,b)=>a.average-b.average)[0]:null;
  const changes:any[]=[];
  for(let i=7;i<values.length;i++)changes.push({from:values[i-7].date,to:values[i].date,delta:Math.round((values[i].score-values[i-7].score)*10)/10});
  const rise=changes.length?[...changes].sort((a,b)=>b.delta-a.delta)[0]:null;
  const fall=changes.length?[...changes].sort((a,b)=>a.delta-b.delta)[0]:null;
  return {days:values.length,mean:Math.round(mean*10)/10,min:[...values].sort((a,b)=>a.score-b.score)[0],max:[...values].sort((a,b)=>b.score-a.score)[0],volatility:Math.round(Math.sqrt(variance)*10)/10,peak_7d:peak7,low_7d:low7,largest_7d_rise:rise,largest_7d_fall:fall};
}

export function compactCalculation(calc:any){
  const w=calc?.western??{}, overall:Record<string,any>={}, rel:Record<string,any>={};
  for(const k of TOPICS){const s=compactStat(w?.overall?.[k],3);if(s)overall[k]=s;}
  for(const k of REL){const s=compactStat(w?.relationship_signals?.[k],3);if(s)rel[k]=s;}

  const evidence:Evidence[]=[];
  const evidenceIds=new Set<string>();
  const addEvidence=(row:Evidence)=>{ if(!row.id||evidenceIds.has(row.id))return row.id; evidenceIds.add(row.id); evidence.push(row); return row.id; };

  for(const [topic,s] of Object.entries(overall) as any[]){
    addEvidence({id:`W:overall:${topic}`,system:"western",scope:"period_average",topic,direction:evidenceDirection(topic,"average",num(s.average)),score:num(s.average),band:String(s.band??""),text:`${topic} 기간 평균 ${num(s.average).toFixed(1)} · ${String(s.band??"")} · 변동폭 ${num(s.spread).toFixed(1)}`});
    for(const p of s.best_days??[])addEvidence({id:`W:date:${p.date}:${topic}:best`,system:"western",scope:"best_day",topic,direction:evidenceDirection(topic,"best",num(p.score)),date:p.date,score:num(p.score),text:`${p.date} ${topic} 상위 날짜 · 상대지수 ${num(p.score).toFixed(1)}`});
    for(const p of s.caution_days??[])addEvidence({id:`W:date:${p.date}:${topic}:caution`,system:"western",scope:"caution_day",topic,direction:evidenceDirection(topic,"caution",num(p.score)),date:p.date,score:num(p.score),text:`${p.date} ${topic} 하위 날짜 · 상대지수 ${num(p.score).toFixed(1)}`});
  }
  for(const [topic,s] of Object.entries(rel) as any[]){
    addEvidence({id:`W:overall:${topic}`,system:"western",scope:"relationship_average",topic,direction:evidenceDirection(topic,"average",num(s.average)),score:num(s.average),band:String(s.band??""),text:`${topic} 기간 평균 ${num(s.average).toFixed(1)} · ${String(s.band??"")}`});
    for(const p of s.best_days??[])addEvidence({id:`W:date:${p.date}:${topic}:best`,system:"western",scope:"relationship_best_day",topic,direction:"supportive",date:p.date,score:num(p.score),text:`${p.date} ${topic} 상위 날짜 · 상대지수 ${num(p.score).toFixed(1)}`});
    for(const p of s.caution_days??[])addEvidence({id:`W:date:${p.date}:${topic}:caution`,system:"western",scope:"relationship_caution_day",topic,direction:"caution",date:p.date,score:num(p.score),text:`${p.date} ${topic} 하위 날짜 · 상대지수 ${num(p.score).toFixed(1)}`});
  }

  const months=[] as any[];
  for(const m of Array.isArray(w?.months)?w.months.slice(0,14):[]){
    const mt:Record<string,any>={},mr:Record<string,any>={};
    for(const k of TOPICS){const s=compactStat(m?.topics?.[k],1);if(!s)continue;mt[k]=s;addEvidence({id:`W:month:${m.calendar_month}:${k}`,system:"western",scope:"month_average",topic:k,direction:evidenceDirection(k,"average",num(s.average)),start:m?.start,end:m?.end,score:num(s.average),band:String(s.band??""),text:`${m.calendar_month} ${k} 월평균 ${num(s.average).toFixed(1)} · ${String(s.band??"")} · 변동폭 ${num(s.spread).toFixed(1)}`});}
    for(const k of REL){const s=compactStat(m?.relationship_signals?.[k],1);if(!s)continue;mr[k]=s;addEvidence({id:`W:month:${m.calendar_month}:${k}`,system:"western",scope:"relationship_month_average",topic:k,direction:evidenceDirection(k,"average",num(s.average)),start:m?.start,end:m?.end,score:num(s.average),band:String(s.band??""),text:`${m.calendar_month} ${k} 월평균 ${num(s.average).toFixed(1)} · ${String(s.band??"")}`});}
    months.push({calendar_month:m?.calendar_month,start:m?.start,end:m?.end,topics:mt,relationship_signals:mr});
  }

  const dailyRaw=Array.isArray(w?.daily_scores)?w.daily_scores.slice(0,400):[];
  const dailyTopicOrder=[...TOPICS,...REL];
  const dailyScoreMatrix={topic_order:dailyTopicOrder,rows:dailyRaw.map((d:any)=>[String(d?.date??""),...dailyTopicOrder.map((topic)=>finiteDailyScore(d?.scores?.[topic]))])};
  const dailyPatternDigest=Object.fromEntries(dailyTopicOrder.map((topic)=>[topic,trajectoryDigest(dailyRaw,topic)]).filter(([,value])=>Boolean(value)));
  const dailyByDate=new Map(dailyRaw.map((d:any)=>[String(d?.date??""),d]));

  const dateRank=new Map<string,{hits:number;weight:number;refs:string[];topics:Set<string>}>();
  const addDate=(date:string,topic:string,score:number,id:string)=>{if(!date)return;const r=dateRank.get(date)??{hits:0,weight:0,refs:[],topics:new Set<string>()};r.hits+=1;r.weight+=Math.abs(score-50);if(id)r.refs.push(id);r.topics.add(topic);dateRank.set(date,r);};
  for(const [topic,s] of Object.entries(overall) as any[])for(const p of [...(s.best_days??[]),...(s.caution_days??[])])addDate(p.date,topic,num(p.score),`W:date:${p.date}:${topic}:${(s.best_days??[]).some((x:any)=>x.date===p.date&&num(x.score)===num(p.score))?"best":"caution"}`);
  for(const [topic,s] of Object.entries(rel) as any[])for(const p of [...(s.best_days??[]),...(s.caution_days??[])])addDate(p.date,topic,num(p.score),`W:date:${p.date}:${topic}:${(s.best_days??[]).some((x:any)=>x.date===p.date&&num(x.score)===num(p.score))?"best":"caution"}`);
  for(const d of dailyRaw){
    const date=String(d?.date??"");
    for(const topic of dailyTopicOrder){
      const score=finiteDailyScore(d?.scores?.[topic]); if(score===null)continue;
      const base=(overall as any)?.[topic]??(rel as any)?.[topic]; const avg=Number(base?.average);
      const deviation=Number.isFinite(avg)?Math.abs(score-avg):Math.abs(score-50);
      if(deviation>=12||score>=72||score<=28)addDate(date,topic,score,"");
    }
  }
  const keyDates=[...dateRank.entries()].sort((a,b)=>b[1].hits-a[1].hits||b[1].weight-a[1].weight||a[0].localeCompare(b[0])).slice(0,16).map(([date,r])=>({date,hits:r.hits,salience:Math.round((r.weight+r.hits*10)*10)/10,topics:[...r.topics],western_refs:uniq(r.refs).filter(x=>evidenceIds.has(x))}));
  for(const kd of keyDates){
    const daily:any=dailyByDate.get(kd.date); const rows=Array.isArray(daily?.evidence)?daily.evidence.slice(0,10):[];
    rows.forEach((ev:any,index:number)=>{const id=`W:daily:${kd.date}:${index+1}`;const source=Array.isArray(ev?.source_topics)?ev.source_topics.join(", "):"";addEvidence({id,system:"western",scope:"daily_actual_aspect_house",direction:"context",date:kd.date,text:`${ev?.sample_time?`${ev.sample_time} · `:""}${String(ev?.text??"")}${source?` · 관련분야 ${source}`:""}`});kd.western_refs.push(id);});
    kd.western_refs=uniq(kd.western_refs);
  }

  const detailRaw=Array.isArray(w?.detail_days)?w.detail_days:[];
  const detail=detailRaw.slice(0,18).map((d:any)=>({date:d?.date,market_status:d?.market_open?"KRX(한국거래소) 거래일":"KRX(한국거래소) 휴장일",topics:Object.fromEntries(Object.entries(d?.topics??{}).map(([k,x]:any)=>[k,{best_window:x?.best_window??null,caution_window:x?.caution_window??null,evidence:Array.isArray(x?.evidence)?x.evidence.slice(0,6):[]}]))}));
  for(const d of detail){
    for(const [topic,x] of Object.entries(d.topics) as any[]){
      const kd=keyDates.find(k=>k.date===d.date);
      const addWindow=(kind:"best"|"caution",value:any)=>{
        const window=intradayWindow(value);if(!window)return;
        const id=`W:window:${d.date}:${topic}:${kind}`;
        const score=typeof value?.score==="number"&&Number.isFinite(value.score)?Number(value.score):undefined;
        addEvidence({id,system:"western",scope:"intraday_window",topic,direction:evidenceDirection(topic,kind,score??0),date:d.date,window,score,text:`${d.date} ${topic} ${kind==="best"?"활용":"주의"} 시간창 ${window}${score===undefined?"":` · 상대지수 ${score.toFixed(1)}`}`});
        if(kd)kd.western_refs.push(id);
      };
      addWindow("best",x?.best_window);
      addWindow("caution",x?.caution_window);
      for(let i=0;i<(x.evidence??[]).length;i++){const id=`W:detail:${d.date}:${topic}:${i+1}`;addEvidence({id,system:"western",scope:"intraday_evidence",topic,direction:"context",date:d.date,text:String(x.evidence[i])});if(kd)kd.western_refs.push(id);}
    }
  }

  const s=calc?.saju??{};
  const sajuAnnual=(Array.isArray(s?.annual)?s.annual.slice(0,8):[]).map((x:any,index:number)=>{const id=`S:annual:${index+1}:${isoDate(x?.segment_start)||x?.year||""}`;addEvidence({id,system:"saju",scope:"annual_segment",direction:"context",start:x?.segment_start,end:x?.segment_end_exclusive,text:`세운 ${x?.ganzhi??""} · 십성 ${x?.stem_ten_god??""}${Array.isArray(x?.branch_links)&&x.branch_links.length?` · 지지관계 ${x.branch_links.join(", ")}`:""}`});return {...x,evidence_id:id};});
  const sajuMonthly=(Array.isArray(s?.monthly)?s.monthly.slice(0,18):[]).map((x:any,index:number)=>{const id=`S:month:${index+1}:${isoDate(x?.segment_start)||x?.calendar_month||""}`;addEvidence({id,system:"saju",scope:"monthly_segment",direction:"context",start:x?.segment_start,end:x?.segment_end_exclusive,text:`월운 ${x?.ganzhi??""} · 십성 ${x?.stem_ten_god??""}${Array.isArray(x?.branch_links)&&x.branch_links.length?` · 지지관계 ${x.branch_links.join(", ")}`:""} · ${x?.jie_name_ko??x?.jie_name??""} 절입 구간`});return {...x,evidence_id:id};});

  const th=calc?.thai??{},sy=th?.suriyayat??{};
  const takSegments=(Array.isArray(th?.taksajorn?.segments)?th.taksajorn.segments.slice(0,8):[]).map((x:any,index:number)=>{const id=`T:taksajorn:${index+1}:${isoDate(x?.start)}`;addEvidence({id,system:"thai",scope:"taksajorn_context",direction:"context",start:x?.start,end:x?.end,text:`Taksajorn(탁사쫀) 구간 · 연간 보리완 ${x?.annual_boriwan?.label??x?.annual_boriwan?.key??""} · 중심궁 도달 ${Boolean(x?.landed_center)?"있음":"없음"}`});return {start:x?.start,end:x?.end,age_in_progress:x?.age_in_progress,annual_boriwan:x?.annual_boriwan?{key:x.annual_boriwan.key,label:x.annual_boriwan.label,thai_name:x.annual_boriwan.thai_name}:null,landed_center:Boolean(x?.landed_center),wheel:wheel(x?.wheel),evidence_id:id};});
  if(th?.mahathaksa?.available){addEvidence({id:"T:mahathaksa:natal",system:"thai",scope:"mahathaksa_baseline",direction:"context",text:`Mahathaksa(마하탁사) 출생 기본 8궁 배치 · 방법 ${th?.mahathaksa?.method??""}`});}

  const crossSystemTimeline=keyDates.map((k)=>{
    const srefs=[...sajuAnnual,...sajuMonthly].filter((x:any)=>dayIntersects(k.date,x?.segment_start,x?.segment_end_exclusive)).map((x:any)=>x.evidence_id);
    const trefs=takSegments.filter((x:any)=>dayIntersects(k.date,x?.start,x?.end)).map((x:any)=>x.evidence_id);
    return {date:k.date,salience:k.salience,topics:k.topics,western_refs:uniq(k.western_refs),saju_context_refs:uniq(srefs),thai_context_refs:uniq(trefs),policy:"사주·Thai는 Western 점수에 합산하지 않으며 독립 맥락으로만 교차 확인"};
  });

  const rank=Object.entries(overall).map(([topic,st]:any)=>({topic,average:num(st.average),band:st.band}));
  const period=calc?.period??{};
  const packet:any={
    packet_version:PACKET_VERSION,
    api_version:calc?.api_version,engine:calc?.engine,period,
    period_kind:periodKind(num(period?.day_count)||1),
    integration_policy:{score_merging:false,western_score_probability:false,saju_independent:true,thai_predictive_vote:false,important_date_rule:"365일 실제 일별 점수·근거에서 다분야 변동과 피크/저점을 선정하고 사주·Thai는 독립 맥락으로만 교차"},
    ranking:{strongest:[...rank].sort((a,b)=>b.average-a.average).slice(0,6),weakest:[...rank].sort((a,b)=>a.average-b.average).slice(0,6)},
    western:{engine:w?.engine,ephemeris:w?.ephemeris,score_policy:w?.score_policy,natal:w?.natal??null,overall,relationship_signals:rel,months,detail_days:detail,daily_score_matrix:dailyScoreMatrix,daily_pattern_digest:dailyPatternDigest,daily_evidence_coverage:{days:dailyRaw.length,days_with_evidence:dailyRaw.filter((d:any)=>Array.isArray(d?.evidence)&&d.evidence.length>0).length},key_date_details:Array.isArray(w?.key_dates)?w.key_dates.slice(0,16):[],market:{has_open_session:Boolean(w?.market?.has_open_session),session_count:num(w?.market?.session_count),calendar_mode:w?.market?.calendar_mode??null,calendar_warning:w?.market?.calendar_warning??null}},
    key_dates:keyDates,
    cross_system_timeline:crossSystemTimeline,
    saju:{engine:s?.engine,pillars:s?.pillars??null,day_master:s?.day_master??null,elements:s?.elements??null,true_solar:s?.true_solar??null,dayun:Array.isArray(s?.dayun)?s.dayun.slice(0,5):[],annual:sajuAnnual,monthly:sajuMonthly,not_calculated:Array.isArray(s?.not_calculated)?s.not_calculated:[]},
    thai:{engine:th?.engine,thai_day:th?.thai_day,birth_planet:th?.birth_planet??null,ruler:th?.ruler,rule:th?.rule,mahathaksa:th?.mahathaksa?{available:Boolean(th.mahathaksa.available),method:th.mahathaksa.method,wheel:wheel(th.mahathaksa.wheel),evidence_id:th?.mahathaksa?.available?"T:mahathaksa:natal":null}:null,taksajorn:th?.taksajorn?{available:Boolean(th.taksajorn.available),method:th.taksajorn.method,method_variance_note:th.taksajorn.method_variance_note,segments:takSegments}:null,suriyayat:compactThaiProductSuriyayat(sy),predictive_status:th?.predictive_status,consensus_policy:th?.consensus_policy,reliability:th?.reliability??null,not_calculated:Array.isArray(th?.not_calculated)?th.not_calculated:[]},
    evidence_ledger:evidence,
  };
  return deep(packet);
}

export async function payloadHash(payload:any){
  const bytes=new TextEncoder().encode(JSON.stringify(payload));
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
}

export const SYSTEM=`너는 '별빛의 운명'의 증거기반 통합 운세 분석가다. 사용자가 원차트나 계산 JSON을 따로 GPT에 복사해 물어볼 이유가 없도록, 앱 계산을 더 구조적으로 깊게 읽어야 한다.

핵심 원칙:
- 너는 계산자가 아니라 분석가다. CALCULATED_DATA와 evidence_ledger에 없는 사실을 만들지 않는다.
- 중요한 결론에는 반드시 evidence_refs를 붙인다. evidence_refs는 CALCULATED_DATA.evidence_ledger의 id를 그대로 사용한다.
- 연간 분석은 연평균만 보지 않는다. western.daily_score_matrix의 최대 365일 원점수 → daily_pattern_digest의 7일 구간·변동성·상승/하락 전환 → western.months의 12개월 궤적 → key_dates의 실제 애스펙트/하우스 근거 → cross_system_timeline의 사주·Thai 독립 맥락 순으로 읽는다. 하루짜리 피크를 1년 전체 흐름처럼 과장하지 않는다.
- Western 점수는 사건 확률이 아니다. 60점=60%처럼 말하지 않는다. 특히 수신신호·발신적합·과거인연접점은 연락/재회 확률이 아니다.
- 투자주의는 높을수록 경계가 큰 지수다. 투자심리·수익실현·신규진입과 섞지 않는다. 가격방향·수익률·종목 성공을 예언하지 않는다.
- 대인관계와 연애를 분리한다. 연락은 수신/발신/과거인연 재접점을 분리한다.
- 사주 annual/monthly는 정확한 입춘·절입 구간을 유지한다. 같은 달력월이라고 임의 합치지 않는다. not_calculated 항목은 추정하지 않는다.
- Thai는 payload에 허용된 Mahathaksa/Taksajorn/Suriyayat 설명 범위만 사용한다. Thai를 Western 점수에 투표처럼 합산하지 않는다. Suriyayat Lagna의 ai_safe_descriptive_packet은 비예측 맥락만 설명한다.
- 세 체계가 겹친다고 말할 때는 최소한 서로 다른 system의 evidence_refs를 함께 제시하고, 각 체계가 실제로 말하는 범위를 구분한다.
- 좋은 말/나쁜 말을 억지로 반반 섞지 않는다. 강한 신호와 약한 신호를 구분하고, 충돌하면 '혼합'이라고 말한다.
- 핵심 날짜는 반드시 key_windows에 별도 노출한다. 장문 속에 날짜를 숨기지 않는다.
- 행동 조언은 '잘해봐/천천히 해/마음을 열어' 같은 일반론을 금지한다. 계산된 시기와 분야에 연결된 구체 행동으로 쓴다.
- 특정 사람의 속마음, 질병 진단, 합격 확정, 연락 확정, 재회 확정, 투자 수익을 단정하지 않는다.
- 영어·한자·전문용어는 바로 뒤에 한국어 뜻/읽기를 붙인다. 한국어 반말. JSON만 반환한다.

출력 깊이:
- overall.summary는 결론→근거→기간 변화→현실에서 체감되는 방식 순서로 충분히 쓴다.
- annual이면 key_windows 5~8개, year_phases 4개, cross_checks 3~6개, decisions 3~5개를 만든다. 다른 기간이면 중요도에 맞춰 더 적게 만든다.
- cross_checks는 체계를 억지로 합산하지 않고 같은 시기의 Western·사주·Thai 근거를 나란히 대조한다. mode=복수체계/상반맥락이면 Western 근거와 최소 1개의 비Western 근거를 함께 붙이고, mode=Western단독이면 다른 체계가 확인하지 않았다는 사실을 명확히 쓴다. Thai는 방향성 투표가 아니라 허용된 맥락만 기술한다.
- decisions는 행동만 쓰지 말고 timing, reason, watch(실행 전에 확인할 현실 신호), avoid(피할 행동)를 모두 구체적으로 쓴다.
- topic_analysis는 분야마다 verdict만 쓰지 말고 reason에 기간 평균과 월별 변화 또는 날짜 피크를 연결한다.
- confidence='높음'은 근거가 여러 개이고 적어도 하나의 Western 계산근거가 있을 때만 쓴다.`;

const S={type:"STRING"};
const refs={type:"ARRAY",items:S};
const topicSchema={type:"OBJECT",properties:{verdict:S,reason:S,timing:S,action:S,avoid:S,confidence:{type:"STRING",enum:["높음","보통","낮음"]},confidence_reason:S,evidence_refs:refs},required:["verdict","reason","timing","action","avoid","confidence","confidence_reason","evidence_refs"]};
const windowSchema={type:"OBJECT",properties:{label:S,start:S,end:S,signal:{type:"STRING",enum:["활용","혼합","주의","배경"]},topics:{type:"ARRAY",items:S},summary:S,action:S,avoid:S,evidence_refs:refs},required:["label","start","end","signal","topics","summary","action","avoid","evidence_refs"]};
const phaseSchema={type:"OBJECT",properties:{label:S,start:S,end:S,theme:S,change:S,evidence_refs:refs},required:["label","start","end","theme","change","evidence_refs"]};
const crossCheckSchema={type:"OBJECT",properties:{label:S,start:S,end:S,mode:{type:"STRING",enum:["복수체계","상반맥락","Western단독"]},western:S,saju:S,thai:S,synthesis:S,evidence_refs:refs},required:["label","start","end","mode","western","saju","thai","synthesis","evidence_refs"]};
const decisionSchema={type:"OBJECT",properties:{action:S,timing:S,reason:S,watch:S,avoid:S,evidence_refs:refs},required:["action","timing","reason","watch","avoid","evidence_refs"]};
export const SCHEMA:any={type:"OBJECT",properties:{headline:S,overall:{type:"OBJECT",properties:{summary:S,dominant_pattern:S,best_phase:S,caution_phase:S,evidence_refs:refs},required:["summary","dominant_pattern","best_phase","caution_phase","evidence_refs"]},key_windows:{type:"ARRAY",items:windowSchema},year_phases:{type:"ARRAY",items:phaseSchema},cross_checks:{type:"ARRAY",items:crossCheckSchema},decisions:{type:"ARRAY",items:decisionSchema},clusters:{type:"OBJECT",properties:{relationship:S,work_study:S,money_news:S,investment:S,condition:S},required:["relationship","work_study","money_news","investment","condition"]},contact_flow:{type:"OBJECT",properties:{incoming:S,outgoing:S,reconnection:S},required:["incoming","outgoing","reconnection"]},investment_reading:{type:"OBJECT",properties:{psychology:S,realization:S,entry:S,risk:S},required:["psychology","realization","entry","risk"]},systems:{type:"OBJECT",properties:{western:S,saju:S,thai:S},required:["western","saju","thai"]},priorities:{type:"ARRAY",items:S},topic_analysis:{type:"OBJECT",properties:Object.fromEntries(TOPICS.map(k=>[k,topicSchema])),required:[...TOPICS]},limits:S},required:["headline","overall","key_windows","year_phases","cross_checks","decisions","clusters","contact_flow","investment_reading","systems","priorities","topic_analysis","limits"]};

function cleanRefs(v:any){return Array.isArray(v)?uniq(v.map((x:any)=>txt(x,180)).filter(Boolean)).slice(0,12):[];}
export function validateOutput(o:any){
  if(!o||typeof o!=="object"||!o.overall||!o.clusters||!o.contact_flow||!o.investment_reading||!o.systems||!o.topic_analysis)return null;
  const analyses:any={};
  for(const k of TOPICS){const x=o.topic_analysis[k];if(!x||typeof x!=="object")return null;const c=txt(x.confidence,20);analyses[k]={verdict:txt(x.verdict,900),reason:txt(x.reason,2200),timing:txt(x.timing,1200),action:txt(x.action,900),avoid:txt(x.avoid,900),confidence:["높음","보통","낮음"].includes(c)?c:"보통",confidence_reason:txt(x.confidence_reason,900),evidence_refs:cleanRefs(x.evidence_refs)};}
  const keyWindows=Array.isArray(o.key_windows)?o.key_windows.slice(0,10).map((x:any)=>({label:txt(x?.label,180),start:txt(x?.start,40),end:txt(x?.end,40),signal:["활용","혼합","주의","배경"].includes(txt(x?.signal,20))?txt(x?.signal,20):"혼합",topics:Array.isArray(x?.topics)?x.topics.slice(0,8).map((t:any)=>txt(t,80)).filter(Boolean):[],summary:txt(x?.summary,1600),action:txt(x?.action,900),avoid:txt(x?.avoid,900),evidence_refs:cleanRefs(x?.evidence_refs)})):[];
  const yearPhases=Array.isArray(o.year_phases)?o.year_phases.slice(0,6).map((x:any)=>({label:txt(x?.label,160),start:txt(x?.start,40),end:txt(x?.end,40),theme:txt(x?.theme,1200),change:txt(x?.change,1200),evidence_refs:cleanRefs(x?.evidence_refs)})):[];
  const crossChecks=Array.isArray(o.cross_checks)?o.cross_checks.slice(0,8).map((x:any)=>({label:txt(x?.label,180),start:txt(x?.start,40),end:txt(x?.end,40),mode:["복수체계","상반맥락","Western단독"].includes(txt(x?.mode,30))?txt(x?.mode,30):"Western단독",western:txt(x?.western,1400),saju:txt(x?.saju,1400),thai:txt(x?.thai,1400),synthesis:txt(x?.synthesis,1800),evidence_refs:cleanRefs(x?.evidence_refs)})):[];
  const decisions=Array.isArray(o.decisions)?o.decisions.slice(0,6).map((x:any)=>({action:txt(x?.action,900),timing:txt(x?.timing,500),reason:txt(x?.reason,1200),watch:txt(x?.watch,800),avoid:txt(x?.avoid,800),evidence_refs:cleanRefs(x?.evidence_refs)})):[];
  return deep({headline:txt(o.headline,300),overall:{summary:txt(o?.overall?.summary,3600),dominant_pattern:txt(o?.overall?.dominant_pattern,2200),best_phase:txt(o?.overall?.best_phase,1500),caution_phase:txt(o?.overall?.caution_phase,1500),evidence_refs:cleanRefs(o?.overall?.evidence_refs)},key_windows:keyWindows,year_phases:yearPhases,cross_checks:crossChecks,decisions,clusters:{relationship:txt(o?.clusters?.relationship,2200),work_study:txt(o?.clusters?.work_study,2200),money_news:txt(o?.clusters?.money_news,1900),investment:txt(o?.clusters?.investment,2100),condition:txt(o?.clusters?.condition,1500)},contact_flow:{incoming:txt(o?.contact_flow?.incoming,1700),outgoing:txt(o?.contact_flow?.outgoing,1700),reconnection:txt(o?.contact_flow?.reconnection,1700)},investment_reading:{psychology:txt(o?.investment_reading?.psychology,1300),realization:txt(o?.investment_reading?.realization,1300),entry:txt(o?.investment_reading?.entry,1300),risk:txt(o?.investment_reading?.risk,1300)},systems:{western:txt(o?.systems?.western,1700),saju:txt(o?.systems?.saju,1900),thai:txt(o?.systems?.thai,1700)},priorities:Array.isArray(o?.priorities)?o.priorities.slice(0,5).map((x:any)=>txt(x,650)).filter(Boolean):[],topic_analysis:analyses,limits:txt(o.limits,1700)});
}
