from pathlib import Path
import re

path = Path('supabase/functions/fortune-interpret-v23-preview/index.ts')
text = path.read_text()

if 'editorialTraceV23.ts' not in text:
    text = text.replace(
        'import { polishV23EditorialDepth } from "./editorialPolishV23.ts";\n',
        'import { polishV23EditorialDepth } from "./editorialPolishV23.ts";\nimport { buildEditorialTrace, captureEditorialStage } from "./editorialTraceV23.ts";\n',
    )

text = text.replace(
    'const VERSION="supabase-ai-v23.3-editorial-flow";',
    'const VERSION="supabase-ai-v23.4-editorial-trace-v1";',
)

new_finalize = r'''function finalizeCandidate(core:any,payload:any,model:string,u:any,meta:any={}){
  const {editorial_trace_seed:traceSeed=[],editorial_trace_origin:traceOrigin,...resultMeta}=meta??{};
  const traceStages=Array.isArray(traceSeed)?[...traceSeed]:[];
  if(!traceStages.length)traceStages.push(captureEditorialStage("finalize_input",core));
  const withTopics={...core,topic_analysis:buildDeterministicTopicAnalysis(payload)};
  traceStages.push(captureEditorialStage("post_topic_injection",withTopics));
  const stabilized=stabilizeCoreForQuality(withTopics,payload);
  traceStages.push(captureEditorialStage("post_stabilizer",stabilized));
  const merged=ensureDayDepthGuides(stabilized,payload);
  traceStages.push(captureEditorialStage("post_day_depth",merged));
  let validated=validateOutput(merged);
  if(!validated){
    const editorial_trace=buildEditorialTrace(traceStages,{model,origin:traceOrigin??(resultMeta?.local_quality_fallback?"local_fallback":"gemini")});
    return {ok:false,error:"1단계 구조 검증 실패",model,usage:u,editorial_trace,...resultMeta};
  }
  let data=normalizeDirectionalWindows(validated,payload);
  const guard=inspectThaiOutputSafety(data,thaiOutputGuardRequired(payload));
  let localThaiScrub=false;
  if(!guard.safe){
    const scrubbed=buildThaiOutputFallback(data);
    validated=scrubbed?validateOutput(scrubbed):null;
    const secondGuard=validated?inspectThaiOutputSafety(validated,thaiOutputGuardRequired(payload)):{safe:false};
    if(!validated||!secondGuard.safe){
      const editorial_trace=buildEditorialTrace(traceStages,{model,origin:traceOrigin??(resultMeta?.local_quality_fallback?"local_fallback":"gemini")});
      return {ok:false,error:"Thai 출력 안전검증 실패",model,usage:u,guard_violations:guard.violations,editorial_trace,...resultMeta};
    }
    data=normalizeDirectionalWindows(validated,payload);localThaiScrub=true;
  }
  traceStages.push(captureEditorialStage("post_thai_guard",data));
  data=polishV23EditorialDepth(data,payload);
  traceStages.push(captureEditorialStage("post_editorial_polish",data));
  const quality=inspectInterpretationQuality(data,payload);
  traceStages.push(captureEditorialStage("post_quality_repair",data));
  const editorial_trace=buildEditorialTrace(traceStages,{model,origin:traceOrigin??(resultMeta?.local_quality_fallback?"local_fallback":"gemini"),quality_ok:Boolean(quality?.ok)});
  if(!quality.ok){
    const criticalPassed=criticalQualityPassed(quality);
    const locallyRepairedTiming=quality?.local_timing_repair===true&&criticalPassed;
    if((resultMeta?.allow_degraded_quality===true&&criticalPassed)||locallyRepairedTiming){
      const warning=locallyRepairedTiming
        ? "직접 근거가 없는 날짜·구간만 로컬에서 제거했고 구조·근거·의미 방향·일관성은 통과했어. 같은 결과를 고치려고 Gemini를 한 번 더 호출하지 않아."
        : String(resultMeta?.quality_warning??"5단계 깊이·실용성 일부 항목은 보정본으로 표시해.");
      return {ok:true,data,model,interpreter_version:VERSION,validation:quality,degraded_quality:true,local_quality_fallback:Boolean(resultMeta?.local_quality_fallback),quality_warning:warning,local_thai_scrub:localThaiScrub,editorial_trace,usage:{...(u??{}),quality_validation:qualitySummary(quality)},...resultMeta};
    }
    return qualityFailure({model,usage:u,data,local_thai_scrub:localThaiScrub,editorial_trace,...resultMeta},quality);
  }
  return {ok:true,data,model,interpreter_version:VERSION,validation:quality,degraded_quality:false,local_quality_fallback:Boolean(resultMeta?.local_quality_fallback),local_thai_scrub:localThaiScrub,editorial_trace,usage:{...(u??{}),quality_validation:qualitySummary(quality)},...resultMeta};
}'''

text, count = re.subn(
    r'function finalizeCandidate\(core:any,payload:any,model:string,u:any,meta:any=\{\}\)\{.*?\n\}\n\nasync function generate\(',
    new_finalize + '\n\nasync function generate(',
    text,
    count=1,
    flags=re.S,
)
if count != 1 and 'post_quality_repair' not in text:
    raise SystemExit(f'finalizeCandidate replacement count={count}')

old_generate = '''  const normalizedCore=normalizeProviderCore(core.partial);\n  return {...finalizeCandidate(normalizedCore,payload,model,core.usage,{single_core_generation:true,v23_period_narrative:true,provider_compact_schema:true}),prompt_budget:{bytes:pb.bytes,max_bytes:pb.max_bytes,estimated_input_tokens:pb.estimated_input_tokens}};'''
new_generate = '''  const rawTrace=captureEditorialStage("provider_raw",core.partial);\n  const normalizedCore=normalizeProviderCore(core.partial);\n  const normalizedTrace=captureEditorialStage("provider_normalized",normalizedCore);\n  return {...finalizeCandidate(normalizedCore,payload,model,core.usage,{single_core_generation:true,v23_period_narrative:true,provider_compact_schema:true,editorial_trace_seed:[rawTrace,normalizedTrace],editorial_trace_origin:"gemini"}),prompt_budget:{bytes:pb.bytes,max_bytes:pb.max_bytes,estimated_input_tokens:pb.estimated_input_tokens}};'''
if old_generate in text:
    text = text.replace(old_generate, new_generate, 1)
elif 'provider_raw' not in text:
    raise SystemExit('generate trace seed replacement failed')

old_usage = 'quality_report:r.quality_report??null};'
new_usage = 'quality_report:r.quality_report??null,editorial_trace:r.editorial_trace??null};'
if old_usage in text:
    text = text.replace(old_usage, new_usage, 1)
elif 'editorial_trace:r.editorial_trace' not in text:
    raise SystemExit('usageJson trace replacement failed')

path.write_text(text)
