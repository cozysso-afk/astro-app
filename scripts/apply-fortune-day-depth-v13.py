from pathlib import Path

INDEX = Path('supabase/functions/fortune-interpret-v23-preview/index.ts')
CI = Path('.github/workflows/interpretation-v3-ci.yml')

index = INDEX.read_text()
import_anchor = 'import { v23FinishReason, v23OutputTokenLimit } from "./runtimeBudgetV23.ts";\n'
import_line = 'import { ensureDayDepthGuides } from "./dayDepthRepairV23.ts";\n'
if import_line not in index:
    if import_anchor not in index:
        raise SystemExit('V23 index import anchor missing')
    index = index.replace(import_anchor, import_anchor + import_line, 1)

old = '  const merged=stabilizeCoreForQuality({...core,topic_analysis:buildDeterministicTopicAnalysis(payload)},payload);'
new = '  const merged=ensureDayDepthGuides(stabilizeCoreForQuality({...core,topic_analysis:buildDeterministicTopicAnalysis(payload)},payload),payload);'
if new not in index:
    if old not in index:
        raise SystemExit('V23 finalizeCandidate anchor missing')
    index = index.replace(old, new, 1)
INDEX.write_text(index)

ci = CI.read_text()
test_anchor = '          node --experimental-strip-types --test supabase/functions/fortune-interpret-v23-preview/cacheIdentityV23.test.mjs\n'
test_line = '          node --experimental-strip-types --test supabase/functions/fortune-interpret-v23-preview/dayDepthRepairV23.test.mjs\n'
if test_line not in ci:
    if test_anchor not in ci:
        raise SystemExit('Interpretation CI anchor missing')
    ci = ci.replace(test_anchor, test_anchor + test_line, 1)
CI.write_text(ci)
