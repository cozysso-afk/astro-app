from pathlib import Path

# 1) Make quality inspection pure and expose targeted repair explicitly.
quality = Path('supabase/functions/fortune-interpret-v6-preview/qualityV2.ts')
s = quality.read_text(encoding='utf-8')

anchor = '''  return changed;\n}\nfunction claimStrings(data:any){'''
replacement = '''  return changed;\n}\n\nexport function repairInterpretationQuality(data:any,payload:any){\n  const map=ledgerMap(payload);\n  const timingRepair=repairUnsupportedV23Timing(data,payload,map as Map<string,any>);\n  return {changed:timingRepair,timing_repair:timingRepair};\n}\nfunction claimStrings(data:any){'''
assert anchor in s, 'quality repair export anchor not found'
s = s.replace(anchor, replacement, 1)

old = '''export function inspectInterpretationQuality(data:any,payload:any){\n  const map=ledgerMap(payload),kind=String(payload?.period_kind??"day"),stages:any[]=[];\n  const localTimingRepair=repairUnsupportedV23Timing(data,payload,map as Map<string,any>);\n'''
new = '''export function inspectInterpretationQuality(data:any,payload:any){\n  const map=ledgerMap(payload),kind=String(payload?.period_kind??"day"),stages:any[]=[];\n'''
assert old in s, 'quality inspect mutation anchor not found'
s = s.replace(old, new, 1)

old = '''  return {version:QUALITY_VERSION,ok:passed===6,score:Math.round(passed/6*100),stages,refs_used:refsUsed.length,ledger_size:map.size,local_timing_repair:localTimingRepair};'''
new = '''  return {version:QUALITY_VERSION,ok:passed===6,score:Math.round(passed/6*100),stages,refs_used:refsUsed.length,ledger_size:map.size};'''
assert old in s, 'quality report return anchor not found'
s = s.replace(old, new, 1)
quality.write_text(s, encoding='utf-8')

# 2) Call repair explicitly before pure validation in V23 and trace both stages.
index = Path('supabase/functions/fortune-interpret-v23-preview/index.ts')
s = index.read_text(encoding='utf-8')
old = '''import { QUALITY_VERSION, inspectInterpretationQuality, strictQualityRetryInstruction } from "../fortune-interpret-v6-preview/qualityV2.ts";'''
new = '''import { QUALITY_VERSION, inspectInterpretationQuality, repairInterpretationQuality, strictQualityRetryInstruction } from "../fortune-interpret-v6-preview/qualityV2.ts";'''
assert old in s, 'V23 quality import anchor not found'
s = s.replace(old, new, 1)
s = s.replace('const VERSION="supabase-ai-v23.5-prose-ownership-v1";', 'const VERSION="supabase-ai-v23.6-quality-repair-split-v1";', 1)
old = '''  data=polishV23EditorialDepth(data,payload);\n  traceStages.push(captureEditorialStage("post_editorial_polish",data));\n  const quality=inspectInterpretationQuality(data,payload);\n  traceStages.push(captureEditorialStage("post_quality_repair",data));'''
new = '''  data=polishV23EditorialDepth(data,payload);\n  traceStages.push(captureEditorialStage("post_editorial_polish",data));\n  const qualityRepair=repairInterpretationQuality(data,payload);\n  traceStages.push(captureEditorialStage("post_quality_repair",data));\n  const quality=inspectInterpretationQuality(data,payload);\n  traceStages.push(captureEditorialStage("post_quality_validation",data));'''
assert old in s, 'V23 quality call anchor not found'
s = s.replace(old, new, 1)
old = '''    const locallyRepairedTiming=quality?.local_timing_repair===true&&criticalPassed;'''
new = '''    const locallyRepairedTiming=qualityRepair?.timing_repair===true&&criticalPassed;'''
assert old in s, 'V23 local repair policy anchor not found'
s = s.replace(old, new, 1)
index.write_text(s, encoding='utf-8')

# 3) Rewrite timing repair regression so validation purity is itself tested.
test_path = Path('supabase/functions/fortune-interpret-v6-preview/qualityV23TimingRepair.test.mjs')
t = test_path.read_text(encoding='utf-8')
t = t.replace("import { inspectInterpretationQuality } from './qualityV2.ts'", "import { inspectInterpretationQuality, repairInterpretationQuality } from './qualityV2.ts'", 1)
old = '''test('V23 locally removes unsupported timing claims before traceability scoring', () => {\n  const data=candidate()\n  const report=inspectInterpretationQuality(data,payload(true))\n  assert.equal(report.local_timing_repair,true)\n  assert.equal(data.key_windows.length,1)\n  assert.equal(data.key_windows[0].start,'2026-09-16')\n  assert.equal(data.decisions.length,1)\n  assert.doesNotMatch(data.relationship_reading.focus_timing,/2026-09-18/)\n  const stage2=report.stages.find(stage=>stage.stage===2)\n  assert.ok(stage2)\n  assert.doesNotMatch(stage2.issues.join(' '),/key_window 날짜를 뒷받침하지 않는 근거|관계·재회 주목 날짜에 직접 날짜 근거 미연결/)\n})\n\ntest('legacy quality validation keeps unsupported timing visible for retry', () => {\n  const data=candidate()\n  const report=inspectInterpretationQuality(data,payload(false))\n  assert.equal(report.local_timing_repair,false)\n  assert.equal(data.key_windows.length,2)\n  const stage2=report.stages.find(stage=>stage.stage===2)\n  assert.match(stage2.issues.join(' '),/key_window 날짜를 뒷받침하지 않는 근거|관계·재회 주목 날짜에 직접 날짜 근거 미연결/)\n})'''
new = '''test('quality inspection is pure and targeted V23 timing repair is explicit', () => {\n  const data=candidate()\n  const before=structuredClone(data)\n  const beforeReport=inspectInterpretationQuality(data,payload(true))\n  assert.deepEqual(data,before,'inspection must not mutate candidate data')\n  const beforeStage2=beforeReport.stages.find(stage=>stage.stage===2)\n  assert.ok(beforeStage2)\n  assert.match(beforeStage2.issues.join(' '),/key_window 날짜를 뒷받침하지 않는 근거|관계·재회 주목 날짜에 직접 날짜 근거 미연결/)\n\n  const repair=repairInterpretationQuality(data,payload(true))\n  assert.equal(repair.changed,true)\n  assert.equal(repair.timing_repair,true)\n  assert.equal(data.key_windows.length,1)\n  assert.equal(data.key_windows[0].start,'2026-09-16')\n  assert.equal(data.decisions.length,1)\n  assert.doesNotMatch(data.relationship_reading.focus_timing,/2026-09-18/)\n\n  const afterRepair=structuredClone(data)\n  const afterReport=inspectInterpretationQuality(data,payload(true))\n  assert.deepEqual(data,afterRepair,'inspection after repair must still be pure')\n  const afterStage2=afterReport.stages.find(stage=>stage.stage===2)\n  assert.ok(afterStage2)\n  assert.doesNotMatch(afterStage2.issues.join(' '),/key_window 날짜를 뒷받침하지 않는 근거|관계·재회 주목 날짜에 직접 날짜 근거 미연결/)\n})\n\ntest('legacy path keeps unsupported timing visible because targeted repair is disabled', () => {\n  const data=candidate()\n  const repair=repairInterpretationQuality(data,payload(false))\n  assert.equal(repair.changed,false)\n  assert.equal(data.key_windows.length,2)\n  const before=structuredClone(data)\n  const report=inspectInterpretationQuality(data,payload(false))\n  assert.deepEqual(data,before)\n  const stage2=report.stages.find(stage=>stage.stage===2)\n  assert.match(stage2.issues.join(' '),/key_window 날짜를 뒷받침하지 않는 근거|관계·재회 주목 날짜에 직접 날짜 근거 미연결/)\n})'''
assert old in t, 'timing repair tests anchor not found'
t = t.replace(old, new, 1)
test_path.write_text(t, encoding='utf-8')

# 4) Pin delivery policy to explicit repair, not hidden validator mutation.
delivery = Path('supabase/functions/fortune-interpret-v23-preview/deliveryPolicyV23.test.mjs')
d = delivery.read_text(encoding='utf-8')
old = '''test('V23 delivers locally repaired timing without paying for a second Gemini repair call', () => {\n  assert.match(source, /quality\\?\\.local_timing_repair===true&&criticalPassed/)\n  assert.match(source, /\\((?:meta|resultMeta)\\?\\.allow_degraded_quality===true&&criticalPassed\\)\\|\\|locallyRepairedTiming/)\n  assert.match(source, /Gemini를 한 번 더 호출하지 않아/)\n  assert.match(source, /if\\(first\\.ok\\)return \\{\\.\\.\\.first,attempt_count:budget\\.used,call_trace:budget\\.calls\\}/)\n})'''
new = '''test('V23 applies targeted timing repair before pure validation without paying for a second Gemini call', () => {\n  assert.match(source, /const qualityRepair=repairInterpretationQuality\\(data,payload\\)/)\n  assert.match(source, /post_quality_repair/)\n  assert.match(source, /const quality=inspectInterpretationQuality\\(data,payload\\)/)\n  assert.match(source, /post_quality_validation/)\n  assert.match(source, /qualityRepair\\?\\.timing_repair===true&&criticalPassed/)\n  assert.match(source, /\\((?:meta|resultMeta)\\?\\.allow_degraded_quality===true&&criticalPassed\\)\\|\\|locallyRepairedTiming/)\n  assert.match(source, /Gemini를 한 번 더 호출하지 않아/)\n  assert.match(source, /if\\(first\\.ok\\)return \\{\\.\\.\\.first,attempt_count:budget\\.used,call_trace:budget\\.calls\\}/)\n})'''
assert old in d, 'delivery policy test anchor not found'
d = d.replace(old, new, 1)
delivery.write_text(d, encoding='utf-8')
