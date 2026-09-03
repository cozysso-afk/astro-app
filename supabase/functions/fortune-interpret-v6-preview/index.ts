import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import { VERSION, PACKET_VERSION, MODELS, DEFAULT_MODEL, FALLBACK_MODEL, compactCalculation, payloadHash, SYSTEM, SCHEMA, validateOutput, txt } from "./integratedInterpretationV2.ts";
import { QUALITY_VERSION, inspectInterpretationQuality, strictQualityRetryInstruction } from "./qualityV2.ts";
import { periodModeInstruction } from "./periodInstruction.ts";
import { addGeminiUsage, inspectThaiOutputSafety, runWithThaiOutputSafety, strictThaiRetryInstruction, thaiOutputGuardRequired, THAI_CONTRACT_VERSION } from "./thaiContract.ts";

const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8"};
const SUPABASE_URL=(Deno.env.get("SUPABASE_URL")??"").trim();
const ANON=(Deno.env.get("SUPABASE_ANON_KEY")??"").trim();
const SERVICE=(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"").trim();

function res(x:unknown,status=200){return new Response(JSON.stringify(x),{status,headers:CORS});}
function usage(raw:any){const u=raw?.usageMetadata??{};return {prompt_tokens:Number(u.promptTokenCount??0),candidate_tokens:Number(u.candidatesTokenCount??0),thought_tokens:Number(u.thoughtsTokenCount??0),total_tokens:Number(u.totalTokenCount??0)};}
function qualitySummary(quality:any){return quality?{version:quality.version,score:quality.score,stages:(quality.stages??[]).map((s:any)=>({stage:s.stage,name:s.name,passed:s.passed}))}:null;}
function qualityFailure(result:any,quality:any){
  const failed=(quality?.stages??[]).filter((s:any)=>!s.passed).map((s:any)=>`${s.stage}:${s.name}`).join(", ");
  return {...result,ok:false,error:`5단계 해설 검증 미통과(${failed})`,quality_guard_failed:true,quality_report:quality,candidate_data:result?.data,validation:undefined};
}

async function generate(payload:any,model:string,key:string,compactMode=false,strictThai=false,qualityRetry=""){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),compactMode?65000:78000);
  try{
    const modeInstruction=periodModeInstruction(payload,compactMode);
    const prompt=`분석기간=${payload?.period?.start??""}~${payload?.period?.end??""}. ${modeInstruction}${strictThai?strictThaiRetryInstruction():""}${qualityRetry}\nCALCULATED_DATA=${JSON.stringify(payload)}`;
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
      method:"POST",signal:controller.signal,headers:{"Content-Type":"application/json","x-goog-api-key":key},
      body:JSON.stringify({systemInstruction:{parts:[{text:SYSTEM}]},contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json",responseSchema:SCHEMA,maxOutputTokens:compactMode?10500:15000,temperature:.27,thinkingConfig:{thinkingLevel:"medium"}}}),
    });
    const rawText=await r.text();
    if(!r.ok)return {ok:false,error:`Gemini HTTP ${r.status}`,model,http_status:r.status};
    const raw=JSON.parse(rawText);
    const parts=raw?.candidates?.[0]?.content?.parts??[];
    let out=parts.filter((p:any)=>!p?.thought).map((p:any)=>p?.text??"").join("").trim();
    if(!out)out=parts.map((p:any)=>p?.text??"").join("").trim();
    out=out.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"");
    try{
      const data=validateOutput(JSON.parse(out));
      if(!data)return {ok:false,error:"1단계 구조 검증 실패",model,usage:usage(raw)};
      const thaiGuard=inspectThaiOutputSafety(data,thaiOutputGuardRequired(payload));
      if(!thaiGuard.safe)return {ok:false,error:"Thai 출력 안전검증에서 금지된 예측 표현을 감지했어.",model,usage:usage(raw),output_guard_failed:true,guard_violations:thaiGuard.violations,guard_engine:thaiGuard.guard_engine,unsafe_data:data};
      const quality=inspectInterpretationQuality(data,payload);
      if(!quality.ok)return qualityFailure({model,usage:usage(raw),data},quality);
      return {ok:true,data,model,interpreter_version:VERSION,validation:quality,usage:{...usage(raw),quality_validation:qualitySummary(quality)}};
    }catch{return {ok:false,error:"구조화 응답이 완전하지 않았어",model,usage:usage(raw)};}
  }catch(e){return {ok:false,error:e instanceof DOMException&&e.name==="AbortError"?"AI 해설 시간이 초과됐어.":`AI 해설 호출 실패: ${e instanceof Error?e.message:String(e)}`,model};}
  finally{clearTimeout(timer);}
}

async function generateWithThaiSafety(payload:any,model:string,key:string,compactMode=false,qualityRetry=""){
  const result=await runWithThaiOutputSafety(payload,(strictThai)=>generate(payload,model,key,compactMode,strictThai,qualityRetry),validateOutput);
  if(!result.ok)return result;
  const quality=result.validation?.ok===true?result.validation:inspectInterpretationQuality(result.data,payload);
  if(!quality.ok)return qualityFailure(result,quality);
  return {...result,model:result.model??model,interpreter_version:VERSION,validation:quality,usage:{...(result.usage??{}),quality_validation:qualitySummary(quality)}};
}

async function calculate(payload:any,preferred:string,key:string){
  const first:any=await generateWithThaiSafety(payload,preferred,key,false,"");
  if(first.ok)return first;
  const secondModel=preferred===FALLBACK_MODEL?preferred:FALLBACK_MODEL;
  const qualityRetry=first?.quality_guard_failed?strictQualityRetryInstruction(first.quality_report):"";
  const second:any=await generateWithThaiSafety(payload,secondModel,key,true,qualityRetry);
  const combinedUsageBase=addGeminiUsage(first.usage,second.usage);
  const combinedUsage=second?.validation?{...combinedUsageBase,quality_validation:qualitySummary(second.validation)}:combinedUsageBase;
  const attemptCount=Number(first.attempt_count??1)+Number(second.attempt_count??1);
  if(second.ok)return preferred===secondModel?{...second,usage:combinedUsage,attempt_count:attemptCount}:{...second,usage:combinedUsage,attempt_count:attemptCount,fallback_from:preferred};
  const qualityDetail=second?.quality_guard_failed?` · 최종 품질점수 ${second?.quality_report?.score??0}/100`:"";
  return {ok:false,error:`AI 해설이 검증을 완료하지 못했어. 1차=${first.error}; 2차=${second.error}${qualityDetail}`,model:preferred,usage:combinedUsage,attempt_count:attemptCount,quality_report:second?.quality_report??first?.quality_report};
}

function admin(){return createClient(SUPABASE_URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});}
async function user(req:Request){const auth=req.headers.get("Authorization")??"";if(!auth)return null;const c=createClient(SUPABASE_URL,ANON,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await c.auth.getUser();return error?null:data.user??null;}

async function job(id:string,payload:any,model:string,key:string){
  const a=admin();
  await a.from("ai_interpret_jobs").update({status:"running",updated_at:new Date().toISOString()}).eq("id",id);
  try{
    const r:any=await calculate(payload,model,key);
    const usageJson=r.usage?{...r.usage,attempt_count:r.attempt_count??1,thai_safety_retry:Boolean(r.thai_safety_retry),thai_safety_fallback:Boolean(r.thai_safety_fallback),quality_validation:qualitySummary(r.validation)??r.usage?.quality_validation??null}:null;
    await a.from("ai_interpret_jobs").update(r.ok?{status:"done",model:r.model,fallback_from:r.fallback_from??null,result_json:r.data,usage_json:usageJson,error:null,updated_at:new Date().toISOString(),completed_at:new Date().toISOString()}:{status:"failed",model,error:r.error,updated_at:new Date().toISOString(),completed_at:new Date().toISOString()}).eq("id",id);
  }catch(e){
    await a.from("ai_interpret_jobs").update({status:"failed",error:e instanceof Error?e.message:String(e),updated_at:new Date().toISOString(),completed_at:new Date().toISOString()}).eq("id",id);
  }
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
  if(req.method!=="POST")return res({ok:false,error:"POST만 지원해."},405);
  let b:any;try{b=await req.json();}catch{return res({ok:false,error:"JSON 요청이 필요해."},400);}
  const key=(Deno.env.get("GEMINI_API_KEY")??"").trim();
  if(b?.action==="meta")return res({configured:Boolean(key),interpreter_version:VERSION,packet_version:PACKET_VERSION,quality_version:QUALITY_VERSION,models:MODELS,background_jobs:true,payload_hash_cache:true,inflight_dedupe:true,five_stage_validation:true,evidence_ledger:true,full_daily_scores:true,daily_actual_evidence:true,monthly_trajectory:true,cross_system_timeline:true,thai_contract:THAI_CONTRACT_VERSION,thai_layers:["Mahathaksa","Taksajorn","Suriyayat 10-planet position facts","validated numeric Lagna","12 descriptive non-predictive house routes"],suriyayat_lagna:true,thai_output_guard:true,thai_strict_retry:true,thai_safe_fallback:true});
  if(!key)return res({ok:false,missing_key:true,error:"GEMINI_API_KEY가 설정되지 않았어."},503);
  const u=await user(req);if(!u)return res({ok:false,error:"인증 세션이 필요해."},401);
  if(b?.action==="status"){
    const id=txt(b.job_id,100);
    const {data,error}=await admin().from("ai_interpret_jobs").select("id,status,model,fallback_from,result_json,usage_json,error,created_at,updated_at,completed_at,period_start,period_end").eq("id",id).eq("user_id",u.id).maybeSingle();
    if(error)return res({ok:false,error:error.message},500);if(!data)return res({ok:false,error:"해설 작업을 찾지 못했어."},404);
    return res({ok:true,job_id:data.id,status:data.status,model:data.model,fallback_from:data.fallback_from,data:data.result_json,usage:data.usage_json,error:data.error,created_at:data.created_at,updated_at:data.updated_at,completed_at:data.completed_at,period_start:data.period_start,period_end:data.period_end,interpreter_version:VERSION});
  }
  if(!b?.calculation)return res({ok:false,error:"calculation이 필요해."},400);
  const preferred=MODELS[b.model]?b.model:DEFAULT_MODEL;
  const payload=compactCalculation(b.calculation);
  if(b?.action==="inspect"){
    const hash=await payloadHash(payload);
    return res({ok:true,interpreter_version:VERSION,packet_version:PACKET_VERSION,quality_version:QUALITY_VERSION,payload_bytes:new TextEncoder().encode(JSON.stringify(payload)).byteLength,payload_hash_prefix:hash.slice(0,16),evidence_ledger:payload?.evidence_ledger?.length??0,key_dates:payload?.key_dates?.length??0,cross_system_dates:payload?.cross_system_timeline?.length??0,western_months:payload?.western?.months?.length??0,daily_score_rows:payload?.western?.daily_score_matrix?.rows?.length??0,actual_daily_refs:(payload?.evidence_ledger??[]).filter((x:any)=>String(x?.id??"").startsWith("W:daily:")).length,thai:{mahathaksa:Boolean(payload?.thai?.mahathaksa),taksajorn:Boolean(payload?.thai?.taksajorn),suriyayat:Boolean(payload?.thai?.suriyayat),suriyayat_lagna:Boolean(payload?.thai?.suriyayat?.lagna?.available)},saju:{annual_segments:payload?.saju?.annual?.length??0,monthly_segments:payload?.saju?.monthly?.length??0},detail_days:payload?.western?.detail_days?.length??0});
  }
  if(b?.action==="start"){
    const hash=await payloadHash(payload);const kind=`${VERSION}:${hash.slice(0,32)}`;const a=admin();
    const modelFilter=`model.eq.${preferred},fallback_from.eq.${preferred}`;
    const {data:cached,error:cacheError}=await a.from("ai_interpret_jobs").select("id,status,model,fallback_from,result_json,usage_json,error,created_at,updated_at,completed_at").eq("user_id",u.id).eq("kind",kind).eq("status","done").or(modelFilter).order("completed_at",{ascending:false}).limit(1).maybeSingle();
    if(!cacheError&&cached?.id&&cached?.result_json)return res({ok:true,job_id:cached.id,status:"done",interpreter_version:VERSION,reused:true,inflight:false},200);
    const {data:pending,error:pendingError}=await a.from("ai_interpret_jobs").select("id,status,model,created_at,updated_at").eq("user_id",u.id).eq("kind",kind).eq("model",preferred).in("status",["queued","running"]).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(!pendingError&&pending?.id)return res({ok:true,job_id:pending.id,status:pending.status,interpreter_version:VERSION,reused:true,inflight:true},202);
    const periodStart=payload?.period?.start||null,periodEnd=payload?.period?.end||null;
    const {data,error}=await a.from("ai_interpret_jobs").insert({user_id:u.id,kind,status:"queued",model:preferred,period_start:periodStart,period_end:periodEnd}).select("id").single();
    if(error||!data?.id)return res({ok:false,error:`해설 작업 생성 실패: ${error?.message??"unknown"}`},500);
    const task=job(data.id,payload,preferred,key);(globalThis as any).EdgeRuntime?.waitUntil?.(task);
    return res({ok:true,job_id:data.id,status:"queued",interpreter_version:VERSION,reused:false,inflight:false},202);
  }
  const r:any=await calculate(payload,preferred,key);return res(r,r.ok?200:502);
});