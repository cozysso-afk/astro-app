from pathlib import Path

def replace_once(path, old, new):
    p=Path(path); s=p.read_text()
    if old not in s:
        raise SystemExit(f'missing marker in {path}: {old}')
    if s.count(old)!=1:
        raise SystemExit(f'non-unique marker in {path}: {old}')
    p.write_text(s.replace(old,new,1))

replace_once('supabase/functions/fortune-interpret-v21-preview/index.ts',
             'const VERSION="supabase-ai-v21.3-balanced-evidence-budget";',
             'const VERSION="supabase-ai-v21.3.1-investment-output-guard";')
replace_once('web/src/lib/readingCache.ts',
             "const FORTUNE_AI_CACHE_CONTRACT = 'release-contract-v21.3-balanced-evidence-budget'",
             "const FORTUNE_AI_CACHE_CONTRACT = 'release-contract-v21.3.1-investment-output-guard'")
replace_once('web/src/lib/fortuneAiJob.ts',
             "export const FORTUNE_AI_JOB_CONTRACT = 'fortune-ai-job-release-v21.3-balanced-evidence-budget'",
             "export const FORTUNE_AI_JOB_CONTRACT = 'fortune-ai-job-release-v21.3.1-investment-output-guard'")
replace_once('web/src/lib/fortuneAiJob.ts',
             "export const FORTUNE_AI_JOB_STORAGE_KEY = 'starlight-destiny.ai-job.v4'",
             "export const FORTUNE_AI_JOB_STORAGE_KEY = 'starlight-destiny.ai-job.v5'")
replace_once('web/src/lib/fortuneAiJob.test.mjs',
             "assert.match(FORTUNE_AI_JOB_STORAGE_KEY, /\\.v4$/)",
             "assert.match(FORTUNE_AI_JOB_STORAGE_KEY, /\\.v5$/)")
replace_once('web/src/lib/fortuneAiJob.test.mjs',
             "assert.match(FORTUNE_AI_JOB_CONTRACT, /v21\\.3-balanced-evidence-budget$/)",
             "assert.match(FORTUNE_AI_JOB_CONTRACT, /v21\\.3\\.1-investment-output-guard$/)")
replace_once('supabase/functions/fortune-interpret-v21-preview/README.md',
             '- Current runtime guard: `supabase-ai-v21.3-balanced-evidence-budget`.',
             '- Current runtime guard: `supabase-ai-v21.3.1-investment-output-guard`.')
replace_once('supabase/functions/fortune-interpret-v21-preview/README.md',
             '- Investment activity indices must not be presented as price, yield, buy, or sell predictions.',
             '- Investment activity indices must not be presented as price, yield, buy, or sell predictions. Post-generation structural sanitization also replaces model-written buy/sell/hold/cash-out timing actions with market-data and risk-limit checks.')

p=Path('supabase/functions/fortune-interpret-v21-preview/costGuardV21.test.mjs')
s=p.read_text()
needle='  assert.match(src,/MAX_GEMINI_CALLS=2/);\n'
addition='  assert.match(src,/supabase-ai-v21\\.3\\.1-investment-output-guard/);\n'
if addition not in s:
    if needle not in s: raise SystemExit('runtime version test marker missing')
    s=s.replace(needle,needle+addition,1)
p.write_text(s)
