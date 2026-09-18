import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import { MODELS, DEFAULT_MODEL, FALLBACK_MODEL, compactCalculation, payloadHash, SCHEMA, validateOutput, txt } from "../fortune-interpret-v6-preview/integratedInterpretationV2.ts";
import { QUALITY_VERSION, inspectInterpretationQuality, strictQualityRetryInstruction } from "../fortune-interpret-v6-preview/qualityV2.ts";
import { addGeminiUsage, inspectThaiOutputSafety, buildThaiOutputFallback, thaiOutputGuardRequired, THAI_CONTRACT_VERSION } from "../fortune-interpret-v6-preview/thaiContract.ts";
import { buildDeterministicTopicAnalysis, buildLocalQualityFallbackCore, stabilizeCoreForQuality } from "../fortune-interpret-v21-preview/costGuardV21.ts";
import { publicCallTrace, publicFailedUsage, publicFortuneError, publicFortuneFailureFields, publicJobUsage, storedFortuneJobError, storedFortuneJobErrorCode } from "../_shared/fortuneAiPublicError.ts";
import { buildV23CorePrompt, buildV23PromptBudget, V23_PROMPT_VERSION } from "./promptV23.ts";
import { buildPeriodNarrativeInstruction, PERIOD_NARRATIVE_VERSION } from "./periodNarrativeV23.ts";
import { exactV23JobKind } from "./cacheIdentityV23.ts";

const VERSION="supabase-ai-v23.0-phenomenon-first";
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8"};
const SUPABASE_URL=(Deno.env.get("SUPABASE_URL")??"").trim();
const ANON=(Deno.env.get("SUPABASE_ANON_KEY")??"").trim();
const SERVICE=(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"").trim();
const MAX_GEMINI_CALLS=2;
const MAX_JOB_MS=115000;
const MAX_USER_NEW_JOBS_10M=6;
const MAX_USER_NEW_JOBS_24H=20;
const MAX_GLOBAL_NEW_JOBS_10M=18;
const MAX_GLOBAL_NEW_JOBS_24H=60;
const enc=new TextEncoder();

function res(x:unknown,status=200){return new Response(JSON.stringify(x),{status,headers:CORS});}
function usage(raw:any){const u=raw?.usageMetadata??{};return {prompt_tokens:Number(u.promptTokenCount??0),candidate_tokens:Number(u.candidatesTokenCount??0),thought_tokens:Number(u.thoughtsTokenCount??0),total_tokens:Number(u.totalTokenCount??0)};}
function qualitySummary(quality:any){return quality?{version:quality.version,score:quality.score,stages:(quality.stages??[]).map((s:any)=>({stage:s.stage,name:s.name,passed:s.passed}))}:null;}
function qualityFailure(result:any,quality:any){const failed=(quality?.stages??[]).filter((s:any)=>!s.passed).map((s:any)=>`${s.stage}:${s.name}`).join(", ");return {...result,ok:false,error:`5단계 해설 검증 미통과(${failed})`,quality_guard_failed:true,quality_report:quality,candidate_data:result?.data,validation:undefined};}
function criticalQualityPassed(quality:any){const stages=Array.isArray(quality?.stages)?quality.stages:[];return [1,2,3,4].every(stage=>stages.some((row:any)=>Number(row?.stage)===stage&&row?.passed===true));}

const CORE_SCHEMA:any=structuredClone(SCHEMA);
delete CORE_SCHEMA.properties.topic_analysis;
CORE_SCHEMA.required=(CORE_SCHEMA.required??[]).filter((key:string)=>key!=="topic_analysis");

const SYSTEM=`너는 '별빛의 운명'의 맞춤형 해설가다. 계산은 이미 서버가 끝냈다. 너의 역할은 근거를 사람이 이해할 수 있는 기간별 서사로 종합하는 것이다.
절대규칙:
- PROMPT_DATA와 evidence_ledger 밖의 사실·날짜·상대 속마음·사건 확률을 만들지 않는다.
- 점수는 상대활성도이지 확률이 아니다. 숫자%로 바꾸지 않는다.
- 서사는 점수나 topic 이름부터 시작하지 않고 period_narrative.phenomena의 현상 묶음부터 시작한다.
- 같은 현상이 여러 topic에 걸쳐 있으면 현상은 한 번 설명하고 분야별 발현 차이만 덧붙인다.
- day/week/month/annual은 서로 다른 시간해상도와 서사 구조를 사용한다. 기간 이름만 바꾼 같은 문장을 재사용하지 않는다.
- 중요한 결론·날짜·행동은 실제 evidence_refs와 연결한다.
- supportive와 caution이 같이 있으면 혼합 또는 긴장으로 표현한다.
- Western·사주·Thai는 합산하지 않고 독립 맥락으로 비교한다. 같은 시기라는 이유로 시너지·합일·확정으로 표현하지 않는다.
- observation.transit은 현재 운행 행성, target은 출생차트 비교 대상이다. 둘을 구분해서 왜 개인에게 해당하는지 풀어쓴다.
- 관측일을 임의의 시작일·종료일로 바꾸지 않는다. applying/separating은 접촉에 가까워짐/멀어짐이지 상대의 접근/이탈이 아니다.
- 같은 애스펙트가 여러 날짜에 반복되면 독립된 여러 근거처럼 부풀리지 않는다.
- 점수·평균·변동폭은 강약 보조정보일 뿐 해설 자체가 아니다.
- 투자 상대지수는 가격방향·수익률·매수·매도 적기 예측으로 바꾸지 않는다.
- 관계가 중요할 때만 상대→나, 나→상대, 과거인연 재접점을 분리해 읽고 실제 반응으로 확인한다.
- 한 문단에는 새로운 판단 하나만 넣고, 근거의 작용 → 체감/환경 → 기간 내 위치 → 현실 확인 신호 순으로 연결한다.
- 한국어 반말. JSON만 반환한다.`;

function coreInstruction(){return `
[OUTPUT]
- topic_analysis는 출력하지 마. 서버가 계산근거와 함께 별도로 붙인다.
- 전체 결론, key_windows, annual이면 year_phases 4개, cross_checks, decisions, 관계가 중요할 경우 relationship_reading/contact_flow, 투자 중요 시 investment_reading, systems, priorities, limits를 작성해.
- 같은 날짜·점수·근거를 여러 섹션에서 반복 설명하지 마. 한 번 설명한 세부 근거는 다른 섹션에서는 결론만 참조해.
- 정확한 날짜 범위는 연결한 evidence_refs가 실제로 그 범위를 덮을 때만 사용해. 한 날짜 근거를 임의 범위로 늘리지 마.
- 모든 decision은 최소 하나의 evidence_ref를 실제 key_window와 공유해.
- day에서 W:window가 있으면 실제 HH:MM~HH:MM과 같은 분야 W:detail을 함께 연결해.
- annual cross_checks는 Western과 비Western이 실제 함께 존재할 때만 복수체계로 써.`;}

type CallTrace={call:number;model:string;kind:"initial"|"repair"|"fallback";prompt_bytes:number;elapsed_ms:number;http_status:number;usage:any;error?:string};
type Budget={used:number;deadline:number;calls:CallTrace[]};
function budgetLeft(b:Budget){return b.used<MAX_GEMINI_CALLS&&Date.now()<b.deadline;}
function outputLimit(kind:string,compact:boolean){if(kind==="annual")return compact?6200:7200;if(kind==="month")return compact?4800:5600;if(kind==="week")return compact?4000:4700;return compact?3400:4000;}

async function generateCore(fullPayload:any,promptPayload:any,model:string,key:string,budget:Budget,kind:"initial"|"repair"|"fallback",compact=false,qualityRetry=""){
  if(!budgetLeft(budget))return {ok:false,error:"AI 호출 상한에 도달해 추가 생성을 중단했어.",model,cost_guard_blocked:true};
  const periodNarrative=buildPeriodNarrativeInstruction(promptPayload);
  const prompt=`분석기간=${promptPayload?.period?.start??""}~${promptPayload?.period?.end??""}.\n${periodNarrative}\n${coreInstruction()}${qualityRetry}\nPROMPT_DATA=${JSON.stringify(promptPayload)}`;
  const promptBytes=enc.encode(prompt).byteLength;
  const callNo=++budget.used;
  const started=Date.now();
  const remain=Math.max(1000,budget.deadline-Date.now());
  const timeout=Math.min(compact?46000:54000,remain);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
      method:"POST",signal:controller.signal,headers:{"Content-Type":"application/json","x-goog-api-key":key},
      body:JSON.stringify({systemInstruction:{parts:[{text:SYSTEM}]},contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json",responseSchema:CORE_SCHEMA,maxOutputTokens:outputLimit(String(fullPayload?.period_kind??"annual"),compact),temperature:.28,thinkingConfig:{thinkingLevel:compact?"low":"medium"}}}),
    });
    const rawText=await r.text();
    let raw:any=null;try{raw=JSON.parse(rawText);}catch{}
    const u=usage(raw);
    const trace:CallTrace={call:callNo,model,kind,prompt_bytes:promptBytes,elapsed_ms:Date.now()-started,http_status:r.status,usage:u};
    if(!r.ok){trace.error=`Gemini HTTP ${r.status}`;budget.calls.push(trace);return {ok:false,error:`Gemini HTTP ${r.status}`,model,http_status:r.status,usage:u};}
    budget.calls.push(trace);
    const parts=raw?.candidates?.[0]?.content?.parts??[];
    let out=parts.filter((p:any)=>!p?.thought).map((p:any)=>p?.text??"").join("").trim();
    if(!out)out=parts.map((p:any)=>p?.text??"").join("").trim();
    out=out.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"");
    try{const partial=JSON.parse(out);if(!partial||typeof partial!=="object"||Array.isArray(partial))return {ok:false,error:"core 구조화 응답이 객체가 아니야",model,usage:u};return {ok:true,partial,model,usage:u};}
    catch{return {ok:false,error:"core 구조화 응답이 완전하지 않았어",model,usage:u};}
  }catch(e){
    const msg=e instanceof DOMException&&e.name==="AbortError"?"AI 해설 시간이 초과됐어.":`AI 해설 호출 실패: ${e instanceof Error?e.message:String(e)}`;
    budget.calls.push({call:callNo,model,kind,prompt_bytes:promptBytes,elapsed_ms:Date.now()-started,http_status:0,usage:{prompt_tokens:0,candidate_tokens:0,thought_tokens:0,total_tokens:0},error:msg});
    return {ok:false,error:msg,model,timeout:e instanceof DOMException&&e.name==="AbortError"};
  }finally{clearTimeout(timer);}
}

function normalizeDirectionalWindows(data:any,payload:any){
  const ledger=new Map<string,any>((Array.isArray(payload?.evidence_ledger)?payload.evidence_ledger:[]).map((row:any)=>[String(row?.id??""),row]));
  for(const window of Array.isArray(data?.key_windows)?data.key_windows:[]){
    const rows=(window?.evidence_refs??[]).map((ref:any)=>ledger.get(String(ref))).filter(Boolean);
    if(rows.some((x:any)=>x?.direction==="supportive")&&rows.some((x:any)=>x?.direction==="caution"))window.signal="혼합";
  }
  return data;
}

function finalizeCandidate(core:any,payload:any,model:string,u:any,meta:any={}){
  const merged=stabilizeCoreForQuality({...core,topic_analysis:buildDeterministicTopicAnalysis(payload)},payload);
  let validated=validateOutput(merged);
  if(!validated)return {ok:false,error:"1단계 구조 검증 실패",model,usage:u,...meta};
  let data=normalizeDirectionalWindows(validated,payload);
  const guard=inspectThaiOutputSafety(data,thaiOutputGuardRequired(payload));
  let localThaiScrub=false;
  if(!guard.safe){
    const scrubbed=buildThaiOutputFallback(data);
    validated=scrubbed?validateOutput(scrubbed):null;
    const secondGuard=validated?inspectThaiOutputSafety(validated,thaiOutputGuardRequired(payload)):{safe:false};
    if(!validated||!secondGuard.safe)return {ok:false,error:"Thai 출력 안전검증 실패",model,usage:u,guard_violations:guard.violations,...meta};
    data=normalizeDirectionalWindows(validated,payload);localThaiScrub=true;
  }
  const quality=inspectInterpretationQuality(data,payload);
  if(!quality.ok){
    const criticalPassed=criticalQualityPassed(quality);
    const locallyRepairedTiming=quality?.local_timing_repair===true&&criticalPassed;
    if((meta?.allow_degraded_quality===true&&criticalPassed)||locallyRepairedTiming){
      const warning=locallyRepairedTiming
        ? "직접 근거가 없는 날짜·구간만 로컬에서 제거했고 구조·근거·의미 방향·일관성은 통과했어. 같은 결과를 고치려고 Gemini를 한 번 더 호출하지 않아."
        : String(meta?.quality_warning??"5단계 깊이·실용성 일부 항목은 보정본으로 표시해.");
      return {ok:true,data,model,interpreter_version:VERSION,validation:quality,degraded_quality:true,local_quality_fallback:Boolean(meta?.local_quality_fallback),quality_warning:warning,local_thai_scrub:localThaiScrub,usage:{...(u??{}),quality_validation:qualitySummary(quality)},...meta};
    }
    return qualityFailure({model,usage:u,data,local_thai_scrub:localThaiScrub,...meta},quality);
  }
  return {ok:true,data,model,interpreter_version:VERSION,validation:quality,degraded_quality:false,local_quality_fallback:Boolean(meta?.local_quality_fallback),local_thai_scrub:localThaiScrub,usage:{...(u??{}),quality_validation:qualitySummary(quality)},...meta};
}

async function generate(payload:any,model:string,key:string,budget:Budget,kind:"initial"|"fallback"|"repair"="initial",compact=false,qualityRetry=""){
  const pb=buildV23PromptBudget(payload);
  if(!pb.ok)return {ok:false,error:`V23 AI 해설 예상 최대 비용이 약 ${Math.round(pb.estimated_max_job_krw)}원으로 작업 상한 ${pb.max_job_krw}원을 넘어 Gemini 호출을 막았어.`,model,cost_guard_blocked:true,prompt_budget:pb};
  const core=await generateCore(payload,pb.packet,model,key,budget,kind,compact,qualityRetry);
  if(!core.ok)return {...core,prompt_budget:{bytes:pb.bytes,max_bytes:pb.max_bytes,estimated_input_tokens:pb.estimated_input_tokens}};
  return {...finalizeCandidate(core.partial,payload,model,core.usage,{single_core_generation:true,v23_period_narrative:true}),prompt_budget:{bytes:pb.bytes,max_bytes:pb.max_bytes,estimated_input_tokens:pb.estimated_input_tokens}};
}

async function calculate(payload:any,preferred:string,key:string,shouldContinue:()=>Promise<boolean>){
  const budget:Budget={used:0,deadline:Date.now()+MAX_JOB_MS,calls:[]};
  const first:any=await generate(payload,preferred,key,budget,"initial",false,"");
  if(first.ok)return {...first,attempt_count:budget.used,call_trace:budget.calls};
  if(first?.http_status===429||first?.cost_guard_blocked)return {...first,attempt_count:budget.used,call_trace:budget.calls};
  if(!(await shouldContinue()))return {ok:false,error:"AI 해설 생성이 취소됐어.",model:preferred,canceled:true,usage:first.usage,attempt_count:budget.used,call_trace:budget.calls};
  const secondModel=preferred===FALLBACK_MODEL?preferred:FALLBACK_MODEL;
  let second:any;
  if(first?.quality_guard_failed===true&&first?.quality_report)second=await generate(payload,secondModel,key,budget,"repair",true,strictQualityRetryInstruction(first.quality_report));
  else if(first?.timeout||[500,502,503,504].includes(Number(first?.http_status??0))||String(first?.error??"").includes("구조화 응답"))second=await generate(payload,secondModel,key,budget,"fallback",true,"");
  else return {...first,attempt_count:budget.used,call_trace:budget.calls};
  const combined=addGeminiUsage(first.usage,second?.usage);
  if(second?.ok)return {...second,usage:{...combined,quality_validation:qualitySummary(second.validation)},attempt_count:budget.used,call_trace:budget.calls,first_quality_report:first?.quality_report??null,...(preferred===secondModel?{}:{fallback_from:preferred})};
  const degraded=second?.candidate_data&&criticalQualityPassed(second?.quality_report)?second:first;
  if(degraded?.candidate_data&&criticalQualityPassed(degraded?.quality_report))return {ok:true,data:degraded.candidate_data,model:degraded?.model??secondModel,interpreter_version:VERSION,validation:degraded.quality_report,degraded_quality:true,local_quality_fallback:false,quality_warning:"구조·근거·의미 방향·일관성은 통과했고 깊이·실용성 일부 항목만 미통과라 결과를 숨기지 않고 표시해.",usage:{...combined,quality_validation:qualitySummary(degraded.quality_report)},attempt_count:budget.used,call_trace:budget.calls,first_quality_report:first?.quality_report??null,quality_report:second?.quality_report??first?.quality_report,...(preferred===secondModel?{}:{fallback_from:preferred})};
  const local=finalizeCandidate(buildLocalQualityFallbackCore(payload),payload,secondModel,{prompt_tokens:0,candidate_tokens:0,thought_tokens:0,total_tokens:0},{allow_degraded_quality:true,local_quality_fallback:true,quality_warning:"V23 Gemini 호출 뒤 검증 미통과 부분은 계산근거만으로 안전 보정했어. 추가 Gemini 호출은 0회야."});
  if(local?.ok)return {...local,usage:{...combined,quality_validation:qualitySummary(local.validation)},attempt_count:budget.used,call_trace:budget.calls,first_quality_report:first?.quality_report??null,quality_report:second?.quality_report??first?.quality_report,...(preferred===secondModel?{}:{fallback_from:preferred})};
  return {ok:false,error:`V23 AI 해설이 검증을 완료하지 못했고 안전 보정본도 만들지 못했어. 1차=${first.error}; 2차=${second?.error??"중단"}; 로컬=${local?.error??"중단"}`,model:preferred,usage:combined,attempt_count:budget.used,call_trace:budget.calls,first_quality_report:first?.quality_report??null,quality_report:second?.quality_report??first?.quality_report};
}

function admin(){return createClient(SUPABASE_URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});}
async function recentV23JobCount(a:any,since:string,userId?:string){let q=a.from("ai_interpret_jobs").select("id",{count:"exact",head:true}).like("kind","supabase-ai-v23%").gte("created_at",since);if(userId)q=q.eq("user_id",userId);const {count,error}=await q;if(error)throw new Error(error.message);return Number(count??0);}
async function checkRollingJobBudget(a:any,userId:string){
  const now=Date.now(),since10=new Date(now-10*60*1000).toISOString(),since24=new Date(now-24*60*60*1000).toISOString();
  try{
    const user10=await recentV23JobCount(a,since10,userId);if(user10>=MAX_USER_NEW_JOBS_10M)return publicFortuneError("COST_GUARD_BLOCKED",undefined,{retry_after_seconds:600});
    const user24=await recentV23JobCount(a,since24,userId);if(user24>=MAX_USER_NEW_JOBS_24H)return publicFortuneError("COST_GUARD_BLOCKED",undefined,{retry_after_seconds:3600});
    const global10=await recentV23JobCount(a,since10);if(global10>=MAX_GLOBAL_NEW_JOBS_10M)return publicFortuneError("COST_GUARD_BLOCKED",undefined,{retry_after_seconds:600});
    const global24=await recentV23JobCount(a,since24);if(global24>=MAX_GLOBAL_NEW_JOBS_24H)return publicFortuneError("COST_GUARD_BLOCKED",undefined,{retry_after_seconds:3600});
    return {ok:true,user10,user24,global10,global24};
  }catch(e){return publicFortuneError("COST_GUARD_CHECK_FAILED",e,{retry_after_seconds:60});}
}
async function user(req:Request){const auth=req.headers.get("Authorization")??"";if(!auth)return null;const c=createClient(SUPABASE_URL,ANON,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await c.auth.getUser();return error?null:data.user??null;}
async function jobActive(id:string){const {data}=await admin().from("ai_interpret_jobs").select("status,error").eq("id",id).maybeSingle();return data?.status==="queued"||data?.status==="running";}

async function job(id:string,payload:any,model:string,key:string){
  const a=admin();await a.from("ai_interpret_jobs").update({status:"running",updated_at:new Date().toISOString()}).eq("id",id);
  try{
    const r:any=await calculate(payload,model,key,()=>jobActive(id));
    const usageJson={...(r.usage??{prompt_tokens:0,candidate_tokens:0,thought_tokens:0,total_tokens:0}),attempt_count:r.attempt_count??0,call_trace:publicCallTrace(r.call_trace),prompt_budget:r.prompt_budget??null,quality_validation:qualitySummary(r.validation)??r.usage?.quality_validation??null,cost_guard_version:VERSION,narrative_version:PERIOD_NARRATIVE_VERSION,prompt_version:V23_PROMPT_VERSION,local_thai_scrub:Boolean(r.local_thai_scrub),degraded_quality:Boolean(r.degraded_quality),local_quality_fallback:Boolean(r.local_quality_fallback),quality_warning:r.quality_warning??null,first_quality_report:r.first_quality_report??null,quality_report:r.quality_report??null};
    if(!(await jobActive(id))){await a.from("ai_interpret_jobs").update({usage_json:usageJson,updated_at:new Date().toISOString()}).eq("id",id);return;}
    const done={status:"done",model:r.model,fallback_from:r.fallback_from??null,result_json:r.data,usage_json:usageJson,error:null,updated_at:new Date().toISOString(),completed_at:new Date().toISOString()};
    const failed={status:"failed",model,error:storedFortuneJobError("JOB_GENERATION_FAILED"),usage_json:usageJson,updated_at:new Date().toISOString(),completed_at:new Date().toISOString()};
    await a.from("ai_interpret_jobs").update(r.ok?done:failed).eq("id",id);
  }catch(e){publicFortuneError("JOB_GENERATION_FAILED",e);await a.from("ai_interpret_jobs").update({status:"failed",error:storedFortuneJobError("JOB_GENERATION_FAILED"),updated_at:new Date().toISOString(),completed_at:new Date().toISOString()}).eq("id",id);}
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
  if(req.method!=="POST")return res(publicFortuneError("METHOD_NOT_ALLOWED"),405);
  let b:any;try{b=await req.json();}catch{return res(publicFortuneError("INVALID_JSON"),400);}
  const key=(Deno.env.get("GEMINI_API_KEY")??"").trim();
  if(b?.action==="meta")return res({configured:Boolean(key),interpreter_version:VERSION,packet_version:V23_PROMPT_VERSION,narrative_version:PERIOD_NARRATIVE_VERSION,quality_version:QUALITY_VERSION,models:MODELS,background_jobs:true,payload_hash_cache:true,inflight_dedupe:true,five_stage_validation:true,single_core_generation:true,deterministic_topic_analysis:true,max_gemini_calls_per_job:MAX_GEMINI_CALLS,max_job_ms:MAX_JOB_MS,rolling_job_guard:true,prompt_budget_guard:true,prompt_copy:true,phenomenon_first:true,period_specific_narrative:true,thai_contract:THAI_CONTRACT_VERSION});
  const u=await user(req);if(!u)return res(publicFortuneError("AUTH_REQUIRED"),401);
  if(b?.action==="status"){
    const id=txt(b.job_id,100);const a=admin();const {data,error}=await a.from("ai_interpret_jobs").select("id,status,model,fallback_from,result_json,usage_json,error,created_at,updated_at,completed_at,period_start,period_end").eq("id",id).eq("user_id",u.id).maybeSingle();
    if(error)return res(publicFortuneError("JOB_STATUS_READ_FAILED",error),500);if(!data)return res(publicFortuneError("JOB_NOT_FOUND"),404);
    if(["queued","running"].includes(String(data.status))&&Date.now()-Date.parse(String(data.updated_at??data.created_at))>MAX_JOB_MS+30000){await a.from("ai_interpret_jobs").update({status:"failed",error:storedFortuneJobError("JOB_TIMEOUT"),completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id);data.status="failed";data.error=storedFortuneJobError("JOB_TIMEOUT");}
    const failureFields=data.status==="failed"?publicFortuneFailureFields(storedFortuneJobErrorCode(data.error)):null;
    return res({ok:true,job_id:data.id,status:data.status,model:data.model,fallback_from:data.fallback_from,data:data.result_json,usage:data.status==="failed"?publicFailedUsage(data.usage_json):publicJobUsage(data.usage_json),error:failureFields?.error??null,...(failureFields??{}),created_at:data.created_at,updated_at:data.updated_at,completed_at:data.completed_at,period_start:data.period_start,period_end:data.period_end,interpreter_version:VERSION});
  }
  if(b?.action==="cancel"){
    const id=txt(b.job_id,100);const now=new Date().toISOString();const {data,error}=await admin().from("ai_interpret_jobs").update({status:"failed",error:storedFortuneJobError("JOB_CANCELED"),updated_at:now,completed_at:now}).eq("id",id).eq("user_id",u.id).in("status",["queued","running"]).select("id,status").maybeSingle();
    if(error)return res(publicFortuneError("JOB_CANCEL_FAILED",error),500);return res({ok:true,job_id:id,canceled:Boolean(data?.id)});
  }
  if(!b?.calculation)return res(publicFortuneError("CALCULATION_REQUIRED"),400);
  const preferred=MODELS[b.model]?b.model:DEFAULT_MODEL;const payload=compactCalculation(b.calculation);const pb=buildV23PromptBudget(payload);
  if(b?.action==="inspect")return res({ok:true,interpreter_version:VERSION,full_payload_bytes:enc.encode(JSON.stringify(payload)).byteLength,prompt_payload_bytes:pb.bytes,prompt_budget_bytes:pb.max_bytes,prompt_budget_ok:pb.ok,estimated_input_tokens:pb.estimated_input_tokens,estimated_max_job_krw:pb.estimated_max_job_krw,max_gemini_calls_per_job:MAX_GEMINI_CALLS,deterministic_topics:buildDeterministicTopicAnalysis(payload).length,key_dates:payload?.key_dates?.length??0,evidence_ledger:payload?.evidence_ledger?.length??0,prompt_evidence_ledger:pb.packet?.evidence_ledger?.length??0,narrative_phenomena:pb.packet?.period_narrative?.phenomena?.length??0,narrative_kind:pb.packet?.period_narrative?.kind??null});
  if(b?.action==="prompt"){const p=buildV23CorePrompt(payload);return res({ok:true,interpreter_version:VERSION,prompt:p.text,prompt_bytes:enc.encode(p.text).byteLength,estimated_input_tokens:Math.ceil(enc.encode(p.text).byteLength/2.6),prompt_budget_bytes:pb.max_bytes,narrative_version:p.narrative_version});}
  if(b?.action!=="start")return res(publicFortuneError("UNSUPPORTED_ACTION"),400);
  if(!key)return res(publicFortuneError("UPSTREAM_NOT_CONFIGURED",undefined,{missing_key:true}),503);
  if(!pb.ok)return res(publicFortuneError("PROMPT_BUDGET_EXCEEDED",undefined,{cost_guard_blocked:true}),413);
  const hash=await payloadHash(payload);const kind=exactV23JobKind(VERSION,payload,hash);const a=admin();const modelFilter=`model.eq.${preferred},fallback_from.eq.${preferred}`;
  const {data:cached,error:cacheError}=await a.from("ai_interpret_jobs").select("id,status,result_json").eq("user_id",u.id).eq("kind",kind).eq("status","done").or(modelFilter).order("completed_at",{ascending:false}).limit(1).maybeSingle();
  if(!cacheError&&cached?.id&&cached?.result_json)return res({ok:true,job_id:cached.id,status:"done",interpreter_version:VERSION,reused:true,inflight:false},200);
  const {data:pending,error:pendingError}=await a.from("ai_interpret_jobs").select("id,status").eq("user_id",u.id).eq("kind",kind).eq("model",preferred).in("status",["queued","running"]).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(!pendingError&&pending?.id)return res({ok:true,job_id:pending.id,status:pending.status,interpreter_version:VERSION,reused:true,inflight:true},202);
  const rolling=await checkRollingJobBudget(a,u.id);if(!rolling.ok)return res({...rolling,cost_guard_blocked:true,rolling_job_guard:true},200);
  const {data,error}=await a.from("ai_interpret_jobs").insert({user_id:u.id,kind,status:"queued",model:preferred,period_start:payload?.period?.start||null,period_end:payload?.period?.end||null}).select("id").single();
  if(error||!data?.id)return res(publicFortuneError("JOB_CREATE_FAILED",error),500);
  const task=job(data.id,payload,preferred,key);(globalThis as any).EdgeRuntime?.waitUntil?.(task);
  return res({ok:true,job_id:data.id,status:"queued",interpreter_version:VERSION,reused:false,inflight:false,prompt_budget:{bytes:pb.bytes,estimated_input_tokens:pb.estimated_input_tokens,max_bytes:pb.max_bytes}},202);
});
