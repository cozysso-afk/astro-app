from pathlib import Path

INDEX = Path('supabase/functions/fortune-interpret-v21-preview/index.ts')
GUARD = Path('supabase/functions/fortune-interpret-v21-preview/costGuardV21.ts')
TEST = Path('supabase/functions/fortune-interpret-v21-preview/costGuardV21.test.mjs')
README = Path('supabase/functions/fortune-interpret-v21-preview/README.md')
CACHE = Path('web/src/lib/readingCache.ts')
JOB = Path('web/src/lib/fortuneAiJob.ts')
JOB_TEST = Path('web/src/lib/fortuneAiJob.test.mjs')

# 1) Runtime version + rolling emergency breaker.
src = INDEX.read_text(encoding='utf-8')
src = src.replace(
    'const VERSION="supabase-ai-v21.2.1-explicit-action-guard";',
    'const VERSION="supabase-ai-v21.3-balanced-evidence-budget";',
    1,
)
needle = 'const MAX_GEMINI_CALLS=2;\nconst MAX_JOB_MS=115000;\nconst enc=new TextEncoder();\n'
replacement = '''const MAX_GEMINI_CALLS=2;\nconst MAX_JOB_MS=115000;\nconst MAX_USER_NEW_JOBS_10M=6;\nconst MAX_USER_NEW_JOBS_24H=20;\nconst MAX_GLOBAL_NEW_JOBS_10M=18;\nconst MAX_GLOBAL_NEW_JOBS_24H=60;\nconst enc=new TextEncoder();\n'''
if needle not in src:
    raise SystemExit('runtime constants anchor not found')
src = src.replace(needle, replacement, 1)

needle = 'function admin(){return createClient(SUPABASE_URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});}\nasync function user(req:Request)'
replacement = '''function admin(){return createClient(SUPABASE_URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});}\nasync function recentV21JobCount(a:any,since:string,userId?:string){\n  let q=a.from("ai_interpret_jobs").select("id",{count:"exact",head:true}).like("kind","supabase-ai-v21%").gte("created_at",since);\n  if(userId)q=q.eq("user_id",userId);\n  const {count,error}=await q;if(error)throw new Error(error.message);return Number(count??0);\n}\nasync function checkRollingJobBudget(a:any,userId:string){\n  const now=Date.now(),since10=new Date(now-10*60*1000).toISOString(),since24=new Date(now-24*60*60*1000).toISOString();\n  try{\n    const user10=await recentV21JobCount(a,since10,userId);\n    if(user10>=MAX_USER_NEW_JOBS_10M)return {ok:false,error:`10분 내 새 AI 해설 작업이 ${MAX_USER_NEW_JOBS_10M}건에 도달해서 비용 보호가 작동했어. 잠시 뒤 다시 시도해.`,retry_after_seconds:600};\n    const user24=await recentV21JobCount(a,since24,userId);\n    if(user24>=MAX_USER_NEW_JOBS_24H)return {ok:false,error:`24시간 내 새 AI 해설 작업이 ${MAX_USER_NEW_JOBS_24H}건에 도달해서 오늘의 비용 보호가 작동했어. 저장된 해설과 프롬프트 복사는 계속 사용할 수 있어.`,retry_after_seconds:3600};\n    const global10=await recentV21JobCount(a,since10);\n    if(global10>=MAX_GLOBAL_NEW_JOBS_10M)return {ok:false,error:"서비스 전체의 단시간 AI 비용 보호 상한에 도달했어. 잠시 뒤 다시 시도해.",retry_after_seconds:600};\n    const global24=await recentV21JobCount(a,since24);\n    if(global24>=MAX_GLOBAL_NEW_JOBS_24H)return {ok:false,error:"서비스 전체의 24시간 AI 비용 보호 상한에 도달했어. 저장된 해설과 프롬프트 복사는 계속 사용할 수 있어.",retry_after_seconds:3600};\n    return {ok:true,user10,user24,global10,global24};\n  }catch(e){return {ok:false,error:`AI 비용 보호 카운터를 확인하지 못해서 새 Gemini 호출을 안전하게 차단했어: ${e instanceof Error?e.message:String(e)}`,retry_after_seconds:60};}\n}\nasync function user(req:Request)'''
if needle not in src:
    raise SystemExit('rolling budget helper anchor not found')
src = src.replace(needle, replacement, 1)

old_meta = 'max_gemini_calls_per_job:MAX_GEMINI_CALLS,max_job_ms:MAX_JOB_MS,local_thai_scrub:true'
new_meta = 'max_gemini_calls_per_job:MAX_GEMINI_CALLS,max_job_ms:MAX_JOB_MS,rolling_job_guard:true,max_user_new_jobs_10m:MAX_USER_NEW_JOBS_10M,max_user_new_jobs_24h:MAX_USER_NEW_JOBS_24H,max_global_new_jobs_10m:MAX_GLOBAL_NEW_JOBS_10M,max_global_new_jobs_24h:MAX_GLOBAL_NEW_JOBS_24H,local_thai_scrub:true'
if old_meta not in src:
    raise SystemExit('meta anchor not found')
src = src.replace(old_meta, new_meta, 1)

needle = '    if(!pendingError&&pending?.id)return res({ok:true,job_id:pending.id,status:pending.status,interpreter_version:VERSION,reused:true,inflight:true},202);\n    const {data,error}=await a.from("ai_interpret_jobs").insert('
replacement = '    if(!pendingError&&pending?.id)return res({ok:true,job_id:pending.id,status:pending.status,interpreter_version:VERSION,reused:true,inflight:true},202);\n    const rolling=await checkRollingJobBudget(a,u.id);if(!rolling.ok)return res({ok:false,cost_guard_blocked:true,rolling_job_guard:true,error:rolling.error,retry_after_seconds:rolling.retry_after_seconds},200);\n    const {data,error}=await a.from("ai_interpret_jobs").insert('
if needle not in src:
    raise SystemExit('start rolling budget anchor not found')
src = src.replace(needle, replacement, 1)
INDEX.write_text(src, encoding='utf-8')

# 2) Reserve cross-system evidence inside the fixed prompt evidence cap.
guard = GUARD.read_text(encoding='utf-8')
needle = '''  const ordered=[...rows].sort((a:any,b:any)=>{\n    const p=(row:any)=>String(row?.id??"").startsWith("W:daily:")?0:String(row?.id??"").startsWith("W:detail:")?1:String(row?.id??"").startsWith("W:window:")?2:String(row?.id??"").startsWith("W:date:")?3:String(row?.id??"").startsWith("W:month:")?4:String(row?.id??"").startsWith("W:overall:")?5:6;\n    return p(a)-p(b);\n  });\n  return ordered.slice(0,payload?.period_kind==="annual"?110:80);\n'''
replacement = '''  const ordered=[...rows].sort((a:any,b:any)=>{\n    const p=(row:any)=>String(row?.id??"").startsWith("W:daily:")?0:String(row?.id??"").startsWith("W:detail:")?1:String(row?.id??"").startsWith("W:window:")?2:String(row?.id??"").startsWith("W:date:")?3:String(row?.id??"").startsWith("W:month:")?4:String(row?.id??"").startsWith("W:overall:")?5:6;\n    return p(a)-p(b);\n  });\n  const limit=payload?.period_kind==="annual"?110:80;\n  const context=ordered.filter((row:any)=>String(row?.system??"")!=="western");\n  const western=ordered.filter((row:any)=>String(row?.system??"")==="western");\n  const reserve=Math.min(context.length,payload?.period_kind==="annual"?16:12,limit);\n  return [...western.slice(0,limit-reserve),...context.slice(0,reserve)];\n'''
if needle not in guard:
    raise SystemExit('prompt evidence anchor not found')
guard = guard.replace(needle, replacement, 1)
GUARD.write_text(guard, encoding='utf-8')

# 3) Regression tests for cross-system reservation and rolling job breaker.
test = TEST.read_text(encoding='utf-8')
insert_before = "test('V21 deterministic topics cover all 15 without a second Gemini call',()=>{\n"
stress = '''test('V21 prompt reserves Saju and Thai evidence even when Western candidates exceed the annual cap',()=>{\n  const p=packet();\n  const stressTopics=[...TOPICS,...REL];\n  for(const topic of stressTopics){\n    for(let i=0;i<8;i++)p.evidence_ledger.push({id:`W:daily:stress:${topic}:${i}`,system:'western',scope:'daily_actual',topic,direction:'supportive',date:`2027-01-${String(i+1).padStart(2,'0')}`,score:60+i,text:`${topic} stress western ${i}`});\n  }\n  p.key_dates=Array.from({length:8},(_,i)=>{\n    const date=`2027-01-${String(i+1).padStart(2,'0')}`;\n    const ref=`W:date:stress:${date}`;\n    p.evidence_ledger.push({id:ref,system:'western',scope:'best_day',direction:'supportive',date,score:70,text:`stress key date ${date}`});\n    return {date,topics:['직장'],western_refs:[ref]};\n  });\n  p.cross_system_timeline=p.key_dates.map(row=>({date:row.date,western_refs:row.western_refs,saju_context_refs:['S:annual:1:2027-01-01'],thai_context_refs:['T:taksajorn:1:2027-01-01']}));\n  const compact=buildPromptPacket(p);\n  assert.ok(compact.evidence_ledger.length<=110);\n  assert.ok(compact.evidence_ledger.some(x=>x.system==='saju'),'Saju context must survive the cap');\n  assert.ok(compact.evidence_ledger.some(x=>x.system==='thai'),'Thai context must survive the cap');\n});\n\n'''
if insert_before not in test:
    raise SystemExit('cross-system test insertion anchor not found')
test = test.replace(insert_before, stress + insert_before, 1)
needle = '  assert.match(src,/MAX_GEMINI_CALLS=2/);\n'
replacement = needle + '  assert.match(src,/MAX_USER_NEW_JOBS_10M=6/);\n  assert.match(src,/MAX_USER_NEW_JOBS_24H=20/);\n  assert.match(src,/MAX_GLOBAL_NEW_JOBS_10M=18/);\n  assert.match(src,/MAX_GLOBAL_NEW_JOBS_24H=60/);\n  assert.match(src,/checkRollingJobBudget/);\n  assert.match(src,/rolling_job_guard:true/);\n'
if needle not in test:
    raise SystemExit('rolling guard test anchor not found')
test = test.replace(needle, replacement, 1)
TEST.write_text(test, encoding='utf-8')

# 4) Break any pre-V21.3 local/pending AI cache contracts.
cache = CACHE.read_text(encoding='utf-8').replace(
    "const FORTUNE_AI_CACHE_CONTRACT = 'release-contract-v21-single-core-cost-guard'",
    "const FORTUNE_AI_CACHE_CONTRACT = 'release-contract-v21.3-balanced-evidence-budget'",
    1,
)
CACHE.write_text(cache, encoding='utf-8')

job = JOB.read_text(encoding='utf-8').replace(
    "export const FORTUNE_AI_JOB_CONTRACT = 'fortune-ai-job-release-v21-single-core-cost-guard'",
    "export const FORTUNE_AI_JOB_CONTRACT = 'fortune-ai-job-release-v21.3-balanced-evidence-budget'",
    1,
).replace(
    "export const FORTUNE_AI_JOB_STORAGE_KEY = 'starlight-destiny.ai-job.v3'",
    "export const FORTUNE_AI_JOB_STORAGE_KEY = 'starlight-destiny.ai-job.v4'",
    1,
)
JOB.write_text(job, encoding='utf-8')

job_test = JOB_TEST.read_text(encoding='utf-8').replace("/\\.v3$/", "/\\.v4$/", 1).replace(
    "/v21-single-core-cost-guard$/",
    "/v21\\.3-balanced-evidence-budget$/",
    1,
)
JOB_TEST.write_text(job_test, encoding='utf-8')

readme = README.read_text(encoding='utf-8')
readme = readme.replace('`supabase-ai-v21.2.1-explicit-action-guard`', '`supabase-ai-v21.3-balanced-evidence-budget`', 1)
anchor = '- Prompt-size budget is checked before a paid request is sent.\n'
addition = '- Cross-system prompt evidence reserves slots for Saju and Thai context so a Western-heavy annual packet cannot crowd them out.\n- Rolling emergency breaker: per user 6 new jobs/10 minutes and 20/24 hours; service-wide 18/10 minutes and 60/24 hours. Cached/pending reuse is checked before these limits, so free reuse does not consume the breaker.\n'
if anchor not in readme:
    raise SystemExit('README budget anchor not found')
readme = readme.replace(anchor, anchor + addition, 1)
README.write_text(readme, encoding='utf-8')
