from pathlib import Path

INDEX = Path('supabase/functions/fortune-interpret-v21-preview/index.ts')
TEST = Path('supabase/functions/fortune-interpret-v21-preview/costGuardV21.test.mjs')
README = Path('supabase/functions/fortune-interpret-v21-preview/README.md')

src = INDEX.read_text(encoding='utf-8')
src = src.replace(
    'const VERSION="supabase-ai-v21.2-single-core-safe-wording";',
    'const VERSION="supabase-ai-v21.2.1-explicit-action-guard";',
)
needle = '  if(!key)return res({ok:false,missing_key:true,error:"GEMINI_API_KEY가 설정되지 않았어."},503);\n  if(b?.action==="start"){\n'
replacement = '  if(b?.action!=="start")return res({ok:false,error:"지원하지 않는 action이야. 유료 AI 호출은 action=start에서만 시작할 수 있어."},400);\n  if(!key)return res({ok:false,missing_key:true,error:"GEMINI_API_KEY가 설정되지 않았어."},503);\n  if(b?.action==="start"){\n'
if needle not in src:
    raise SystemExit('paid-action insertion anchor not found')
src = src.replace(needle, replacement, 1)
needle = '  const r:any=await calculate(payload,preferred,key,async()=>true);return res(r,r.ok?200:r?.cost_guard_blocked?413:502);\n});\n'
replacement = '  return res({ok:false,error:"지원하지 않는 action이야."},400);\n});\n'
if needle not in src:
    raise SystemExit('direct calculate fallback anchor not found')
src = src.replace(needle, replacement, 1)
INDEX.write_text(src, encoding='utf-8')

test = TEST.read_text(encoding='utf-8')
needle = "  assert.match(src,/if\\(!\\(await jobActive\\(id\\)\\)\\)\\{/);\n"
replacement = needle + "  assert.match(src,/if\\(b\\?\\.action!==\\\"start\\\"\\)return res/);\n  assert.doesNotMatch(src,/calculate\\(payload,preferred,key,async\\(\\)=>true\\)/);\n"
if needle not in test:
    raise SystemExit('runtime guard test anchor not found')
test = test.replace(needle, replacement, 1)
TEST.write_text(test, encoding='utf-8')

readme = README.read_text(encoding='utf-8')
needle = '- Normal generation path: one Gemini core call.\n'
replacement = needle + '- Paid Gemini generation is fail-closed: only an explicit authenticated `action: start` can enter a paid generation path; missing or unknown actions return HTTP 400.\n'
if needle not in readme:
    raise SystemExit('README anchor not found')
README.write_text(readme.replace(needle, replacement, 1), encoding='utf-8')
