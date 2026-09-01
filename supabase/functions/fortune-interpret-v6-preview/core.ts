import { compactThaiProductSuriyayat } from "./thaiContract.ts";

export const VERSION = "supabase-ai-v7-thai-lagna-output-guard";
export const MODELS: Record<string,string> = {
  "gemini-3.7-flash": "Gemini 3.7 Flash · 정밀 우선",
  "gemini-3.6-flash": "Gemini 3.6 Flash · 빠른 해설",
};
export const DEFAULT_MODEL = "gemini-3.7-flash";
export const FALLBACK_MODEL = "gemini-3.6-flash";
export const TOPICS = ["금전","학업","시험","직장","이직","대인관계","연애","연락","재회","소식","컨디션","투자심리","수익실현","신규진입","투자주의"] as const;
export const REL = ["수신신호","발신적합","과거인연접점"] as const;

function num(v: unknown){ const n=Number(v??0); return Number.isFinite(n)?n:0; }
export function txt(v: unknown,n:number){ return String(v??"").trim().slice(0,n); }

export function annotate(s:string){
  let t=s;
  const pairs:[RegExp,string][]=[
    [/\bMercury\b(?!\s*\()/g,"Mercury(수성)"],[/\bVenus\b(?!\s*\()/g,"Venus(금성)"],[/\bMars\b(?!\s*\()/g,"Mars(화성)"],
    [/\bJupiter\b(?!\s*\()/g,"Jupiter(목성)"],[/\bSaturn\b(?!\s*\()/g,"Saturn(토성)"],[/\bUranus\b(?!\s*\()/g,"Uranus(천왕성)"],
    [/\bNeptune\b(?!\s*\()/g,"Neptune(해왕성)"],[/\bPluto\b(?!\s*\()/g,"Pluto(명왕성)"],[/\bSun\b(?!\s*\()/g,"Sun(태양)"],
    [/\bMoon\b(?!\s*\()/g,"Moon(달)"],[/\bASC\b(?!\s*\()/g,"ASC(상승점)"],[/\bMC\b(?!\s*\()/g,"MC(중천점)"],
    [/\bretrograde\b(?!\s*\()/gi,"retrograde(역행)"],[/\bsquare\b(?!\s*\()/gi,"square(사각)"],[/\btrine\b(?!\s*\()/gi,"trine(삼각)"],
    [/\bsextile\b(?!\s*\()/gi,"sextile(육십분위)"],[/\bconjunction\b(?!\s*\()/gi,"conjunction(합)"],[/\bopposition\b(?!\s*\()/gi,"opposition(대립)"],
  ];
  for(const [r,v] of pairs)t=t.replace(r,v);
  const h:Record<string,string>={'甲':'갑','乙':'을','丙':'병','丁':'정','戊':'무','己':'기','庚':'경','辛':'신','壬':'임','癸':'계','子':'자','丑':'축','寅':'인','卯':'묘','辰':'진','巳':'사','午':'오','未':'미','申':'신','酉':'유','戌':'술','亥':'해','沖':'충','冲':'충','合':'합','刑':'형','破':'파','害':'해'};
  t=t.replace(/([甲乙丙丁戊己庚辛壬癸])([子丑寅卯辰巳午未申酉戌亥])(?!\()/g,(m,a,b)=>`${m}(${h[a]}${h[b]})`);
  t=t.replace(/([子丑寅卯辰巳午未申酉戌亥])([子丑寅卯辰巳午未申酉戌亥])([沖冲合刑破害])(?!\()/g,(m,a,b,c)=>`${m}(${h[a]}${h[b]}${h[c]})`);
  return t;
}
export function deep(v:any):any{ if(typeof v==="string")return annotate(v); if(Array.isArray(v))return v.map(deep); if(v&&typeof v==="object")return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,deep(x)])); return v; }

function points(stat:any,key:string){
  if(!Array.isArray(stat?.[key])) return [];
  return stat[key].slice(0,5).map((x:any)=>({date:String(x?.date??""),label:String(x?.label??""),score:num(x?.score)})).filter((x:any)=>x.date);
}
function compactStat(stat:any){ if(!stat||typeof stat!=="object")return null; return {average:num(stat.average),band:String(stat.band??""),spread:num(stat.spread),best_days:points(stat,"best_days"),caution_days:points(stat,"caution_days")}; }

function wheel(w:any){
  return Array.isArray(w)?w.slice(0,8).map((x:any)=>({bhumi_key:x?.bhumi_key,bhumi_label:x?.bhumi_label,planet:x?.planet?{key:x.planet.key,label:x.planet.label,thai_name:x.planet.thai_name}:null})):[];
}
function sajuAnnual(rows:any){ return Array.isArray(rows)?rows.slice(0,6).map((x:any)=>({year:x?.year,ganzhi:x?.ganzhi,stem_ten_god:x?.stem_ten_god,branch_links:x?.branch_links??[],segment_start:x?.segment_start,segment_end_exclusive:x?.segment_end_exclusive,start_jie:x?.start_jie,start_jie_ko:x?.start_jie_ko,representative_time:x?.representative_time,boundary_note:x?.boundary_note})):[]; }
function sajuMonthly(rows:any){ return Array.isArray(rows)?rows.slice(0,16).map((x:any)=>({calendar_month:x?.calendar_month,ganzhi:x?.ganzhi,stem_ten_god:x?.stem_ten_god,branch_links:x?.branch_links??[],segment_start:x?.segment_start,segment_end_exclusive:x?.segment_end_exclusive,representative_time:x?.representative_time,jie_name:x?.jie_name,jie_name_ko:x?.jie_name_ko,next_jie:x?.next_jie,next_jie_ko:x?.next_jie_ko,boundary_note:x?.boundary_note})):[]; }
export function compactCalculation(calc:any){
  const w=calc?.western??{}, overall:Record<string,any>={}, rel:Record<string,any>={};
  for(const k of TOPICS){const s=compactStat(w?.overall?.[k]);if(s)overall[k]=s;}
  for(const k of REL){const s=compactStat(w?.relationship_signals?.[k]);if(s)rel[k]=s;}

  const refs=new Map<string,{topics:Set<string>;hits:number;weight:number}>();
  const add=(date:string,key:string,score:number)=>{if(!date)return;const r=refs.get(date)??{topics:new Set<string>(),hits:0,weight:0};r.topics.add(key);r.hits+=1;r.weight+=Math.abs(score-50);refs.set(date,r);};
  for(const [k,s] of Object.entries(overall) as any[])for(const x of [...(s?.best_days??[]),...(s?.caution_days??[])])add(String(x?.date??""),k,num(x?.score));
  for(const [k,s] of Object.entries(rel) as any[])for(const x of [...(s?.best_days??[]),...(s?.caution_days??[])])add(String(x?.date??""),k,num(x?.score));
  const rankedDates=[...refs.entries()].sort((a,b)=>b[1].hits-a[1].hits||b[1].weight-a[1].weight||a[0].localeCompare(b[0])).slice(0,18);
  const wanted=new Map(rankedDates.map(([d,r])=>[d,r.topics]));
  const raw=Array.isArray(w?.detail_days)?w.detail_days:[];
  let detail=raw.filter((d:any)=>wanted.has(String(d?.date))).map((d:any)=>{
    const keys=wanted.get(String(d?.date))??new Set<string>();
    const topics:Record<string,any>={};
    for(const k of keys){ if(!(TOPICS as readonly string[]).includes(k))continue; const x=d?.topics?.[k]; if(!x)continue; topics[k]={best_window:x.best_window??null,caution_window:x.caution_window??null,evidence:Array.isArray(x.evidence)?x.evidence.slice(0,4):[]}; }
    return {date:d?.date,market_status:d?.market_open?"KRX(한국거래소) 거래일":"KRX(한국거래소) 휴장일",topics};
  });
  if(!detail.length&&raw.length)detail=raw.slice(0,2).map((d:any)=>({date:d?.date,market_status:d?.market_open?"KRX(한국거래소) 거래일":"KRX(한국거래소) 휴장일",topics:{}}));

  const rank=Object.entries(overall).map(([topic,s]:any)=>({topic,average:num(s.average),band:s.band}));
  const s=calc?.saju??{}, th=calc?.thai??{}, sy=th?.suriyayat??{};
  const takSegments=Array.isArray(th?.taksajorn?.segments)?th.taksajorn.segments.slice(0,4).map((x:any)=>({start:x?.start,end:x?.end,age_in_progress:x?.age_in_progress,annual_boriwan:x?.annual_boriwan?{key:x.annual_boriwan.key,label:x.annual_boriwan.label,thai_name:x.annual_boriwan.thai_name}:null,landed_center:Boolean(x?.landed_center),wheel:wheel(x?.wheel)})):[];

  return deep({
    api_version:calc?.api_version,engine:calc?.engine,period:calc?.period,
    ranking:{strongest:[...rank].sort((a,b)=>b.average-a.average).slice(0,5),weakest:[...rank].sort((a,b)=>a.average-b.average).slice(0,5)},
    western:{engine:w?.engine,ephemeris:w?.ephemeris,score_policy:w?.score_policy,overall,relationship_signals:rel,detail_days:detail,market:{has_open_session:Boolean(w?.market?.has_open_session),session_count:num(w?.market?.session_count),calendar_mode:w?.market?.calendar_mode??null,calendar_warning:w?.market?.calendar_warning??null}},
    saju:{engine:s?.engine,pillars:s?.pillars??null,day_master:s?.day_master??null,elements:s?.elements??null,true_solar:s?.true_solar??null,dayun:Array.isArray(s?.dayun)?s.dayun.slice(0,4):[],annual:sajuAnnual(s?.annual),monthly:sajuMonthly(s?.monthly),not_calculated:Array.isArray(s?.not_calculated)?s.not_calculated:[]},
    thai:{engine:th?.engine,thai_day:th?.thai_day,birth_planet:th?.birth_planet??null,ruler:th?.ruler,rule:th?.rule,
      mahathaksa:th?.mahathaksa?{available:Boolean(th.mahathaksa.available),method:th.mahathaksa.method,wheel:wheel(th.mahathaksa.wheel)}:null,
      taksajorn:th?.taksajorn?{available:Boolean(th.taksajorn.available),method:th.taksajorn.method,method_variance_note:th.taksajorn.method_variance_note,segments:takSegments}:null,
      suriyayat:compactThaiProductSuriyayat(sy),
      predictive_status:th?.predictive_status,consensus_policy:th?.consensus_policy,reliability:th?.reliability??null,not_calculated:Array.isArray(th?.not_calculated)?th.not_calculated:[]},
  });
}

export async function payloadHash(payload:any){
  const bytes=new TextEncoder().encode(JSON.stringify(payload));
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
}

export const SYSTEM=`너는 '별빛의 운명'의 정밀 운세 해설자다. 입력은 계산엔진이 확정한 CALCULATED_DATA이고 너는 재계산자가 아니라 해설자다.

절대규칙:
- CALCULATED_DATA에 없는 천체 위치·애스펙트·하우스·사건·확률·상대 속마음을 만들지 않는다.
- Western(서양점성술) 점수는 사건 확률이 아니라 상대 활성도다. 60점=60%처럼 바꾸지 않는다.
- 일간은 강한 축과 약한 축의 차이를 먼저 설명하고, 주간·월간·연간은 best_days/caution_days와 detail_days의 실제 날짜·시간창을 사용한다. 없는 시간은 만들지 않는다.
- 대인관계는 일반 인간관계, 연애는 로맨스 관계로 분리한다. 연락은 수신신호(상대→나), 발신적합(나→상대), 과거인연접점(재활성)을 분리하며 실제 연락 확률로 말하지 않는다.
- 투자심리·수익실현·신규진입·투자주의는 다른 지수다. 투자주의는 높을수록 경계가 큰 값이며 가격방향·수익률을 예언하지 않는다.
- 사주 annual/monthly의 segment_start와 segment_end_exclusive는 立春(입춘)·節(절) 정확시각 경계다. 같은 달력 연도·월 표기가 반복되어도 구간이 다르면 절대로 합치지 않는다. 대표일로 월 전체를 뭉개지 않는다.
- 사주의 not_calculated에 있는 신강·신약, 용신·희신·기신 등은 임의 추정하지 않는다.
- Thai(태국점성술)의 Mahathaksa(마하탁사)·Taksajorn(탁사쫀)은 payload에 있는 8궁 배치와 실제 기간구간만 해석한다. method_variance_note가 있으면 다른 학파가 있음을 한계로 인정한다.
- Suriyayat(수리야얏) 10행성은 교차검증된 '위치 사실층'이다. 위치 변화는 사실로 설명할 수 있지만, payload에 없는 길흉·디그니티·애스펙트·사건 의미를 만들지 않는다.
- Suriyayat Lagna(라그나)는 ai_safe_descriptive_packet이 실제 payload에 있고 12개 경로가 완전할 때만 사용한다. 그 패킷의 source house → lord → destination house 연결을 비예측형 맥락으로만 설명한다.
- ai_safe_descriptive_packet이 없으면 Lagna·Thai 하우스를 추정하지 않는다. 패킷이 있어도 학파 예외, 최종 길흉, 사건, 정확한 미래 날짜·시각, 확률, 점수로 확장하지 않는다.
- Western·사주·Thai는 독립 체계다. 서로 같은 주제를 실제 데이터로 지지할 때만 교차해서 말하고 숫자를 임의 합산하지 않는다.
- 내부 JSON 키나 true/false를 사용자 문장에 노출하지 않는다. 모든 영어·한자·전문용어는 바로 괄호에 한국어 뜻/읽기를 붙인다.
- 뻔한 심리상담 문구, 희망고문, 공포조장을 피한다. 근거가 약하면 약하다고 말한다. 한국어 반말. 출력은 JSON만 반환한다.`;

const topicSchema={type:"OBJECT",properties:{verdict:{type:"STRING"},reason:{type:"STRING"},timing:{type:"STRING"},action:{type:"STRING"},avoid:{type:"STRING"},confidence:{type:"STRING",enum:["높음","보통","낮음"]},confidence_reason:{type:"STRING"}},required:["verdict","reason","timing","action","avoid","confidence","confidence_reason"]};
export const SCHEMA:any={type:"OBJECT",properties:{headline:{type:"STRING"},overall:{type:"OBJECT",properties:{summary:{type:"STRING"},dominant_pattern:{type:"STRING"},best_phase:{type:"STRING"},caution_phase:{type:"STRING"}},required:["summary","dominant_pattern","best_phase","caution_phase"]},clusters:{type:"OBJECT",properties:{relationship:{type:"STRING"},work_study:{type:"STRING"},money_news:{type:"STRING"},investment:{type:"STRING"},condition:{type:"STRING"}},required:["relationship","work_study","money_news","investment","condition"]},contact_flow:{type:"OBJECT",properties:{incoming:{type:"STRING"},outgoing:{type:"STRING"},reconnection:{type:"STRING"}},required:["incoming","outgoing","reconnection"]},investment_reading:{type:"OBJECT",properties:{psychology:{type:"STRING"},realization:{type:"STRING"},entry:{type:"STRING"},risk:{type:"STRING"}},required:["psychology","realization","entry","risk"]},systems:{type:"OBJECT",properties:{western:{type:"STRING"},saju:{type:"STRING"},thai:{type:"STRING"}},required:["western","saju","thai"]},priorities:{type:"ARRAY",items:{type:"STRING"}},topic_analysis:{type:"OBJECT",properties:Object.fromEntries(TOPICS.map(k=>[k,topicSchema])),required:[...TOPICS]},limits:{type:"STRING"}},required:["headline","overall","clusters","contact_flow","investment_reading","systems","priorities","topic_analysis","limits"]};

export function validateOutput(o:any){
  if(!o||typeof o!=="object"||!o.overall||!o.clusters||!o.contact_flow||!o.investment_reading||!o.systems||!o.topic_analysis)return null; const a:any={};
  for(const k of TOPICS){const x=o.topic_analysis[k];if(!x||typeof x!=="object")return null;const c=txt(x.confidence,20);a[k]={verdict:txt(x.verdict,700),reason:txt(x.reason,1600),timing:txt(x.timing,900),action:txt(x.action,600),avoid:txt(x.avoid,600),confidence:["높음","보통","낮음"].includes(c)?c:"보통",confidence_reason:txt(x.confidence_reason,600)};}
  return deep({headline:txt(o.headline,240),overall:{summary:txt(o?.overall?.summary,2200),dominant_pattern:txt(o?.overall?.dominant_pattern,1500),best_phase:txt(o?.overall?.best_phase,1100),caution_phase:txt(o?.overall?.caution_phase,1100)},clusters:{relationship:txt(o?.clusters?.relationship,1500),work_study:txt(o?.clusters?.work_study,1500),money_news:txt(o?.clusters?.money_news,1300),investment:txt(o?.clusters?.investment,1400),condition:txt(o?.clusters?.condition,1000)},contact_flow:{incoming:txt(o?.contact_flow?.incoming,1200),outgoing:txt(o?.contact_flow?.outgoing,1200),reconnection:txt(o?.contact_flow?.reconnection,1200)},investment_reading:{psychology:txt(o?.investment_reading?.psychology,900),realization:txt(o?.investment_reading?.realization,900),entry:txt(o?.investment_reading?.entry,900),risk:txt(o?.investment_reading?.risk,900)},systems:{western:txt(o?.systems?.western,1200),saju:txt(o?.systems?.saju,1400),thai:txt(o?.systems?.thai,1200)},priorities:Array.isArray(o?.priorities)?o.priorities.slice(0,4).map((x:any)=>txt(x,450)):[],topic_analysis:a,limits:txt(o.limits,1200)});
}
