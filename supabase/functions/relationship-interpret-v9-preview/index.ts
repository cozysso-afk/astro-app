import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const DEFAULT_MODEL="gemini-3.7-flash",FALLBACK_MODEL="gemini-3.6-flash",VERSION="relationship-v11.4-reliability-evidence";
const MODELS=new Set([DEFAULT_MODEL,FALLBACK_MODEL]);
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8"};
const SUPABASE_URL=(Deno.env.get("SUPABASE_URL")??"").trim();
const SERVICE=(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"").trim();
const MAX_GEMINI_CALLS=2,MAX_PROMPT_BYTES=110000;
const MAX_USER_NEW_JOBS_10M=6,MAX_USER_NEW_JOBS_24H=20,MAX_GLOBAL_NEW_JOBS_10M=18,MAX_GLOBAL_NEW_JOBS_24H=60;
const enc=new TextEncoder();
type Purpose="compatibility"|"reunion"|"marriage_unmarried"|"marriage_married";
const TIME_SENSITIVE=new Set(["Moon","ASC","DSC","MC","IC"]);
const S={type:"STRING"};

function respond(x:unknown,status=200){return new Response(JSON.stringify(x),{status,headers:CORS});}
function cut(v:unknown,n:number){return String(v??"").trim().slice(0,n);}
function gloss(s:string){let t=s;const pairs:[RegExp,string][]=[[/\bSun\b(?!\s*\()/g,"Sun(태양)"],[/\bMoon\b(?!\s*\()/g,"Moon(달)"],[/\bMercury\b(?!\s*\()/g,"Mercury(수성)"],[/\bVenus\b(?!\s*\()/g,"Venus(금성)"],[/\bMars\b(?!\s*\()/g,"Mars(화성)"],[/\bJupiter\b(?!\s*\()/g,"Jupiter(목성)"],[/\bSaturn\b(?!\s*\()/g,"Saturn(토성)"],[/\bUranus\b(?!\s*\()/g,"Uranus(천왕성)"],[/\bNeptune\b(?!\s*\()/g,"Neptune(해왕성)"],[/\bPluto\b(?!\s*\()/g,"Pluto(명왕성)"],[/\bASC\b(?!\s*\()/g,"ASC(상승점)"],[/\bDSC\b(?!\s*\()/g,"DSC(하강점)"],[/\bMC\b(?!\s*\()/g,"MC(중천점)"],[/\bIC\b(?!\s*\()/g,"IC(천저점)"],[/\bconjunction\b(?!\s*\()/gi,"conjunction(합)"],[/\bsextile\b(?!\s*\()/gi,"sextile(육십분위)"],[/\bsquare\b(?!\s*\()/gi,"square(사각)"],[/\btrine\b(?!\s*\()/gi,"trine(삼각)"],[/\bquincunx\b(?!\s*\()/gi,"quincunx(퀸컨스·150도각)"],[/\bopposition\b(?!\s*\()/gi,"opposition(대립)"],[/\bsynastry\b(?!\s*\()/gi,"synastry(시너스트리·궁합차트)"],[/\btransit\b(?!\s*\()/gi,"transit(트랜짓·현재 행성 이동)"],[/\bDavison\b(?!\s*\()/g,"Davison(데이비슨)"],[/\bMarks\b(?!\s*\()/g,"Marks(마크스)"]];for(const [r,v] of pairs)t=t.replace(r,v);return t;}
function deep(v:any):any{if(typeof v==="string")return gloss(v);if(Array.isArray(v))return v.map(deep);if(v&&typeof v==="object")return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,deep(x)]));return v;}
function aspect(a:any){if(!a||typeof a!=="object")return null;const orb=Number(a.orb??99);if(!Number.isFinite(orb))return null;return {a:String(a.a??""),aspect:String(a.aspect??""),b:String(a.b??""),orb,tone:String(a.tone??"mixed"),layer:a.layer??null,orb_grade:a.orb_grade??null,time_sensitivity:a.time_sensitivity??null,evidence_confidence:a.evidence_confidence??null,layer_priority:a.layer_priority??null,event_probability:a.event_probability??"not_calculated"};}
function stat(s:any){if(!s||typeof s!=="object")return null;return {average:Number(s.average??0),band:String(s.band??""),spread:Number(s.spread??0),best_days:Array.isArray(s.best_days)?s.best_days.slice(0,10):[],caution_days:Array.isArray(s.caution_days)?s.caution_days.slice(0,8):[]};}

function aspectList(v:any,n:number){return (Array.isArray(v)?v:[]).map(aspect).filter(Boolean).sort((a:any,b:any)=>a.orb-b.orb).slice(0,n);}
function focusPacket(f:any,n:number){const keys=["core_identity_emotion","attraction_romance","sexual_intimacy","communication","stability_commitment","conflict_reactivity","idealization_confusion","power_attachment","freedom_unpredictability","home_marriage"];return Object.fromEntries(keys.map(k=>[k,aspectList(f?.[k],n)]));}
function houseRows(v:any,n:number){return (Array.isArray(v)?v:[]).slice(0,n).map((x:any)=>({planet:String(x?.planet??""),whole_house:x?.whole_house??null,placidus_house:x?.placidus_house??x?.house??null}));}
function housePacket(h:any,n:number){if(!h||typeof h!=="object")return null;if(!h.available)return {available:false,precision_note:h?.precision_note??""};return {available:true,precision_note:h?.precision_note??"",user_in_counterpart:{relationship_houses:houseRows(h?.user_in_counterpart?.relationship_houses,n)},counterpart_in_user:{relationship_houses:houseRows(h?.counterpart_in_user?.relationship_houses,n)}};}
function sajuPerson(x:any){if(!x||typeof x!=="object")return null;return {year:x?.year??null,month:x?.month??null,day:x?.day??null,hour:x?.hour??null,day_stem:x?.day_stem??null,day_branch:x?.day_branch??null,precision:x?.precision??null,time_known:Boolean(x?.time_known),time_exact:Boolean(x?.time_exact),time_reliability:x?.time_reliability??null};}
function sajuPacket(x:any,n:number){if(!x||typeof x!=="object")return null;if(!x.available)return {available:false,error:x?.error??""};return {available:true,policy:x?.policy??"",user:sajuPerson(x?.user),counterpart:sajuPerson(x?.counterpart),day_master_relation:x?.day_master_relation??null,spouse_palace:x?.spouse_palace??null,cross_branch_links:Array.isArray(x?.cross_branch_links)?x.cross_branch_links.slice(0,n):[],limitations:Array.isArray(x?.limitations)?x.limitations.slice(0,6):[]};}
function compactSignal(s:any,n:number){if(!s||typeof s!=="object")return null;return {exact_contacts:Number(s?.exact_contacts??0),supportive_contacts:Number(s?.supportive_contacts??0),challenging_contacts:Number(s?.challenging_contacts??0),tightest:aspectList(s?.tightest,n)};}
const CORE_PLANETS=["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","True Node","ASC","MC"];
function chartCore(c:any,n:number){if(!c||typeof c!=="object")return null;const pos=c?.positions??{};const keys=CORE_PLANETS.filter(k=>pos?.[k]).slice(0,n);return {positions:Object.fromEntries(keys.map(k=>{const v=pos[k]??{};return [k,{lon:Number(v?.lon??v?.longitude??v?.longitude_deg??0),sign:v?.sign??v?.sign_ko??null,house:v?.house??null}]})),angles:c?.angles?{ASC:c.angles?.ASC??null,MC:c.angles?.MC??null,IC:c.angles?.IC??null,DSC:c.angles?.DSC??null}:null};}
function advancedPacket(x:any,n:number){if(!x||typeof x!=="object")return null;if(!x.available)return {available:false,reason:x?.reason??""};return {available:true,reason:x?.reason??"",method:x?.method??null,chart:chartCore(x?.chart,n),user:chartCore(x?.user,n),counterpart:chartCore(x?.counterpart,n)};}
function transitHit(x:any){if(!x||typeof x!=="object")return null;return {person:x?.person??null,transit:x?.transit??null,aspect:x?.aspect??null,target:x?.target??null,orb:Number(x?.orb??0),tone:x?.tone??null,score:Number(x?.score??0),layer_class:x?.layer_class??null,orb_grade:x?.orb_grade??null,time_sensitivity:x?.time_sensitivity??null,evidence_confidence:x?.evidence_confidence??null,layer_priority:x?.layer_priority??null,event_probability:x?.event_probability??"not_calculated"};}
function transitDay(x:any,n:number){if(!x||typeof x!=="object")return null;return {date:x?.date??null,score:Number(x?.score??0),user_score:Number(x?.user_score??0),counterpart_score:Number(x?.counterpart_score??0),shared_activation:Boolean(x?.shared_activation),hits:(Array.isArray(x?.hits)?x.hits:[]).map(transitHit).filter(Boolean).slice(0,n)};}
function transitMonth(x:any){if(!x||typeof x!=="object")return null;return {calendar_month:x?.calendar_month??null,score:Number(x?.score??0),top_dates:Array.isArray(x?.top_dates)?x.top_dates.slice(0,4):[]};}
function monthlyAdvancedPacket(m:any,n:number){
 const ps=m?.progressed_synastry,pc=m?.progressed_composite,mt=m?.marks_tertiary;
 const unavailable=(x:any,fallback:string)=>({available:false,reason:x?.reason??fallback});
 return {
   calendar_month:m?.calendar_month??null,representative_date:m?.representative_date??null,
   signal_summary:compactSignal(m?.signal_summary,n),
   progressed_synastry:ps?.available===true?{
     available:true,
     user_progressed_to_partner_natal:aspectList(ps?.user_progressed_to_partner_natal,n),
     partner_progressed_to_user_natal:aspectList(ps?.partner_progressed_to_user_natal,n),
     progressed_to_progressed:aspectList(ps?.progressed_to_progressed,n),
   }:unavailable(ps,"progressed synastry unavailable"),
   progressed_composite:pc?.available===true?{
     available:true,method:pc?.method??null,
     to_natal_composite_aspects:aspectList(pc?.to_natal_composite_aspects,n),
   }:unavailable(pc,"progressed composite unavailable"),
   marks_tertiary:mt?.available===true?{
     available:true,
     user:{completed_lunar_months:mt?.user?.completed_lunar_months??null,to_base_marks_aspects:aspectList(mt?.user?.to_base_marks_aspects,n)},
     counterpart:{completed_lunar_months:mt?.counterpart?.completed_lunar_months??null,to_base_marks_aspects:aspectList(mt?.counterpart?.to_base_marks_aspects,n)},
     directional_cross_aspects:aspectList(mt?.directional_cross_aspects,n),
     angle_policy:mt?.angle_policy??null,
   }:unavailable(mt,"Marks tertiary unavailable"),
 };
}
function compact(calc:any,ctx:any,purpose:Purpose,level=0){
 const r=calc?.result??{},n=r?.natal_synastry??{},exact=Boolean(n?.partner_time_exact),available=Boolean(n?.partner_time_available??exact);
 let aspects=(Array.isArray(n?.aspects)?n.aspects:[]).map(aspect).filter(Boolean).sort((a:any,b:any)=>a.orb-b.orb);
 if(!exact)aspects=aspects.filter((a:any)=>!TIME_SENSITIVE.has(a.a)&&!TIME_SENSITIVE.has(a.b));
 const L=level===0?{static:36,focus:6,house:12,cross:12,chart:13,months:12,tight:5,ranked:12,days:14,hits:5,topMonths:10}:level===1?{static:28,focus:4,house:9,cross:9,chart:10,months:9,tight:3,ranked:9,days:10,hits:3,topMonths:8}:{static:20,focus:3,house:6,cross:6,chart:8,months:6,tight:2,ranked:6,days:8,hits:2,topMonths:6};
 const focus=r?.relationship_focus?.groups??{};
 const trans=r?.relationship_transits??r?.reunion_transits??null;
 const ctxMonths=Array.isArray(ctx?.months)?ctx.months.map((m:any)=>({calendar_month:m?.calendar_month,start:m?.start,end:m?.end,incoming:stat(m?.incoming),outgoing:stat(m?.outgoing),reconnection:stat(m?.reconnection)})):[];
 const rankedMonths=ctxMonths.map((m:any)=>({...m,rank_score:Number(m?.reconnection?.average??0)*.5+Number(m?.incoming?.average??0)*.35+Number(m?.outgoing?.average??0)*.15})).sort((a:any,b:any)=>b.rank_score-a.rank_score).slice(0,L.ranked);
 const advancedMonths=(Array.isArray(r?.months)?r.months:[]).slice(0,L.months).map((m:any)=>monthlyAdvancedPacket(m,L.tight));
 const transitDays=(Array.isArray(trans?.top_days)?trans.top_days:[]).slice(0,L.days).map((d:any)=>transitDay(d,L.hits)).filter(Boolean);
 const transitMonths=(Array.isArray(trans?.top_months)?trans.top_months:[]).slice(0,L.topMonths).map(transitMonth).filter(Boolean);
 return deep({
   analysis_mode:r?.analysis_mode??null,period:calc?.period,relationship_status:calc?.relationship_status,
   timing_contract:{timing_timezone_policy:r?.timing_timezone_policy??null,secondary_key:r?.secondary_key??null,tertiary_key:r?.tertiary_key??null,orb_policy:r?.orb_policy??null,interpretation_policy:r?.interpretation_policy??null},
   precision:{partner_time_available:available,partner_time_exact:exact,birth_time_reliability:r?.birth_time_reliability??null,sensitivity_scan:r?.sensitivity_scan??null,removed_time_sensitive_count:(Array.isArray(n?.aspects)?n.aspects.length:0)-aspects.length},
   static:{aspects:aspects.slice(0,L.static),strongest:aspects.slice(0,Math.min(14,L.static))},
   focus:focusPacket(focus,L.focus),
   house_overlays:housePacket(r?.house_overlays,L.house),
   saju_relationship:sajuPacket(r?.saju_relationship,L.cross),
   advanced:{composite:advancedPacket(r?.composite,L.chart),davison:advancedPacket(r?.davison,L.chart),marks:advancedPacket(r?.marks,L.chart),months:advancedMonths},
   directional:purpose==="reunion"&&ctx?{period:ctx?.period,incoming:stat(ctx?.incoming),outgoing:stat(ctx?.outgoing),reconnection:stat(ctx?.reconnection),ranked_months:rankedMonths}:null,
   transit_triggers:trans?{period:trans?.period,policy:trans?.policy,top_days:transitDays,top_months:transitMonths}:null,
   limitations:Array.isArray(r?.limitations)?r.limitations.slice(0,8):[]
 });
}
function selectPromptPacket(calc:any,ctx:any,purpose:Purpose){let originalBytes=0,last:any=null;for(let level=0;level<=2;level++){const payload=compact(calc,ctx,purpose,level);const budget=promptBudget(payload,purpose);if(level===0)originalBytes=budget.bytes;last={payload,budget,compression_level:level,original_prompt_bytes:originalBytes};if(budget.ok)return last;}return last;}


const SYSTEM=`너는 '별빛의 운명'의 관계 전문 리더다. 사용자가 별도로 차트를 복사해 다른 GPT에게 물어볼 필요가 없도록 계산 근거가 풍부한 리딩을 작성한다. 다만 계산되지 않은 사실·상대의 실제 속마음·사건 확률을 만들지 않는다.

공통 절대규칙:
- 출생시간을 입력했다는 사실과 exact 검증은 다르다. precision.birth_time_reliability를 우선 확인하고, exact가 아니면 ASC/DSC/MC/IC·하우스·Davison/Marks를 확정 근거로 사용하지 않는다. provisional 행성층은 잠정 근거라고 명시한다.
- 오브가 좁은 실제 접점을 우선한다. 접점 개수보다 orb_grade·evidence_confidence·time_sensitivity를 우선한다.
- 레이어 우선순위는 Natal structure > Secondary Progression > 주요/중장기 Transit > 빠른 Daily Transit > Tertiary/Marks 보조층이다. 하위 보조층 하나만으로 상위 레이어 결론을 뒤집지 않는다.
- sensitivity_scan은 진단용이며 exact 생시 확정이나 사건확률 계산에 사용하지 않는다. 각 핵심 문단마다 가능한 한 실제 애스펙트 이름과 오브를 1~3개 근거로 든다.
- 생시 미상으로 제거된 Moon(달)·각도점·하우스는 추측하지 않는다. 사용 가능하지 않은 Davison(데이비슨)·Marks(마크스)도 추측 금지.
- 정확 생시에서 house_overlays의 whole_house(홀사인)와 placidus_house(플라시두스)를 둘 다 읽는다. 둘이 같은 하우스를 가리키면 중첩 근거로, 다르면 각 체계의 의미를 분리해 설명하며 한 체계로 덮어쓰거나 임의 평균하지 않는다.
- 점수와 접점 개수는 확률이 아니다. 좋은 말/나쁜 말을 억지로 균형 맞추지 않는다.
- timing_contract의 fixed UTC offset·local noon 규칙을 그대로 따른다. IANA/DST를 임의 추정해 날짜를 바꾸지 않는다.
- advanced.composite와 advanced.months의 progressed_synastry·progressed_composite·marks_tertiary를 서로 다른 계산층으로 읽고 signal_summary 하나로 뭉개지 않는다.
- 영어·한자·전문용어는 바로 뒤 괄호에 한글 읽기/뜻을 붙인다.
- 서양점성술과 사주는 독립 근거로 읽고, 둘이 같은 주제를 가리킬 때만 '교차해서 보면'이라고 종합한다.
- 사주는 CALCULATED_DATA.saju_relationship에 실제로 들어온 원주·day_master_relation(일간 상호관계·십성)·spouse_palace(일지·배우자궁 합충해파)·cross_branch_links(교차 지지관계)만 사용한다. 데이터에 없는 天干合(천간합: 갑기합·을경합·병신합·정임합·무계합), 신강·신약, 용신·희신·기신, 배우자성, 합혼점수, 도화/홍염은 절대 만들지 않는다.
- 일반론 조언 금지. 실제 접점과 연결된 반복 장면·관계 역학을 설명한다.

[일반 궁합 compatibility]
재회운처럼 연락시기 중심으로 쓰지 말고, 연애 관계 자체를 깊게 본다. 아래 포인트를 데이터가 있는 범위에서 빠짐없이 확인한다.
1) Sun(태양)-Moon(달)·Sun(태양)-Sun(태양)·Moon(달)-Moon(달): 기본 정체성·정서 리듬.
2) Venus(금성)-Mars(화성), Venus(금성)-Sun(태양)/Moon(달), Pluto(명왕성): 호감·로맨스·신체적/성적 끌림·집착 강도.
3) Mercury(수성): 대화 템포, 이해 방식, 말이 통하는 지점과 오해 방식.
4) Saturn(토성): 책임·결속·부담·지속성. Jupiter(목성): 성장·관대함·함께 커지는 축.
5) Uranus(천왕성): 자유·갑작스러운 거리 변화. Neptune(해왕성): 이상화·모호함·투사. Pluto(명왕성): 힘겨루기·변형·끊기 어려움.
6) 정확한 생시가 있을 때 4·5·7·8하우스 오버레이: 가정/연애/파트너십/친밀감·공유자원.
7) 사주: 일간끼리의 생극 관계, 서로를 어떤 십성으로 체감하는지, 일지(배우자궁)의 합·충·해·파, 월지/년지 교차관계.
결론은 '좋은 궁합/나쁜 궁합'으로 끝내지 말고 무엇이 강하게 끌고 무엇이 오래 가게 하고 무엇이 소모시키는지를 분리한다. overview는 7~10문장, 각 세부 섹션은 4~7문장. felt_scenarios는 계산근거를 현실 장면으로 번역한 4개.

[재회 reunion]
기존처럼 시기 우선. 수신/발신/재접점을 분리하고 transit(트랜짓·현재 행성 이동) 실제 날짜와 정적 궁합 구조를 교차검증한다. 연락 활성도와 안정적인 재회 가능 구조는 반드시 분리한다. 선택기간 내 2~4개 시기창과 후속파동을 제시한다.

[미혼 결혼 marriage_unmarried]
'결혼으로 공식화될 가능성·프러포즈/약혼/결혼 결정이 강해지는 시기'를 재미용 점성 해석으로 적극적으로 제시한다. 다만 통계적 확률이나 확정된 미래 사실처럼 단정하지 않는다. 이어서 '이 둘이 결혼생활로 들어가면 어떻게 작동하나'를 깊게 본다.
- 정서적 집: Moon(달), Venus(금성), Saturn(토성), 4하우스/IC(천저점).
- 배우자/동반자: 7하우스/DSC(하강점), Sun(태양), Moon(달), Venus(금성), Saturn(토성).
- 친밀감·돈·공유자원: 8하우스, Pluto(명왕성), Venus(금성)/Mars(화성).
- 연애의 즐거움·애정표현: 5하우스, Venus(금성), Sun(태양), Jupiter(목성).
- 생활 역할과 갈등 수습: Mercury(수성), Mars(화성), Saturn(토성), Uranus(천왕성).
- 사주 일지(배우자궁) 합충해파와 일간 상호 십성을 반드시 확인한다.
marriage_reading의 bottom_line/bond/emotional_home/daily_life/intimacy_resources/conflict_repair/commitment_or_current_cycle/timing/caution을 각각 충분히 쓴다. intimacy_resources에는 8하우스·Pluto(명왕성)·Venus(금성)/Mars(화성) 근거가 실제 데이터에 있을 때만 친밀감·공유재정·공유자원을 별도로 읽는다. 결속이 강해도 생활궁합이 힘들 수 있고, 끌림이 강해도 책임 구조가 약할 수 있음을 분리한다.

[기혼 결혼 marriage_married]
이미 결혼한 관계다. 결혼 가능성·결혼 성사 여부·프러포즈 가능성 표현은 금지한다. 현재 결속·정서적 거리·생활역할·공유재정/친밀감·반복갈등·회복력·시기별 긴장/완화를 위 포인트로 깊게 읽는다. marriage_reading.intimacy_resources는 현재의 친밀감·공유재정·공유자원 구조로만 해석한다.

문체는 한국어 반말. 결론→근거→현실에서 체감되는 방식→시기 순서. 짧아서 민망한 요약 금지. JSON만 반환.`;

const COMMON_SCHEMA:any={headline:S,overview:S,chemistry:S,emotional_dynamic:S,communication:S,conflict_pattern:S,power_boundaries:S,long_term:S,timing:S,reunion_context:S,felt_scenarios:{type:"ARRAY",items:S},practical_advice:{type:"ARRAY",items:S},top_aspects:{type:"ARRAY",items:{type:"OBJECT",properties:{label:S,meaning:S},required:["label","meaning"]}},limits:S};
const REUNION_SCHEMA:any={type:"OBJECT",properties:{bottom_line:S,incoming_contact:S,outgoing_contact:S,reconnection_windows:S,low_windows:S,relationship_filter:S,precision_note:S},required:["bottom_line","incoming_contact","outgoing_contact","reconnection_windows","low_windows","relationship_filter","precision_note"]};
const MARRIAGE_SCHEMA:any={type:"OBJECT",properties:{mode:S,bottom_line:S,bond:S,emotional_home:S,daily_life:S,intimacy_resources:S,conflict_repair:S,commitment_or_current_cycle:S,timing:S,caution:S,precision_note:S},required:["mode","bottom_line","bond","emotional_home","daily_life","intimacy_resources","conflict_repair","commitment_or_current_cycle","timing","caution","precision_note"]};
function schemaFor(purpose:Purpose){const properties:any={...COMMON_SCHEMA};const required=["headline","overview","chemistry","emotional_dynamic","communication","conflict_pattern","power_boundaries","long_term","timing","reunion_context","felt_scenarios","practical_advice","top_aspects","limits"];if(purpose==="reunion"){properties.reunion_reading=REUNION_SCHEMA;required.push("reunion_reading");}if(purpose.startsWith("marriage_")){properties.marriage_reading=MARRIAGE_SCHEMA;required.push("marriage_reading");}return {type:"OBJECT",properties,required};}

function usage(raw:any){const u=raw?.usageMetadata??{};return {prompt_tokens:Number(u.promptTokenCount??0),candidate_tokens:Number(u.candidatesTokenCount??0),thought_tokens:Number(u.thoughtsTokenCount??0),total_tokens:Number(u.totalTokenCount??0)};}
function validate(o:any,p:Purpose){if(!o||typeof o!=="object")return null;const rr=o.reunion_reading??{},mr=o.marriage_reading??{};const out:any={headline:cut(o.headline,450),overview:cut(o.overview,6500),chemistry:cut(o.chemistry,4200),emotional_dynamic:cut(o.emotional_dynamic,4200),communication:cut(o.communication,4200),conflict_pattern:cut(o.conflict_pattern,4200),power_boundaries:cut(o.power_boundaries,3800),long_term:cut(o.long_term,4500),timing:cut(o.timing,3500),reunion_context:cut(o.reunion_context,3500),felt_scenarios:Array.isArray(o.felt_scenarios)?o.felt_scenarios.slice(0,4).map((x:any)=>cut(x,1300)):[],reunion_reading:{bottom_line:cut(rr.bottom_line,4500),incoming_contact:cut(rr.incoming_contact,4000),outgoing_contact:cut(rr.outgoing_contact,3500),reconnection_windows:cut(rr.reconnection_windows,6000),low_windows:cut(rr.low_windows,3500),relationship_filter:cut(rr.relationship_filter,4500),precision_note:cut(rr.precision_note,1800)},marriage_reading:{mode:cut(mr.mode,80),bottom_line:cut(mr.bottom_line,4800),bond:cut(mr.bond,4200),emotional_home:cut(mr.emotional_home,4200),daily_life:cut(mr.daily_life,4800),intimacy_resources:cut(mr.intimacy_resources,4600),conflict_repair:cut(mr.conflict_repair,4200),commitment_or_current_cycle:cut(mr.commitment_or_current_cycle,4200),timing:cut(mr.timing,3800),caution:cut(mr.caution,3800),precision_note:cut(mr.precision_note,1800)},practical_advice:Array.isArray(o.practical_advice)?o.practical_advice.slice(0,4).map((x:any)=>cut(x,1200)):[],top_aspects:Array.isArray(o.top_aspects)?o.top_aspects.slice(0,10).map((x:any)=>({label:cut(x?.label,500),meaning:cut(x?.meaning,1800)})):[],limits:cut(o.limits,2200)};if(p!=="reunion")out.reunion_reading={bottom_line:"",incoming_contact:"",outgoing_contact:"",reconnection_windows:"",low_windows:"",relationship_filter:"",precision_note:""};if(!p.startsWith("marriage_"))out.marriage_reading={mode:"",bottom_line:"",bond:"",emotional_home:"",daily_life:"",intimacy_resources:"",conflict_repair:"",commitment_or_current_cycle:"",timing:"",caution:"",precision_note:""};return deep(out);}
function grounded(data:any,payload:any,p:Purpose,relaxed=false){
 const all=JSON.stringify(data),src=JSON.stringify(payload);
 const forbidden=["갑기합","을경합","병신합","정임합","무계합","신강","신약","용신","희신","기신","배우자성","합혼점수"];
 for(const word of forbidden)if(all.includes(word)&&!src.includes(word))return false;
 const unknownTime=payload?.precision?.partner_time_exact===false;
 const scale=relaxed?.60:(unknownTime?.72:1);
 const need=(n:number)=>Math.max(40,Math.floor(n*scale));
 if(p==="compatibility"){
   if(String(data.overview??"").length<need(350))return false;
   for(const k of ["chemistry","emotional_dynamic","communication","conflict_pattern","power_boundaries","long_term"])
     if(String(data[k]??"").length<need(120))return false;
   const scenarioMin=(unknownTime||relaxed)?2:3;
   if((data.felt_scenarios??[]).length<scenarioMin)return false;
 }
 if(p.startsWith("marriage_")){
   const m=data.marriage_reading??{};
   if(String(data.overview??"").length<need(300))return false;
   if(String(m.bottom_line??"").length<need(260))return false;
   for(const k of ["bond","emotional_home","daily_life","conflict_repair","commitment_or_current_cycle","timing","caution"])
     if(String(m[k]??"").length<need(170))return false;
 }
 if(p==="reunion"&&String(data.reunion_reading?.bottom_line??"").length<need(220))return false;
 return true;
}

function modeInstruction(purpose:Purpose){return purpose==="compatibility"?"일반 연애 궁합이다. 표준 궁합 포인트와 사주 관계층을 빠짐없이 읽고 각 섹션을 충분히 길게 써라.":purpose==="reunion"?"재회운이다. 시기창과 실제 트랜짓 근거를 우선하되 기본 궁합의 재회 필터도 깊게 써라.":purpose==="marriage_unmarried"?"특정 상대가 있는 미혼 결혼궁합이다. 두 사람이 결혼생활로 들어갈 경우의 결속·정서적 집·생활 역할·돈/공유자원·친밀감·갈등회복·책임을 분리해 읽고, 결혼으로 공식화될 가능성과 프러포즈·약혼·결혼 결정이 강해지는 시기 흐름도 계산 근거 범위에서 적극적으로 제시하되 확정 사실처럼 단정하지 마라.":"이미 결혼한 두 사람의 결혼생활 분석이다. 결혼 가능성 표현은 금지하고 현재 결속·정서적 거리·생활 역할·공유재정/친밀감·반복갈등·회복 주기를 읽어라.";}
function promptText(payload:any,purpose:Purpose,compactMode=false){return `PURPOSE=${purpose}\n${modeInstruction(purpose)}\n${compactMode?"재시도다. 완전한 JSON을 만들되 근거·오브·사주 허용필드·시기는 유지하고 중복만 줄여라.\n":""}CALCULATED_DATA=${JSON.stringify(payload)}`;}
function promptBudget(payload:any,purpose:Purpose){const bytes=enc.encode(SYSTEM+promptText(payload,purpose,false)).length;return {bytes,max_bytes:MAX_PROMPT_BYTES,ok:bytes<=MAX_PROMPT_BYTES,estimated_input_tokens:Math.ceil(bytes/2.6)};}
function addUsage(a:any,b:any){return {prompt_tokens:Number(a?.prompt_tokens??0)+Number(b?.prompt_tokens??0),candidate_tokens:Number(a?.candidate_tokens??0)+Number(b?.candidate_tokens??0),thought_tokens:Number(a?.thought_tokens??0)+Number(b?.thought_tokens??0),total_tokens:Number(a?.total_tokens??0)+Number(b?.total_tokens??0)};}
async function sha(value:string){const digest=await crypto.subtle.digest("SHA-256",enc.encode(value));return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");}
function stable(v:any):string{if(v===null||typeof v!=="object")return JSON.stringify(v);if(Array.isArray(v))return `[${v.map(stable).join(",")}]`;return `{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;}

async function generate(payload:any,purpose:Purpose,model:string,key:string,compactMode=false){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),115000);try{const prompt=promptText(payload,purpose,compactMode);const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:"POST",signal:controller.signal,headers:{"Content-Type":"application/json","x-goog-api-key":key},body:JSON.stringify({systemInstruction:{parts:[{text:SYSTEM}]},contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json",responseSchema:schemaFor(purpose),maxOutputTokens:compactMode?12000:16000,temperature:.32,thinkingConfig:{thinkingLevel:"medium"}}})});const rawText=await r.text();if(!r.ok)return {ok:false,error:`Gemini HTTP ${r.status}`,model,usage:{prompt_tokens:0,candidate_tokens:0,thought_tokens:0,total_tokens:0}};const raw=JSON.parse(rawText),u=usage(raw),parts=raw?.candidates?.[0]?.content?.parts??[];let txt=parts.filter((x:any)=>!x?.thought).map((x:any)=>x?.text??"").join("").trim()||parts.map((x:any)=>x?.text??"").join("").trim();txt=txt.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"");try{const data=validate(JSON.parse(txt),purpose);if(!data||!grounded(data,payload,purpose,compactMode))return {ok:false,error:"관계 해설이 깊이/근거 검증을 통과하지 못했어",model,usage:u};return {ok:true,data,model,interpreter_version:VERSION,usage:u};}catch{return {ok:false,error:"구조화 관계 해설이 완전하지 않았어",model,usage:u};}}catch(e){return {ok:false,error:e instanceof DOMException&&e.name==="AbortError"?"관계 해설 시간이 초과됐어.":`관계 해설 실패: ${e instanceof Error?e.message:String(e)}`,model,usage:{prompt_tokens:0,candidate_tokens:0,thought_tokens:0,total_tokens:0}};}finally{clearTimeout(timer);}}
async function calculate(payload:any,purpose:Purpose,preferred:string,key:string){let calls=0;const first:any=await generate(payload,purpose,preferred,key,false);calls+=1;const firstUsage=first.usage??{};if(first.ok)return {...first,usage:{...firstUsage,attempt_count:calls}};if(calls>=MAX_GEMINI_CALLS)return {...first,usage:{...firstUsage,attempt_count:calls}};const retryModel=preferred===DEFAULT_MODEL?FALLBACK_MODEL:preferred;const second:any=await generate(payload,purpose,retryModel,key,true);calls+=1;const total=addUsage(firstUsage,second.usage??{});if(second.ok)return {...second,usage:{...total,attempt_count:calls},...(retryModel!==preferred?{fallback_from:preferred}:{})};return {ok:false,error:`관계 해설 생성 실패 · 1차 ${first.error??"알 수 없는 오류"} · 재시도 ${second.error??"알 수 없는 오류"}`,model:preferred,interpreter_version:VERSION,usage:{...total,attempt_count:calls}};}

async function countJobs(admin:any,userId:string|null,since:string){let q=admin.from("ai_interpret_jobs").select("id",{count:"exact",head:true}).like("kind","supabase-relationship-v11%").gte("created_at",since);if(userId)q=q.eq("user_id",userId);const {count,error}=await q;if(error)throw error;return Number(count??0);}
async function rollingGuard(admin:any,userId:string){const now=Date.now();const u10=await countJobs(admin,userId,new Date(now-10*60*1000).toISOString()),u24=await countJobs(admin,userId,new Date(now-24*60*60*1000).toISOString()),g10=await countJobs(admin,null,new Date(now-10*60*1000).toISOString()),g24=await countJobs(admin,null,new Date(now-24*60*60*1000).toISOString());if(u10>=MAX_USER_NEW_JOBS_10M)return `내 계정에서 10분 동안 새 관계 해설 ${MAX_USER_NEW_JOBS_10M}건 한도에 도달했어.`;if(u24>=MAX_USER_NEW_JOBS_24H)return `내 계정에서 24시간 새 관계 해설 ${MAX_USER_NEW_JOBS_24H}건 한도에 도달했어.`;if(g10>=MAX_GLOBAL_NEW_JOBS_10M)return `전체 10분 새 관계 해설 ${MAX_GLOBAL_NEW_JOBS_10M}건 안전 한도에 도달했어.`;if(g24>=MAX_GLOBAL_NEW_JOBS_24H)return `전체 24시간 새 관계 해설 ${MAX_GLOBAL_NEW_JOBS_24H}건 안전 한도에 도달했어.`;return "";}

Deno.serve(async(req)=>{if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});if(req.method!=="POST")return respond({ok:false,error:"POST만 지원해."},405);let b:any;try{b=await req.json();}catch{return respond({ok:false,error:"JSON 요청이 필요해."},400);}if(!b?.calculation)return respond({ok:false,error:"calculation이 필요해."},400);const purpose=String(b.purpose??"compatibility") as Purpose;if(!["compatibility","reunion","marriage_unmarried","marriage_married"].includes(purpose))return respond({ok:false,error:"지원하지 않는 관계 해설 모드야."},400);if(!SUPABASE_URL||!SERVICE)return respond({ok:false,cost_guard_blocked:true,error:"관계 해설 비용가드 서버 설정이 없어 새 Gemini 호출을 막았어."},200);const auth=(req.headers.get("authorization")??"").replace(/^Bearer\s+/i,"").trim();if(!auth)return respond({ok:false,error:"로그인 세션이 필요해."},401);const admin=createClient(SUPABASE_URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});const {data:{user},error:userError}=await admin.auth.getUser(auth);if(userError||!user)return respond({ok:false,error:"유효한 로그인 세션이 필요해."},401);const preferred=MODELS.has(String(b.model))?String(b.model):DEFAULT_MODEL;const pack=selectPromptPacket(b.calculation,b.reunion_context,purpose);const payload=pack.payload;const budget=pack.budget;if(!budget.ok)return respond({ok:false,cost_guard_blocked:true,prompt_budget:true,error:`관계 해설 근거를 3단계로 압축했지만 안전 상한 ${budget.max_bytes.toLocaleString()} bytes를 넘어 Gemini 호출을 막았어.`,prompt_bytes:budget.bytes,max_prompt_bytes:budget.max_bytes,prompt_compression_level:pack.compression_level,original_prompt_bytes:pack.original_prompt_bytes},200);const hash=await sha(stable({version:VERSION,purpose,preferred,payload}));const kind=`supabase-relationship-v11:${purpose}:${hash.slice(0,40)}`;const {data:existing,error:existingError}=await admin.from("ai_interpret_jobs").select("id,status,result_json,usage_json,model,fallback_from").eq("user_id",user.id).eq("kind",kind).order("created_at",{ascending:false}).limit(1);if(existingError)return respond({ok:false,cost_guard_blocked:true,error:"관계 해설 캐시/비용 상태를 확인하지 못해 새 Gemini 호출을 막았어."},200);const cached=existing?.[0];if(cached?.status==="done"&&cached?.result_json)return respond({...cached.result_json,cached:true,server_cache:true,usage:cached.usage_json??cached.result_json?.usage},200);if(cached?.status==="queued"||cached?.status==="running")return respond({ok:false,inflight:true,cost_guard_blocked:true,error:"같은 관계 해설이 이미 생성 중이라 중복 Gemini 호출을 막았어."},200);let blocked="";try{blocked=await rollingGuard(admin,user.id);}catch{return respond({ok:false,cost_guard_blocked:true,error:"관계 해설 비용 카운터를 확인하지 못해 새 Gemini 호출을 막았어."},200);}if(blocked)return respond({ok:false,cost_guard_blocked:true,rolling_job_guard:true,error:blocked},200);const key=(Deno.env.get("GEMINI_API_KEY")??"").trim();if(!key)return respond({ok:false,error:"GEMINI_API_KEY가 없어."},503);const periodStart=String(payload?.period?.start??"")||null,periodEnd=String(payload?.period?.end??"")||null;const {data:inserted,error:insertError}=await admin.from("ai_interpret_jobs").insert({user_id:user.id,kind,status:"queued",model:preferred,period_start:periodStart,period_end:periodEnd}).select("id").single();if(insertError||!inserted?.id)return respond({ok:false,cost_guard_blocked:true,error:"관계 해설 비용 기록을 만들지 못해 Gemini 호출을 막았어."},200);const generated:any=await calculate(payload,purpose,preferred,key);const result:any={...generated,prompt_bytes:budget.bytes,max_prompt_bytes:budget.max_bytes,prompt_compression_level:pack.compression_level,original_prompt_bytes:pack.original_prompt_bytes};const finalStatus=result.ok?"done":"failed";await admin.from("ai_interpret_jobs").update({status:finalStatus,model:result.model??preferred,fallback_from:result.fallback_from??null,result_json:result.ok?result:null,usage_json:result.usage??null,error:result.ok?null:result.error??"관계 해설 실패",completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",inserted.id);return respond(result,200);});
