from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f'missing anchor: {label}')
    p.write_text(s.replace(old, new, 1))


def append_once(path, marker, block):
    p = Path(path)
    s = p.read_text()
    if marker in s:
        return
    p.write_text(s.rstrip() + '\n\n' + block.strip() + '\n')

# 1) Build a fully local, evidence-only fallback core. It is used only after paid attempts fail quality.
cost_path = 'supabase/functions/fortune-interpret-v21-preview/costGuardV21.ts'
insert_anchor = 'export function buildPromptPacket(payload:any){'
fallback_fn = r'''export function buildLocalQualityFallbackCore(payload:any){
  const topics=buildDeterministicTopicAnalysis(payload);
  const important=topics.filter((x:any)=>x.importance!=="참고");
  const core=topics.filter((x:any)=>x.importance==="핵심");
  const names=(core.length?core:important).slice(0,3).map((x:any)=>String(x.topic));
  const periodStart=String(payload?.period?.start??"");
  const periodEnd=String(payload?.period?.end??"");
  const periodLabel=periodStart&&periodEnd&&periodStart!==periodEnd?`${periodStart}~${periodEnd}`:periodStart||"선택 기간";
  const focus=names.length?names.join(" · "):"핵심 분야";
  const topicLine=(wanted:string[])=>{
    const rows=topics.filter((x:any)=>wanted.includes(String(x.topic))).filter((x:any)=>x.importance!=="참고").slice(0,3);
    return rows.length?rows.map((x:any)=>`${x.topic}: ${x.verdict}`).join(" "):"이번 기간에 해당 분야가 최우선으로 두드러진다는 직접 근거는 강하지 않아.";
  };
  const sajuText=payload?.saju?.day_master
    ? `사주는 일간 ${String(payload.saju.day_master)}과 실제 계산된 세운·월운 구간만 Western과 합산하지 않고 독립 맥락으로 참고해.`
    : "사주는 실제 계산된 구간이 있을 때만 Western과 합산하지 않고 독립 맥락으로 참고해.";
  const thaiText=payload?.thai?.thai_day
    ? `Thai는 ${String(payload.thai.thai_day)} 출생요일과 실제 계산된 Mahathaksa·Taksajorn·Suriyayat 범위만 독립 맥락으로 참고해.`
    : "Thai는 실제 계산된 범위만 독립 맥락으로 참고해.";
  return {
    headline:`${periodLabel}은 ${focus} 흐름을 계산근거 중심으로 확인하는 기간이야.`,
    overall:{
      summary:"",
      dominant_pattern:`${focus}의 상대활성도 변화가 이번 기간의 우선 확인 대상이야. 한 날짜나 점수 하나를 사건 확률로 바꾸지 않고 기간 평균·직접 날짜 근거·실제 반응을 함께 봐.`,
      best_phase:"직접 계산근거가 연결된 상위 날짜·구간에서 실제 일정과 반응이 함께 좋아지는지 확인해.",
      caution_phase:"하위 날짜·구간에서는 체감만으로 결론을 확대하지 말고 실제 일정·반응·수치를 다시 확인해.",
      evidence_refs:[],
    },
    key_windows:[],
    year_phases:[],
    cross_checks:[],
    decisions:[],
    clusters:{
      relationship:topicLine(["대인관계","연애","연락","재회"]),
      work_study:topicLine(["학업","시험","직장","이직"]),
      money_news:topicLine(["금전","소식"]),
      investment:"투자 관련 상대지수는 심리·행동의 참고값이야. 가격방향·수익률·매수·매도 시점을 뜻하지 않으며 실제 시장 데이터와 손익·리스크 기준을 우선해.",
      condition:topicLine(["컨디션"]),
    },
    relationship_reading:{
      context:"관계가 중요 분야일 때 상대 → 나, 나 → 상대, 과거 인연 재접점을 서로 다른 축으로 분리해 확인해.",
      flow:"한 방향의 상대활성도가 올라가도 다른 방향의 결과까지 자동으로 뜻하지 않아. 실제 연락·답변·약속·만남 제안이 뒤따르는지 확인해.",
      focus_timing:"직접 관계 날짜 근거가 연결된 구간만 주목하고, 실제 반응이 함께 나타나는지 확인해.",
      watch:"실제 연락 빈도, 답변의 구체성, 약속 이행, 만남 제안처럼 관찰 가능한 신호를 확인해.",
      avoid:"상대활성도만으로 상대의 속마음이나 연애·재회 결과를 미리 확정하지 마.",
      evidence_refs:[],
    },
    contact_flow:{
      incoming:"상대 → 나는 실제로 먼저 온 연락·답변·구체적 제안이 나타나는지 확인하는 방향축이야.",
      outgoing:"나 → 상대는 내가 먼저 연락하거나 제안할 때의 상대적 적합도이지 상대의 수락을 뜻하지 않아.",
      reconnection:"과거 인연 재접점은 과거 인연이 다시 접촉할 상대적 활성도이지 재회 확정이 아니야.",
    },
    investment_reading:{
      psychology:"투자심리 상대활성도는 과열·위축을 점검하는 보조지표이며 시장 가격 방향 예측이 아니야.",
      realization:"수익실현 상대활성도는 실제 수익 가능성이나 매도 적기를 뜻하지 않아. 시장 데이터와 사전 손익 기준을 우선해.",
      entry:"신규진입 상대활성도는 매수 신호가 아니야. 밸류에이션·가격·거래량과 본인 위험 한도를 먼저 확인해.",
      risk:"투자주의 상대활성도는 판단 오류와 변동성 대응을 더 보수적으로 점검하는 참고값이야.",
    },
    systems:{
      western:"Western 계산은 기간 평균·일별 궤적·직접 날짜 근거의 상대활성도 변화를 중심으로 읽어. 점수는 사건 확률이 아니야.",
      saju:sajuText,
      thai:thaiText,
    },
    priorities:[],
    topic_analysis:topics,
    limits:"Gemini 유료 호출이 끝난 뒤에도 5단계 품질검증을 완전히 통과하지 못한 경우 계산근거만으로 만든 안전 보정본이야. 구조·근거 추적·의미 방향·내부 일관성은 통과해야 표시하고, 깊이·실용성 일부 항목만 부족하면 결과를 숨기지 않고 보정본으로 보여줘. 사건 확률·상대 속마음·가격방향은 단정하지 않아.",
  };
}

'''
replace_once(cost_path, insert_anchor, fallback_fn + insert_anchor, 'local fallback function')

# 2) Runtime: never return zero content after paid attempts when a critical-safe local fallback can be built.
index_path = 'supabase/functions/fortune-interpret-v21-preview/index.ts'
replace_once(index_path,
'''import { buildDeterministicTopicAnalysis, buildExternalPrompt, buildPromptPacket, promptBudget, stabilizeCoreForQuality } from "./costGuardV21.ts";''',
'''import { buildDeterministicTopicAnalysis, buildExternalPrompt, buildLocalQualityFallbackCore, buildPromptPacket, promptBudget, stabilizeCoreForQuality } from "./costGuardV21.ts";''',
'index local fallback import')
replace_once(index_path,
'''const VERSION="supabase-ai-v21.3.2-relationship-direction-depth";''',
'''const VERSION="supabase-ai-v21.3.3-no-zero-paid-fallback";''',
'runtime version')
replace_once(index_path,
'''function qualityFailure(result:any,quality:any){const failed=(quality?.stages??[]).filter((s:any)=>!s.passed).map((s:any)=>`${s.stage}:${s.name}`).join(", ");return {...result,ok:false,error:`5단계 해설 검증 미통과(${failed})`,quality_guard_failed:true,quality_report:quality,candidate_data:result?.data,validation:undefined};}
''',
'''function qualityFailure(result:any,quality:any){const failed=(quality?.stages??[]).filter((s:any)=>!s.passed).map((s:any)=>`${s.stage}:${s.name}`).join(", ");return {...result,ok:false,error:`5단계 해설 검증 미통과(${failed})`,quality_guard_failed:true,quality_report:quality,candidate_data:result?.data,validation:undefined};}
function criticalQualityPassed(quality:any){
  const stages=Array.isArray(quality?.stages)?quality.stages:[];
  return [1,2,3,4].every((stage)=>stages.some((row:any)=>Number(row?.stage)===stage&&row?.passed===true));
}
''',
'critical quality helper')
replace_once(index_path,
'''  const quality=inspectInterpretationQuality(data,payload);
  if(!quality.ok)return qualityFailure({model,usage:u,data,local_thai_scrub:localThaiScrub,...meta},quality);
  return {ok:true,data,model,interpreter_version:VERSION,validation:quality,local_thai_scrub:localThaiScrub,usage:{...(u??{}),quality_validation:qualitySummary(quality)},...meta};
''',
'''  const quality=inspectInterpretationQuality(data,payload);
  if(!quality.ok){
    if(meta?.allow_degraded_quality===true&&criticalQualityPassed(quality)){
      return {ok:true,data,model,interpreter_version:VERSION,validation:quality,degraded_quality:true,local_quality_fallback:Boolean(meta?.local_quality_fallback),quality_warning:String(meta?.quality_warning??"5단계 깊이·실용성 일부 항목은 보정본으로 표시해."),local_thai_scrub:localThaiScrub,usage:{...(u??{}),quality_validation:qualitySummary(quality)},...meta};
    }
    return qualityFailure({model,usage:u,data,local_thai_scrub:localThaiScrub,...meta},quality);
  }
  return {ok:true,data,model,interpreter_version:VERSION,validation:quality,degraded_quality:false,local_quality_fallback:Boolean(meta?.local_quality_fallback),local_thai_scrub:localThaiScrub,usage:{...(u??{}),quality_validation:qualitySummary(quality)},...meta};
''',
'allow stage5-only degraded result')
replace_once(index_path,
'''  const combined=addGeminiUsage(first.usage,second?.usage);
  if(second?.ok)return {...second,usage:{...combined,quality_validation:qualitySummary(second.validation)},attempt_count:budget.used,call_trace:budget.calls,first_quality_report:first?.quality_report??null,...(preferred===secondModel?{}:{fallback_from:preferred})};
  return {ok:false,error:`AI 해설이 검증을 완료하지 못했어. 1차=${first.error}; 2차=${second?.error??"중단"}`,model:preferred,usage:combined,attempt_count:budget.used,call_trace:budget.calls,first_quality_report:first?.quality_report??null,quality_report:second?.quality_report??first?.quality_report};
''',
'''  const combined=addGeminiUsage(first.usage,second?.usage);
  if(second?.ok)return {...second,usage:{...combined,quality_validation:qualitySummary(second.validation)},attempt_count:budget.used,call_trace:budget.calls,first_quality_report:first?.quality_report??null,...(preferred===secondModel?{}:{fallback_from:preferred})};
  if(second?.quality_guard_failed===true&&second?.candidate_data&&criticalQualityPassed(second?.quality_report)){
    return {ok:true,data:second.candidate_data,model:second?.model??secondModel,interpreter_version:VERSION,validation:second.quality_report,degraded_quality:true,local_quality_fallback:false,quality_warning:"구조·근거·의미 방향·일관성은 통과했고 깊이·실용성 일부 항목만 미통과라 결과를 숨기지 않고 표시해.",usage:{...combined,quality_validation:qualitySummary(second.quality_report)},attempt_count:budget.used,call_trace:budget.calls,first_quality_report:first?.quality_report??null,quality_report:second?.quality_report??null,...(preferred===secondModel?{}:{fallback_from:preferred})};
  }
  const local=finalizeCandidate(buildLocalQualityFallbackCore(payload),payload,secondModel,{prompt_tokens:0,candidate_tokens:0,thought_tokens:0,total_tokens:0},{allow_degraded_quality:true,local_quality_fallback:true,quality_warning:"Gemini 유료 호출은 끝났고, 검증 미통과 부분은 계산근거만으로 안전 보정해 표시했어. 추가 Gemini 호출은 0회야."});
  if(local?.ok)return {...local,usage:{...combined,quality_validation:qualitySummary(local.validation)},attempt_count:budget.used,call_trace:budget.calls,first_quality_report:first?.quality_report??null,quality_report:second?.quality_report??first?.quality_report,...(preferred===secondModel?{}:{fallback_from:preferred})};
  return {ok:false,error:`AI 해설이 검증을 완료하지 못했고 안전 보정본도 만들지 못했어. 1차=${first.error}; 2차=${second?.error??"중단"}; 로컬=${local?.error??"중단"}`,model:preferred,usage:combined,attempt_count:budget.used,call_trace:budget.calls,first_quality_report:first?.quality_report??null,quality_report:second?.quality_report??first?.quality_report};
''',
'calculate local fallback tail')
replace_once(index_path,
'''    const usageJson={...(r.usage??{prompt_tokens:0,candidate_tokens:0,thought_tokens:0,total_tokens:0}),attempt_count:r.attempt_count??0,call_trace:r.call_trace??[],prompt_budget:r.prompt_budget??null,quality_validation:qualitySummary(r.validation)??r.usage?.quality_validation??null,cost_guard_version:VERSION,local_thai_scrub:Boolean(r.local_thai_scrub),first_quality_report:r.first_quality_report??null,quality_report:r.quality_report??null};''',
'''    const usageJson={...(r.usage??{prompt_tokens:0,candidate_tokens:0,thought_tokens:0,total_tokens:0}),attempt_count:r.attempt_count??0,call_trace:r.call_trace??[],prompt_budget:r.prompt_budget??null,quality_validation:qualitySummary(r.validation)??r.usage?.quality_validation??null,cost_guard_version:VERSION,local_thai_scrub:Boolean(r.local_thai_scrub),degraded_quality:Boolean(r.degraded_quality),local_quality_fallback:Boolean(r.local_quality_fallback),quality_warning:r.quality_warning??null,first_quality_report:r.first_quality_report??null,quality_report:r.quality_report??null};''',
'persist fallback metadata')

# 3) Web types + visible notice. No extra Gemini calls.
replace_once('web/src/appTypes.ts',
'''    local_thai_scrub?: boolean
''',
'''    local_thai_scrub?: boolean
    degraded_quality?: boolean
    local_quality_fallback?: boolean
    quality_warning?: string | null
''',
'AI usage fallback type')

for panel in ['web/src/PeriodAiInterpretationPanel.tsx','web/src/AiInterpretationPanel.tsx']:
    replace_once(panel,
'''  const validationPassed = validation?.score === 100 || (!!validation?.stages?.length && validation.stages.every((stage)=>stage.passed))
''',
'''  const validationPassed = validation?.score === 100 || (!!validation?.stages?.length && validation.stages.every((stage)=>stage.passed))
  const localQualityFallback = Boolean(result.usage?.local_quality_fallback)
  const degradedQuality = Boolean(result.usage?.degraded_quality)
''',
'panel fallback state')

replace_once('web/src/PeriodAiInterpretationPanel.tsx',
'''    {validation?.stages?.length ? <div className={`period-ai-validation ${validationPassed ? 'is-passed' : 'is-partial'}`}><CheckCircle2 size={15}/><strong>{validationPassed ? '5단계 검증 통과' : '해설 검증 결과'}</strong><span>{validation.score ?? 0}/100</span></div> : null}
''',
'''    {(localQualityFallback || degradedQuality) ? <div className="period-ai-quality-fallback"><CheckCircle2 size={15}/><div><strong>{localQualityFallback ? '검증 실패 부분 안전 보정본' : '핵심 검증 통과 · 일부 깊이 보정'}</strong><span>{result.usage?.quality_warning || (localQualityFallback ? '추가 Gemini 호출 없이 계산근거만으로 보정해 표시했어.' : '결과를 숨기지 않고 통과한 핵심 근거를 기준으로 표시했어.')}</span></div></div> : null}
    {validation?.stages?.length ? <div className={`period-ai-validation ${validationPassed ? 'is-passed' : 'is-partial'}`}><CheckCircle2 size={15}/><strong>{validationPassed ? '5단계 검증 통과' : '해설 검증 결과'}</strong><span>{validation.score ?? 0}/100</span></div> : null}
''',
'period fallback notice')
replace_once('web/src/AiInterpretationPanel.tsx',
'''    {validation?.stages?.length ? <div className={`ai-validation-badge ${validationPassed ? 'is-passed' : 'is-partial'}`}><CheckCircle2 size={16}/><strong>{validationPassed ? '5단계 검증 통과' : '해설 검증 결과'}</strong><span>{validation.score ?? 0}/100 · {validation.stages.filter((stage)=>stage.passed).length}/5 단계</span></div> : null}
''',
'''    {(localQualityFallback || degradedQuality) ? <div className="ai-quality-fallback"><CheckCircle2 size={16}/><div><strong>{localQualityFallback ? '검증 실패 부분 안전 보정본' : '핵심 검증 통과 · 일부 깊이 보정'}</strong><span>{result.usage?.quality_warning || (localQualityFallback ? '추가 Gemini 호출 없이 계산근거만으로 보정해 표시했어.' : '결과를 숨기지 않고 통과한 핵심 근거를 기준으로 표시했어.')}</span></div></div> : null}
    {validation?.stages?.length ? <div className={`ai-validation-badge ${validationPassed ? 'is-passed' : 'is-partial'}`}><CheckCircle2 size={16}/><strong>{validationPassed ? '5단계 검증 통과' : '해설 검증 결과'}</strong><span>{validation.score ?? 0}/100 · {validation.stages.filter((stage)=>stage.passed).length}/5 단계</span></div> : null}
''',
'annual fallback notice')

append_once('web/src/period-ai-v18.css','/* V21.3.3 no-zero paid fallback */',r'''/* V21.3.3 no-zero paid fallback */
.period-ai-quality-fallback{display:flex;align-items:flex-start;gap:8px;padding:10px 11px;border:1px solid rgba(122,151,137,.2);border-radius:13px;background:linear-gradient(135deg,rgba(237,249,243,.9),rgba(248,245,255,.88));color:#5b6f64}.period-ai-quality-fallback>svg{flex:0 0 auto;margin-top:2px}.period-ai-quality-fallback>div{display:grid;gap:2px}.period-ai-quality-fallback strong{font-size:.8rem;color:#52675b}.period-ai-quality-fallback span{font-size:.75rem;line-height:1.55;color:#6e746f}
''')
append_once('web/src/ai-interpret-v2.css','/* V21.3.3 no-zero paid fallback */',r'''/* V21.3.3 no-zero paid fallback */
.ai-quality-fallback{display:flex;align-items:flex-start;gap:8px;padding:10px 11px;border:1px solid rgba(122,151,137,.2);border-radius:13px;background:linear-gradient(135deg,rgba(237,249,243,.9),rgba(248,245,255,.88));color:#5b6f64}.ai-quality-fallback>svg{flex:0 0 auto;margin-top:2px}.ai-quality-fallback>div{display:grid;gap:2px}.ai-quality-fallback strong{font-size:.8rem;color:#52675b}.ai-quality-fallback span{font-size:.75rem;line-height:1.55;color:#6e746f}
''')

# 4) Regression coverage: local fallback must at least pass critical stages 1-4 on the annual fixture.
test_path = 'supabase/functions/fortune-interpret-v21-preview/costGuardV21.test.mjs'
replace_once(test_path,
'''import { buildDeterministicTopicAnalysis, buildExternalPrompt, buildPromptPacket, promptBudget, stabilizeCoreForQuality } from './costGuardV21.ts';
import { TOPICS, REL } from '../fortune-interpret-v6-preview/integratedInterpretationV2.ts';
''',
'''import { buildDeterministicTopicAnalysis, buildExternalPrompt, buildLocalQualityFallbackCore, buildPromptPacket, promptBudget, stabilizeCoreForQuality } from './costGuardV21.ts';
import { TOPICS, REL, validateOutput } from '../fortune-interpret-v6-preview/integratedInterpretationV2.ts';
import { inspectInterpretationQuality } from '../fortune-interpret-v6-preview/qualityV2.ts';
''',
'cost guard test imports')
append_once(test_path,"test('V21.3.3 local fallback keeps paid jobs from becoming zero-content when critical validation can pass'",r'''test('V21.3.3 local fallback keeps paid jobs from becoming zero-content when critical validation can pass',()=>{
  const p=packet();
  const core=buildLocalQualityFallbackCore(p);
  const stabilized=stabilizeCoreForQuality(core,p);
  const validated=validateOutput(stabilized);
  assert.ok(validated,'local fallback must satisfy output schema');
  const report=inspectInterpretationQuality(validated,p);
  for(const stage of [1,2,3,4]){
    const row=report.stages.find(x=>x.stage===stage);
    assert.equal(row?.passed,true,`critical quality stage ${stage} must pass: ${(row?.issues??[]).join(' / ')}`);
  }
  assert.ok(validated.key_windows.length>=5);
  assert.ok(validated.decisions.length>=3);
  assert.match(validated.limits,/안전 보정본/);
});

test('V21.3.3 runtime preserves paid usage and exposes local fallback instead of zero content',()=>{
  const src=fs.readFileSync(new URL('./index.ts',import.meta.url),'utf8');
  assert.match(src,/supabase-ai-v21\.3\.3-no-zero-paid-fallback/);
  assert.match(src,/buildLocalQualityFallbackCore/);
  assert.match(src,/allow_degraded_quality:true/);
  assert.match(src,/local_quality_fallback:true/);
  assert.match(src,/criticalQualityPassed/);
  assert.match(src,/usage:\{\.\.\.combined,quality_validation:/);
});
''')

print('V21.3.3 no-zero paid fallback patch applied')
