import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const DEFAULT_MODEL="gemini-3.7-flash",FALLBACK_MODEL="gemini-3.6-flash",VERSION="relationship-v10.2-purpose-schema";
const MODELS=new Set([DEFAULT_MODEL,FALLBACK_MODEL]);
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8"};
type Purpose="compatibility"|"reunion"|"marriage_unmarried"|"marriage_married";
const TIME_SENSITIVE=new Set(["Moon","ASC","DSC","MC","IC"]);
const S={type:"STRING"};

function respond(x:unknown,status=200){return new Response(JSON.stringify(x),{status,headers:CORS});}
function cut(v:unknown,n:number){return String(v??"").trim().slice(0,n);}
function gloss(s:string){let t=s;const pairs:[RegExp,string][]=[[/\bSun\b(?!\s*\()/g,"Sun(태양)"],[/\bMoon\b(?!\s*\()/g,"Moon(달)"],[/\bMercury\b(?!\s*\()/g,"Mercury(수성)"],[/\bVenus\b(?!\s*\()/g,"Venus(금성)"],[/\bMars\b(?!\s*\()/g,"Mars(화성)"],[/\bJupiter\b(?!\s*\()/g,"Jupiter(목성)"],[/\bSaturn\b(?!\s*\()/g,"Saturn(토성)"],[/\bUranus\b(?!\s*\()/g,"Uranus(천왕성)"],[/\bNeptune\b(?!\s*\()/g,"Neptune(해왕성)"],[/\bPluto\b(?!\s*\()/g,"Pluto(명왕성)"],[/\bASC\b(?!\s*\()/g,"ASC(상승점)"],[/\bDSC\b(?!\s*\()/g,"DSC(하강점)"],[/\bMC\b(?!\s*\()/g,"MC(중천점)"],[/\bIC\b(?!\s*\()/g,"IC(천저점)"],[/\bconjunction\b(?!\s*\()/gi,"conjunction(합)"],[/\bsextile\b(?!\s*\()/gi,"sextile(육십분위)"],[/\bsquare\b(?!\s*\()/gi,"square(사각)"],[/\btrine\b(?!\s*\()/gi,"trine(삼각)"],[/\bquincunx\b(?!\s*\()/gi,"quincunx(퀸컨스·150도각)"],[/\bopposition\b(?!\s*\()/gi,"opposition(대립)"],[/\bsynastry\b(?!\s*\()/gi,"synastry(시너스트리·궁합차트)"],[/\btransit\b(?!\s*\()/gi,"transit(트랜짓·현재 행성 이동)"],[/\bDavison\b(?!\s*\()/g,"Davison(데이비슨)"],[/\bMarks\b(?!\s*\()/g,"Marks(마크스)"]];for(const [r,v] of pairs)t=t.replace(r,v);return t;}
function deep(v:any):any{if(typeof v==="string")return gloss(v);if(Array.isArray(v))return v.map(deep);if(v&&typeof v==="object")return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,deep(x)]));return v;}
function aspect(a:any){if(!a||typeof a!=="object")return null;const orb=Number(a.orb??99);if(!Number.isFinite(orb))return null;return {a:String(a.a??""),aspect:String(a.aspect??""),b:String(a.b??""),orb,tone:String(a.tone??"mixed"),layer:a.layer??null};}
function stat(s:any){if(!s||typeof s!=="object")return null;return {average:Number(s.average??0),band:String(s.band??""),spread:Number(s.spread??0),best_days:Array.isArray(s.best_days)?s.best_days.slice(0,10):[],caution_days:Array.isArray(s.caution_days)?s.caution_days.slice(0,8):[]};}

function compact(calc:any,ctx:any){
 const r=calc?.result??{},n=r?.natal_synastry??{},exact=Boolean(n?.partner_time_exact);
 let aspects=(Array.isArray(n?.aspects)?n.aspects:[]).map(aspect).filter(Boolean).sort((a:any,b:any)=>a.orb-b.orb);
 if(!exact)aspects=aspects.filter((a:any)=>!TIME_SENSITIVE.has(a.a)&&!TIME_SENSITIVE.has(a.b));
 const focus=r?.relationship_focus?.groups??{};
 const trans=r?.relationship_transits??r?.reunion_transits??null;
 const months=Array.isArray(ctx?.months)?ctx.months.map((m:any)=>({calendar_month:m?.calendar_month,start:m?.start,end:m?.end,incoming:stat(m?.incoming),outgoing:stat(m?.outgoing),reconnection:stat(m?.reconnection)})):[];
 const rankedMonths=months.map((m:any)=>({...m,rank_score:Number(m?.reconnection?.average??0)*.5+Number(m?.incoming?.average??0)*.35+Number(m?.outgoing?.average??0)*.15})).sort((a:any,b:any)=>b.rank_score-a.rank_score).slice(0,14);
 return deep({
   analysis_mode:r?.analysis_mode??null,period:calc?.period,relationship_status:calc?.relationship_status,
   precision:{partner_time_exact:exact,removed_time_sensitive_count:(Array.isArray(n?.aspects)?n.aspects.length:0)-aspects.length},
   static:{aspects:aspects.slice(0,45),strongest:aspects.slice(0,14)},
   focus:{
     core_identity_emotion:focus?.core_identity_emotion??[], attraction_romance:focus?.attraction_romance??[], sexual_intimacy:focus?.sexual_intimacy??[],
     communication:focus?.communication??[], stability_commitment:focus?.stability_commitment??[], conflict_reactivity:focus?.conflict_reactivity??[],
     idealization_confusion:focus?.idealization_confusion??[], power_attachment:focus?.power_attachment??[], freedom_unpredictability:focus?.freedom_unpredictability??[], home_marriage:focus?.home_marriage??[]
   },
   house_overlays:r?.house_overlays??null,
   saju_relationship:r?.saju_relationship??null,
   advanced:{davison:r?.davison??null,marks:r?.marks??null,months:Array.isArray(r?.months)?r.months.slice(0,24).map((m:any)=>({calendar_month:m?.calendar_month,representative_date:m?.representative_date,signal_summary:m?.signal_summary??null})):[]},
   directional:ctx?{period:ctx?.period,incoming:stat(ctx?.incoming),outgoing:stat(ctx?.outgoing),reconnection:stat(ctx?.reconnection),ranked_months:rankedMonths}:null,
   transit_triggers:trans?{period:trans.period,policy:trans.policy,top_days:Array.isArray(trans.top_days)?trans.top_days.slice(0,20):[],top_months:Array.isArray(trans.top_months)?trans.top_months.slice(0,14):[]}:null,
   limitations:r?.limitations??[]
 });
}

const SYSTEM=`너는 '별빛의 운명'의 관계 전문 리더다. 사용자가 별도로 차트를 복사해 다른 GPT에게 물어볼 필요가 없도록 계산 근거가 풍부한 리딩을 작성한다. 다만 계산되지 않은 사실·상대의 실제 속마음·사건 확률을 만들지 않는다.

공통 절대규칙:
- 오브가 좁은 실제 접점을 우선한다. 각 핵심 문단마다 가능한 한 실제 애스펙트 이름과 오브를 1~3개 근거로 든다.
- 생시 미상으로 제거된 Moon(달)·각도점·하우스는 추측하지 않는다. 사용 가능하지 않은 Davison(데이비슨)·Marks(마크스)도 추측 금지.
- 정확 생시에서 house_overlays의 whole_house(홀사인)와 placidus_house(플라시두스)를 둘 다 읽는다. 둘이 같은 하우스를 가리키면 중첩 근거로, 다르면 각 체계의 의미를 분리해 설명하며 한 체계로 덮어쓰거나 임의 평균하지 않는다.
- 점수와 접점 개수는 확률이 아니다. 좋은 말/나쁜 말을 억지로 균형 맞추지 않는다.
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
'결혼하나?'를 예언하지 말고 '이 둘이 결혼생활로 들어가면 어떻게 작동하나'를 깊게 본다.
- 정서적 집: Moon(달), Venus(금성), Saturn(토성), 4하우스/IC(천저점).
- 배우자/동반자: 7하우스/DSC(하강점), Sun(태양), Moon(달), Venus(금성), Saturn(토성).
- 친밀감·돈·공유자원: 8하우스, Pluto(명왕성), Venus(금성)/Mars(화성).
- 연애의 즐거움·애정표현: 5하우스, Venus(금성), Sun(태양), Jupiter(목성).
- 생활 역할과 갈등 수습: Mercury(수성), Mars(화성), Saturn(토성), Uranus(천왕성).
- 사주 일지(배우자궁) 합충해파와 일간 상호 십성을 반드시 확인한다.
marriage_reading의 bottom_line/bond/emotional_home/daily_life/conflict_repair/commitment_or_current_cycle/timing/caution을 각각 최소 4문장 수준으로 충분히 쓴다. 결속이 강해도 생활궁합이 힘들 수 있고, 끌림이 강해도 책임 구조가 약할 수 있음을 분리한다.

[기혼 결혼 marriage_married]
이미 결혼한 관계다. 결혼 가능성 표현 금지. 현재 결속·정서적 거리·생활역할·공유재정/친밀감·반복갈등·회복력·시기별 긴장/완화를 위 포인트로 깊게 읽는다.

문체는 한국어 반말. 결론→근거→현실에서 체감되는 방식→시기 순서. 짧아서 민망한 요약 금지. JSON만 반환.`;

const COMMON_SCHEMA:any={headline:S,overview:S,chemistry:S,emotional_dynamic:S,communication:S,conflict_pattern:S,power_boundaries:S,long_term:S,timing:S,reunion_context:S,felt_scenarios:{type:"ARRAY",items:S},practical_advice:{type:"ARRAY",items:S},top_aspects:{type:"ARRAY",items:{type:"OBJECT",properties:{label:S,meaning:S},required:["label","meaning"]}},limits:S};
const REUNION_SCHEMA:any={type:"OBJECT",properties:{bottom_line:S,incoming_contact:S,outgoing_contact:S,reconnection_windows:S,low_windows:S,relationship_filter:S,precision_note:S},required:["bottom_line","incoming_contact","outgoing_contact","reconnection_windows","low_windows","relationship_filter","precision_note"]};
const MARRIAGE_SCHEMA:any={type:"OBJECT",properties:{mode:S,bottom_line:S,bond:S,emotional_home:S,daily_life:S,conflict_repair:S,commitment_or_current_cycle:S,timing:S,caution:S,precision_note:S},required:["mode","bottom_line","bond","emotional_home","daily_life","conflict_repair","commitment_or_current_cycle","timing","caution","precision_note"]};
function schemaFor(purpose:Purpose){const properties:any={...COMMON_SCHEMA};const required=["headline","overview","chemistry","emotional_dynamic","communication","conflict_pattern","power_boundaries","long_term","timing","reunion_context","felt_scenarios","practical_advice","top_aspects","limits"];if(purpose==="reunion"){properties.reunion_reading=REUNION_SCHEMA;required.push("reunion_reading");}if(purpose.startsWith("marriage_")){properties.marriage_reading=MARRIAGE_SCHEMA;required.push("marriage_reading");}return {type:"OBJECT",properties,required};}

function usage(raw:any){const u=raw?.usageMetadata??{};return {prompt_tokens:Number(u.promptTokenCount??0),candidate_tokens:Number(u.candidatesTokenCount??0),thought_tokens:Number(u.thoughtsTokenCount??0),total_tokens:Number(u.totalTokenCount??0)};}
function validate(o:any,p:Purpose){if(!o||typeof o!=="object")return null;const rr=o.reunion_reading??{},mr=o.marriage_reading??{};const out:any={headline:cut(o.headline,450),overview:cut(o.overview,6500),chemistry:cut(o.chemistry,4200),emotional_dynamic:cut(o.emotional_dynamic,4200),communication:cut(o.communication,4200),conflict_pattern:cut(o.conflict_pattern,4200),power_boundaries:cut(o.power_boundaries,3800),long_term:cut(o.long_term,4500),timing:cut(o.timing,3500),reunion_context:cut(o.reunion_context,3500),felt_scenarios:Array.isArray(o.felt_scenarios)?o.felt_scenarios.slice(0,4).map((x:any)=>cut(x,1300)):[],reunion_reading:{bottom_line:cut(rr.bottom_line,4500),incoming_contact:cut(rr.incoming_contact,4000),outgoing_contact:cut(rr.outgoing_contact,3500),reconnection_windows:cut(rr.reconnection_windows,6000),low_windows:cut(rr.low_windows,3500),relationship_filter:cut(rr.relationship_filter,4500),precision_note:cut(rr.precision_note,1800)},marriage_reading:{mode:cut(mr.mode,80),bottom_line:cut(mr.bottom_line,4800),bond:cut(mr.bond,4200),emotional_home:cut(mr.emotional_home,4200),daily_life:cut(mr.daily_life,4800),conflict_repair:cut(mr.conflict_repair,4200),commitment_or_current_cycle:cut(mr.commitment_or_current_cycle,4200),timing:cut(mr.timing,3800),caution:cut(mr.caution,3800),precision_note:cut(mr.precision_note,1800)},practical_advice:Array.isArray(o.practical_advice)?o.practical_advice.slice(0,4).map((x:any)=>cut(x,1200)):[],top_aspects:Array.isArray(o.top_aspects)?o.top_aspects.slice(0,10).map((x:any)=>({label:cut(x?.label,500),meaning:cut(x?.meaning,1800)})):[],limits:cut(o.limits,2200)};if(p!=="reunion")out.reunion_reading={bottom_line:"",incoming_contact:"",outgoing_contact:"",reconnection_windows:"",low_windows:"",relationship_filter:"",precision_note:""};if(!p.startsWith("marriage_"))out.marriage_reading={mode:"",bottom_line:"",bond:"",emotional_home:"",daily_life:"",conflict_repair:"",commitment_or_current_cycle:"",timing:"",caution:"",precision_note:""};return deep(out);}
function grounded(data:any,payload:any,p:Purpose){const all=JSON.stringify(data);const src=JSON.stringify(payload);const forbidden=["갑기합","을경합","병신합","정임합","무계합","신강","신약","용신","희신","기신","배우자성","합혼점수"];for(const word of forbidden)if(all.includes(word)&&!src.includes(word))return false;if(p==="compatibility"){if(data.overview.length<350)return false;for(const k of ["chemistry","emotional_dynamic","communication","conflict_pattern","power_boundaries","long_term"])if(String(data[k]??"").length<120)return false;if((data.felt_scenarios??[]).length<3)return false;}if(p.startsWith("marriage_")){const m=data.marriage_reading??{};if(data.overview.length<300)return false;if(String(m.bottom_line??"").length<260)return false;for(const k of ["bond","emotional_home","daily_life","conflict_repair","commitment_or_current_cycle","timing","caution"])if(String(m[k]??"").length<170)return false;}if(p==="reunion"&&String(data.reunion_reading?.bottom_line??"").length<220)return false;return true;}

async function generate(payload:any,purpose:Purpose,model:string,key:string,compactMode=false){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),115000);try{const modeInstruction=purpose==="compatibility"?"일반 연애 궁합이다. 표준 궁합 포인트와 사주 관계층을 빠짐없이 읽고 각 섹션을 충분히 길게 써라.":purpose==="reunion"?"재회운이다. 시기창과 실제 트랜짓 근거를 우선하되 기본 궁합의 재회 필터도 깊게 써라.":"결혼운이다. 가정·생활·책임·공유재정·친밀감·갈등회복을 중심으로 각 항목을 최소 4문장으로 써라.";const prompt=`PURPOSE=${purpose}\n${modeInstruction}\n${compactMode?"재시도다. 완전한 JSON을 만들되 근거·오브·사주 허용필드·시기는 유지하고 중복만 줄여라.":""}\nCALCULATED_DATA=${JSON.stringify(payload)}`;const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:"POST",signal:controller.signal,headers:{"Content-Type":"application/json","x-goog-api-key":key},body:JSON.stringify({systemInstruction:{parts:[{text:SYSTEM}]},contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json",responseSchema:schemaFor(purpose),maxOutputTokens:compactMode?12000:16000,temperature:.32,thinkingConfig:{thinkingLevel:"medium"}}})});const rawText=await r.text();if(!r.ok)return {ok:false,error:`Gemini HTTP ${r.status}`,model};const raw=JSON.parse(rawText),parts=raw?.candidates?.[0]?.content?.parts??[];let txt=parts.filter((x:any)=>!x?.thought).map((x:any)=>x?.text??"").join("").trim()||parts.map((x:any)=>x?.text??"").join("").trim();txt=txt.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"");try{const data=validate(JSON.parse(txt),purpose);if(!data||!grounded(data,payload,purpose))return {ok:false,error:"관계 해설이 깊이/근거 검증을 통과하지 못했어",model};return {ok:true,data,model,interpreter_version:VERSION,usage:usage(raw)};}catch{return {ok:false,error:"구조화 관계 해설이 완전하지 않았어",model};}}catch(e){return {ok:false,error:e instanceof DOMException&&e.name==="AbortError"?"관계 해설 시간이 초과됐어.":`관계 해설 실패: ${e instanceof Error?e.message:String(e)}`,model};}finally{clearTimeout(timer);}}
async function calculate(payload:any,purpose:Purpose,preferred:string,key:string){const first:any=await generate(payload,purpose,preferred,key,false);if(first.ok)return first;const retryModel=preferred===DEFAULT_MODEL?FALLBACK_MODEL:preferred;const second:any=await generate(payload,purpose,retryModel,key,true);if(second.ok)return retryModel!==preferred?{...second,fallback_from:preferred}:second;return {ok:false,error:`관계 해설 생성 실패 · 1차 ${first.error ?? "알 수 없는 오류"} · 재시도 ${second.error ?? "알 수 없는 오류"}`,model:preferred,interpreter_version:VERSION};}

Deno.serve(async(req)=>{if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});if(req.method!=="POST")return respond({ok:false,error:"POST만 지원해."},405);let b:any;try{b=await req.json();}catch{return respond({ok:false,error:"JSON 요청이 필요해."},400);}const key=(Deno.env.get("GEMINI_API_KEY")??"").trim();if(!key)return respond({ok:false,error:"GEMINI_API_KEY가 없어."},503);if(!b?.calculation)return respond({ok:false,error:"calculation이 필요해."},400);const purpose=String(b.purpose??"compatibility") as Purpose;if(!["compatibility","reunion","marriage_unmarried","marriage_married"].includes(purpose))return respond({ok:false,error:"지원하지 않는 관계 해설 모드야."},400);const preferred=MODELS.has(String(b.model))?String(b.model):DEFAULT_MODEL;const payload=compact(b.calculation,b.reunion_context);const result=await calculate(payload,purpose,preferred,key);return respond(result,200);});
