import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";

import { publicRelationshipError, publicCachedResult, isStaleRelationshipJob } from "./publicError.ts";
import type { RelationshipErrorCode } from "./publicError.ts";
import { buildReunionEvidenceV2 } from "./reunionEvidenceV2.ts";
import { repairReunionGroundingV2 } from "./reunionGroundingV2.ts";

const DEFAULT_MODEL="gemini-3.7-flash",FALLBACK_MODEL="gemini-3.6-flash",VERSION="relationship-v11.8-provisional-time-reference";
const REUNION_VERSION="relationship-v12.5-directional-evidence-narrative";
const versionForPurpose=(purpose:Purpose)=>purpose==="reunion"?REUNION_VERSION:VERSION;
const MODELS=new Set([DEFAULT_MODEL,FALLBACK_MODEL]);
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8"};
const SUPABASE_URL=(Deno.env.get("SUPABASE_URL")??"").trim();
const SERVICE=(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"").trim();
const MAX_GEMINI_CALLS=2,MAX_PROMPT_BYTES=180000,MAX_AI_JOB_ESTIMATED_KRW=300;
const GEMINI_USD_KRW_ESTIMATE=1384,GEMINI_INTRO_END=Date.parse("2026-12-31T23:59:59Z");
const MAX_USER_NEW_JOBS_10M=6,MAX_USER_NEW_JOBS_24H=20,MAX_GLOBAL_NEW_JOBS_10M=18,MAX_GLOBAL_NEW_JOBS_24H=60;
const enc=new TextEncoder();
type Purpose="compatibility"|"reunion"|"marriage_unmarried"|"marriage_married";
const TIME_SENSITIVE=new Set(["Moon","ASC","DSC","MC","IC"]);
const S={type:"STRING"};

function respond(x:unknown,status=200){return new Response(JSON.stringify(x),{status,headers:CORS});}
function cut(v:unknown,n:number){return String(v??"").trim().slice(0,n);}
function gloss(s:string){let t=s;const pairs:[RegExp,string][]=[[/\bSun\b(?!\s*\()/g,"Sun(태양)"],[/\bMoon\b(?!\s*\()/g,"Moon(달)"],[/\bMercury\b(?!\s*\()/g,"Mercury(수성)"],[/\bVenus\b(?!\s*\()/g,"Venus(금성)"],[/\bMars\b(?!\s*\()/g,"Mars(화성)"],[/\bJupiter\b(?!\s*\()/g,"Jupiter(목성)"],[/\bSaturn\b(?!\s*\()/g,"Saturn(토성)"],[/\bUranus\b(?!\s*\()/g,"Uranus(천왕성)"],[/\bNeptune\b(?!\s*\()/g,"Neptune(해왕성)"],[/\bPluto\b(?!\s*\()/g,"Pluto(명왕성)"],[/\bASC\b(?!\s*\()/g,"ASC(상승점)"],[/\bDSC\b(?!\s*\()/g,"DSC(하강점)"],[/\bMC\b(?!\s*\()/g,"MC(중천점)"],[/\bIC\b(?!\s*\()/g,"IC(천저점)"],[/\bconjunction\b(?!\s*\()/gi,"conjunction(합)"],[/\bsextile\b(?!\s*\()/gi,"sextile(육십분위)"],[/\bsquare\b(?!\s*\()/gi,"square(사각)"],[/\btrine\b(?!\s*\()/gi,"trine(삼각)"],[/\bquincunx\b(?!\s*\()/gi,"quincunx(퀸컨스·150도각)"],[/\bopposition\b(?!\s*\()/gi,"opposition(대립)"],[/\bsynastry\b(?!\s*\()/gi,"synastry(시너스트리·궁합차트)"],[/\btransit\b(?!\s*\()/gi,"transit(트랜짓·현재 행성 이동)"],[/\bDavison\b(?!\s*\()/g,"Davison(데이비슨)"],[/\bMarks\b(?!\s*\()/g,"Marks(마크스)"]];for(const [r,v] of pairs)t=t.replace(r,v);return t;}
function deep(v:any):any{if(typeof v==="string")return gloss(v);if(Array.isArray(v))return v.map(deep);if(v&&typeof v==="object")return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,deep(x)]));return v;}
function hierarchyPacket(h:any){if(!h)return null;return {version:h.version,as_of_date:h.as_of_date,validation:h.validation,weights:h.weights,thresholds:h.thresholds,stages:h.stages,top_periods:h.top_periods,nearest_window:h.nearest_window,initiative:h.initiative,coverage:h.coverage,limitations:h.limitations,score_meaning:h.score_meaning,stability_structure:h.stability_structure};}
function aspect(a:any){if(!a||typeof a!=="object")return null;const orb=Number(a.orb??99);if(!Number.isFinite(orb))return null;return {a:String(a.a??""),aspect:String(a.aspect??""),b:String(a.b??""),orb,tone:String(a.tone??"mixed"),layer:a.layer??null,orb_grade:a.orb_grade??null,time_sensitivity:a.time_sensitivity??null,evidence_confidence:a.evidence_confidence??null,layer_priority:a.layer_priority??null,event_probability:a.event_probability??"not_calculated"};}
function stat(s:any,maxPoints=3){if(!s||typeof s!=="object")return null;const n=Math.max(1,Math.min(4,maxPoints));return {average:Number(s.average??0),band:String(s.band??""),spread:Number(s.spread??0),best_days:Array.isArray(s.best_days)?s.best_days.slice(0,n):[],caution_days:Array.isArray(s.caution_days)?s.caution_days.slice(0,n):[]};}
function sensitivityPacket(s:any){if(!s||typeof s!=="object")return null;const one=(x:any)=>!x||typeof x!=="object"?null:{available:Boolean(x.available),reason:x.reason??null,time_reliability:x.time_reliability??null,sample_count:Number(x.sample_count??0),step_minutes:Number(x.step_minutes??0),window_minutes:Number(x.window_minutes??0),angle_variation_deg:x.angle_variation_deg??null,robust_contact_count:Array.isArray(x.robust_contacts)?x.robust_contacts.length:0,sensitive_contact_count:Array.isArray(x.sensitive_contacts)?x.sensitive_contacts.length:0,fragile_contact_count:Array.isArray(x.fragile_contacts)?x.fragile_contacts.length:0,warnings:Array.isArray(x.warnings)?x.warnings.slice(0,3):[],event_probability:x.event_probability??"not_calculated"};return {policy:s.policy??null,user:one(s.user),counterpart:one(s.counterpart)};}

function aspectList(v:any,n:number){return (Array.isArray(v)?v:[]).map(aspect).filter(Boolean).sort((a:any,b:any)=>a.orb-b.orb).slice(0,n);}
function focusPacket(f:any,n:number){const keys=["core_identity_emotion","attraction_romance","sexual_intimacy","communication","stability_commitment","conflict_reactivity","idealization_confusion","power_attachment","freedom_unpredictability","home_marriage"];return Object.fromEntries(keys.map(k=>[k,aspectList(f?.[k],n)]));}
function houseRows(v:any,n:number){return (Array.isArray(v)?v:[]).slice(0,n).map((x:any)=>({planet:String(x?.planet??""),whole_house:x?.whole_house??null,placidus_house:x?.placidus_house??x?.house??null}));}
function housePacket(h:any,n:number){if(!h||typeof h!=="object")return null;if(!h.available)return {available:false,precision_note:h?.precision_note??""};return {available:true,precision_note:h?.precision_note??"",user_in_counterpart:{relationship_houses:houseRows(h?.user_in_counterpart?.relationship_houses,n)},counterpart_in_user:{relationship_houses:houseRows(h?.counterpart_in_user?.relationship_houses,n)}};}
function sajuPerson(x:any){if(!x||typeof x!=="object")return null;return {year:x?.year??null,month:x?.month??null,day:x?.day??null,hour:x?.hour??null,day_stem:x?.day_stem??null,day_branch:x?.day_branch??null,precision:x?.precision??null,time_known:Boolean(x?.time_known),time_exact:Boolean(x?.time_exact),time_reliability:x?.time_reliability??null};}
function sajuPacket(x:any,n:number){if(!x||typeof x!=="object")return null;if(!x.available)return {available:false,error:x?.error??""};return {available:true,policy:x?.policy??"",user:sajuPerson(x?.user),counterpart:sajuPerson(x?.counterpart),day_master_relation:x?.day_master_relation??null,spouse_palace:x?.spouse_palace??null,cross_branch_links:Array.isArray(x?.cross_branch_links)?x.cross_branch_links.slice(0,n):[],limitations:Array.isArray(x?.limitations)?x.limitations.slice(0,6):[]};}
function compactSignal(s:any,n:number){if(!s||typeof s!=="object")return null;return {exact_contacts:Number(s?.exact_contacts??0),supportive_contacts:Number(s?.supportive_contacts??0),challenging_contacts:Number(s?.challenging_contacts??0),tightest:aspectList(s?.tightest,n)};}
const CORE_PLANETS=["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","True Node","ASC","MC"];
function chartCore(c:any,n:number){if(!c||typeof c!=="object")return null;const pos=c?.positions??{};const keys=CORE_PLANETS.filter(k=>pos?.[k]).slice(0,n);return {positions:Object.fromEntries(keys.map(k=>{const v=pos[k]??{};return [k,{lon:Number(v?.lon??v?.longitude??v?.longitude_deg??0),sign:v?.sign??v?.sign_ko??null,house:v?.house??null}]})),angles:c?.angles?{ASC:c.angles?.ASC??null,MC:c.angles?.MC??null,IC:c.angles?.IC??null,DSC:c.angles?.DSC??null}:null};}
function advancedPacket(x:any,n:number){if(!x||typeof x!=="object")return null;if(!x.available)return {available:false,reason:x?.reason??""};return {available:true,reason:x?.reason??"",precision:x?.precision??null,note:x?.note??null,method:x?.method??null,chart:chartCore(x?.chart,n),user:chartCore(x?.user,n),counterpart:chartCore(x?.counterpart,n)};}
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
function reunionDimensionPacket(raw:any,n:number){
 if(!raw||typeof raw!=="object")return null;
 const one=(x:any)=>x&&typeof x==="object"?{
   incoming:stat(x?.incoming),outgoing:stat(x?.outgoing),reconnection:stat(x?.reconnection),
   top_evidence:(Array.isArray(x?.top_evidence)?x.top_evidence:[]).slice(0,n).map((e:any)=>({date:e?.date??null,score:Number(e?.score??0),user_score:Number(e?.user_score??0),counterpart_score:Number(e?.counterpart_score??0),user_evidence:aspectList(e?.user_evidence,2),counterpart_evidence:aspectList(e?.counterpart_evidence,2),event_probability:"not_calculated"})),
 }:null;
 return {emotional_reactivation:one(raw?.emotional_reactivation),contact_recontact:one(raw?.contact_recontact),in_person_meeting:one(raw?.in_person_meeting),relationship_rebuilding:one(raw?.relationship_rebuilding),policy:raw?.policy??null};
}
function secondaryDimensionPacket(x:any,n:number){
 if(!x||typeof x!=="object")return null;
 return {label:x?.label??null,evidence:aspectList(x?.evidence,Math.min(3,n)),independent_primary_layers:Array.isArray(x?.independent_primary_layers)?x.independent_primary_layers.slice(0,4):[],independent_layer_count:Number(x?.independent_layer_count??0),convergence:Boolean(x?.convergence),score:null,policy:x?.policy??null,event_probability:"not_calculated"};
}
function secondarySupportPacket(raw:any,n:number){
 if(!raw||typeof raw!=="object")return null;
 const months=(Array.isArray(raw?.months)?raw.months:[]).slice(0,n).map((m:any)=>({calendar_month:m?.calendar_month??null,representative_date:m?.representative_date??null,dimensions:{emotional_reactivation:secondaryDimensionPacket(m?.dimensions?.emotional_reactivation,n),contact_recontact:secondaryDimensionPacket(m?.dimensions?.contact_recontact,n),in_person_meeting:secondaryDimensionPacket(m?.dimensions?.in_person_meeting,n),relationship_rebuilding:secondaryDimensionPacket(m?.dimensions?.relationship_rebuilding,n)}}));
 return {months,policy:raw?.policy??null,event_probability:"not_calculated"};
}
function reunionEvidenceContractPacket(raw:any,n:number){
 if(!raw||typeof raw!=="object")return null;
 const all=Array.isArray(raw?.evidence)?raw.evidence:[];
 const dirs=["counterpart_to_user","user_to_counterpart","shared","relationship_itself"];
 const per=Math.max(3,Math.min(12,n));
 const chosen=dirs.flatMap(direction=>all.filter((x:any)=>x?.direction===direction).sort((a:any,b:any)=>Number(a?.orb??99)-Number(b?.orb??99)).slice(0,per));
 return {version:raw?.version??null,available:Boolean(raw?.available),evidence:chosen.slice(0,48).map((x:any)=>({a:x?.a??null,aspect:x?.aspect??null,b:x?.b??null,orb:Number(x?.orb??99),tone:x?.tone??null,direction:x?.direction??null,phase:x?.phase??null,phase_basis:x?.phase_basis??null,exact_at:x?.exact_at??null,exact_at_basis:x?.exact_at_basis??null,reference_date:x?.reference_date??null,source_path:x?.source_path??null,relationship_domains:Array.isArray(x?.relationship_domains)?x.relationship_domains.slice(0,5):[],stage_hints:Array.isArray(x?.stage_hints)?x.stage_hints.slice(0,4):[],target_house:x?.target_house??null,event_probability:"not_calculated"})),policy:raw?.policy??null};
}
function compact(calc:any,ctx:any,purpose:Purpose,level=0){
 const r=calc?.result??{},n=r?.natal_synastry??{},exact=Boolean(n?.partner_time_exact),available=Boolean(n?.partner_time_available??exact);
 let aspects=(Array.isArray(n?.aspects)?n.aspects:[]).map(aspect).filter(Boolean).sort((a:any,b:any)=>a.orb-b.orb);
 if(!available)aspects=aspects.filter((a:any)=>!TIME_SENSITIVE.has(a.a)&&!TIME_SENSITIVE.has(a.b));
 const L=level===0?{static:36,focus:6,house:12,cross:12,chart:13,months:12,tight:5,ranked:12,days:14,hits:5,topMonths:10}:level===1?{static:28,focus:4,house:9,cross:9,chart:10,months:9,tight:3,ranked:9,days:10,hits:3,topMonths:8}:{static:20,focus:3,house:6,cross:6,chart:8,months:6,tight:2,ranked:6,days:8,hits:2,topMonths:6};
 const focus=r?.relationship_focus?.groups??{};
 const trans=r?.relationship_transits??r?.reunion_transits??null;
 const ctxMonths=Array.isArray(ctx?.months)?ctx.months.map((m:any)=>({calendar_month:m?.calendar_month,start:m?.start,end:m?.end,incoming:stat(m?.incoming),outgoing:stat(m?.outgoing),reconnection:stat(m?.reconnection)})):[];
 const rankedMonths=ctxMonths.map((m:any)=>({...m,rank_score:Number(m?.reconnection?.average??0)*.5+Number(m?.incoming?.average??0)*.35+Number(m?.outgoing?.average??0)*.15})).sort((a:any,b:any)=>b.rank_score-a.rank_score).slice(0,L.ranked);
 const advancedMonths=(Array.isArray(r?.months)?r.months:[]).slice(0,L.months).map((m:any)=>monthlyAdvancedPacket(m,L.tight));
 const transitDays=(Array.isArray(trans?.top_days)?trans.top_days:[]).slice(0,L.days).map((d:any)=>transitDay(d,L.hits)).filter(Boolean);
 const transitMonths=(Array.isArray(trans?.top_months)?trans.top_months:[]).slice(0,L.topMonths).map(transitMonth).filter(Boolean);
 const base=deep({
   analysis_mode:r?.analysis_mode??null,period:calc?.period,relationship_status:calc?.relationship_status,
   timing_contract:{timing_timezone_policy:r?.timing_timezone_policy??null,secondary_key:r?.secondary_key??null,tertiary_key:r?.tertiary_key??null,orb_policy:r?.orb_policy??null,interpretation_policy:r?.interpretation_policy??null},
   precision:{partner_time_available:available,partner_time_exact:exact,birth_time_reliability:r?.birth_time_reliability??null,sensitivity_scan:sensitivityPacket(r?.sensitivity_scan),removed_time_sensitive_count:(Array.isArray(n?.aspects)?n.aspects.length:0)-aspects.length},
   static:{aspects:aspects.slice(0,L.static),strongest:aspects.slice(0,Math.min(14,L.static))},
   focus:focusPacket(focus,L.focus),
   house_overlays:housePacket(r?.house_overlays,L.house),
   saju_relationship:sajuPacket(r?.saju_relationship,L.cross),
   advanced:{composite:advancedPacket(r?.composite,L.chart),davison:advancedPacket(r?.davison,L.chart),marks:advancedPacket(r?.marks,L.chart),months:advancedMonths},
   directional:purpose==="reunion"&&ctx?{period:ctx?.period,incoming:stat(ctx?.incoming),outgoing:stat(ctx?.outgoing),reconnection:stat(ctx?.reconnection),ranked_months:rankedMonths}:null,
   reunion_hierarchy:purpose==="reunion"?hierarchyPacket(r?.reunion_hierarchy):null,
   reunion_dimensions:purpose==="reunion"?reunionDimensionPacket(r?.reunion_dimensions,L.ranked):null,
   reunion_secondary_support:purpose==="reunion"?secondarySupportPacket(r?.reunion_secondary_support,L.months):null,
   reunion_evidence_contract:purpose==="reunion"?reunionEvidenceContractPacket(r?.reunion_evidence_contract,L.months):null,
   reunion_timing_windows:purpose==="reunion"?r?.reunion_timing_windows??null:null,
   reunion_return_support:purpose==="reunion"?r?.reunion_return_support??null:null,
   transit_triggers:trans?{period:trans?.period,policy:trans?.policy,top_days:transitDays,top_months:transitMonths}:null,
   limitations:Array.isArray(r?.limitations)?r.limitations.slice(0,8):[]
 });
 if(purpose==="reunion"){
   const reunion_evidence_v2=buildReunionEvidenceV2(base);
   return {analysis_mode:base.analysis_mode,period:base.period,relationship_status:base.relationship_status,timing_contract:base.timing_contract,precision:base.precision,saju_relationship:base.saju_relationship,reunion_hierarchy:base.reunion_hierarchy,reunion_dimensions:base.reunion_dimensions,reunion_secondary_support:base.reunion_secondary_support,reunion_evidence_contract:base.reunion_evidence_contract,reunion_timing_windows:base.reunion_timing_windows,reunion_return_support:base.reunion_return_support,reunion_evidence_v2,limitations:base.limitations};
 }
 return base;
}
function selectPromptPacket(calc:any,ctx:any,purpose:Purpose){let originalBytes=0,last:any=null;for(let level=0;level<=2;level++){const payload=compact(calc,ctx,purpose,level);const budget=promptBudget(payload,purpose);if(level===0)originalBytes=budget.bytes;last={payload,budget,compression_level:level,original_prompt_bytes:originalBytes};if(budget.ok)return last;}return last;}


const SYSTEM=`너는 '별빛의 운명'의 관계 전문 리더다. 사용자가 별도로 차트를 복사해 다른 GPT에게 물어볼 필요가 없도록 계산 근거가 풍부한 리딩을 작성한다. 다만 계산되지 않은 사실·상대의 실제 속마음·사건 확률을 만들지 않는다.

공통 절대규칙:
- 재회 시기 선정의 최우선 기준은 reunion_hierarchy이다. 장기 35%·중기 25%·단기 25%·체계 교차 15%이며 장기·중기 관문을 통과해야 한다. 빠른 트리거 우선이나 85/15 규칙은 사용하지 않는다.
- 현재 기준일은 reunion_hierarchy.as_of_date이다. 메인 결론은 오늘 이후 TOP 3와 nearest_window를 구분하고 감정/연락/만남/관계 재정의/안정적 유지 구조를 분리한다. 지난 활성기는 미래 후보로 표현하지 않는다.
- 전문 근거보다 최종 결론과 쉬운 설명을 먼저 쓴다. 점수는 확률이 아니다. 미구현 체계·UNVERIFIED 검증 항목은 검증 완료로 쓰지 않는다.
- '끊어지지 않는 인연', '운명적으로 다시 만난다', '서로를 지울 수 없다', '반드시 연락한다', '상대가 아직 사랑한다'는 쓰지 않는다. 차트로 실제 행동이나 속마음을 확정하지 않는다.
- 서양 내부 진행·회귀·트랜짓은 서양 한 체계다. 사주·자미두수와의 교차만 독립 체계로 센다. 자미두수 coverage가 false이면 자미 근거를 만들지 않는다.

- 출생시간을 입력했다는 사실과 정밀 검증은 다르다. precision.birth_time_reliability를 우선 확인한다. exact가 아니어도 입력 생시 기반 Moon·ASC/DSC/MC/IC·하우스·Davison/Marks가 데이터에 제공되면 provisional(잠정) 참고 근거로 읽을 수 있지만, 확정·결정적 근거로 승격하지 않는다. sensitivity_scan 경고와 evidence_confidence를 함께 보고 흔들리는 각도/하우스는 보조 맥락으로만 쓴다.
- 오브가 좁은 실제 접점을 우선한다. 접점 개수보다 orb_grade·evidence_confidence·time_sensitivity를 우선한다.
- 레이어 우선순위는 Natal structure > Secondary Progression > 주요/중장기 Transit > 빠른 Daily Transit > Tertiary/Marks 보조층이다. 하위 보조층 하나만으로 상위 레이어 결론을 뒤집지 않는다.
- sensitivity_scan은 진단용이며 exact 생시 확정이나 사건확률 계산에 사용하지 않는다.
- 재회운에서는 CALCULATED_DATA.reunion_dimensions의 ① emotional_reactivation(감정 활성) ② contact_recontact(연락·재접촉) ③ in_person_meeting(실제 만남) ④ relationship_rebuilding(관계 재결합)을 절대 하나로 합치지 않는다. 감정 활성↑ ≠ 연락↑ ≠ 만남↑ ≠ 재결합↑이다. incoming/outgoing은 상대측/내측 차트 활성이지 선연락 주체가 아니다.
- reunion_secondary_support는 daily transit 점수와 합산하지 않는다. Secondary Progression(2차 진행)은 기간/배경 신호로만 읽고 정확한 날짜를 만들지 않는다. 특정 날짜는 CALCULATED_DATA.reunion_timing_windows에 존재하는 fast transit trigger 날짜만 제시한다. Marks/Tertiary 단독 신호로 관계 재결합 결론을 뒤집지 않는다.
- 누가 먼저 움직이는지는 reunion_evidence_v2.initiative_gate가 available=true일 때만 방향을 말한다. false면 반드시 판정 불가로 쓰고, 상대측 활성만으로 상대가 먼저 연락한다고 단정하지 않는다.
- Return(회귀)이 Daily Transit과 같은 현상을 재표현한 경우 독립 근거로 중복 가산하지 않는다.
- 각 핵심 문단마다 가능한 한 실제 애스펙트 이름과 오브를 1~3개 근거로 든다.
- 생시 미상으로 제거된 Moon(달)·각도점·하우스는 추측하지 않는다. 사용 가능하지 않은 Davison(데이비슨)·Marks(마크스)도 추측 금지.
- 정확 생시에서 house_overlays의 whole_house(홀사인)와 placidus_house(플라시두스)를 둘 다 읽는다. 둘이 같은 하우스를 가리키면 중첩 근거로, 다르면 각 체계의 의미를 분리해 설명하며 한 체계로 덮어쓰거나 임의 평균하지 않는다.
- 점수와 접점 개수는 확률이 아니다. 좋은 말/나쁜 말을 억지로 균형 맞추지 않는다.
- timing_contract의 fixed UTC offset·local noon 규칙을 그대로 따른다. IANA/DST를 임의 추정해 날짜를 바꾸지 않는다.
- advanced.composite와 advanced.months의 progressed_synastry·progressed_composite·marks_tertiary를 서로 다른 계산층으로 읽고 signal_summary 하나로 뭉개지 않는다.
- CALCULATED_DATA.reunion_evidence_contract가 있으면 진행 근거의 방향을 반드시 구분한다: counterpart_to_user=상대 진행차트가 사용자 출생차트를 자극하는 방향, user_to_counterpart=사용자 진행차트가 상대 출생차트를 자극하는 방향, shared=현재 두 진행차트의 상호 접점, relationship_itself=진행 컴포지트로 본 관계 자체의 현재 단계다. 이 방향은 실제 속마음이나 실제 행동의 관측값이 아니다.
- reunion_evidence_contract.phase는 applying=월별 오브가 더 가까워지는 흐름, separating=가장 가까운 구간을 지나 멀어지는 흐름, exact=샘플 날짜에서 0.02° 이내인 근접 정점으로만 읽는다. exact_at이 null이면 정확일을 새로 만들지 않는다.
- 전문용어를 전부 숨기지 않는다. 핵심 문단에는 실제 행성·각·오브 1~2개를 보여준 뒤 바로 사람 말로 뜻을 풀어 쓴다. 기술값만 나열하거나 기술값 없는 추상 요약만 쓰지 않는다.
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
CALCULATED_DATA.reunion_evidence_v2를 재회 해설의 1차 근거 계약으로 사용한다. 원시 차트 이름을 나열하지 말고 다음 다섯 질문에 답한다: ① 왜 다시 연결될 여지가 있는가 ② 누가 먼저 움직이는 흐름인가 ③ 언제 접점이 강해지는가 ④ 다시 붙으면 관계가 유지될 구조인가 ⑤ 무엇이 다시 깨뜨릴 위험인가.
- 각 핵심 결론에는 reunion_evidence_v2에 실제 존재하는 evidence_refs를 반드시 붙인다. 존재하지 않는 ref를 만들지 않는다.
- 가능한 경우 서로 다른 independence_group 2개 이상을 종합한다. 같은 파생계열 반복은 수렴 근거로 세지 않는다.
- natal synastry는 기본 상호작용, composite는 관계 자체의 기본 구조, Davison은 현실의 관계 과제, Marks A/B는 각 방향의 관계 경험, progressed synastry는 현재 두 사람의 진행 접점, progressed composite는 관계 자체의 현재 단계, Marks tertiary와 daily transit은 단기 시기 촉발로 역할을 분리한다.
- 감정 활성 / 연락·재접촉 / 실제 만남 / 관계 재결합을 네 단계로 분리하고 한 단계의 강함을 다음 단계의 성립으로 자동 승격하지 않는다.
- CALCULATED_DATA.reunion_return_support의 Solar Return(태양회귀)은 연간 배경, Lunar Return(달회귀)은 월간·정서 배경으로만 사용한다. Return만으로 구체 날짜를 만들지 말고, 이미 fast transit trigger를 통과한 날짜들 사이에서 배경 교차검증/동률 해소에만 사용한다. 같은 천문 현상을 transit과 Return으로 중복 가산하지 않는다.
- Return에서 user/counterpart 쪽이 활성됐다는 사실은 선연락 방향 근거가 아니다. Return은 initiative(누가 먼저 움직이는가) 판정에 사용하지 말고, 방향은 initiative_gate가 available일 때만 따른다.
- 사용자 본문에서는 Solar Return/Lunar Return 기술명을 앞세우지 말고 각각 '연간 배경', '월간 배경'으로 먼저 풀어 쓴다. 기술명은 정밀도·근거 설명에서만 병기한다.
- 재회 모드에서는 원시 advanced/directional/transit 표를 중복 전달하지 않고 reunion_evidence_v2가 질문별로 압축한 근거를 사용한다.
- "실제 행동을 봐", "속단하지 마", "대화가 중요해" 같은 범용 조언은 전체 해설에서 한 번을 넘기지 말고, 대신 계산 근거가 만드는 구체적 관계 역학을 설명한다.
- 시기창은 기간 신호와 날짜 트리거를 분리한다. Secondary Progression은 기간 배경만 만들고, 특정 날짜는 reunion_timing_windows에 실제 fast transit trigger가 있을 때만 제시한다.
- reunion_evidence_contract가 있으면 why_reconnect와 rebuild 해설 안에서 가능한 범위에 한해 네 층을 빠뜨리지 않는다: ① 나→상대 ② 상대→나 ③ 현재 두 사람의 진행차트끼리 ④ 진행 컴포지트로 본 관계 자체. 근거가 없는 층은 만들지 않는다.
- 각 핵심 해설 단락은 '계산 근거 → 쉬운 뜻 → 실제 관계에서 나타날 수 있는 장면 → 함께 걸리는 반대/제약 근거 → 종합' 순서로 쓴다. 좋은 각 하나로 재회를 확정하거나 나쁜 각 하나로 종료를 확정하지 않는다.
- applying과 separating을 문장에 반영한다. applying은 앞으로 강해지는 배경, separating은 최근 강했던 흐름의 흔적으로 설명하며, separating 근거를 미래 예고처럼 쓰지 않는다.
- 진행 시너스트리의 counterpart_to_user는 '상대가 실제로 이렇게 느낀다'가 아니라 '상대의 현재 진행 흐름이 사용자의 어떤 영역을 자극하는 구도'라고 표현한다. 관측되지 않은 속마음·의도·행동을 사실처럼 쓰지 않는다.

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
const REUNION_SCHEMA:any={type:"OBJECT",properties:{bottom_line:S,contact_recontact:S,emotional_reactivation:S,relationship_rebuilding:S,incoming_contact:S,outgoing_contact:S,reconnection_windows:S,low_windows:S,relationship_filter:S,precision_note:S},required:["bottom_line","contact_recontact","emotional_reactivation","relationship_rebuilding","incoming_contact","outgoing_contact","reconnection_windows","low_windows","relationship_filter","precision_note"]};
const REF_ARRAY:any={type:"ARRAY",items:S};
const REUNION_V2_SECTION:any={type:"OBJECT",properties:{conclusion:S,interpretation:S,evidence_refs:REF_ARRAY},required:["conclusion","interpretation","evidence_refs"]};
const REUNION_V2_SCHEMA:any={type:"OBJECT",properties:{summary:S,why_reconnect:REUNION_V2_SECTION,initiative:REUNION_V2_SECTION,timing:{type:"OBJECT",properties:{conclusion:S,windows:{type:"ARRAY",items:{type:"OBJECT",properties:{period:S,meaning:S,evidence_refs:REF_ARRAY},required:["period","meaning","evidence_refs"]}},evidence_refs:REF_ARRAY},required:["conclusion","windows","evidence_refs"]},rebuild:{type:"OBJECT",properties:{conclusion:S,conditions:{type:"ARRAY",items:S},evidence_refs:REF_ARRAY},required:["conclusion","conditions","evidence_refs"]},repeat_risks:{type:"OBJECT",properties:{conclusion:S,patterns:{type:"ARRAY",items:S},evidence_refs:REF_ARRAY},required:["conclusion","patterns","evidence_refs"]},convergence:{type:"ARRAY",items:{type:"OBJECT",properties:{theme:S,period:S,meaning:S,evidence_refs:REF_ARRAY},required:["theme","period","meaning","evidence_refs"]}},precision_note:S},required:["summary","why_reconnect","initiative","timing","rebuild","repeat_risks","convergence","precision_note"]};
const MARRIAGE_SCHEMA:any={type:"OBJECT",properties:{mode:S,bottom_line:S,bond:S,emotional_home:S,daily_life:S,intimacy_resources:S,conflict_repair:S,commitment_or_current_cycle:S,timing:S,caution:S,precision_note:S},required:["mode","bottom_line","bond","emotional_home","daily_life","intimacy_resources","conflict_repair","commitment_or_current_cycle","timing","caution","precision_note"]};
function schemaFor(purpose:Purpose){
 if(purpose==="reunion")return {type:"OBJECT",properties:{headline:S,overview:S,timing:S,reunion_context:S,practical_advice:{type:"ARRAY",items:S},top_aspects:{type:"ARRAY",items:{type:"OBJECT",properties:{label:S,meaning:S},required:["label","meaning"]}},limits:S,reunion_synthesis_v2:REUNION_V2_SCHEMA},required:["headline","overview","timing","reunion_context","practical_advice","top_aspects","limits","reunion_synthesis_v2"]};
 const properties:any={...COMMON_SCHEMA};const required=["headline","overview","chemistry","emotional_dynamic","communication","conflict_pattern","power_boundaries","long_term","timing","reunion_context","felt_scenarios","practical_advice","top_aspects","limits"];
 if(purpose.startsWith("marriage_")){properties.marriage_reading=MARRIAGE_SCHEMA;required.push("marriage_reading");}
 return {type:"OBJECT",properties,required};
}

function usage(raw:any){const u=raw?.usageMetadata??{};return {prompt_tokens:Number(u.promptTokenCount??0),candidate_tokens:Number(u.candidatesTokenCount??0),thought_tokens:Number(u.thoughtsTokenCount??0),total_tokens:Number(u.totalTokenCount??0)};}
function cleanRefs(v:any){return Array.isArray(v)?v.slice(0,12).map((x:any)=>cut(x,180)).filter(Boolean):[];}
function cleanV2Section(v:any){return {conclusion:cut(v?.conclusion,2200),interpretation:cut(v?.interpretation,3200),evidence_refs:cleanRefs(v?.evidence_refs)};}
function cleanReunionV2(v:any){return {summary:cut(v?.summary,3200),why_reconnect:cleanV2Section(v?.why_reconnect),initiative:cleanV2Section(v?.initiative),timing:{conclusion:cut(v?.timing?.conclusion,2600),windows:Array.isArray(v?.timing?.windows)?v.timing.windows.slice(0,4).map((x:any)=>({period:cut(x?.period,120),meaning:cut(x?.meaning,1800),evidence_refs:cleanRefs(x?.evidence_refs)})):[],evidence_refs:cleanRefs(v?.timing?.evidence_refs)},rebuild:{conclusion:cut(v?.rebuild?.conclusion,2600),conditions:Array.isArray(v?.rebuild?.conditions)?v.rebuild.conditions.slice(0,4).map((x:any)=>cut(x,900)):[],evidence_refs:cleanRefs(v?.rebuild?.evidence_refs)},repeat_risks:{conclusion:cut(v?.repeat_risks?.conclusion,2600),patterns:Array.isArray(v?.repeat_risks?.patterns)?v.repeat_risks.patterns.slice(0,4).map((x:any)=>cut(x,900)):[],evidence_refs:cleanRefs(v?.repeat_risks?.evidence_refs)},convergence:Array.isArray(v?.convergence)?v.convergence.slice(0,5).map((x:any)=>({theme:cut(x?.theme,500),period:cut(x?.period,120),meaning:cut(x?.meaning,1600),evidence_refs:cleanRefs(x?.evidence_refs)})):[],precision_note:cut(v?.precision_note,1800)};}
function validate(o:any,p:Purpose){if(!o||typeof o!=="object")return null;const rr=o.reunion_reading??{},rv2=o.reunion_synthesis_v2??{},mr=o.marriage_reading??{};const out:any={headline:cut(o.headline,450),overview:cut(o.overview,6500),chemistry:cut(o.chemistry,4200),emotional_dynamic:cut(o.emotional_dynamic,4200),communication:cut(o.communication,4200),conflict_pattern:cut(o.conflict_pattern,4200),power_boundaries:cut(o.power_boundaries,3800),long_term:cut(o.long_term,4500),timing:cut(o.timing,3500),reunion_context:cut(o.reunion_context,3500),felt_scenarios:Array.isArray(o.felt_scenarios)?o.felt_scenarios.slice(0,4).map((x:any)=>cut(x,1300)):[],reunion_reading:{bottom_line:cut(rr.bottom_line,4500),contact_recontact:cut(rr.contact_recontact,4000),emotional_reactivation:cut(rr.emotional_reactivation,4000),relationship_rebuilding:cut(rr.relationship_rebuilding,4500),incoming_contact:cut(rr.incoming_contact,4000),outgoing_contact:cut(rr.outgoing_contact,3500),reconnection_windows:cut(rr.reconnection_windows,6000),low_windows:cut(rr.low_windows,3500),relationship_filter:cut(rr.relationship_filter,4500),precision_note:cut(rr.precision_note,1800)},reunion_synthesis_v2:cleanReunionV2(rv2),marriage_reading:{mode:cut(mr.mode,80),bottom_line:cut(mr.bottom_line,4800),bond:cut(mr.bond,4200),emotional_home:cut(mr.emotional_home,4200),daily_life:cut(mr.daily_life,4800),intimacy_resources:cut(mr.intimacy_resources,4600),conflict_repair:cut(mr.conflict_repair,4200),commitment_or_current_cycle:cut(mr.commitment_or_current_cycle,4200),timing:cut(mr.timing,3800),caution:cut(mr.caution,3800),precision_note:cut(mr.precision_note,1800)},practical_advice:Array.isArray(o.practical_advice)?o.practical_advice.slice(0,4).map((x:any)=>cut(x,1200)):[],top_aspects:Array.isArray(o.top_aspects)?o.top_aspects.slice(0,10).map((x:any)=>({label:cut(x?.label,500),meaning:cut(x?.meaning,1800)})):[],limits:cut(o.limits,2200)};if(p!=="reunion"){out.reunion_reading={bottom_line:"",contact_recontact:"",emotional_reactivation:"",relationship_rebuilding:"",incoming_contact:"",outgoing_contact:"",reconnection_windows:"",low_windows:"",relationship_filter:"",precision_note:""};out.reunion_synthesis_v2=cleanReunionV2({});}if(!p.startsWith("marriage_"))out.marriage_reading={mode:"",bottom_line:"",bond:"",emotional_home:"",daily_life:"",intimacy_resources:"",conflict_repair:"",commitment_or_current_cycle:"",timing:"",caution:"",precision_note:""};return deep(out);}

function grounded(data:any,payload:any,p:Purpose,relaxed=false){
 const all=JSON.stringify(data),src=JSON.stringify(payload);
 const forbidden=["갑기합","을경합","병신합","정임합","무계합","신강","신약","용신","희신","기신","배우자성","합혼점수"];
 for(const word of forbidden)if(all.includes(word)&&!src.includes(word))return false;
 const unknownTime=payload?.precision?.partner_time_exact===false;
 const scale=relaxed?.60:(unknownTime?.72:1);
 const need=(n:number)=>Math.max(40,Math.floor(n*scale));
 if(p==="reunion"){
   const v2=data?.reunion_synthesis_v2??{};
   const validEvidenceRefs=new Set((payload?.reunion_evidence_v2?.evidence??[]).map((x:any)=>String(x?.id??"")).filter(Boolean));
   const refs=[...(v2?.why_reconnect?.evidence_refs??[]),...(v2?.initiative?.evidence_refs??[]),...(v2?.timing?.evidence_refs??[]),...(v2?.rebuild?.evidence_refs??[]),...(v2?.repeat_risks?.evidence_refs??[]),...(v2?.timing?.windows??[]).flatMap((x:any)=>x?.evidence_refs??[]),...(v2?.convergence??[]).flatMap((x:any)=>x?.evidence_refs??[])];
   const distinctValidRefs=new Set(refs.map((x:any)=>String(x)).filter((x:string)=>validEvidenceRefs.has(x)));
   if(String(v2?.summary??"").length<need(180)||refs.some((x:any)=>!validEvidenceRefs.has(String(x)))||distinctValidRefs.size<3)return false;
 }
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
 if(p==="reunion"){
   const r=data.reunion_synthesis_v2??{};
   const why=`${String(r?.why_reconnect?.conclusion??"")} ${String(r?.why_reconnect?.interpretation??"")}`.trim();
   if(String(r?.summary??"").length<need(260))return false;
   if(why.length<need(420))return false;
   if(String(r?.timing?.conclusion??"").length<need(220))return false;
   if(String(r?.rebuild?.conclusion??"").length<need(240))return false;
   if(String(r?.repeat_risks?.conclusion??"").length<need(140))return false;
 }
 return true;
}

function modeInstruction(purpose:Purpose){return purpose==="compatibility"?"일반 연애 궁합이다. 표준 궁합 포인트와 사주 관계층을 빠짐없이 읽고 각 섹션을 충분히 길게 써라.":purpose==="reunion"?"재회운이다. 감정 활성→연락·재접촉→실제 만남→관계 재결합을 네 개의 독립 단계로 읽고 절대 자동 승격하지 마라. reunion_evidence_v2의 다섯 질문을 순서대로 종합하되 initiative_gate가 닫혀 있으면 누가 먼저 연락하는지 판정하지 않는다. 날짜와 기간은 reunion_hierarchy의 오늘 이후 top_periods 및 nearest_window가 제공한 문자열만 그대로 인용한다. 날짜 문자열을 새로 만들거나, 이미 지난 날짜를 미래 핵심 시기처럼 제시하거나, 기존 빠른 트랜짓·진행각·Return 배경으로 새 날짜를 만들어서는 안 된다. hierarchy에 없는 월·기간을 핵심 시기로 승격하지 않는다. 같은 원자료 파생 신호를 여러 표에서 반복해 강도를 부풀리지 말고, 독립 계열이 충돌하면 평균내지 말고 단계별 차이를 설명하라. reunion_hierarchy.stages의 activation은 현재 감정 세기나 사건 확률이 아니라 조회 범위 안에서 선택된 미래 후보 중 최고 활성도다. candidate_count가 0이거나 activation이 null이면 그 단계에는 공개할 미래 후보가 없다고 써라. contact_recontact 후보가 없는데 '연락 기운이 살아 있다', '연결될 여지가 커진다', '연락이 가까워졌다'처럼 쓰지 마라. contact_recontact 후보는 있지만 in_person_meeting 또는 relationship_rebuilding 후보가 없으면 '연락 후보는 있으나 만남·재구축 단계는 아직 열리지 않았다'고 분리해서 써라. generic incoming/outgoing/reconnection 점수로 hierarchy gate를 덮어쓰지 마라. natal/시너스트리처럼 매 계산에서 고정되는 관계 구조는 짧게 요약하고, 이번 조회에서 달라진 stage·nearest window·future top periods를 우선 설명한다. '카르마적 인연', '운명적 인연', '끊을 수 없는 인연'처럼 검증 불가능한 숙명 표현을 쓰지 않는다. 범용 상담문구 대신 이번 계산의 구체적 단계 차이를 현실 관계 장면으로 번역하라. summary는 첫 2~3문장 안에서 현재 가장 가까운 단계와 아직 열리지 않은 다음 단계를 대비해 설명하고, 점수보다 실제 관계에서 무엇이 달라 보이는지를 먼저 말한다. timing.conclusion은 날짜 목록을 다시 쓰지 말고 감정→연락→만남→재구축 중 지금 어디에 있고 다음 단계로 넘어가려면 무엇이 더 필요한지를 설명한다. rebuild는 연락이 생긴 뒤 관계 회복 여부를 가르는 현실 조건을 최대 3개로 좁힌다. repeat_risks는 현재 단계와 직접 연결되는 근거가 있는 문제만 최대 2개 쓰고, '균형·성장·조율·신중함' 같은 추상어만으로 문장을 만들지 않는다. why_reconnect는 고정 natal/시너스트리 구조를 장황하게 반복하지 말고 이번 흐름을 이해하는 데 필요한 만큼만 짧게 쓴다. 단, '짧게'를 한두 문장으로 끝내라는 뜻으로 해석하지 마라. summary는 5~7문장으로 현재 가장 앞선 단계, 연락 단계의 후보 유무, 아직 열리지 않은 다음 단계를 분명히 대비한다. why_reconnect는 conclusion+interpretation을 합쳐 6~9문장으로 왜 다시 신경 쓰일 수 있는지와 그것이 실제 연락과 어떻게 다른지 현실 장면까지 번역한다. timing.conclusion은 4~6문장으로 현재 단계와 다음 단계 사이에 무엇이 더 필요한지 설명한다. rebuild.conclusion은 4~6문장으로 연락 이후 실제 만남과 관계 재구축까지 무엇을 확인해야 하는지 말한다. repeat_risks는 3~5문장으로 현재 단계와 연결되는 반복 위험만 설명한다. 점수가 중간대이거나 후보 수가 적으면 강한 표현으로 부풀리지 말고, 후보가 없으면 없는 단계를 분명히 말한다. 같은 뜻을 다른 말로 반복해 분량을 채우지 말고, 근거가 허용하는 범위에서 답장·대화 재개·약속 제안·실제 만남·관계 정의 같은 현실 장면을 조건형으로 넣어라. 사용자 본문은 '무슨 뜻인지 → 현실에서 어떻게 나타날 수 있는지 → 다음 단계와 무엇이 다른지' 순서로 쓰고, 오브와 전문용어 나열은 기술 근거로 밀어라.":purpose==="marriage_unmarried"?"특정 상대가 있는 미혼 결혼궁합이다. 두 사람이 결혼생활로 들어갈 경우의 결속·정서적 집·생활 역할·돈/공유자원·친밀감·갈등회복·책임을 분리해 읽고, 결혼으로 공식화될 가능성과 프러포즈·약혼·결혼 결정이 강해지는 시기 흐름도 계산 근거 범위에서 적극적으로 제시하되 확정 사실처럼 단정하지 마라.":"이미 결혼한 두 사람의 결혼생활 분석이다. 결혼 가능성 표현은 금지하고 현재 결속·정서적 거리·생활 역할·공유재정/친밀감·반복갈등·회복 주기를 읽어라.";}
function promptText(payload:any,purpose:Purpose,compactMode=false){return `PURPOSE=${purpose}\n${modeInstruction(purpose)}\n${compactMode?"재시도다. 완전한 JSON을 만들되 근거·오브·사주 허용필드·시기는 유지하고 중복만 줄여라.\n":""}CALCULATED_DATA=${JSON.stringify(payload)}`;}
function relationshipOutputTokens(purpose:Purpose,compactMode:boolean){if(purpose==="reunion")return compactMode?6500:8500;return compactMode?12000:16000;}
function relationshipEstimatedJobKrw(inputTokens:number,purpose:Purpose){const intro=Date.now()<=GEMINI_INTRO_END,inputRate=intro ? .75 : 1.5,outputRate=intro ? 3.75 : 7.5,thoughtReserve=3000;const one=(output:number)=>((inputTokens/1_000_000)*inputRate+((output+thoughtReserve)/1_000_000)*outputRate)*GEMINI_USD_KRW_ESTIMATE;return one(relationshipOutputTokens(purpose,false))+one(relationshipOutputTokens(purpose,true));}
function promptBudget(payload:any,purpose:Purpose){const bytes=enc.encode(SYSTEM+promptText(payload,purpose,false)).length,estimated_input_tokens=Math.ceil(bytes/2.6),estimated_max_job_krw=relationshipEstimatedJobKrw(estimated_input_tokens,purpose);return {bytes,max_bytes:MAX_PROMPT_BYTES,estimated_input_tokens,estimated_max_job_krw,max_job_krw:MAX_AI_JOB_ESTIMATED_KRW,ok:bytes<=MAX_PROMPT_BYTES&&estimated_max_job_krw<=MAX_AI_JOB_ESTIMATED_KRW};}
function addUsage(a:any,b:any){return {prompt_tokens:Number(a?.prompt_tokens??0)+Number(b?.prompt_tokens??0),candidate_tokens:Number(a?.candidate_tokens??0)+Number(b?.candidate_tokens??0),thought_tokens:Number(a?.thought_tokens??0)+Number(b?.thought_tokens??0),total_tokens:Number(a?.total_tokens??0)+Number(b?.total_tokens??0)};}
async function sha(value:string){const digest=await crypto.subtle.digest("SHA-256",enc.encode(value));return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");}
function stable(v:any):string{if(v===null||typeof v!=="object")return JSON.stringify(v);if(Array.isArray(v))return `[${v.map(stable).join(",")}]`;return `{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;}

async function generate(payload:any,purpose:Purpose,model:string,key:string,compactMode=false){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),115000);try{const prompt=promptText(payload,purpose,compactMode);const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:"POST",signal:controller.signal,headers:{"Content-Type":"application/json","x-goog-api-key":key},body:JSON.stringify({systemInstruction:{parts:[{text:SYSTEM}]},contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json",responseSchema:schemaFor(purpose),maxOutputTokens:relationshipOutputTokens(purpose,compactMode),temperature:.32,thinkingConfig:{thinkingLevel:"medium"}}})});const rawText=await r.text();if(!r.ok)return publicRelationshipError("REL_GENERATION_FAILED",{model,usage:{prompt_tokens:0,candidate_tokens:0,thought_tokens:0,total_tokens:0}});let raw:any;try{raw=JSON.parse(rawText)}catch{return publicRelationshipError("REL_RESULT_INVALID",{model})}const u=usage(raw),parts=raw?.candidates?.[0]?.content?.parts??[];let txt=parts.filter((x:any)=>!x?.thought).map((x:any)=>x?.text??"").join("").trim()||parts.map((x:any)=>x?.text??"").join("").trim();txt=txt.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"");try{let data=validate(JSON.parse(txt),purpose);if(!data)return publicRelationshipError("REL_RESULT_INVALID",{model,usage:u});if(purpose==="reunion"){const repaired=repairReunionGroundingV2(data,payload);if(!repaired.ok)return publicRelationshipError("REL_RESULT_INVALID",{model,usage:u});data=repaired.data;}if(!grounded(data,payload,purpose,compactMode))return publicRelationshipError("REL_RESULT_INVALID",{model,usage:u});return {ok:true,data,model,interpreter_version:versionForPurpose(purpose),usage:u};}catch{return publicRelationshipError("REL_RESULT_INVALID",{model,usage:u});}}catch(e){return publicRelationshipError(e instanceof DOMException&&e.name==="AbortError"?"REL_GENERATION_TIMEOUT":"REL_GENERATION_FAILED",{model,usage:{prompt_tokens:0,candidate_tokens:0,thought_tokens:0,total_tokens:0}});}finally{clearTimeout(timer);}}
async function calculate(payload:any,purpose:Purpose,preferred:string,key:string){let calls=0;const first:any=await generate(payload,purpose,preferred,key,false);calls+=1;const firstUsage=first.usage??{};if(first.ok)return {...first,usage:{...firstUsage,attempt_count:calls}};if(calls>=MAX_GEMINI_CALLS)return {...first,usage:{...firstUsage,attempt_count:calls}};const retryModel=preferred===DEFAULT_MODEL?FALLBACK_MODEL:preferred;const second:any=await generate(payload,purpose,retryModel,key,true);calls+=1;const total=addUsage(firstUsage,second.usage??{});if(second.ok)return {...second,usage:{...total,attempt_count:calls},...(retryModel!==preferred?{fallback_from:preferred}:{})};return publicRelationshipError(second.error_code??"REL_GENERATION_FAILED",{model:preferred,interpreter_version:versionForPurpose(purpose),usage:{...total,attempt_count:calls}});}

async function countJobs(admin:any,userId:string|null,since:string){let q=admin.from("ai_interpret_jobs").select("id",{count:"exact",head:true}).like("kind","supabase-relationship-v11%").gte("created_at",since);if(userId)q=q.eq("user_id",userId);const {count,error}=await q;if(error)throw error;return Number(count??0);}
async function rollingGuard(admin:any,userId:string){const now=Date.now();const u10=await countJobs(admin,userId,new Date(now-10*60*1000).toISOString()),u24=await countJobs(admin,userId,new Date(now-24*60*60*1000).toISOString()),g10=await countJobs(admin,null,new Date(now-10*60*1000).toISOString()),g24=await countJobs(admin,null,new Date(now-24*60*60*1000).toISOString());if(u10>=MAX_USER_NEW_JOBS_10M)return `내 계정에서 10분 동안 새 관계 해설 ${MAX_USER_NEW_JOBS_10M}건 한도에 도달했어.`;if(u24>=MAX_USER_NEW_JOBS_24H)return `내 계정에서 24시간 새 관계 해설 ${MAX_USER_NEW_JOBS_24H}건 한도에 도달했어.`;if(g10>=MAX_GLOBAL_NEW_JOBS_10M)return `전체 10분 새 관계 해설 ${MAX_GLOBAL_NEW_JOBS_10M}건 안전 한도에 도달했어.`;if(g24>=MAX_GLOBAL_NEW_JOBS_24H)return `전체 24시간 새 관계 해설 ${MAX_GLOBAL_NEW_JOBS_24H}건 안전 한도에 도달했어.`;return "";}

Deno.serve(async(req)=>{
let failureCode:RelationshipErrorCode="REL_INVALID_REQUEST";let failureExtras:unknown={};
try{if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});if(req.method!=="POST")return respond(publicRelationshipError("REL_METHOD_NOT_ALLOWED"),405);let b:any;try{b=await req.json();}catch{return respond(publicRelationshipError("REL_INVALID_REQUEST"),400);}if(!b?.calculation)return respond(publicRelationshipError("REL_INVALID_REQUEST"),400);const purpose=String(b.purpose??"compatibility") as Purpose;if(!["compatibility","reunion","marriage_unmarried","marriage_married"].includes(purpose))return respond(publicRelationshipError("REL_INVALID_REQUEST"),400);if(!SUPABASE_URL||!SERVICE)return respond(publicRelationshipError("REL_UPSTREAM_NOT_CONFIGURED",{cost_guard_blocked:true}),200);const auth=(req.headers.get("authorization")??"").replace(/^Bearer\s+/i,"").trim();if(!auth)return respond(publicRelationshipError("REL_AUTH_REQUIRED"),401);const admin=createClient(SUPABASE_URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});failureCode="REL_AUTH_REQUIRED";const {data:{user},error:userError}=await admin.auth.getUser(auth);if(userError||!user)return respond(publicRelationshipError("REL_AUTH_REQUIRED"),401);const preferred=MODELS.has(String(b.model))?String(b.model):DEFAULT_MODEL;failureCode="REL_INVALID_REQUEST";const pack=selectPromptPacket(b.calculation,b.reunion_context,purpose);const payload=pack.payload;if(purpose==="reunion"&&payload?.reunion_hierarchy?.validation?.status!=="PASS")return respond({ok:false,error:"재회 계산 검증 통과 후 해설을 생성할 수 있습니다. 다시 계산해주세요."},422);const budget=pack.budget;if(!budget.ok)return respond({...publicRelationshipError("REL_COST_GUARD_BLOCKED",{cost_guard_blocked:true}),prompt_budget:true,error:`관계 해설을 3단계로 압축했지만 예상 최대 비용 약 ${Math.round(budget.estimated_max_job_krw)}원이 작업 상한 ${budget.max_job_krw}원을 넘어 Gemini 호출을 막았어.`,prompt_bytes:budget.bytes,max_prompt_bytes:budget.max_bytes,estimated_max_job_krw:budget.estimated_max_job_krw,max_job_krw:budget.max_job_krw,prompt_compression_level:pack.compression_level,original_prompt_bytes:pack.original_prompt_bytes},200);const hash=await sha(stable({version:versionForPurpose(purpose),purpose,preferred,payload}));const kind=`supabase-relationship-v11:${purpose}:${hash.slice(0,40)}`;failureCode="REL_CACHE_READ_FAILED";const {data:existing,error:existingError}=await admin.from("ai_interpret_jobs").select("id,status,result_json,usage_json,model,fallback_from,created_at,updated_at").eq("user_id",user.id).eq("kind",kind).order("created_at",{ascending:false}).limit(1);if(existingError)return respond(publicRelationshipError("REL_CACHE_READ_FAILED",{cost_guard_blocked:true}),200);const cached=existing?.[0];if(cached?.status==="done"){const safe=publicCachedResult(cached.result_json,cached.usage_json);return safe?respond(safe,200):respond(publicRelationshipError("REL_CACHED_RESULT_INVALID"),502);}if((cached?.status==="queued"||cached?.status==="running")&&!isStaleRelationshipJob(cached))return respond({...publicRelationshipError("REL_COST_GUARD_BLOCKED",{cost_guard_blocked:true}),inflight:true,error:"같은 관계 해설이 이미 생성 중이라 중복 Gemini 호출을 막았어."},200);let blocked="";try{blocked=await rollingGuard(admin,user.id);}catch{return respond(publicRelationshipError("REL_COST_GUARD_BLOCKED",{cost_guard_blocked:true}),200);}if(blocked)return respond({...publicRelationshipError("REL_COST_GUARD_BLOCKED",{cost_guard_blocked:true}),rolling_job_guard:true,error:blocked},200);const key=(Deno.env.get("GEMINI_API_KEY")??"").trim();if(!key)return respond(publicRelationshipError("REL_UPSTREAM_NOT_CONFIGURED",{missing_key:"GEMINI_API_KEY"}),503);const periodStart=String(payload?.period?.start??"")||null,periodEnd=String(payload?.period?.end??"")||null;failureCode="REL_JOB_CREATE_FAILED";const {data:inserted,error:insertError}=await admin.from("ai_interpret_jobs").insert({user_id:user.id,kind,status:"queued",model:preferred,period_start:periodStart,period_end:periodEnd}).select("id").single();if(insertError||!inserted?.id)return respond(publicRelationshipError("REL_JOB_CREATE_FAILED",{cost_guard_blocked:true}),200);failureCode="REL_GENERATION_FAILED";const generated:any=await calculate(payload,purpose,preferred,key);const result:any={...generated,prompt_bytes:budget.bytes,max_prompt_bytes:budget.max_bytes,estimated_max_job_krw:budget.estimated_max_job_krw,max_job_krw:budget.max_job_krw,prompt_compression_level:pack.compression_level,original_prompt_bytes:pack.original_prompt_bytes};const finalStatus=result.ok?"done":"failed";failureCode="REL_JOB_FINALIZE_FAILED";failureExtras=result;const {data:finalized,error:finalizeError}=await admin.from("ai_interpret_jobs").update({status:finalStatus,model:result.model??preferred,fallback_from:result.fallback_from??null,result_json:result.ok?result:null,usage_json:result.usage??null,error:result.ok?null:result.error??"관계 해설 실패",completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",inserted.id).select("id").single();if(finalizeError||!finalized?.id)return respond(publicRelationshipError("REL_JOB_FINALIZE_FAILED",result),503);return respond(result,200);
}catch{return respond(publicRelationshipError(failureCode,failureExtras),502)}
});