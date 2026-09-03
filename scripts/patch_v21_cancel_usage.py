from pathlib import Path

# Preserve usage_json after a user cancellation even if the in-flight first Gemini request
# only returns after the DB job has already been marked failed/canceled.
p=Path('supabase/functions/fortune-interpret-v21-preview/index.ts')
s=p.read_text(encoding='utf-8')
old='''    const r:any=await calculate(payload,model,key,()=>jobActive(id));
    if(!(await jobActive(id)))return;
    const usageJson={...(r.usage??{prompt_tokens:0,candidate_tokens:0,thought_tokens:0,total_tokens:0}),attempt_count:r.attempt_count??0,call_trace:r.call_trace??[],prompt_budget:r.prompt_budget??null,quality_validation:qualitySummary(r.validation)??r.usage?.quality_validation??null,cost_guard_version:VERSION,local_thai_scrub:Boolean(r.local_thai_scrub)};
    const done={status:"done",model:r.model,fallback_from:r.fallback_from??null,result_json:r.data,usage_json:usageJson,error:null,updated_at:new Date().toISOString(),completed_at:new Date().toISOString()};
'''
new='''    const r:any=await calculate(payload,model,key,()=>jobActive(id));
    const usageJson={...(r.usage??{prompt_tokens:0,candidate_tokens:0,thought_tokens:0,total_tokens:0}),attempt_count:r.attempt_count??0,call_trace:r.call_trace??[],prompt_budget:r.prompt_budget??null,quality_validation:qualitySummary(r.validation)??r.usage?.quality_validation??null,cost_guard_version:VERSION,local_thai_scrub:Boolean(r.local_thai_scrub)};
    if(!(await jobActive(id))){
      // A cancel request can mark the row failed while the already-sent first network call is still in flight.
      // Never resurrect that job, but attach the real usage/trace once the call returns so spent tokens are observable.
      await a.from("ai_interpret_jobs").update({usage_json:usageJson,updated_at:new Date().toISOString()}).eq("id",id);
      return;
    }
    const done={status:"done",model:r.model,fallback_from:r.fallback_from??null,result_json:r.data,usage_json:usageJson,error:null,updated_at:new Date().toISOString(),completed_at:new Date().toISOString()};
'''
if old not in s: raise SystemExit('backend job anchor missing')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

# Extend static regression: canceled jobs must persist usage rather than return before building it.
p=Path('supabase/functions/fortune-interpret-v21-preview/costGuardV21.test.mjs')
s=p.read_text(encoding='utf-8')
old="""  assert.match(src,/usage_json:usageJson/);
});
"""
new="""  assert.match(src,/usage_json:usageJson/);
  assert.match(src,/if\(!\(await jobActive\(id\)\)\)\{/);
  assert.match(src,/update\(\{usage_json:usageJson,updated_at:/);
  const usageBuild=src.indexOf('const usageJson=');
  const inactiveCheck=src.indexOf('if(!(await jobActive(id)))');
  assert.ok(usageBuild>=0 && inactiveCheck>usageBuild,'usage must be built before canceled-job early return');
});
"""
if old not in s: raise SystemExit('test anchor missing')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

# Frontend: after cancel, briefly poll the canceled job for usage-only metadata. This never starts AI.
p=Path('web/src/AppNext.tsx')
s=p.read_text(encoding='utf-8')
anchor='''  async function cancelAiInterpretation(silent = false) {
'''
helper='''  async function captureCanceledAiUsage(jobId: string) {
    // The first network request may already have been sent when cancel is pressed.
    // V21 stores its usage after that request returns; poll only for metadata, never start/retry Gemini here.
    for (let attempt=0; attempt<14; attempt++) {
      await new Promise((resolve)=>window.setTimeout(resolve, attempt<4 ? 1800 : 3000))
      try {
        const { data, error } = await supabase.functions.invoke(FORTUNE_AI_FUNCTION, { body:{ action:'status', job_id:jobId } })
        if (error) continue
        const total=Number(data?.usage?.total_tokens ?? 0)
        if (total>0) {
          setAiInterpretation({ ok:false, model:data.model, fallback_from:data.fallback_from, interpreter_version:data.interpreter_version || 'unknown', usage:data.usage, error:data?.error || 'AI 해설 생성을 취소했어.' })
          return
        }
      } catch {
        // Best-effort observability only. Cancellation itself has already completed.
      }
    }
  }

'''+anchor
if anchor not in s: raise SystemExit('frontend cancel anchor missing')
s=s.replace(anchor,helper,1)
old='''      setAiActiveJobId(null)
      setAiLoading(false)
      if (!silent) {
'''
new='''      setAiActiveJobId(null)
      setAiLoading(false)
      void captureCanceledAiUsage(jobId)
      if (!silent) {
'''
if old not in s: raise SystemExit('frontend cancel success anchor missing')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

print('patched V21 canceled-call usage observability')
