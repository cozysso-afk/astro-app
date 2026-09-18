from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'pattern not found in {path}: {old[:120]}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')

replace_once(
    'supabase/functions/fortune-interpret-v23-preview/index.ts',
    'import { buildPeriodNarrativeInstruction, PERIOD_NARRATIVE_VERSION } from "./periodNarrativeV23.ts";\n',
    'import { buildPeriodNarrativeInstruction, PERIOD_NARRATIVE_VERSION } from "./periodNarrativeV23.ts";\nimport { exactV23JobKind } from "./cacheIdentityV23.ts";\n',
)
replace_once(
    'supabase/functions/fortune-interpret-v23-preview/index.ts',
    'const hash=await payloadHash(payload);const kind=`${VERSION}:${hash.slice(0,32)}`;const a=admin();',
    'const hash=await payloadHash(payload);const kind=exactV23JobKind(VERSION,payload,hash);const a=admin();',
)

replace_once(
    'supabase/functions/fortune-interpret-v22-preview/index.ts',
    'import { buildLocalPeriodAwareFallbackV23 } from "../fortune-interpret-v23-preview/provisionalV23.ts";\n',
    'import { buildLocalPeriodAwareFallbackV23 } from "../fortune-interpret-v23-preview/provisionalV23.ts";\nimport { provisionalV23JobKind } from "../fortune-interpret-v23-preview/cacheIdentityV23.ts";\n',
)
replace_once(
    'supabase/functions/fortune-interpret-v22-preview/index.ts',
    'const hash=await payloadHash(packet);const hashPart=hash.slice(0,32);const kind=v23?`${VERSION}:v23-period-aware:${hashPart}`:`${VERSION}:${hashPart}`;const a=admin();',
    'const hash=await payloadHash(packet);const hashPart=hash.slice(0,32);const kind=v23?provisionalV23JobKind(VERSION,packet,hash):`${VERSION}:${hashPart}`;const a=admin();',
)

replace_once(
    'web/src/lib/readingCache.ts',
    "const FORTUNE_NARRATIVE_CACHE_CONTRACT = 'v23-period-narrative-v1'\n",
    "const FORTUNE_NARRATIVE_CACHE_CONTRACT = 'v23-period-narrative-v1'\nconst FORTUNE_DAY_WEEK_NARRATIVE_CACHE_CONTRACT = 'v23-period-narrative-dw-v2'\n",
)
replace_once(
    'web/src/lib/readingCache.ts',
    "  const precision = fortuneAiPrecisionReadiness(calculation)\n  const signature = {\n",
    "  const precision = fortuneAiPrecisionReadiness(calculation)\n  const periodKind = String(calculation.period_kind ?? request.period_kind ?? period.kind ?? '').trim().toLowerCase()\n  const narrativeContract = periodKind === 'day' || periodKind === 'week'\n    ? FORTUNE_DAY_WEEK_NARRATIVE_CACHE_CONTRACT\n    : FORTUNE_NARRATIVE_CACHE_CONTRACT\n  const signature = {\n",
)
replace_once(
    'web/src/lib/readingCache.ts',
    '    narrative_contract: FORTUNE_NARRATIVE_CACHE_CONTRACT,\n',
    '    narrative_contract: narrativeContract,\n',
)

replace_once(
    'web/src/lib/v23NarrativeTransport.test.mjs',
    "  assert.match(source,/FORTUNE_NARRATIVE_CACHE_CONTRACT = 'v23-period-narrative-v1'/)\n  assert.match(source,/narrative_contract: FORTUNE_NARRATIVE_CACHE_CONTRACT/)\n",
    "  assert.match(source,/FORTUNE_NARRATIVE_CACHE_CONTRACT = 'v23-period-narrative-v1'/)\n  assert.match(source,/FORTUNE_DAY_WEEK_NARRATIVE_CACHE_CONTRACT = 'v23-period-narrative-dw-v2'/)\n  assert.match(source,/periodKind === 'day' \\|\\| periodKind === 'week'/)\n  assert.match(source,/narrative_contract: narrativeContract/)\n",
)
