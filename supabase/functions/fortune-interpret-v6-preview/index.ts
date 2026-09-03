import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import { VERSION, PACKET_VERSION, MODELS, DEFAULT_MODEL, FALLBACK_MODEL, compactCalculation, payloadHash, SYSTEM, SCHEMA, validateOutput, txt } from "./integratedInterpretationV2.ts";
import { QUALITY_VERSION, inspectInterpretationQuality, strictQualityRetryInstruction } from "./qualityV2.ts";
import { periodModeInstruction } from "./periodInstruction.ts";
import { addGeminiUsage, inspectThaiOutputSafety, runWithThaiOutputSafety, strictThaiRetryInstruction, thaiOutputGuardRequired, THAI_CONTRACT_VERSION } from "./thaiContract.ts";
import { classifyQualityRepair } from "./repairV19.ts";

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

const CORE_SCHEMA:any=structuredClone(SCHEMA);
delete CORE_SCHEMA.properties.topic_analysis;
CORE_SCHEMA.required=(CORE_SCHEMA.required??[]).filter((key:string)=>key!=="topic_analysis");
const TOPIC_SCHEMA:any={type:"OBJECT",properties:{topic_analysis:SCHEMA.properties.topic_analysis},required:["topic_analysis"]};

function normalizeDirectionalWindows(data:any,payload:any){
  const ledger=new Map<string,any>((Array.isArray(payload?.evidence_ledger)?payload.evidence_ledger:[]).map((row:any)=>[String(row?.id??""),row]));
  for(const window of Array.isArray(data?.key_windows)?data.key_windows:[]){
    const rows=(Array.isArray(window?.evidence_refs)?window.evidence_refs:[]).map((ref:any)=>ledger.get(String(ref))).filter(Boolean);
    const supportive=rows.some((row:any)=>row?.direction==="supportive");
    const caution=rows.some((row:any)=>row?.direction==="caution");
    if(supportive&&caution)window.signal="혼합";
  }
  return data;
}

function splitPartInstruction(part:"core"|"topics"){
  if(part==="topics")return `[OUTPUT PART: TOPICS]
- topic_analysis만 출력하고 15개 분야를 정확히 한 번씩 모두 넣어. topic 이름은 지정된 한국어 분야명을 그대로 써.
- importance=핵심은 실제 근거가 충분한 최대 5개만 선택하고 reason을 구체적으로 써. 연간은 최소 85자, 그 외 기간은 최소 60자를 목표로 하며, 가능하면 평균/추세 근거와 실제 날짜·일별·세부 근거처럼 서로 다른 층위의 evidence_refs를 2개 이상 연결해.
- importance=주목 reason은 연간 최소 55자, 그 외 기간 최소 40자를 목표로 하고, 단순 형용사가 아니라 변화 방향 + 시기 또는 구체 근거를 함께 설명해.
- importance=참고는 짧게 유지해. 근거를 충분히 설명할 수 없는 분야를 핵심/주목으로 올리지 마.
- evidence_refs는 evidence_ledger에 실제 존재하는 ID만 그대로 사용하고, reason/timing에 ledger에 없는 정확한 날짜를 만들지 마.`;
  return `[OUTPUT PART: CORE]
- topic_analysis는 출력하지 말고 총평·핵심시기·연간구간·교차검증·행동·관계/연락/재회·투자·체계별 해설·한계만 작성해.
- key_windows의 start/end에 정확한 날짜를 쓸 때는 그 날짜를 직접 포함하거나 덮는 evidence_refs가 반드시 있어야 해. 근거가 한 날짜뿐이면 임의로 앞뒤 날짜를 늘려 범위를 만들지 말고 start=end로 그 날짜만 써. 월초/중순/말 같은 말에서 임의의 1일·15일·말일을 생성하지 마.
- 모든 정확한 날짜는 CALCULATED_DATA.evidence_ledger 또는 계산 패킷에 실제 존재하는 날짜만 사용해. 근거 없는 중간 날짜·범위 끝점을 추론하지 마.
- key_window의 evidence_refs에 supportive와 caution이 함께 있으면 signal은 반드시 '혼합'으로 써. 한쪽 방향으로 단순화하지 마.
- decisions의 각 항목은 반드시 적어도 하나의 evidence_ref를 실제로 출력한 key_window와 공유해야 해. timing도 그 key_window의 start/end 또는, 오늘 분석이면 실제 W:window 시간창과 직접 연결해. 계산된 핵심 시기와 무관한 '전면 보류', '무조건 관망' 같은 포괄 조언을 새로 만들지 마.
- 오늘 분석에 W:window 근거가 있으면 최소 한 결정의 timing에 그 정확한 HH:MM~HH:MM 시간창을 쓰고 같은 분야의 W:detail 근거도 함께 연결해.
- 관계·연애·연락·재회 근거가 두드러지면 relationship_reading의 flow/focus_timing/watch를 충분히 구체적으로 써. focus_timing은 최소 35자 정도로 시기 + 흐름 + 현실 확인 방식을 함께 설명하고, 정확한 날짜는 relationship_reading.evidence_refs가 직접 뒷받침하는 날짜만 써.
- cross_checks의 synthesis는 최소 60자 정도로 Western과 다른 체계가 같은 시기를 어떻게 보완하거나 다르게 설명하는지 구체적으로 종합해. western 설명도 최소 35자 정도로 근거의 의미를 풀어 써.
- annual이면 year_phases 4개 이상, cross_checks 3개 이상, key_windows 5개 이상을 유지하고 각 항목의 근거를 실제 evidence_refs로 연결해.`;
}

async function generatePart(payload:any,model:string,key:string,part:"core"|"topics",schema:any,compactMode=false,strictThai=false,qualityRetry=""){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),compactMode?56000:66000);
  try{
    const modeInstruction=periodModeInstruction(payload,compactMode);
    const prompt=`분석기간=${payload?.period?.start??""}~${payload?.period?.end??""}. ${splitPartInstruction(part)} ${modeInstruction}${strictThai?strictThaiRetryInstruction():""}${qualityRetry}\nCALCULATED_DATA=${JSON.stringify(payload)}`;
    const maxOutputTokens=part==="core"?(compactMode?10000:12000):(compactMode?6500:8200);
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
      method:"POST",signal:controller.signal,headers:{"Content-Type":"application/json","x-goog-api-key":key},
      body:JSON.stringify({systemInstruction:{parts:[{text:SYSTEM}]},contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json",responseSchema:schema,maxOutputTokens,temperature:.27,thinkingConfig:{thinkingLevel:compactMode?"low":"medium"}}}),
    });
    const rawText=await r.text();
    if(!r.ok)return {ok:false,error:`${part} Gemini HTTP ${r.status}`,model,http_status:r.status};
    const raw=JSON.parse(rawText);
    const parts=raw?.candidates?.[0]?.content?.parts??[];
    let out=parts.filter((p:any)=>!p?.thought).map((p:any)=>p?.text??"").join("").trim();
    if(!out)out=parts.map((p:any)=>p?.text??"").join("").trim();
    out=out.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"");
    try{
      const partial=JSON.parse(out);
      if(!partial||typeof partial!=="object"||Array.isArray(partial))return {ok:false,error:`${part} 구조화 응답이 객체가 아니야`,model,usage:usage(raw)};
      return {ok:true,partial,model,usage:usage(raw)};
    }catch{return {ok:false,error:`${part} 구조화 응답이 완전하지 않았어`,model,usage:usage(raw)};}
  }catch(e){return {ok:false,error:e instanceof DOMException&&e.name==="AbortError"?`${part} AI 해설 시간이 초과됐어.`:`${part} AI 해설 호출 실패: ${e instanceof Error?e.message:String(e)}`,model};}
  finally{clearTimeout(timer);}
}

async function generate(payload:any,model:string,key:string,compactMode=false,strictThai=false,qualityRetry=""){
  const [core,topics]=await Promise.all([
    generatePart(payload,model,key,"core",CORE_SCHEMA,compactMode,strictThai,qualityRetry),
    generatePart(payload,model,key,"topics",TOPIC_SCHEMA,compactMode,strictThai,qualityRetry),
  ]);
  const combinedUsage=addGeminiUsage(core.usage,topics.usage);
  if(!core.ok||!topics.ok)return {ok:false,error:[core.ok?"":core.error,topics.ok?"":topics.error].filter(Boolean).join("; "),model,usage:combinedUsage,split_generation:true};
  try{
    const merged={...core.partial,...topics.partial};
    const validated=validateOutput(merged);
    if(!validated)return {ok:false,error:"1단계 구조 검증 실패",model,usage:combinedUsage,split_generation:true};
    const data=normalizeDirectionalWindows(validated,payload);
    const thaiGuard=inspectThaiOutputSafety(data,thaiOutputGuardRequired(payload));
    if(!thaiGuard.safe)return {ok:false,error:"Thai 출력 안전검증에서 금지된 예측 표현을 감지했어.",model,usage:combinedUsage,output_guard_failed:true,guard_violations:thaiGuard.violations,guard_engine:thaiGuard.guard_engine,unsafe_data:data,split_generation:true};
    const quality=inspectInterpretationQuality(data,payload);
    if(!quality.ok)return qualityFailure({model,usage:combinedUsage,data,split_generation:true},quality);
    return {ok:true,data,model,interpreter_version:VERSION,validation:quality,split_generation:true,usage:{...combinedUsage,quality_validation:qualitySummary(quality)}};
  }catch{return {ok:false,error:"분할 구조화 응답 병합에 실패했어",model,usage:combinedUsage,split_generation:true};}
}

async function repairCandidate(payload:any,candidate:any,report:any,model:string,key:string,compactMode=true,strictThai=false){
  const repair=classifyQualityRepair(report,candidate);
  const qualityRetry=strictQualityRetryInstruction(report);
  const [core,topics]=await Promise.all([
    repair.core?generatePart(payload,model,key,"core",CORE_SCHEMA,compactMode,strictThai,qualityRetry):Promise.resolve({ok:true,partial:null,usage:null}),
    repair.topics?generatePart(payload,model,key,"topics",TOPIC_SCHEMA,compactMode,strictThai,qualityRetry):Promise.resolve({ok:true,partial:null,usage:null}),
  ]);
  const combinedUsage=addGeminiUsage(core.usage,topics.usage);
  if(!core.ok||!topics.ok)return {ok:false,error:[core.ok?"":core.error,topics.ok?"":topics.error].filter(Boolean).join("; "),model,usage:combinedUsage,targeted_repair:repair};
  try{
    const merged={...candidate,...(core.partial??{}),...(topics.partial??{})};
    const validated=validateOutput(merged);
    if(!validated)return {ok:false,error:"타깃 재생성 후 구조 검증 실패",model,usage:combinedUsage,targeted_repair:repair};
    const data=normalizeDirectionalWindows(validated,payload);
    const thaiGuard=inspectThaiOutputSafety(data,thaiOutputGuardRequired(payload));
    if(!thaiGuard.safe)return {ok:false,error:"Thai 출력 안전검증에서 금지된 예측 표현을 감지했어.",model,usage:combinedUsage,output_guard_failed:true,guard_violations:thaiGuard.violations,guard_engine:thaiGuard.guard_engine,unsafe_data:data,targeted_repair:repair};
    const quality=inspectInterpretationQuality(data,payload);
    if(!quality.ok)return qualityFailure({model,usage:combinedUsage,data,targeted_repair:repair},quality);
    return {ok:true,data,model,interpreter_version:VERSION,validation:quality,targeted_repair:repair,usage:{...combinedUsage,quality_validation:qualitySummary(quality)}};
  }catch{return {ok:false,error:"타깃 재생성 병합에 실패했어",model,usage:combinedUsage,targeted_repair:repair};}
}

async function repairCandidateWithThaiSafety(payload:any,candidate:any,report:any,model:string,key:string){
  const result=await runWithThaiOutputSafety(payload,(strictThai)=>repairCandidate(payload,candidate,report,model,key,true,strictThai),validateOutput);
  if(!result.ok)return result;
  const quality=result.validation?.ok===true?result.validation:inspectInterpretationQuality(result.data,payload);
  if(!quality.ok)return qualityFailure(result,quality);
  return {...result,model:result.model??model,interpreter_version:VERSION,validation:quality,usage:{...(result.usage??{}),quality_validation:qualitySummary(quality)}};
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
  const canTarget=first?.quality_guard_failed===true&&first?.candidate_data&&first?.quality_report;
  const second:any=canTarget
    ?await repairCandidateWithThaiSafety(payload,first.candidate_data,first.quality_report,secondModel,key)
    :await generateWithThaiSafety(payload,secondModel,key,true,"");
  const combinedUsageBase=addGeminiUsage(first.usage,second.usage);
  const combinedUsage=second?.validation?{...combinedUsageBase,quality_validation:qualitySummary(second.validation)}:combinedUsageBase;
  const attemptCount=Number(first.attempt_count??1)+Number(second.attempt_count??1);
  if(second.ok)return preferred===secondModel?{...second,usage:combinedUsage,attempt_count:attemptCount}:{...second,usage:combinedUsage,attempt_count:attemptCount,fallback_from:preferred};
  const qualityDetail=second?.quality_guard_failed?` · 최종 품질점수 ${second?.quality_report?.score??0}/100`:"";
  const repairLabel=canTarget?"타깃 재생성":"전체 재생성";
  return {ok:false,error:`AI 해설이 검증을 완료하지 못했어. 1차=${first.error}; 2차(${repairLabel})=${second.error}${qualityDetail}`,model:preferred,usage:combinedUsage,attempt_count:attemptCount,quality_report:second?.quality_report??first?.quality_report};
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
  if(b?.action==="meta")return res({configured:Boolean(key),interpreter_version:VERSION,packet_version:PACKET_VERSION,quality_version:QUALITY_VERSION,models:MODELS,background_jobs:true,payload_hash_cache:true,inflight_dedupe:true,five_stage_validation:true,split_structured_output:true,evidence_ledger:true,full_daily_scores:true,daily_actual_evidence:true,monthly_trajectory:true,cross_system_timeline:true,thai_contract:THAI_CONTRACT_VERSION,thai_layers:["Mahathaksa","Taksajorn","Suriyayat 10-planet position facts","validated numeric Lagna","12 descriptive non-predictive house routes"],suriyayat_lagna:true,thai_output_guard:true,thai_strict_retry:true,thai_safe_fallback:true});
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