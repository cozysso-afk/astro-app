import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import { VERSION, MODELS, DEFAULT_MODEL, FALLBACK_MODEL, compactCalculation, payloadHash, SYSTEM, SCHEMA, validateOutput, txt } from "./core.ts";
import { addGeminiUsage, inspectThaiOutputSafety, runWithThaiOutputSafety, strictThaiRetryInstruction, thaiOutputGuardRequired, THAI_CONTRACT_VERSION } from "./thaiContract.ts";

const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8"};
const SUPABASE_URL=(Deno.env.get("SUPABASE_URL")??"").trim();
const ANON=(Deno.env.get("SUPABASE_ANON_KEY")??"").trim();
const SERVICE=(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"").trim();

function res(x:unknown,status=200){return new Response(JSON.stringify(x),{status,headers:CORS});}
function usage(raw:any){const u=raw?.usageMetadata??{};return {prompt_tokens:Number(u.promptTokenCount??0),candidate_tokens:Number(u.candidatesTokenCount??0),thought_tokens:Number(u.thoughtsTokenCount??0),total_tokens:Number(u.totalTokenCount??0)};}

async function generate(payload:any,model:string,key:string,compactMode=false,strictThai=false){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),compactMode?60000:70000);
  try{
    const prompt=`분석기간=${payload?.period?.start??""}~${payload?.period?.end??""}. ${compactMode?"이전 생성이 완전한 구조로 끝나지 않았다. 이번에는 각 필드를 더 짧게 유지해 반드시 완전한 JSON으로 끝내라.":"계산값의 강약, 정확한 절입 구간, 날짜 변화를 구체적으로 읽어라."}${strictThai?strictThaiRetryInstruction():""}\nCALCULATED_DATA=${JSON.stringify(payload)}`;
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
      method:"POST",signal:controller.signal,headers:{"Content-Type":"application/json","x-goog-api-key":key},
      body:JSON.stringify({systemInstruction:{parts:[{text:SYSTEM}]},contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json",responseSchema:SCHEMA,maxOutputTokens:compactMode?8500:12000,temperature:.32,thinkingConfig:{thinkingLevel:"medium"}}}),
    });
    const rawText=await r.text();
    if(!r.ok)return {ok:false,error:`Gemini HTTP ${r.status}`,model,http_status:r.status};
    const raw=JSON.parse(rawText);
    const parts=raw?.candidates?.[0]?.content?.parts??[];
    let out=parts.filter((p:any)=>!p?.thought).map((p:any)=>p?.text??"").join("").trim();
    if(!out)out=parts.map((p:any)=>p?.text??"").join("").trim();
    out=out.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"");
    try{const data=validateOutput(JSON.parse(out));if(!data)return {ok:false,error:"구조 검증 실패",model,usage:usage(raw)};const guard=inspectThaiOutputSafety(data,thaiOutputGuardRequired(payload));if(!guard.safe)return {ok:false,error:"Thai 출력 안전검증에서 금지된 예측 표현을 감지했어.",model,usage:usage(raw),output_guard_failed:true,guard_violations:guard.violations,guard_engine:guard.guard_engine,unsafe_data:data};return {ok:true,data,model,interpreter_version:VERSION,usage:usage(raw)};}
    catch{return {ok:false,error:"구조화 응답이 완전하지 않았어",model,usage:usage(raw)};}
  }catch(e){return {ok:false,error:e instanceof DOMException&&e.name==="AbortError"?"AI 해설 시간이 초과됐어.":`AI 해설 호출 실패: ${e instanceof Error?e.message:String(e)}`,model};}
  finally{clearTimeout(timer);}
}

async function generateWithThaiSafety(payload:any,model:string,key:string,compactMode=false){
  const result=await runWithThaiOutputSafety(payload,(strictThai)=>generate(payload,model,key,compactMode,strictThai),validateOutput);
  return result.ok?{...result,model:result.model??model,interpreter_version:VERSION}:result;
}

async function calculate(payload:any,preferred:string,key:string){
  const first:any=await generateWithThaiSafety(payload,preferred,key,false);
  if(first.ok)return first;
  const secondModel=preferred===FALLBACK_MODEL?preferred:FALLBACK_MODEL;
  const second:any=await generateWithThaiSafety(payload,secondModel,key,true);
  const combinedUsage=addGeminiUsage(first.usage,second.usage);
  const attemptCount=Number(first.attempt_count??1)+Number(second.attempt_count??1);
  if(second.ok)return preferred===secondModel?{...second,usage:combinedUsage,attempt_count:attemptCount}:{...second,usage:combinedUsage,attempt_count:attemptCount,fallback_from:preferred};
  return {ok:false,error:`AI 해설 구조화가 완료되지 않았어. 1차=${first.error}; 2차=${second.error}`,model:preferred,usage:combinedUsage,attempt_count:attemptCount};
}

function admin(){return createClient(SUPABASE_URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});}
async function user(req:Request){const auth=req.headers.get("Authorization")??"";if(!auth)return null;const c=createClient(SUPABASE_URL,ANON,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await c.auth.getUser();return error?null:data.user??null;}

async function job(id:string,payload:any,model:string,key:string){
  const a=admin();
  await a.from("ai_interpret_jobs").update({status:"running",updated_at:new Date().toISOString()}).eq("id",id);
  try{
    const r:any=await calculate(payload,model,key);
    const usageJson=r.usage?{...r.usage,attempt_count:r.attempt_count??1,thai_safety_retry:Boolean(r.thai_safety_retry),thai_safety_fallback:Boolean(r.thai_safety_fallback)}:null;
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
  if(b?.action==="meta")return res({configured:Boolean(key),interpreter_version:VERSION,models:MODELS,background_jobs:true,payload_hash_cache:true,inflight_dedupe:true,thai_contract:THAI_CONTRACT_VERSION,thai_layers:["Mahathaksa","Taksajorn","Suriyayat 10-planet position facts","validated numeric Lagna","12 descriptive non-predictive house routes"],suriyayat_lagna:true,thai_output_guard:true,thai_strict_retry:true,thai_safe_fallback:true});
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
    return res({ok:true,interpreter_version:VERSION,payload_bytes:new TextEncoder().encode(JSON.stringify(payload)).byteLength,payload_hash_prefix:hash.slice(0,16),thai:{mahathaksa:Boolean(payload?.thai?.mahathaksa),taksajorn:Boolean(payload?.thai?.taksajorn),suriyayat:Boolean(payload?.thai?.suriyayat),suriyayat_lagna:Boolean(payload?.thai?.suriyayat?.lagna?.available)},saju:{annual_segments:payload?.saju?.annual?.length??0,monthly_segments:payload?.saju?.monthly?.length??0},detail_days:payload?.western?.detail_days?.length??0});
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
