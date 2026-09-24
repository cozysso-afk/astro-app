from pathlib import Path
p=Path('supabase/functions/relationship-interpret-v9-preview/index.ts')
s=p.read_text()
old='function selectPromptPacket(calc:any,ctx:any,purpose:Purpose){let originalBytes=0,last:any=null;for(let level=0;level<=2;level++){const payload=compact(calc,ctx,purpose,level);const budget=promptBudget(payload,purpose);if(level===0)originalBytes=budget.bytes;last={payload,budget,compression_level:level,original_prompt_bytes:originalBytes};if(budget.ok)return last;}return last;}'
new='function selectPromptPacket(calc:any,ctx:any,purpose:Purpose){let originalBytes=0,last:any=null;for(let level=0;level<=2;level++){const payload=compact(calc,ctx,purpose,level);const budget=promptBudget(payload,purpose);if(level===0)originalBytes=budget.bytes;last={payload,budget,compression_level:level,original_prompt_bytes:originalBytes};if((purpose==="reunion"&&budget.target_ok)||(purpose!=="reunion"&&budget.ok))return last;}return last;}'
if old not in s: raise SystemExit('selectPromptPacket target not found')
s=s.replace(old,new,1)
old='function promptBudget(payload:any,purpose:Purpose){const bytes=enc.encode(SYSTEM+promptText(payload,purpose,false)).length,maxBytes=purpose==="reunion"?REUNION_PROMPT_TARGET_BYTES:MAX_PROMPT_BYTES,estimated_input_tokens=Math.ceil(bytes/2.6),estimated_max_job_krw=relationshipEstimatedJobKrw(estimated_input_tokens,purpose);return {bytes,max_bytes:maxBytes,estimated_input_tokens,estimated_max_job_krw,max_job_krw:MAX_AI_JOB_ESTIMATED_KRW,ok:bytes<=maxBytes&&estimated_max_job_krw<=MAX_AI_JOB_ESTIMATED_KRW};}'
new='function promptBudget(payload:any,purpose:Purpose){const bytes=enc.encode(SYSTEM+promptText(payload,purpose,false)).length,targetBytes=purpose==="reunion"?REUNION_PROMPT_TARGET_BYTES:MAX_PROMPT_BYTES,estimated_input_tokens=Math.ceil(bytes/2.6),estimated_max_job_krw=relationshipEstimatedJobKrw(estimated_input_tokens,purpose),ok=bytes<=MAX_PROMPT_BYTES&&estimated_max_job_krw<=MAX_AI_JOB_ESTIMATED_KRW;return {bytes,max_bytes:MAX_PROMPT_BYTES,target_bytes:targetBytes,target_ok:bytes<=targetBytes,estimated_input_tokens,estimated_max_job_krw,max_job_krw:MAX_AI_JOB_ESTIMATED_KRW,ok};}'
if old not in s: raise SystemExit('promptBudget strict target not found')
s=s.replace(old,new,1)
p.write_text(s)

p=Path('web/src/lib/reunionAiResilienceV128.test.mjs')
s=p.read_text()
needle="  assert.match(server,/REUNION_PROMPT_TARGET_BYTES=85000/)\n"
extra="  assert.match(server,/target_ok:bytes<=targetBytes/)\n  assert.match(server,/purpose===\\\"reunion\\\"&&budget\\.target_ok/)\n"
if extra.strip() not in s:
    if needle not in s: raise SystemExit('focused prompt target assertion not found')
    s=s.replace(needle,needle+extra,1)
p.write_text(s)
print('reunion prompt target converted to best-effort compression goal')
