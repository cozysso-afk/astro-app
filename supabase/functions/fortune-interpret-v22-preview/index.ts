import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import { compactCalculation, payloadHash } from "../fortune-interpret-v6-preview/integratedInterpretationV2.ts";
import { buildLocalQualityFallbackCore } from "../fortune-interpret-v21-preview/costGuardV21.ts";
import { normalizeProxiedFortuneResponse, publicFortuneError } from "../_shared/fortuneAiPublicError.ts";
import { auditProvisionalResidue, attachPrecisionPacketMetadata, buildProvisionalExternalPrompt, precisionGateFromPayload, sanitizeProvisionalCalculation, sanitizeProvisionalInterpretationOutput } from "./precisionV2.ts";

const VERSION="supabase-ai-v22-integrated-precision-v2";
const UPSTREAM="fortune-interpret-v21-preview";
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8"};
const SUPABASE_URL=(Deno.env.get("SUPABASE_URL")??"").trim();
const ANON=(Deno.env.get("SUPABASE_ANON_KEY")??"").trim();
const SERVICE=(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"").trim();
function res(x:unknown,status=200){return new Response(JSON.stringify(x),{status,headers:CORS});}
function admin(){return createClient(SUPABASE_URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});}
async function currentUser(req:Request){const auth=req.headers.get("Authorization")??"";if(!auth)return null;const c=createClient(SUPABASE_URL,ANON,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await c.auth.getUser();return error?null:data.user??null;}
async function proxyV21(req:Request,body:any){const headers=new Headers();for(const name of ["authorization","apikey","x-client-info"]){const value=req.headers.get(name);if(value)headers.set(name,value);}headers.set("content-type","application/json");const response=await fetch(`${SUPABASE_URL}/functions/v1/${UPSTREAM}`,{method:"POST",headers,body:JSON.stringify(body)});const parsed=await response.json().catch(()=>null);const normalized=normalizeProxiedFortuneResponse(parsed,response.status);const outHeaders=new Headers(CORS);outHeaders.set("x-starlight-upstream",UPSTREAM);return new Response(JSON.stringify(normalized.body),{status:normalized.status,headers:outHeaders});}
function zeroUsage(){return {prompt_tokens:0,candidate_tokens:0,thought_tokens:0,total_tokens:0,attempt_count:0,call_trace:[],gemini_paid_call:false,precision_contract:"integrated-precision-v2",precision_mode:"provisional"};}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
  if(req.method!=="POST")return res(publicFortuneError("METHOD_NOT_ALLOWED",undefined,{gemini_paid_call:false}),405);
  let body:any;try{body=await req.json();}catch{return res(publicFortuneError("INVALID_JSON",undefined,{gemini_paid_call:false}),400);}
  if(body?.action==="meta"){
    try{const upstream=await proxyV21(req,body);const data=await upstream.clone().json().catch(()=>({}));return res({...data,interpreter_version:VERSION,integrated_precision_contract:"integrated-precision-v2",precision_gateway:true});}
    catch{return res({ok:true,configured:false,interpreter_version:VERSION,integrated_precision_contract:"integrated-precision-v2",precision_gateway:true});}
  }
  if(body?.action==="status"||body?.action==="cancel")return proxyV21(req,body);
  if(!body?.calculation)return res(publicFortuneError("CALCULATION_REQUIRED",undefined,{gemini_paid_call:false}),400);
  const gate=precisionGateFromPayload(body.calculation);
  if(!gate.ok)return res(publicFortuneError("PRECISION_CONTRACT_REQUIRED",undefined,{gemini_paid_call:false}),409);
  if(gate.mode==="exact")return proxyV21(req,body);
  let safeCalculation:any;
  try{safeCalculation=sanitizeProvisionalCalculation(body.calculation);const firstAudit=auditProvisionalResidue(safeCalculation);if(!firstAudit.ok)return res(publicFortuneError("PROVISIONAL_INITIAL_AUDIT_FAILED",undefined,{gemini_paid_call:false}),409);}
  catch(e){return res(publicFortuneError("PROVISIONAL_SANITIZE_FAILED",e,{gemini_paid_call:false}),409);}
  if(body?.action==="prompt"){try{return res({ok:true,interpreter_version:VERSION,prompt:buildProvisionalExternalPrompt(body.calculation),gemini_paid_call:false});}catch(e){return res(publicFortuneError("PROVISIONAL_PROMPT_BLOCKED",e,{gemini_paid_call:false}),409);}}
  const compacted=compactCalculation(safeCalculation);
  const packet=attachPrecisionPacketMetadata(compacted,body.calculation);
  const packetAudit=auditProvisionalResidue(packet);
  if(!packetAudit.ok)return res(publicFortuneError("PROVISIONAL_PACKET_AUDIT_FAILED",undefined,{gemini_paid_call:false}),409);
  if(body?.action==="inspect")return res({ok:true,interpreter_version:VERSION,precision_mode:"provisional",gemini_paid_call:false,payload_bytes:new TextEncoder().encode(JSON.stringify(packet)).byteLength});
  if(body?.action!=="start")return res(publicFortuneError("UNSUPPORTED_ACTION",undefined,{gemini_paid_call:false}),400);
  const user=await currentUser(req);if(!user)return res(publicFortuneError("AUTH_REQUIRED",undefined,{gemini_paid_call:false}),401);
  try{
    const raw=buildLocalQualityFallbackCore(packet);const finalData=sanitizeProvisionalInterpretationOutput(raw);const finalAudit=auditProvisionalResidue(finalData);
    if(!finalAudit.ok)return res(publicFortuneError("PROVISIONAL_FINAL_AUDIT_FAILED",undefined,{gemini_paid_call:false}),409);
    const hash=await payloadHash(packet);const kind=`${VERSION}:${hash.slice(0,32)}`;const a=admin();
    const {data:cached}=await a.from("ai_interpret_jobs").select("id,result_json").eq("user_id",user.id).eq("kind",kind).eq("status","done").order("completed_at",{ascending:false}).limit(1).maybeSingle();
    if(cached?.id&&cached?.result_json)return res({ok:true,job_id:cached.id,status:"done",interpreter_version:VERSION,reused:true,inflight:false,gemini_paid_call:false});
    const now=new Date().toISOString();
    const {data,error}=await a.from("ai_interpret_jobs").insert({user_id:user.id,kind,status:"done",model:"deterministic-provisional-v2",fallback_from:null,period_start:packet?.period?.start||null,period_end:packet?.period?.end||null,result_json:finalData,usage_json:zeroUsage(),error:null,updated_at:now,completed_at:now}).select("id").single();
    if(error||!data?.id)return res(publicFortuneError("PROVISIONAL_DB_WRITE_FAILED",error,{gemini_paid_call:false}),500);
    return res({ok:true,job_id:data.id,status:"done",interpreter_version:VERSION,reused:false,inflight:false,gemini_paid_call:false},200);
  }catch(e){return res(publicFortuneError("PROVISIONAL_GENERATION_FAILED",e,{gemini_paid_call:false}),500);}
});
