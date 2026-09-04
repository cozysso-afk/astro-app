from pathlib import Path
import re

# Relationship interpreter: cost accounting, server cache/breaker, marriage schema depth.
p=Path('supabase/functions/relationship-interpret-v9-preview/index.ts')
s=p.read_text()

old='import "jsr:@supabase/functions-js/edge-runtime.d.ts";\n\n'
new='import "jsr:@supabase/functions-js/edge-runtime.d.ts";\nimport { createClient } from "npm:@supabase/supabase-js@2.112.4";\n\n'
if old not in s: raise SystemExit('edge import anchor missing')
s=s.replace(old,new,1)

s=s.replace('VERSION="relationship-v10.3-unknown-time-resilient"','VERSION="relationship-v11.0-mode-split-cost-guard"',1)

anchor='const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8"};\n'
extra='''const SUPABASE_URL=(Deno.env.get("SUPABASE_URL")??"").trim();\nconst SERVICE=(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"").trim();\nconst MAX_GEMINI_CALLS=2,MAX_PROMPT_BYTES=110000;\nconst MAX_USER_NEW_JOBS_10M=6,MAX_USER_NEW_JOBS_24H=20,MAX_GLOBAL_NEW_JOBS_10M=18,MAX_GLOBAL_NEW_JOBS_24H=60;\nconst enc=new TextEncoder();\n'''
if anchor not in s: raise SystemExit('CORS anchor missing')
s=s.replace(anchor,anchor+extra,1)

old='const MARRIAGE_SCHEMA:any={type:"OBJECT",properties:{mode:S,bottom_line:S,bond:S,emotional_home:S,daily_life:S,conflict_repair:S,commitment_or_current_cycle:S,timing:S,caution:S,precision_note:S},required:["mode","bottom_line","bond","emotional_home","daily_life","conflict_repair","commitment_or_current_cycle","timing","caution","precision_note"]};'
new='const MARRIAGE_SCHEMA:any={type:"OBJECT",properties:{mode:S,bottom_line:S,bond:S,emotional_home:S,daily_life:S,intimacy_resources:S,conflict_repair:S,commitment_or_current_cycle:S,timing:S,caution:S,precision_note:S},required:["mode","bottom_line","bond","emotional_home","daily_life","intimacy_resources","conflict_repair","commitment_or_current_cycle","timing","caution","precision_note"]};'
if old not in s: raise SystemExit('marriage schema missing')
s=s.replace(old,new,1)

old='marriage_reading:{mode:cut(mr.mode,80),bottom_line:cut(mr.bottom_line,4800),bond:cut(mr.bond,4200),emotional_home:cut(mr.emotional_home,4200),daily_life:cut(mr.daily_life,4800),conflict_repair:cut(mr.conflict_repair,4200),commitment_or_current_cycle:cut(mr.commitment_or_current_cycle,4200),timing:cut(mr.timing,3800),caution:cut(mr.caution,3800),precision_note:cut(mr.precision_note,1800)}'
new='marriage_reading:{mode:cut(mr.mode,80),bottom_line:cut(mr.bottom_line,4800),bond:cut(mr.bond,4200),emotional_home:cut(mr.emotional_home,4200),daily_life:cut(mr.daily_life,4800),intimacy_resources:cut(mr.intimacy_resources,4600),conflict_repair:cut(mr.conflict_repair,4200),commitment_or_current_cycle:cut(mr.commitment_or_current_cycle,4200),timing:cut(mr.timing,3800),caution:cut(mr.caution,3800),precision_note:cut(mr.precision_note,1800)}'
if old not in s: raise SystemExit('marriage validate block missing')
s=s.replace(old,new,1)
s=s.replace('out.marriage_reading={mode:"",bottom_line:"",bond:"",emotional_home:"",daily_life:"",conflict_repair:"",commitment_or_current_cycle:"",timing:"",caution:"",precision_note:""}', 'out.marriage_reading={mode:"",bottom_line:"",bond:"",emotional_home:"",daily_life:"",intimacy_resources:"",conflict_repair:"",commitment_or_current_cycle:"",timing:"",caution:"",precision_note:""}', 1)

# Make the two marriage modes explicit in the prompt too, not just in SYSTEM.
s=s.replace('const modeInstruction=purpose==="compatibility"?"일반 연애 궁합이다. 표준 궁합 포인트와 사주 관계층을 빠짐없이 읽고 각 섹션을 충분히 길게 써라.":purpose==="reunion"?"재회운이다. 시기창과 실제 트랜짓 근거를 우선하되 기본 궁합의 재회 필터도 깊게 써라.":"결혼운이다. 가정·생활·책임·공유재정·친밀감·갈등회복을 중심으로 각 항목을 최소 4문장으로 써라.";', 'const modeInstruction=purpose==="compatibility"?"일반 연애 궁합이다. 표준 궁합 포인트와 사주 관계층을 빠짐없이 읽고 각 섹션을 충분히 길게 써라.":purpose==="reunion"?"재회운이다. 시기창과 실제 트랜짓 근거를 우선하되 기본 궁합의 재회 필터도 깊게 써라.":purpose==="marriage_unmarried"?"특정 상대가 있는 미혼 결혼궁합이다. 두 사람이 결혼생활로 들어갈 경우의 결속·정서적 집·생활 역할·돈/공유자원·친밀감·갈등회복·책임을 분리해 읽고 결혼 성사 여부는 예언하지 마라.":"이미 결혼한 두 사람의 결혼생활 분석이다. 결혼 가능성 표현은 금지하고 현재 결속·정서적 거리·생활 역할·공유재정/친밀감·반복갈등·회복 주기를 읽어라.";',1)

# Replace paid generation tail with audited version.
pat=re.compile(r'async function generate\(payload:any,purpose:Purpose,model:string,key:string,compactMode=false\).*?Deno\.serve\(async\(req\)=>\{.*?\}\);\s*$',re.S)
if not pat.search(s): raise SystemExit('paid tail not found')
new_tail=r'''function modeInstruction(purpose:Purpose){return purpose==="compatibility"?"일반 연애 궁합이다. 표준 궁합 포인트와 사주 관계층을 빠짐없이 읽고 각 섹션을 충분히 길게 써라.":purpose==="reunion"?"재회운이다. 시기창과 실제 트랜짓 근거를 우선하되 기본 궁합의 재회 필터도 깊게 써라.":purpose==="marriage_unmarried"?"특정 상대가 있는 미혼 결혼궁합이다. 두 사람이 결혼생활로 들어갈 경우의 결속·정서적 집·생활 역할·돈/공유자원·친밀감·갈등회복·책임을 분리해 읽고 결혼 성사 여부는 예언하지 마라.":"이미 결혼한 두 사람의 결혼생활 분석이다. 결혼 가능성 표현은 금지하고 현재 결속·정서적 거리·생활 역할·공유재정/친밀감·반복갈등·회복 주기를 읽어라.";}
function promptText(payload:any,purpose:Purpose,compactMode=false){return `PURPOSE=${purpose}\n${modeInstruction(purpose)}\n${compactMode?"재시도다. 완전한 JSON을 만들되 근거·오브·사주 허용필드·시기는 유지하고 중복만 줄여라.\n":""}CALCULATED_DATA=${JSON.stringify(payload)}`;}
function promptBudget(payload:any,purpose:Purpose){const bytes=enc.encode(SYSTEM+promptText(payload,purpose,false)).length;return {bytes,max_bytes:MAX_PROMPT_BYTES,ok:bytes<=MAX_PROMPT_BYTES,estimated_input_tokens:Math.ceil(bytes/2.6)};}
function addUsage(a:any,b:any){return {prompt_tokens:Number(a?.prompt_tokens??0)+Number(b?.prompt_tokens??0),candidate_tokens:Number(a?.candidate_tokens??0)+Number(b?.candidate_tokens??0),thought_tokens:Number(a?.thought_tokens??0)+Number(b?.thought_tokens??0),total_tokens:Number(a?.total_tokens??0)+Number(b?.total_tokens??0)};}
async function sha(value:string){const digest=await crypto.subtle.digest("SHA-256",enc.encode(value));return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");}
function stable(v:any):string{if(v===null||typeof v!=="object")return JSON.stringify(v);if(Array.isArray(v))return `[${v.map(stable).join(",")}]`;return `{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;}

async function generate(payload:any,purpose:Purpose,model:string,key:string,compactMode=false){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),115000);try{const prompt=promptText(payload,purpose,compactMode);const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:"POST",signal:controller.signal,headers:{"Content-Type":"application/json","x-goog-api-key":key},body:JSON.stringify({systemInstruction:{parts:[{text:SYSTEM}]},contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json",responseSchema:schemaFor(purpose),maxOutputTokens:compactMode?12000:16000,temperature:.32,thinkingConfig:{thinkingLevel:"medium"}}})});const rawText=await r.text();if(!r.ok)return {ok:false,error:`Gemini HTTP ${r.status}`,model,usage:{prompt_tokens:0,candidate_tokens:0,thought_tokens:0,total_tokens:0}};const raw=JSON.parse(rawText),u=usage(raw),parts=raw?.candidates?.[0]?.content?.parts??[];let txt=parts.filter((x:any)=>!x?.thought).map((x:any)=>x?.text??"").join("").trim()||parts.map((x:any)=>x?.text??"").join("").trim();txt=txt.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"");try{const data=validate(JSON.parse(txt),purpose);if(!data||!grounded(data,payload,purpose,compactMode))return {ok:false,error:"관계 해설이 깊이/근거 검증을 통과하지 못했어",model,usage:u};return {ok:true,data,model,interpreter_version:VERSION,usage:u};}catch{return {ok:false,error:"구조화 관계 해설이 완전하지 않았어",model,usage:u};}}catch(e){return {ok:false,error:e instanceof DOMException&&e.name==="AbortError"?"관계 해설 시간이 초과됐어.":`관계 해설 실패: ${e instanceof Error?e.message:String(e)}`,model,usage:{prompt_tokens:0,candidate_tokens:0,thought_tokens:0,total_tokens:0}};}finally{clearTimeout(timer);}}
async function calculate(payload:any,purpose:Purpose,preferred:string,key:string){let calls=0;const first:any=await generate(payload,purpose,preferred,key,false);calls+=1;const firstUsage=first.usage??{};if(first.ok)return {...first,usage:{...firstUsage,attempt_count:calls}};if(calls>=MAX_GEMINI_CALLS)return {...first,usage:{...firstUsage,attempt_count:calls}};const retryModel=preferred===DEFAULT_MODEL?FALLBACK_MODEL:preferred;const second:any=await generate(payload,purpose,retryModel,key,true);calls+=1;const total=addUsage(firstUsage,second.usage??{});if(second.ok)return {...second,usage:{...total,attempt_count:calls},...(retryModel!==preferred?{fallback_from:preferred}:{})};return {ok:false,error:`관계 해설 생성 실패 · 1차 ${first.error??"알 수 없는 오류"} · 재시도 ${second.error??"알 수 없는 오류"}`,model:preferred,interpreter_version:VERSION,usage:{...total,attempt_count:calls}};}

async function countJobs(admin:any,userId:string|null,since:string){let q=admin.from("ai_interpret_jobs").select("id",{count:"exact",head:true}).like("kind","supabase-relationship-v11%").gte("created_at",since);if(userId)q=q.eq("user_id",userId);const {count,error}=await q;if(error)throw error;return Number(count??0);}
async function rollingGuard(admin:any,userId:string){const now=Date.now();const u10=await countJobs(admin,userId,new Date(now-10*60*1000).toISOString()),u24=await countJobs(admin,userId,new Date(now-24*60*60*1000).toISOString()),g10=await countJobs(admin,null,new Date(now-10*60*1000).toISOString()),g24=await countJobs(admin,null,new Date(now-24*60*60*1000).toISOString());if(u10>=MAX_USER_NEW_JOBS_10M)return `내 계정에서 10분 동안 새 관계 해설 ${MAX_USER_NEW_JOBS_10M}건 한도에 도달했어.`;if(u24>=MAX_USER_NEW_JOBS_24H)return `내 계정에서 24시간 새 관계 해설 ${MAX_USER_NEW_JOBS_24H}건 한도에 도달했어.`;if(g10>=MAX_GLOBAL_NEW_JOBS_10M)return `전체 10분 새 관계 해설 ${MAX_GLOBAL_NEW_JOBS_10M}건 안전 한도에 도달했어.`;if(g24>=MAX_GLOBAL_NEW_JOBS_24H)return `전체 24시간 새 관계 해설 ${MAX_GLOBAL_NEW_JOBS_24H}건 안전 한도에 도달했어.`;return "";}

Deno.serve(async(req)=>{if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});if(req.method!=="POST")return respond({ok:false,error:"POST만 지원해."},405);let b:any;try{b=await req.json();}catch{return respond({ok:false,error:"JSON 요청이 필요해."},400);}if(!b?.calculation)return respond({ok:false,error:"calculation이 필요해."},400);const purpose=String(b.purpose??"compatibility") as Purpose;if(!["compatibility","reunion","marriage_unmarried","marriage_married"].includes(purpose))return respond({ok:false,error:"지원하지 않는 관계 해설 모드야."},400);if(!SUPABASE_URL||!SERVICE)return respond({ok:false,cost_guard_blocked:true,error:"관계 해설 비용가드 서버 설정이 없어 새 Gemini 호출을 막았어."},200);const auth=(req.headers.get("authorization")??"").replace(/^Bearer\s+/i,"").trim();if(!auth)return respond({ok:false,error:"로그인 세션이 필요해."},401);const admin=createClient(SUPABASE_URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});const {data:{user},error:userError}=await admin.auth.getUser(auth);if(userError||!user)return respond({ok:false,error:"유효한 로그인 세션이 필요해."},401);const preferred=MODELS.has(String(b.model))?String(b.model):DEFAULT_MODEL;const payload=compact(b.calculation,b.reunion_context);const budget=promptBudget(payload,purpose);if(!budget.ok)return respond({ok:false,cost_guard_blocked:true,prompt_budget:true,error:`관계 해설 입력이 안전 상한 ${budget.max_bytes.toLocaleString()} bytes를 넘어 Gemini 호출을 막았어.`,prompt_bytes:budget.bytes,max_prompt_bytes:budget.max_bytes},200);const hash=await sha(stable({version:VERSION,purpose,preferred,payload}));const kind=`supabase-relationship-v11:${purpose}:${hash.slice(0,40)}`;const {data:existing,error:existingError}=await admin.from("ai_interpret_jobs").select("id,status,result_json,usage_json,model,fallback_from").eq("user_id",user.id).eq("kind",kind).order("created_at",{ascending:false}).limit(1);if(existingError)return respond({ok:false,cost_guard_blocked:true,error:"관계 해설 캐시/비용 상태를 확인하지 못해 새 Gemini 호출을 막았어."},200);const cached=existing?.[0];if(cached?.status==="done"&&cached?.result_json)return respond({...cached.result_json,cached:true,server_cache:true,usage:cached.usage_json??cached.result_json?.usage},200);if(cached?.status==="pending")return respond({ok:false,inflight:true,cost_guard_blocked:true,error:"같은 관계 해설이 이미 생성 중이라 중복 Gemini 호출을 막았어."},200);let blocked="";try{blocked=await rollingGuard(admin,user.id);}catch{return respond({ok:false,cost_guard_blocked:true,error:"관계 해설 비용 카운터를 확인하지 못해 새 Gemini 호출을 막았어."},200);}if(blocked)return respond({ok:false,cost_guard_blocked:true,rolling_job_guard:true,error:blocked},200);const key=(Deno.env.get("GEMINI_API_KEY")??"").trim();if(!key)return respond({ok:false,error:"GEMINI_API_KEY가 없어."},503);const periodStart=String(payload?.period?.start??"")||null,periodEnd=String(payload?.period?.end??"")||null;const {data:inserted,error:insertError}=await admin.from("ai_interpret_jobs").insert({user_id:user.id,kind,status:"pending",model:preferred,period_start:periodStart,period_end:periodEnd}).select("id").single();if(insertError||!inserted?.id)return respond({ok:false,cost_guard_blocked:true,error:"관계 해설 비용 기록을 만들지 못해 Gemini 호출을 막았어."},200);const result:any=await calculate(payload,purpose,preferred,key);const finalStatus=result.ok?"done":"failed";await admin.from("ai_interpret_jobs").update({status:finalStatus,model:result.model??preferred,fallback_from:result.fallback_from??null,result_json:result.ok?result:null,usage_json:result.usage??null,error:result.ok?null:result.error??"관계 해설 실패",completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",inserted.id);return respond({...result,prompt_bytes:budget.bytes,max_prompt_bytes:budget.max_bytes},200);});
'''
s=pat.sub(new_tail,s)
p.write_text(s)

# Cache contract: invalidate all old relationship AI results after mode/schema/cost contract changes.
p=Path('web/src/lib/readingCache.ts')
s=p.read_text()
anchor="const FORTUNE_AI_CACHE_CONTRACT = 'release-contract-v21.3.2-relationship-direction-depth'\n"
if anchor not in s: raise SystemExit('reading cache anchor missing')
if 'RELATIONSHIP_AI_CACHE_CONTRACT' not in s:
    s=s.replace(anchor,anchor+"const RELATIONSHIP_AI_CACHE_CONTRACT = 'relationship-v11-mode-split-cost-guard'\n",1)
old='return `relationship-ai:${hashText(stableStringify({ model, purpose, calculation, context: context ?? null }))}`'
new='return `relationship-ai:${hashText(stableStringify({ contract: RELATIONSHIP_AI_CACHE_CONTRACT, model, purpose, calculation, context: context ?? null }))}`'
if old not in s: raise SystemExit('relationship cache id anchor missing')
s=s.replace(old,new,1)
p.write_text(s)

# Response schema typing.
p=Path('web/src/appTypes.ts')
s=p.read_text()
old='      daily_life: string\n      conflict_repair: string\n'
new='      daily_life: string\n      intimacy_resources: string\n      conflict_repair: string\n'
if old not in s: raise SystemExit('app type marriage block missing')
s=s.replace(old,new,1)
p.write_text(s)
