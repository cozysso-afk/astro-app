import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import { MODELS, FALLBACK_MODEL, TOPICS, compactCalculation, payloadHash, SCHEMA, validateOutput, txt } from "../fortune-interpret-v6-preview/integratedInterpretationV2.ts";
import { QUALITY_VERSION, inspectInterpretationQuality, strictQualityRetryInstruction } from "../fortune-interpret-v6-preview/qualityV2.ts";
import { addGeminiUsage, inspectThaiOutputSafety, thaiOutputGuardRequired, strictThaiRetryInstruction, THAI_CONTRACT_VERSION } from "../fortune-interpret-v6-preview/thaiContract.ts";
import { buildDeterministicTopicAnalysis } from "../fortune-interpret-v21-preview/costGuardV21.ts";
import { publicCallTrace, publicFailedUsage, publicFortuneError, publicFortuneFailureFields, publicJobUsage, storedFortuneJobError, storedFortuneJobErrorCode } from "../_shared/fortuneAiPublicError.ts";
import { buildV23CorePrompt, buildV23CorePromptFromPacket, buildV23PromptBudget, V23_PROMPT_VERSION } from "./promptV23.ts";
import { PERIOD_NARRATIVE_VERSION } from "./periodNarrativeV23.ts";
import { isExtendedPeriod, inspectPeriodProviderDocument, inspectPeriodReading, applyPeriodReadingGate } from "./periodReadingContractV1.ts";
import { exactV23JobKind } from "./cacheIdentityV23.ts";
import { EDITORIAL_SECTION_KEYS, buildProviderCoreSchema, normalizeProviderCore } from "./providerSchemaV23.ts";
import { inspectDailyEditorial, applyDailyEditorialGate, dailyEditorialRetryInstruction } from "./dailyEditorialV1.ts";
import { buildDailyClarityRequest, applyDailyRewrite } from "./dailyRewriteV1.ts";
import { DAILY_PRIMARY_KEYS, inspectDailyProviderDocument, omitUnsupportedDailyConditions } from "./dailyReadingContractV1.ts";
import { v23FinishReason, v23OutputTokenLimit, v23ThinkingLevel } from "./runtimeBudgetV23.ts";
import { buildAuthoredTopicAnalysisOnly } from "./editorialPolishV23.ts";
import { buildEditorialTrace, captureEditorialStage } from "./editorialTraceV23.ts";
import { attachPrecisionPacketMetadata, precisionGateFromPayload } from "../fortune-interpret-v22-preview/precisionV2.ts";
import { attachAuthoredDayTimingEvidence } from "./dayTimingEvidenceV23.ts";

const VERSION="supabase-ai-v23.16-readable-retry-v23";
const STRUCTURE_VERSION="fortune-provider-structure-v1";
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
// Gemini 3.7 repeatedly exhausted the first-call timeout in live QA. Starting
// with 3.6 leaves the second paid call available for a targeted semantic
// rewrite when the quality gate reports concrete evidence/consistency issues.
const V23_DEFAULT_MODEL="gemini-3.6-flash";
const enc=new TextEncoder();

function res(x:unknown,status=200){return new Response(JSON.stringify(x),{status,headers:CORS});}
function usage(raw:any){const u=raw?.usageMetadata??{};return {prompt_tokens:Number(u.promptTokenCount??0),candidate_tokens:Number(u.candidatesTokenCount??0),thought_tokens:Number(u.thoughtsTokenCount??0),total_tokens:Number(u.totalTokenCount??0)};}
function qualitySummary(quality:any){return quality?{version:quality.version,score:quality.score,stages:(quality.stages??[]).map((s:any)=>({stage:s.stage,name:s.name,passed:s.passed}))}:null;}
function qualityFailure(result:any,quality:any){const failed=(quality?.stages??[]).filter((s:any)=>!s.passed).map((s:any)=>`${s.stage}:${s.name}`).join(", ");return {...result,ok:false,error:`Quality V6 해설 검증 미통과(${failed})`,quality_guard_failed:true,quality_report:quality,candidate_data:result?.data,validation:undefined};}

function structureReport(value:any){
  const issues:string[]=[];
  if(!value||typeof value!=="object"||Array.isArray(value))issues.push("root_object_missing");
  if(!value?.overall||typeof value.overall!=="object")issues.push("overall_missing");
  if(!value?.systems||typeof value.systems!=="object")issues.push("systems_missing");
  if(!value?.clusters||typeof value.clusters!=="object")issues.push("clusters_missing");
  const topicKeys=value?.topic_analysis&&typeof value.topic_analysis==="object"&&!Array.isArray(value.topic_analysis)?Object.keys(value.topic_analysis):[];
  if(topicKeys.length!==TOPICS.length)issues.push("topic_count_mismatch");
  if(topicKeys.some(topic=>!TOPICS.includes(topic as any)))issues.push("topic_unknown");
  const clusterSections=EDITORIAL_SECTION_KEYS.filter(key=>{const [group,section]=key.split(".");return value?.clusters?.[group]?.[section]&&typeof value.clusters[group][section]==="object";});
  if(clusterSections.length!==EDITORIAL_SECTION_KEYS.length)issues.push("cluster_section_missing");
  return {version:STRUCTURE_VERSION,passed:false,issues,topic_count:topicKeys.length,cluster_section_count:clusterSections.length};
}
function structureFailure(result:any,value:any){const report=structureReport(value);if(!report.issues.length)report.issues.push("validator_rejected_normalized_core");return {...result,ok:false,error:"provider 구조화 응답 검증 실패",structure_guard_failed:true,structure_report:report,candidate_data:result?.data,validation:undefined};}
function strictStructureRetryInstruction(report:any){return `\n\n[STRUCTURE RETRY · REQUIRED]\n- 이전 응답은 서버 구조 검증을 통과하지 못했다: ${(report?.issues??[]).join(",")||"validator_rejected_normalized_core"}.\n- responseSchema의 required 필드를 빠짐없이 반환하고, clusters key는 중복 없이 sparse 배열로 작성해.\n- period_section_not_plain_language 또는 period_hero_not_plain_language가 있으면 headline·overall·각 conclusion/action/real_scene 첫 문장에서 행성명·각 이름·영문 전문어·사주 용어·기류·에너지·작용을 모두 빼고 생활 장면부터 써.\n- 각 fields에 정확한 날짜나 기간을 쓰려면 그 fields의 evidence_refs가 그 날짜 또는 구간을 직접 포함해야 해. 아니면 날짜를 삭제하고 장면만 설명해.\n- 원고를 축약해도 JSON 필드 이름·자료형·enum은 바꾸지 마. 이 규칙을 어기면 응답 전체가 폐기된다.`;}

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

function coreInstruction(periodKind:unknown,compact=false){const kind=String(periodKind??"annual");if(kind==="day")return `
[DAILY OUTPUT]
- clusters는 sparse 배열이고 key는 ${DAILY_PRIMARY_KEYS.join(', ')} 여섯 기본 분야를 먼저 작성해. daily_editorial_brief.questions에서 generation_policy가 required_detail인 연락·재회·시험·이직·투자·소식 세부도 빠짐없이 작성해. 나머지 기존 조건부 상세는 근거가 뒷받침할 때 추가해. 각 항목은 conclusion/real_scene/action/change_condition/evidence_refs/applicability를 포함해.
- headline 한 문장, overall.summary 80~180자, 기본 각 분야는 판단 한 문장과 설명·행동·판단 조건을 구분해. 친근한 반말로 ~해/~야로 끝내. 보고서식 ~한다/~이다는 쓰지 마.
- time_of_day=not_in_this_reading_scope이다. 시각·아침·오전·오후·저녁·밤·새벽을 새로 붙이지 마. 모든 key_windows의 start/end는 근거의 날짜로 쓰되 시간대 행동을 만들지 마.
- key_windows 1개, decisions 1개, priorities 1~2개. decision은 key_window와 하나 이상의 실제 evidence_ref를 공유해. year_phases와 cross_checks는 빈 배열로 둬. domain_answers는 빈 배열로 두고 이번 세부 해설은 clusters에서 작성해. relationship_reading/contact_flow/investment_reading은 기존 기능이며 해당 질문의 근거가 있으면 작성할 수 있어. 실제 선연락·재회·수익을 확정하지 마.
- systems에는 독립된 전문 근거와 한계를 짧게 쓸 수 있어. 반면 headline/overall.summary/clusters.real_scene은 전문용어를 먼저 나열하지 말고 사람이 이해하는 생활 장면으로 써.
- 종합에서 특정 역할을 나열하지 마. 애정은 만남·호감의 상호성·관계 속도를 다루고 연락 조언으로만 채우지 마. 현실 사건·증상·학습 효과를 관측한 것처럼 단정하지 마.
- change_condition은 이번 일일 계약에서는 빈 문자열로 둬. 안전이나 성공을 보장하는 예외를 만들지 마.
- 근거 ID는 PROMPT_DATA.evidence_ledger에 전달된 것만 써. 근거 없는 분야는 명시적으로 insufficient로 두고 문장을 만들지 마. 실제 기준일을 모르면 오늘 대신 선택 운세일이라고 써.
`;return "";}

type CallTrace={call:number;model:string;kind:"initial"|"semantic_rewrite"|"structure_rewrite"|"fallback";prompt_bytes:number;elapsed_ms:number;http_status:number;usage:any;max_output_tokens:number;finish_reason?:string;error?:string};
type Budget={used:number;deadline:number;calls:CallTrace[]};
function budgetLeft(b:Budget){return b.used<MAX_GEMINI_CALLS&&Date.now()<b.deadline;}
async function generateCore(fullPayload:any,promptPayload:any,model:string,key:string,budget:Budget,kind:"initial"|"semantic_rewrite"|"structure_rewrite"|"fallback",compact=false,qualityRetry="",override?:{prompt:string;schema:any}){
  if(!budgetLeft(budget))return {ok:false,error:"AI 호출 상한에 도달해 추가 생성을 중단했어.",model,cost_guard_blocked:true};
  const authoredPrompt=override?{text:""}:buildV23CorePromptFromPacket(promptPayload);
  const prompt=override?.prompt??`${authoredPrompt.text}\n\n${coreInstruction(fullPayload?.period_kind,compact)}${qualityRetry}`;
  const promptBytes=enc.encode(prompt).byteLength;
  const callNo=++budget.used;
  const started=Date.now();
  const remain=Math.max(1000,budget.deadline-Date.now());
  const timeout=Math.min(compact?46000:54000,remain);
  const maxOutputTokens=v23OutputTokenLimit(String(fullPayload?.period_kind??"annual"),compact);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
      method:"POST",signal:controller.signal,headers:{"Content-Type":"application/json","x-goog-api-key":key},
      body:JSON.stringify({systemInstruction:{parts:[{text:SYSTEM}]},contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json",responseSchema:override?.schema??buildProviderCoreSchema(SCHEMA,fullPayload?.period_kind),maxOutputTokens,temperature:.28,thinkingConfig:{thinkingLevel:v23ThinkingLevel()}}}),
    });
    const rawText=await r.text();
    let raw:any=null;try{raw=JSON.parse(rawText);}catch{}
    const u=usage(raw);
    const finishReason=v23FinishReason(raw);
    const trace:CallTrace={call:callNo,model,kind,prompt_bytes:promptBytes,elapsed_ms:Date.now()-started,http_status:r.status,usage:u,max_output_tokens:maxOutputTokens,...(finishReason?{finish_reason:finishReason}:{})};
    if(!r.ok){trace.error=`Gemini HTTP ${r.status}`;budget.calls.push(trace);return {ok:false,error:`Gemini HTTP ${r.status}`,model,http_status:r.status,usage:u};}
    budget.calls.push(trace);
    if(finishReason==="MAX_TOKENS")return {ok:false,error:`core 구조화 응답이 maxOutputTokens=${maxOutputTokens}에서 잘렸어`,model,usage:u,finish_reason:finishReason,max_output_tokens:maxOutputTokens};
    const parts=raw?.candidates?.[0]?.content?.parts??[];
    let out=parts.filter((p:any)=>!p?.thought).map((p:any)=>p?.text??"").join("").trim();
    if(!out)out=parts.map((p:any)=>p?.text??"").join("").trim();
    out=out.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"");
    try{const partial=JSON.parse(out);if(!partial||typeof partial!=="object"||Array.isArray(partial))return {ok:false,error:"core 구조화 응답이 객체가 아니야",model,usage:u};return {ok:true,partial,model,usage:u};}
    catch{return {ok:false,error:"core 구조화 응답이 완전하지 않았어",model,usage:u};}
  }catch(e){
    const msg=e instanceof DOMException&&e.name==="AbortError"?"AI 해설 시간이 초과됐어.":`AI 해설 호출 실패: ${e instanceof Error?e.message:String(e)}`;
    budget.calls.push({call:callNo,model,kind,prompt_bytes:promptBytes,elapsed_ms:Date.now()-started,http_status:0,usage:{prompt_tokens:0,candidate_tokens:0,thought_tokens:0,total_tokens:0},max_output_tokens:maxOutputTokens,error:msg});
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
  const {editorial_trace_seed:traceSeed=[],editorial_trace_origin:traceOrigin,...resultMeta}=meta??{};
  const traceStages=Array.isArray(traceSeed)?[...traceSeed]:[];
  if(!traceStages.length)traceStages.push(captureEditorialStage("finalize_input",core));
  core=omitUnsupportedDailyConditions(core,payload?.period_kind);
  if(payload?.period_kind==="day")traceStages.push(captureEditorialStage("omit_unsupported_daily_exceptions",core));
  const withTopics={...core,topic_analysis:buildAuthoredTopicAnalysisOnly(core,buildDeterministicTopicAnalysis(payload),payload)};
  traceStages.push(captureEditorialStage("post_authored_projection",withTopics));
  const validated=validateOutput(withTopics);
  if(!validated){
    const editorial_trace=buildEditorialTrace(traceStages,{model,origin:traceOrigin??(resultMeta?.local_quality_fallback?"local_fallback":"gemini")});
    return structureFailure({model,usage:u,data:withTopics,origin:"gemini",editorial_trace,...resultMeta},withTopics);
  }
  const dailyEditorial=inspectDailyEditorial(validated,payload);
  const data={...attachAuthoredDayTimingEvidence(normalizeDirectionalWindows(validated,payload),payload),editorial_delivery:core.editorial_delivery};
  const guard=inspectThaiOutputSafety(data,thaiOutputGuardRequired(payload));
  if(!guard.safe){
    const editorial_trace=buildEditorialTrace(traceStages,{model,origin:traceOrigin??"gemini"});
    return {ok:false,error:"Thai 출력 안전검증 실패",model,usage:u,guard_violations:guard.violations,editorial_trace,...resultMeta};
  }
  traceStages.push(captureEditorialStage("post_thai_guard",data));
  const quality=applyDailyEditorialGate(inspectInterpretationQuality(data,payload,{requireDailyTimedDecision:false,allowEmptyDailyChangeCondition:true,periodReadingContract:true}),dailyEditorial);
  const gatedQuality=applyPeriodReadingGate(quality,inspectPeriodReading(data,payload));
  traceStages.push(captureEditorialStage("post_quality_validation",data));
  const editorial_trace=buildEditorialTrace(traceStages,{model,origin:traceOrigin??"gemini",quality_ok:Boolean(gatedQuality?.ok)});
  if(!gatedQuality.ok){
    return qualityFailure({model,usage:u,data,origin:"gemini",editorial_trace,...resultMeta},gatedQuality);
  }
  return {ok:true,data,model,origin:"gemini",interpreter_version:VERSION,validation:gatedQuality,degraded_quality:false,local_quality_fallback:false,editorial_trace,usage:{...(u??{}),quality_validation:qualitySummary(gatedQuality)},...resultMeta};
}

async function generate(payload:any,model:string,key:string,budget:Budget,kind:"initial"|"fallback"|"semantic_rewrite"|"structure_rewrite"="initial",compact=false,qualityRetry=""){
  const pb=buildV23PromptBudget(payload);
  if(!pb.ok)return {ok:false,error:`V23 AI 해설 예상 최대 비용이 약 ${Math.round(pb.estimated_max_job_krw)}원으로 작업 상한 ${pb.max_job_krw}원을 넘어 Gemini 호출을 막았어.`,model,cost_guard_blocked:true,prompt_budget:pb};
  const core=await generateCore(payload,pb.packet,model,key,budget,kind,compact,qualityRetry);
  if(!core.ok)return {...core,prompt_budget:{bytes:pb.bytes,max_bytes:pb.max_bytes,estimated_input_tokens:pb.estimated_input_tokens}};
  const rawTrace=captureEditorialStage("provider_raw",core.partial);
  const dailyReport=isExtendedPeriod(payload?.period_kind)?inspectPeriodProviderDocument(core.partial,payload?.period_kind,pb.packet):inspectDailyProviderDocument(core.partial,payload?.period_kind,pb.packet);
  if(!dailyReport.passed)return {...core,ok:false,error:"해설 분야 검증 실패",structure_guard_failed:true,structure_report:{...dailyReport,issues:dailyReport.issues.map((issue:any)=>typeof issue==="string"?issue:`${issue.path}: ${issue.code}`)}};
  const normalizedCore=normalizeProviderCore(core.partial);
  const normalizedTrace=captureEditorialStage("provider_normalized",normalizedCore);
  return {...finalizeCandidate(normalizedCore,payload,model,core.usage,{single_core_generation:true,v23_period_narrative:true,provider_compact_schema:true,editorial_trace_seed:[rawTrace,normalizedTrace],editorial_trace_origin:"gemini"}),prompt_budget:{bytes:pb.bytes,max_bytes:pb.max_bytes,estimated_input_tokens:pb.estimated_input_tokens}};
}

async function rewriteDailyCandidate(first:any,payload:any,model:string,key:string,budget:Budget,request:any){
  const result=await generateCore(payload,{},model,key,budget,"semantic_rewrite",true,"",request);
  if(!result.ok)return result;
  try{
    const patched=applyDailyRewrite(first.candidate_data,request,result.partial);
    const rows=Object.entries(patched.clusters??{}).flatMap(([group,sections]:any)=>Object.entries(sections).map(([name,section]:any)=>({key:`${group}.${name}`,...section})));
    const structure=inspectDailyProviderDocument({...patched,clusters:rows},"day",payload);
    if(!structure.passed)return {ok:false,error:"일일 수정 원고 구조 검증 실패",model,usage:result.usage,structure_guard_failed:true,structure_report:structure};
    const edited=finalizeCandidate(patched,payload,model,result.usage,{targeted_daily_rewrite:true,editorial_trace_origin:"gemini",editorial_trace_seed:[captureEditorialStage("provider_original_candidate",first.candidate_data),captureEditorialStage("provider_patch_applied",patched)]});
    return {...edited,editorial_trace:{...edited.editorial_trace,previous:first.editorial_trace??null}};
  }catch{return {ok:false,error:"일일 수정 원고 범위 검증 실패",model,usage:result.usage};}
}

async function calculate(payload:any,preferred:string,key:string,shouldContinue:()=>Promise<boolean>){
  const budget:Budget={used:0,deadline:Date.now()+MAX_JOB_MS,calls:[]};
  const first:any=await generate(payload,preferred,key,budget,"initial",false,"");
  if(first.ok&&payload?.period_kind!=="day")return {...first,attempt_count:budget.used,call_trace:budget.calls};
  if(first?.http_status===429||first?.cost_guard_blocked)return {...first,attempt_count:budget.used,call_trace:budget.calls};
  if(!(await shouldContinue()))return {ok:false,error:"AI 해설 생성이 취소됐어.",model:preferred,canceled:true,usage:first.usage,attempt_count:budget.used,call_trace:budget.calls};
  const secondModel=preferred===FALLBACK_MODEL?preferred:FALLBACK_MODEL;
  let second:any;
  const dailyDraft=first.ok?first.data:first.quality_guard_failed?first.candidate_data:null;
  const dailyPatch=dailyDraft?buildDailyClarityRequest(dailyDraft,payload,first.quality_report):null;
  if(dailyPatch)second=await rewriteDailyCandidate({...first,candidate_data:dailyDraft},payload,"gemini-3.7-flash",key,budget,dailyPatch);
  else if(first?.structure_guard_failed===true&&first?.structure_report)second=await generate(payload,secondModel,key,budget,"structure_rewrite",true,strictStructureRetryInstruction(first.structure_report));
  else if(first?.quality_guard_failed===true&&first?.quality_report)second=await generate(payload,secondModel,key,budget,"semantic_rewrite",true,strictQualityRetryInstruction(first.quality_report)+(first.quality_report.daily_editorial?.passed===false?dailyEditorialRetryInstruction(first.quality_report.daily_editorial,first.candidate_data):""));
  else if(Array.isArray(first?.guard_violations)&&first.guard_violations.length)second=await generate(payload,secondModel,key,budget,"semantic_rewrite",true,strictThaiRetryInstruction(first.guard_violations));
  else if(first?.timeout||[500,502,503,504].includes(Number(first?.http_status??0))||String(first?.error??"").includes("구조화 응답"))second=await generate(payload,secondModel,key,budget,"fallback",true,"");
  else return {...first,attempt_count:budget.used,call_trace:budget.calls};
  const combined=addGeminiUsage(first.usage,second?.usage);
  if(second?.ok)return {...second,usage:{...combined,quality_validation:qualitySummary(second.validation)},attempt_count:budget.used,call_trace:budget.calls,first_quality_report:first?.quality_report??null,first_structure_report:first?.structure_report??null,...(preferred===second.model?{}:{fallback_from:preferred})};
  return {ok:false,error:`V23 AI 해설이 검증을 완료하지 못했어. 1차=${first.error}; 2차=${second?.error??"중단"}`,model:preferred,origin:"deterministic_safe",safe_summary_required:true,usage:combined,attempt_count:budget.used,call_trace:budget.calls,first_quality_report:first?.quality_report??null,quality_report:second?.quality_report??first?.quality_report,first_structure_report:first?.structure_report??null,structure_report:second?.structure_report??first?.structure_report??null};
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
    const callTrace=publicCallTrace(r.call_trace);
    const usageJson={...(r.usage??{prompt_tokens:0,candidate_tokens:0,thought_tokens:0,total_tokens:0}),attempt_count:r.attempt_count??0,call_trace:callTrace,gemini_paid_call:callTrace.length>0,prompt_budget:r.prompt_budget??null,quality_validation:qualitySummary(r.validation)??r.usage?.quality_validation??null,cost_guard_version:VERSION,generation_version:VERSION,narrative_version:PERIOD_NARRATIVE_VERSION,prompt_version:V23_PROMPT_VERSION,origin:r.origin??(r.ok?"gemini":"deterministic_safe"),safe_summary_required:Boolean(r.safe_summary_required),local_thai_scrub:false,degraded_quality:false,local_quality_fallback:false,quality_warning:null,first_quality_report:r.first_quality_report??null,quality_report:r.quality_report??null,first_structure_report:r.first_structure_report??null,structure_report:r.structure_report??null,editorial_trace:r.editorial_trace??null};
    if(!(await jobActive(id))){await a.from("ai_interpret_jobs").update({usage_json:usageJson,updated_at:new Date().toISOString()}).eq("id",id);return;}
    const done={status:"done",model:r.model,fallback_from:r.fallback_from??null,result_json:r.data,usage_json:usageJson,error:null,updated_at:new Date().toISOString(),completed_at:new Date().toISOString()};
    const failed={status:"failed",model,error:storedFortuneJobError("JOB_GENERATION_FAILED"),usage_json:usageJson,updated_at:new Date().toISOString(),completed_at:new Date().toISOString()};
    await a.from("ai_interpret_jobs").update(r.ok?done:failed).eq("id",id);
  }catch(e){publicFortuneError("JOB_GENERATION_FAILED",e);await a.from("ai_interpret_jobs").update({status:"failed",error:storedFortuneJobError("JOB_GENERATION_FAILED"),updated_at:new Date().toISOString(),completed_at:new Date().toISOString()}).eq("id",id);}
}

function verifiedGeminiJob(data:any){
  if(data?.status!=="done"||!data?.result_json||data?.usage_json?.origin!=="gemini")return false;
  if(data?.usage_json?.generation_version!==VERSION||data?.usage_json?.cost_guard_version!==VERSION)return false;
  const trace=Array.isArray(data?.usage_json?.call_trace)?data.usage_json.call_trace:[];
  const successful=trace.some((row:any)=>Number(row?.http_status)>=200&&Number(row?.http_status)<300&&String(row?.model??"")===String(data?.model??""));
  const stages=data?.usage_json?.quality_validation?.stages;
  return successful&&Array.isArray(stages)&&stages.length===6&&stages.every((stage:any)=>stage?.passed===true);
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
  if(req.method!=="POST")return res(publicFortuneError("METHOD_NOT_ALLOWED"),405);
  let b:any;try{b=await req.json();}catch{return res(publicFortuneError("INVALID_JSON"),400);}
  const key=(Deno.env.get("GEMINI_API_KEY")??"").trim();
  if(b?.action==="meta")return res({configured:Boolean(key),interpreter_version:VERSION,packet_version:V23_PROMPT_VERSION,narrative_version:PERIOD_NARRATIVE_VERSION,quality_version:QUALITY_VERSION,models:MODELS,background_jobs:true,payload_hash_cache:true,inflight_dedupe:true,quality_v6_validation:true,semantic_rewrite:true,structure_rewrite:true,single_core_generation:true,deterministic_topic_analysis:true,provider_compact_schema:true,max_gemini_calls_per_job:MAX_GEMINI_CALLS,max_job_ms:MAX_JOB_MS,rolling_job_guard:true,prompt_budget_guard:true,prompt_copy:true,phenomenon_first:true,period_specific_narrative:true,thai_contract:THAI_CONTRACT_VERSION});
  const u=await user(req);if(!u)return res(publicFortuneError("AUTH_REQUIRED"),401);
  if(b?.action==="status"){
    const id=txt(b.job_id,100);const a=admin();const {data,error}=await a.from("ai_interpret_jobs").select("id,status,model,fallback_from,result_json,usage_json,error,created_at,updated_at,completed_at,period_start,period_end").eq("id",id).eq("user_id",u.id).maybeSingle();
    if(error)return res(publicFortuneError("JOB_STATUS_READ_FAILED",error),500);if(!data)return res(publicFortuneError("JOB_NOT_FOUND"),404);
    if(["queued","running"].includes(String(data.status))&&Date.now()-Date.parse(String(data.updated_at??data.created_at))>MAX_JOB_MS+30000){await a.from("ai_interpret_jobs").update({status:"failed",error:storedFortuneJobError("JOB_TIMEOUT"),completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id);data.status="failed";data.error=storedFortuneJobError("JOB_TIMEOUT");}
    const failureFields=data.status==="failed"?publicFortuneFailureFields(storedFortuneJobErrorCode(data.error)):null;
    const provenanceVerified=verifiedGeminiJob(data);
    const origin=provenanceVerified?"gemini":"deterministic_safe";
    const storedVersion=typeof data.usage_json?.generation_version==="string"?data.usage_json.generation_version:"unverified";
    return res({ok:true,job_id:data.id,status:data.status,origin,provenance_verified:provenanceVerified,model:data.model,fallback_from:data.fallback_from,data:data.result_json,usage:data.status==="failed"?publicFailedUsage(data.usage_json):publicJobUsage(data.usage_json),error:failureFields?.error??null,...(failureFields??{}),created_at:data.created_at,updated_at:data.updated_at,completed_at:data.completed_at,period_start:data.period_start,period_end:data.period_end,interpreter_version:data.status==="done"?storedVersion:VERSION});
  }
  if(b?.action==="cancel"){
    const id=txt(b.job_id,100);const now=new Date().toISOString();const {data,error}=await admin().from("ai_interpret_jobs").update({status:"failed",error:storedFortuneJobError("JOB_CANCELED"),updated_at:now,completed_at:now}).eq("id",id).eq("user_id",u.id).in("status",["queued","running"]).select("id,status").maybeSingle();
    if(error)return res(publicFortuneError("JOB_CANCEL_FAILED",error),500);return res({ok:true,job_id:id,canceled:Boolean(data?.id)});
  }
  if(!b?.calculation)return res(publicFortuneError("CALCULATION_REQUIRED"),400);
  const compacted=compactCalculation(b.calculation);
  const preferred=MODELS[b.model]?b.model:compacted.period_kind==="day"?"gemini-3.7-flash":V23_DEFAULT_MODEL;
  const precisionGate=precisionGateFromPayload(b.calculation);
  const payload=precisionGate.ok?attachPrecisionPacketMetadata(compacted,b.calculation):compacted;
  const pb=buildV23PromptBudget(payload);
  if(b?.action==="inspect")return res({ok:true,interpreter_version:VERSION,full_payload_bytes:enc.encode(JSON.stringify(payload)).byteLength,prompt_payload_bytes:pb.bytes,prompt_budget_bytes:pb.max_bytes,prompt_budget_ok:pb.ok,estimated_input_tokens:pb.estimated_input_tokens,estimated_max_job_krw:pb.estimated_max_job_krw,max_gemini_calls_per_job:MAX_GEMINI_CALLS,deterministic_topics:buildDeterministicTopicAnalysis(payload).length,key_dates:payload?.key_dates?.length??0,evidence_ledger:payload?.evidence_ledger?.length??0,prompt_evidence_ledger:pb.packet?.evidence_ledger?.length??0,narrative_phenomena:pb.packet?.period_narrative?.phenomena?.length??0,narrative_kind:pb.packet?.period_narrative?.kind??null,provider_schema_bytes:enc.encode(JSON.stringify(buildProviderCoreSchema(SCHEMA,payload?.period_kind))).byteLength,provider_editorial_sections:EDITORIAL_SECTION_KEYS.length});
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
