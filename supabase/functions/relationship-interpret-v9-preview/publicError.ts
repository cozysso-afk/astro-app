const ERRORS = {
  REL_METHOD_NOT_ALLOWED: ['request', '지원하지 않는 요청 방식이야.'],
  REL_INVALID_REQUEST: ['request', '관계 AI 해설 요청을 확인해줘.'],
  REL_AUTH_REQUIRED: ['auth', '인증이 필요해.'],
  REL_UPSTREAM_NOT_CONFIGURED: ['upstream_config', '관계 AI 해설 서버 설정이 필요해.'],
  REL_COST_GUARD_BLOCKED: ['cost_guard', '관계 AI 비용 보호 한도에 도달했어. 잠시 뒤 다시 시도해.'],
  REL_CACHE_READ_FAILED: ['cache_read', '관계 AI 해설 저장 상태를 확인하지 못했어.'],
  REL_JOB_CREATE_FAILED: ['db_write', '관계 AI 해설 작업을 시작하지 못했어.'],
  REL_GENERATION_TIMEOUT: ['generation', '관계 AI 해설 시간이 초과됐어.'],
  REL_GENERATION_FAILED: ['generation', '관계 AI 해설 생성에 실패했어.'],
  REL_RESULT_INVALID: ['validation', '관계 AI 해설 결과를 안전하게 확인하지 못했어.'],
  REL_JOB_FINALIZE_FAILED: ['db_write', '관계 AI 해설 저장을 완료하지 못했어.'],
  REL_CACHED_RESULT_INVALID: ['cache', '저장된 관계 AI 해설을 안전하게 확인하지 못했어.'],
} as const;
export type RelationshipErrorCode = keyof typeof ERRORS;
export function record(value: unknown): Record<string, any> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : null;
}
export function publicUsage(value: unknown) {
  const r=record(value), out: Record<string, number>={};
  if(!r)return out;
  for(const k of ['prompt_tokens','candidate_tokens','thought_tokens','total_tokens','attempt_count','estimated_usd','estimated_krw']) {
    const n=r[k];
    if(typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=Number.MAX_SAFE_INTEGER)out[k]=n;
  }
  return out;
}
const model=(v:unknown)=>v==='gemini-3.7-flash'||v==='gemini-3.6-flash';
const version=(v:unknown)=>typeof v==='string'&&v.length<=100&&/^relationship-v\d+(?:\.\d+)*(?:-[a-z0-9]+)*$/.test(v);
function metadata(value:unknown) {
  const r=record(value)??{}, out:Record<string,any>={};
  for(const k of ['model','fallback_from'])if(model(r[k]))out[k]=r[k];
  if(version(r.interpreter_version))out.interpreter_version=r.interpreter_version;
  if(r.usage!==undefined)out.usage=publicUsage(r.usage);
  return out;
}
export function publicRelationshipError(code:RelationshipErrorCode, extras:unknown={}) {
  const definition=Object.prototype.hasOwnProperty.call(ERRORS,code)?ERRORS[code]:ERRORS.REL_GENERATION_FAILED;
  const safeCode=Object.prototype.hasOwnProperty.call(ERRORS,code)?code:'REL_GENERATION_FAILED';
  const r=record(extras)??{}, safe=metadata(r);
  for(const k of ['cost_guard_blocked','reused'])if(typeof r[k]==='boolean')safe[k]=r[k];
  if(typeof r.retry_after_seconds==='number'&&Number.isFinite(r.retry_after_seconds)&&r.retry_after_seconds>=0)safe.retry_after_seconds=Math.min(86400,Math.ceil(r.retry_after_seconds));
  if(r.missing_key==='GEMINI_API_KEY')safe.missing_key=r.missing_key;
  return {ok:false,error_code:safeCode,stage:definition[0],error:definition[1],...safe};
}
// Shape projection only: never classify or rewrite legitimate interpretation prose.
const TEXT_LIMITS:Record<string,number>={headline:450,overview:6500,chemistry:4200,emotional_dynamic:4200,communication:4200,conflict_pattern:4200,power_boundaries:3800,long_term:4500,timing:3500,reunion_context:3500,limits:2200};
const REUNION_LIMITS:Record<string,number>={bottom_line:4500,contact_recontact:4000,emotional_reactivation:4000,relationship_rebuilding:4500,incoming_contact:4000,outgoing_contact:3500,reconnection_windows:6000,low_windows:3500,relationship_filter:4500,precision_note:1800};
function textField(v:unknown,max:number){return typeof v==='string'&&v.length<=max*4?v:null;}
function refList(v:unknown){return Array.isArray(v)&&v.length<=12&&v.every(x=>typeof x==='string'&&x.length<=180)?v.slice():null;}
function publicReunionV2(value:unknown){const r=record(value);if(!r)return null;const sec=(v:unknown)=>{const x=record(v),refs=refList(x?.evidence_refs);if(!x||!refs)return null;const conclusion=textField(x.conclusion,2600),interpretation=textField(x.interpretation,3200);return conclusion!==null&&interpretation!==null?{conclusion,interpretation,evidence_refs:refs}:null;};const why=sec(r.why_reconnect),initiative=sec(r.initiative),t=record(r.timing),reb=record(r.rebuild),risk=record(r.repeat_risks);if(!why||!initiative||!t||!reb||!risk)return null;const timingRefs=refList(t.evidence_refs),rebuildRefs=refList(reb.evidence_refs),riskRefs=refList(risk.evidence_refs);if(!timingRefs||!rebuildRefs||!riskRefs)return null;const windows=Array.isArray(t.windows)&&t.windows.length<=4?t.windows.map((w:unknown)=>{const x=record(w),refs=refList(x?.evidence_refs);const period=textField(x?.period,120),meaning=textField(x?.meaning,1800);return x&&refs&&period!==null&&meaning!==null?{period,meaning,evidence_refs:refs}:null;}):[];if(windows.some(x=>x===null))return null;const convergence=Array.isArray(r.convergence)&&r.convergence.length<=5?r.convergence.map((c:unknown)=>{const x=record(c),refs=refList(x?.evidence_refs);const theme=textField(x?.theme,500),period=textField(x?.period,120),meaning=textField(x?.meaning,1600);return x&&refs&&theme!==null&&period!==null&&meaning!==null?{theme,period,meaning,evidence_refs:refs}:null;}):[];if(convergence.some(x=>x===null))return null;const summary=textField(r.summary,3200),precision=textField(r.precision_note,1800);if(summary===null||precision===null)return null;const conditions=Array.isArray(reb.conditions)&&reb.conditions.length<=4&&reb.conditions.every((x:unknown)=>typeof x==='string'&&x.length<=3600)?reb.conditions.slice():null;const patterns=Array.isArray(risk.patterns)&&risk.patterns.length<=4&&risk.patterns.every((x:unknown)=>typeof x==='string'&&x.length<=3600)?risk.patterns.slice():null;if(!conditions||!patterns)return null;return {summary,why_reconnect:why,initiative,timing:{conclusion:textField(t.conclusion,2600)??'',windows,evidence_refs:timingRefs},rebuild:{conclusion:textField(reb.conclusion,2600)??'',conditions,evidence_refs:rebuildRefs},repeat_risks:{conclusion:textField(risk.conclusion,2600)??'',patterns,evidence_refs:riskRefs},convergence,precision_note:precision};}
const MARRIAGE_LIMITS:Record<string,number>={mode:80,bottom_line:4800,bond:4200,emotional_home:4200,daily_life:4800,intimacy_resources:4600,conflict_repair:4200,commitment_or_current_cycle:4200,timing:3800,caution:3800,precision_note:1800};
// validate() cuts before gloss() expands planet/aspect names. Allow that bounded
// expansion here; preserve cached text exactly instead of cutting/glossing again.
function texts(value:unknown,limits:Record<string,number>) {
  const r=record(value),out:Record<string,string>={}; if(!r)return null;
  for(const [k,max] of Object.entries(limits)){if(typeof r[k]!=='string'||r[k].length>max*4)return null;out[k]=r[k];}
  return out;
}
export function publicInterpretation(value:unknown) {
  const r=record(value),out:Record<string,any>|null=texts(value,TEXT_LIMITS);if(!r||!out)return null;
  for(const [k,max] of [['felt_scenarios',1300],['practical_advice',1200]] as const){
    if(!Array.isArray(r[k])||r[k].length>4||r[k].some((x:unknown)=>typeof x!=='string'||x.length>max*4))return null;
    out[k]=r[k].slice();
  }
  if(!Array.isArray(r.top_aspects)||r.top_aspects.length>10)return null;
  out.top_aspects=r.top_aspects.map((x:unknown)=>texts(x,{label:500,meaning:1800}));
  if(out.top_aspects.some((x:unknown)=>x===null))return null;
  out.reunion_reading=texts(r.reunion_reading,REUNION_LIMITS);
  out.reunion_synthesis_v2=r.reunion_synthesis_v2===undefined?undefined:publicReunionV2(r.reunion_synthesis_v2);
  if(r.reunion_synthesis_v2!==undefined&&!out.reunion_synthesis_v2)return null;
  out.marriage_reading=texts(r.marriage_reading,MARRIAGE_LIMITS);
  if(!out.reunion_reading||!out.marriage_reading)return null;
  return out;
}
export function publicRelationshipResult(value:unknown,usageValue?:unknown) {
  const r=record(value);if(!r||r.ok!==true||!model(r.model)||!version(r.interpreter_version))return null;
  const data=publicInterpretation(r.data);if(!data)return null;
  return {ok:true,data,...metadata(r),usage:publicUsage(usageValue??r.usage)};
}
export function publicCachedResult(value:unknown,usageValue?:unknown) {
  const safe=publicRelationshipResult(value,usageValue);
  return safe?{...safe,cached:true,server_cache:true,reused:true}:null;
}
// 2 x 115s provider timeouts + 370s scheduling/DB margin. No timer or scheduler.
export const STALE_RELATIONSHIP_JOB_MS=10*60*1000;
export function isStaleRelationshipJob(row:unknown,now=Date.now()) {
  const r=record(row);if(!r)return false;
  const stamps=[r.created_at,r.updated_at].filter(x=>typeof x==='string').map(x=>Date.parse(x)).filter(Number.isFinite);
  return stamps.length>0&&now-Math.max(...stamps)>STALE_RELATIONSHIP_JOB_MS;
}
