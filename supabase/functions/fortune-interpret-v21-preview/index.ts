import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import { PACKET_VERSION, MODELS, DEFAULT_MODEL, FALLBACK_MODEL, compactCalculation, payloadHash, SCHEMA, validateOutput, txt } from "../fortune-interpret-v6-preview/integratedInterpretationV2.ts";
import { QUALITY_VERSION, inspectInterpretationQuality, strictQualityRetryInstruction } from "../fortune-interpret-v6-preview/qualityV2.ts";
import { addGeminiUsage, inspectThaiOutputSafety, buildThaiOutputFallback, thaiOutputGuardRequired, THAI_CONTRACT_VERSION } from "../fortune-interpret-v6-preview/thaiContract.ts";
import { classifyQualityRepair } from "../fortune-interpret-v6-preview/repairV19.ts";
import { buildDeterministicTopicAnalysis, buildExternalPrompt, buildPromptPacket, promptBudget, stabilizeCoreForQuality } from "./costGuardV21.ts";

const VERSION="supabase-ai-v21.1-single-core-local-stabilizer";
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8"};
const SUPABASE_URL=(Deno.env.get("SUPABASE_URL")??"").trim();
const ANON=(Deno.env.get("SUPABASE_ANON_KEY")??"").trim();
const SERVICE=(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"").trim();
const MAX_GEMINI_CALLS=2;
const MAX_JOB_MS=115000;
const enc=new TextEncoder();

function res(x:unknown,status=200){return new Response(JSON.stringify(x),{status,headers:CORS});}
function usage(raw:any){const u=raw?.usageMetadata??{};return {prompt_tokens:Number(u.promptTokenCount??0),candidate_tokens:Number(u.candidatesTokenCount??0),thought_tokens:Number(u.thoughtsTokenCount??0),total_tokens:Number(u.totalTokenCount??0)};}
function qualitySummary(quality:any){return quality?{version:quality.version,score:quality.score,stages:(quality.stages??[]).map((s:any)=>({stage:s.stage,name:s.name,passed:s.passed}))}:null;}
function qualityFailure(result:any,quality:any){const failed=(quality?.stages??[]).filter((s:any)=>!s.passed).map((s:any)=>`${s.stage}:${s.name}`).join(", ");return {...result,ok:false,error:`5단계 해설 검증 미통과(${failed})`,quality_guard_failed:true,quality_report:quality,candidate_data:result?.data,validation:undefined};}

const CORE_SCHEMA:any=structuredClone(SCHEMA);
delete CORE_SCHEMA.properties.topic_analysis;
CORE_SCHEMA.required=(CORE_SCHEMA.required??[]).filter((key:string)=>key!=="topic_analysis");

const SYSTEM=`너는 '별빛의 운명'의 맞춤형 해설가다. 계산은 이미 서버가 끝냈다. 너의 역할은 압축된 계산근거를 사람이 이해하기 쉬운 흐름으로 종합하는 것이다.
절대규칙:
- PROMPT_DATA와 evidence_ledger 밖의 사실·날짜·상대 속마음·사건 확률을 만들지 않는다.
- 점수는 상대활성도이지 확률이 아니다. 숫자%로 바꾸지 않는다.
- 중요한 결론·날짜·행동은 실제 evidence_refs와 연결한다.
- supportive와 caution이 같이 있으면 '혼합'으로 표현한다.
- 사주와 Thai는 Western 점수에 합산하지 않고 독립 맥락으로만 비교한다.
- 관계가 중요할 때만 상대→나·나→상대·과거인연 재접점의 순서와 현실 확인 신호를 종합한다.
- 중요하지 않은 분야를 분량 채우기 위해 반복하지 않는다. 15개 분야 상세는 서버가 별도로 만들므로 topic_analysis는 출력하지 않는다.
- 결론→핵심 흐름→주목 시기→현실 확인→피할 행동 순서. 한국어 반말. JSON만 반환한다.`;

function modeInstruction(payload:any,compact=false){
  const kind=String(payload?.period_kind??"annual");
  const retry=compact?"이전 출력의 실패 지점만 고치고 이미 맞는 흐름을 불필요하게 다시 쓰지 마. ":"";
  if(kind==="day")return `${retry}오늘은 detail_days와 W:window/W:detail을 우선해 정확한 시간창을 행동에 연결해.`;
  if(kind==="week")return `${retry}주간은 일별 전환과 핵심 날짜를 중심으로 초반·중반·후반 흐름을 짧게 묶어.`;
  if(kind==="month")return `${retry}월간은 일별 변동 요약과 월내 핵심 날짜를 중심으로 초·중·후반 전환을 설명해.`;
  return `${retry}연간은 daily_pattern_digest와 12개월 변화, 핵심 날짜를 연결해 4개 흐름 구간으로 종합하되 365일 원자료를 다시 나열하지 마.`;
}

function coreInstruction(){return `
[OUTPUT]
- topic_analysis는 절대 출력하지 마.
- 전체 결론, key_windows, annual이면 year_phases 4개, cross_checks, decisions, 관계가 중요할 경우 relationship_reading/contact_flow, 투자 중요 시 investment_reading, systems, priorities, limits만 작성해.
- 같은 날짜·점수·근거를 여러 섹션에서 반복 설명하지 마. 한 번 설명한 세부 근거는 다른 섹션에서는 결론만 참조해.
- 정확한 날짜 범위는 연결한 evidence_refs가 실제로 그 범위를 덮을 때만 사용해. 한 날짜 근거를 임의 범위로 늘리지 마.
- 모든 decision은 최소 하나의 evidence_ref를 실제 key_window와 공유해.
- 오늘 W:window가 있으면 실제 HH:MM~HH:MM을 쓰고 같은 분야 W:detail을 함께 연결해.
- annual cross_checks는 Western과 비Western이 실제 함께 존재할 때만 복수체계로 써.`;}

type CallTrace={call:number;model:string;kind:"initial"|"repair"|"fallback";prompt_bytes:number;elapsed_ms:number;http_status:number;usage:any;error?:string};
type Budget={used:number;deadline:number;calls:CallTrace[]};
function budgetLeft(b:Budget){return b.used<MAX_GEMINI_CALLS&&Date.now()<b.deadline;}
function outputLimit(kind:string,compact:boolean){if(kind==="annual")return compact?6200:7200;if(kind==="month")return compact?4800:5600;if(kind==="week")return compact?4000:4700;return compact?3400:4000;}

async function generateCore(fullPayload:any,promptPayload:any,model:string,key:string,budget:Budget,kind:"initial"|"repair"|"fallback",compact=false,qualityRetry=""){
  if(!budgetLeft(budget))return {ok:false,error:"AI 호출 상한에 도달해 추가 생성을 중단했어.",model,cost_guard_blocked:true};
  const prompt=`분석기간=${promptPayload?.period?.start??""}~${promptPayload?.period?.end??""}. ${coreInstruction()} ${modeInstruction(promptPayload,compact)}${qualityRetry}\nPROMPT_DATA=${JSON.stringify(promptPayload)}`;
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
      body:JSON.stringify({systemInstruction:{parts:[{text:SYSTEM}]},contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json",responseSchema:CORE_SCHEMA,maxOutputTokens:outputLimit(String(fullPayload?.period_kind??"annual"),compact),temperature:.24,thinkingConfig:{thinkingLevel:compact?"low":"medium"}}}),
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
  for(const window of Array.isArray(data?.key_windows)?data.key_windows:[]){const rows=(window?.evidence_refs??[]).map((ref:any)=>ledger.get(String(ref))).filter(Boolean);if(rows.some((x:any)=>x?.direction==="supportive")&&rows.some((x:any)=>x?.direction==="caution"))window.signal="혼합";}
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
  if(!quality.ok)return qualityFailure({model,usage:u,data,local_thai_scrub:localThaiScrub,...meta},quality);
  return {ok:true,data,model,interpreter_version:VERSION,validation:quality,local_thai_scrub:localThaiScrub,usage:{...(u??{}),quality_validation:qualitySummary(quality)},...meta};
}

async function generate(payload:any,model:string,key:string,budget:Budget,kind:"initial"|"fallback"="initial",compact=false,qualityRetry=""){
  const pb=promptBudget(payload);
  if(!pb.ok)return {ok:false,error:`AI 입력 근거가 비용 상한을 넘었어(${pb.bytes}/${pb.max_bytes} bytes). Gemini를 호출하지 않았어.`,model,cost_guard_blocked:true,prompt_budget:pb};
  const core=await generateCore(payload,pb.packet,model,key,budget,kind,compact,qualityRetry);
  if(!core.ok)return {...core,prompt_budget:{bytes:pb.bytes,max_bytes:pb.max_bytes,estimated_input_tokens:pb.estimated_input_tokens}};
  return {...finalizeCandidate(core.partial,payload,model,core.usage,{single_core_generation:true}),prompt_budget:{bytes:pb.bytes,max_bytes:pb.max_bytes,estimated_input_tokens:pb.estimated_input_tokens}};
}

async function repairCandidate(payload:any,candidate:any,report:any,model:string,key:string,budget:Budget){
  const repair=classifyQualityRepair(report,candidate);
  const deterministicTopics=buildDeterministicTopicAnalysis(payload);
  if(!repair.core){
    return finalizeCandidate({...candidate,topic_analysis:deterministicTopics},payload,model,{prompt_tokens:0,candidate_tokens:0,thought_tokens:0,total_tokens:0},{targeted_repair:{core:false,topics:true,local_only:true}});
  }
  const pb=promptBudget(payload);
  if(!pb.ok)return {ok:false,error:"타깃 수선 입력이 비용 상한을 넘어 추가 Gemini 호출을 중단했어.",model,cost_guard_blocked:true,prompt_budget:pb};
  const retry=await generateCore(payload,pb.packet,model,key,budget,"repair",true,strictQualityRetryInstruction(report));
  if(!retry.ok)return {...retry,targeted_repair:repair};
  return finalizeCandidate({...candidate,...retry.partial,topic_analysis:deterministicTopics},payload,model,retry.usage,{targeted_repair:{...repair,topics:false}});
}

async function calculate(payload:any,preferred:string,key:string,shouldContinue:()=>Promise<boolean>){
  const budget:Budget={used:0,deadline:Date.now()+MAX_JOB_MS,calls:[]};
  const first:any=await generate(payload,preferred,key,budget,"initial",false,"");
  if(first.ok)return {...first,attempt_count:budget.used,call_trace:budget.calls};
  if(first?.http_status===429||first?.cost_guard_blocked)return {...first,attempt_count:budget.used,call_trace:budget.calls};
  if(!(await shouldContinue()))return {ok:false,error:"AI 해설 생성이 취소됐어.",model:preferred,canceled:true,usage:first.usage,attempt_count:budget.used,call_trace:budget.calls};
  const secondModel=preferred===FALLBACK_MODEL?preferred:FALLBACK_MODEL;
  let second:any;
  if(first?.quality_guard_failed===true&&first?.candidate_data&&first?.quality_report){second=await repairCandidate(payload,first.candidate_data,first.quality_report,secondModel,key,budget);}
  else if(first?.timeout||[500,502,503,504].includes(Number(first?.http_status??0))||String(first?.error??"").includes("구조화 응답")){second=await generate(payload,secondModel,key,budget,"fallback",true,"");}
  else return {...first,attempt_count:budget.used,call_trace:budget.calls};
  const combined=addGeminiUsage(first.usage,second?.usage);
  if(second?.ok)return {...second,usage:{...combined,quality_validation:qualitySummary(second.validation)},attempt_count:budget.used,call_trace:budget.calls,...(preferred===secondModel?{}:{fallback_from:preferred})};
  return {ok:false,error:`AI 해설이 검증을 완료하지 못했어. 1차=${first.error}; 2차=${second?.error??"중단"}`,model:preferred,usage:combined,attempt_count:budget.used,call_trace:budget.calls,quality_report:second?.quality_report??first?.quality_report};
}

function admin(){return createClient(SUPABASE_URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});}
async function user(req:Request){const auth=req.headers.get("Authorization")??"";if(!auth)return null;const c=createClient(SUPABASE_URL,ANON,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await c.auth.getUser();return error?null:data.user??null;}
async function jobActive(id:string){const {data}=await admin().from("ai_interpret_jobs").select("status,error").eq("id",id).maybeSingle();return data?.status==="queued"||data?.status==="running";}

async function job(id:string,payload:any,model:string,key:string){
  const a=admin();await a.from("ai_interpret_jobs").update({status:"running",updated_at:new Date().toISOString()}).eq("id",id);
  try{
    const r:any=await calculate(payload,model,key,()=>jobActive(id));
    const usageJson={...(r.usage??{prompt_tokens:0,candidate_tokens:0,thought_tokens:0,total_tokens:0}),attempt_count:r.attempt_count??0,call_trace:r.call_trace??[],prompt_budget:r.prompt_budget??null,quality_validation:qualitySummary(r.validation)??r.usage?.quality_validation??null,cost_guard_version:VERSION,local_thai_scrub:Boolean(r.local_thai_scrub),quality_report:r.quality_report??null};
    if(!(await jobActive(id))){
      // A cancel request can mark the row failed while the already-sent first network call is still in flight.
      // Never resurrect that job, but attach the real usage/trace once the call returns so spent tokens are observable.
      await a.from("ai_interpret_jobs").update({usage_json:usageJson,updated_at:new Date().toISOString()}).eq("id",id);
      return;
    }
    const done={status:"done",model:r.model,fallback_from:r.fallback_from??null,result_json:r.data,usage_json:usageJson,error:null,updated_at:new Date().toISOString(),completed_at:new Date().toISOString()};
    const failed={status:"failed",model,error:r.error,usage_json:usageJson,updated_at:new Date().toISOString(),completed_at:new Date().toISOString()};
    await a.from("ai_interpret_jobs").update(r.ok?done:failed).eq("id",id);
  }catch(e){await a.from("ai_interpret_jobs").update({status:"failed",error:e instanceof Error?e.message:String(e),updated_at:new Date().toISOString(),completed_at:new Date().toISOString()}).eq("id",id);}
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
  if(req.method!=="POST")return res({ok:false,error:"POST만 지원해."},405);
  let b:any;try{b=await req.json();}catch{return res({ok:false,error:"JSON 요청이 필요해."},400);}
  const key=(Deno.env.get("GEMINI_API_KEY")??"").trim();
  if(b?.action==="meta")return res({configured:Boolean(key),interpreter_version:VERSION,packet_version:PACKET_VERSION,quality_version:QUALITY_VERSION,models:MODELS,background_jobs:true,payload_hash_cache:true,inflight_dedupe:true,five_stage_validation:true,single_core_generation:true,deterministic_topic_analysis:true,max_gemini_calls_per_job:MAX_GEMINI_CALLS,max_job_ms:MAX_JOB_MS,local_thai_scrub:true,prompt_budget_guard:true,prompt_copy:true,local_quality_stabilizer:true,quality_failure_observability:true,thai_contract:THAI_CONTRACT_VERSION});
  const u=await user(req);if(!u)return res({ok:false,error:"인증 세션이 필요해."},401);
  if(b?.action==="status"){
    const id=txt(b.job_id,100);const a=admin();const {data,error}=await a.from("ai_interpret_jobs").select("id,status,model,fallback_from,result_json,usage_json,error,created_at,updated_at,completed_at,period_start,period_end").eq("id",id).eq("user_id",u.id).maybeSingle();
    if(error)return res({ok:false,error:error.message},500);if(!data)return res({ok:false,error:"해설 작업을 찾지 못했어."},404);
    if(["queued","running"].includes(String(data.status))&&Date.now()-Date.parse(String(data.updated_at??data.created_at))>MAX_JOB_MS+30000){await a.from("ai_interpret_jobs").update({status:"failed",error:"AI 해설 작업이 제한시간을 넘겨 자동 종료됐어.",completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id);data.status="failed";data.error="AI 해설 작업이 제한시간을 넘겨 자동 종료됐어.";}
    return res({ok:true,job_id:data.id,status:data.status,model:data.model,fallback_from:data.fallback_from,data:data.result_json,usage:data.usage_json,error:data.error,created_at:data.created_at,updated_at:data.updated_at,completed_at:data.completed_at,period_start:data.period_start,period_end:data.period_end,interpreter_version:VERSION});
  }
  if(b?.action==="cancel"){
    const id=txt(b.job_id,100);const now=new Date().toISOString();const {data,error}=await admin().from("ai_interpret_jobs").update({status:"failed",error:"AI 해설 생성이 사용자 요청으로 취소됐어.",updated_at:now,completed_at:now}).eq("id",id).eq("user_id",u.id).in("status",["queued","running"]).select("id,status").maybeSingle();
    if(error)return res({ok:false,error:error.message},500);return res({ok:true,job_id:id,canceled:Boolean(data?.id)});
  }
  if(!b?.calculation)return res({ok:false,error:"calculation이 필요해."},400);
  const preferred=MODELS[b.model]?b.model:DEFAULT_MODEL;const payload=compactCalculation(b.calculation);const pb=promptBudget(payload);
  if(b?.action==="inspect")return res({ok:true,interpreter_version:VERSION,full_payload_bytes:enc.encode(JSON.stringify(payload)).byteLength,prompt_payload_bytes:pb.bytes,prompt_budget_bytes:pb.max_bytes,prompt_budget_ok:pb.ok,estimated_input_tokens:pb.estimated_input_tokens,max_gemini_calls_per_job:MAX_GEMINI_CALLS,deterministic_topics:buildDeterministicTopicAnalysis(payload).length,key_dates:payload?.key_dates?.length??0,evidence_ledger:payload?.evidence_ledger?.length??0,prompt_evidence_ledger:pb.packet?.evidence_ledger?.length??0});
  if(b?.action==="prompt"){const p=buildExternalPrompt(payload);return res({ok:true,interpreter_version:VERSION,prompt:p.text,prompt_bytes:p.bytes,estimated_input_tokens:p.estimated_input_tokens,prompt_budget_bytes:p.max_bytes});}
  if(!key)return res({ok:false,missing_key:true,error:"GEMINI_API_KEY가 설정되지 않았어."},503);
  if(b?.action==="start"){
    if(!pb.ok)return res({ok:false,cost_guard_blocked:true,error:`AI 입력 근거가 비용 상한을 넘었어(${pb.bytes}/${pb.max_bytes} bytes). 계산 결과와 프롬프트 복사는 그대로 사용할 수 있어.`},413);
    const hash=await payloadHash(payload);const kind=`${VERSION}:${hash.slice(0,32)}`;const a=admin();const modelFilter=`model.eq.${preferred},fallback_from.eq.${preferred}`;
    const {data:cached,error:cacheError}=await a.from("ai_interpret_jobs").select("id,status,result_json").eq("user_id",u.id).eq("kind",kind).eq("status","done").or(modelFilter).order("completed_at",{ascending:false}).limit(1).maybeSingle();
    if(!cacheError&&cached?.id&&cached?.result_json)return res({ok:true,job_id:cached.id,status:"done",interpreter_version:VERSION,reused:true,inflight:false},200);
    const {data:pending,error:pendingError}=await a.from("ai_interpret_jobs").select("id,status").eq("user_id",u.id).eq("kind",kind).eq("model",preferred).in("status",["queued","running"]).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(!pendingError&&pending?.id)return res({ok:true,job_id:pending.id,status:pending.status,interpreter_version:VERSION,reused:true,inflight:true},202);
    const {data,error}=await a.from("ai_interpret_jobs").insert({user_id:u.id,kind,status:"queued",model:preferred,period_start:payload?.period?.start||null,period_end:payload?.period?.end||null}).select("id").single();
    if(error||!data?.id)return res({ok:false,error:`해설 작업 생성 실패: ${error?.message??"unknown"}`},500);
    const task=job(data.id,payload,preferred,key);(globalThis as any).EdgeRuntime?.waitUntil?.(task);return res({ok:true,job_id:data.id,status:"queued",interpreter_version:VERSION,reused:false,inflight:false,prompt_budget:{bytes:pb.bytes,estimated_input_tokens:pb.estimated_input_tokens,max_bytes:pb.max_bytes}},202);
  }
  const r:any=await calculate(payload,preferred,key,async()=>true);return res(r,r.ok?200:r?.cost_guard_blocked?413:502);
});
