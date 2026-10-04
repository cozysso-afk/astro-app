from pathlib import Path

INDEX = Path('supabase/functions/fortune-interpret-v23-preview/index.ts')
SHARED = Path('supabase/functions/_shared/fortuneAiPublicError.ts')
RUNTIME = Path('supabase/functions/fortune-interpret-v23-preview/runtimeBudgetV23.ts')
TEST = Path('supabase/functions/fortune-interpret-v23-preview/runtimeBudgetV23.test.mjs')

index = INDEX.read_text()

old = 'import { EDITORIAL_SECTION_KEYS, buildProviderCoreSchema, normalizeProviderCore } from "./providerSchemaV23.ts";\n'
new = old + 'import { v23FinishReason, v23OutputTokenLimit } from "./runtimeBudgetV23.ts";\n'
if old not in index:
    raise SystemExit('index import anchor missing')
index = index.replace(old, new, 1)

old = 'const VERSION="supabase-ai-v23.0-phenomenon-first";'
new = 'const VERSION="supabase-ai-v23.1-structured-output-headroom";'
if old not in index:
    raise SystemExit('version anchor missing')
index = index.replace(old, new, 1)

old = 'type CallTrace={call:number;model:string;kind:"initial"|"semantic_rewrite"|"fallback";prompt_bytes:number;elapsed_ms:number;http_status:number;usage:any;error?:string};'
new = 'type CallTrace={call:number;model:string;kind:"initial"|"semantic_rewrite"|"fallback";prompt_bytes:number;elapsed_ms:number;http_status:number;usage:any;max_output_tokens:number;finish_reason?:string;error?:string};'
if old not in index:
    raise SystemExit('CallTrace anchor missing')
index = index.replace(old, new, 1)

old = 'function outputLimit(kind:string,compact:boolean){if(kind==="annual")return compact?6200:10000;if(kind==="month")return compact?4800:5600;if(kind==="week")return compact?4000:4700;return compact?3400:4000;}\n\n'
if old not in index:
    raise SystemExit('outputLimit anchor missing')
index = index.replace(old, '', 1)

old = '  const timeout=Math.min(compact?46000:54000,remain);\n  const controller=new AbortController();'
new = '  const timeout=Math.min(compact?46000:54000,remain);\n  const maxOutputTokens=v23OutputTokenLimit(String(fullPayload?.period_kind??"annual"),compact);\n  const controller=new AbortController();'
if old not in index:
    raise SystemExit('timeout anchor missing')
index = index.replace(old, new, 1)

old = 'generationConfig:{responseMimeType:"application/json",responseSchema:CORE_SCHEMA,maxOutputTokens:outputLimit(String(fullPayload?.period_kind??"annual"),compact),temperature:.28,thinkingConfig:{thinkingLevel:compact?"low":"medium"}}'
new = 'generationConfig:{responseMimeType:"application/json",responseSchema:CORE_SCHEMA,maxOutputTokens,temperature:.28,thinkingConfig:{thinkingLevel:compact?"low":"medium"}}'
if old not in index:
    raise SystemExit('generationConfig outputLimit anchor missing')
index = index.replace(old, new, 1)

old = '    const u=usage(raw);\n    const trace:CallTrace={call:callNo,model,kind,prompt_bytes:promptBytes,elapsed_ms:Date.now()-started,http_status:r.status,usage:u};'
new = '    const u=usage(raw);\n    const finishReason=v23FinishReason(raw);\n    const trace:CallTrace={call:callNo,model,kind,prompt_bytes:promptBytes,elapsed_ms:Date.now()-started,http_status:r.status,usage:u,max_output_tokens:maxOutputTokens,...(finishReason?{finish_reason:finishReason}:{})};'
if old not in index:
    raise SystemExit('trace anchor missing')
index = index.replace(old, new, 1)

old = '    if(!r.ok){trace.error=`Gemini HTTP ${r.status}`;budget.calls.push(trace);return {ok:false,error:`Gemini HTTP ${r.status}`,model,http_status:r.status,usage:u};}\n    budget.calls.push(trace);\n    const parts=raw?.candidates?.[0]?.content?.parts??[];'
new = '    if(!r.ok){trace.error=`Gemini HTTP ${r.status}`;budget.calls.push(trace);return {ok:false,error:`Gemini HTTP ${r.status}`,model,http_status:r.status,usage:u};}\n    budget.calls.push(trace);\n    if(finishReason==="MAX_TOKENS")return {ok:false,error:`core 구조화 응답이 maxOutputTokens=${maxOutputTokens}에서 잘렸어`,model,usage:u,finish_reason:finishReason,max_output_tokens:maxOutputTokens};\n    const parts=raw?.candidates?.[0]?.content?.parts??[];'
if old not in index:
    raise SystemExit('finishReason guard anchor missing')
index = index.replace(old, new, 1)

old = '    budget.calls.push({call:callNo,model,kind,prompt_bytes:promptBytes,elapsed_ms:Date.now()-started,http_status:0,usage:{prompt_tokens:0,candidate_tokens:0,thought_tokens:0,total_tokens:0},error:msg});'
new = '    budget.calls.push({call:callNo,model,kind,prompt_bytes:promptBytes,elapsed_ms:Date.now()-started,http_status:0,usage:{prompt_tokens:0,candidate_tokens:0,thought_tokens:0,total_tokens:0},max_output_tokens:maxOutputTokens,error:msg});'
if old not in index:
    raise SystemExit('catch trace anchor missing')
index = index.replace(old, new, 1)
INDEX.write_text(index)

shared = SHARED.read_text()
old = "    for (const key of ['call','prompt_bytes','elapsed_ms','http_status'] as const) {"
new = "    for (const key of ['call','prompt_bytes','elapsed_ms','http_status','max_output_tokens'] as const) {"
if old not in shared:
    raise SystemExit('publicCallTrace numeric anchor missing')
shared = shared.replace(old, new, 1)
old = "    for (const key of ['model','kind'] as const) {"
new = "    for (const key of ['model','kind','finish_reason'] as const) {"
if old not in shared:
    raise SystemExit('publicCallTrace string anchor missing')
shared = shared.replace(old, new, 1)
SHARED.write_text(shared)

RUNTIME.write_text('''export type V23PeriodKind = 'day' | 'week' | 'month' | 'annual'\n\nconst LIMITS: Record<V23PeriodKind, { full: number; compact: number }> = {\n  // Production telemetry on 2026-10-01/02 hit the old 4,000-token day ceiling:\n  // visible candidate 3,466~3,515 + thinking 470~519 ~= 3,985 tokens.\n  // The structured 31-section result is ~20k JSON chars, so keep a small completion margin\n  // without expanding the annual ceiling.\n  day: { full: 6200, compact: 5600 },\n  week: { full: 7000, compact: 6200 },\n  month: { full: 8000, compact: 7000 },\n  annual: { full: 10000, compact: 8200 },\n}\n\nfunction normalizeKind(value: unknown): V23PeriodKind {\n  const kind = String(value ?? '').toLowerCase()\n  if (kind === 'day' || kind === 'today' || kind === 'daily') return 'day'\n  if (kind === 'week' || kind === 'weekly') return 'week'\n  if (kind === 'month' || kind === 'monthly') return 'month'\n  return 'annual'\n}\n\nexport function v23OutputTokenLimit(kind: unknown, compact = false) {\n  const row = LIMITS[normalizeKind(kind)]\n  return compact ? row.compact : row.full\n}\n\nexport function v23FinishReason(raw: any) {\n  const value = String(raw?.candidates?.[0]?.finishReason ?? '').trim()\n  return /^[A-Z0-9_]{1,40}$/.test(value) ? value : ''\n}\n''')

TEST.write_text('''import assert from 'node:assert/strict'\nimport test from 'node:test'\n\nimport { publicCallTrace } from '../_shared/fortuneAiPublicError.ts'\nimport { v23FinishReason, v23OutputTokenLimit } from './runtimeBudgetV23.ts'\n\ntest('V23 structured output has completion headroom for every period', () => {\n  assert.equal(v23OutputTokenLimit('day', false), 6200)\n  assert.equal(v23OutputTokenLimit('day', true), 5600)\n  assert.equal(v23OutputTokenLimit('week', false), 7000)\n  assert.equal(v23OutputTokenLimit('week', true), 6200)\n  assert.equal(v23OutputTokenLimit('month', false), 8000)\n  assert.equal(v23OutputTokenLimit('month', true), 7000)\n  assert.equal(v23OutputTokenLimit('annual', false), 10000)\n  assert.equal(v23OutputTokenLimit('annual', true), 8200)\n  assert.equal(v23OutputTokenLimit('today', false), 6200)\n})\n\ntest('MAX_TOKENS is observable in the persisted safe call trace', () => {\n  assert.equal(v23FinishReason({ candidates: [{ finishReason: 'MAX_TOKENS' }] }), 'MAX_TOKENS')\n  assert.equal(v23FinishReason({ candidates: [{ finishReason: 'not safe text' }] }), '')\n  const trace = publicCallTrace([{\n    call: 1, model: 'gemini-3.7-flash', kind: 'initial', prompt_bytes: 66000, elapsed_ms: 18000,\n    http_status: 200, max_output_tokens: 6200, finish_reason: 'MAX_TOKENS',\n    usage: { prompt_tokens: 27000, candidate_tokens: 3500, thought_tokens: 500, total_tokens: 31000 },\n  }])\n  assert.equal(trace[0].max_output_tokens, 6200)\n  assert.equal(trace[0].finish_reason, 'MAX_TOKENS')\n})\n''')

Path('scripts/apply-fortune-output-headroom-v10.py').unlink(missing_ok=True)
