from pathlib import Path

qpath=Path('supabase/functions/fortune-interpret-v6-preview/qualityV2.ts')
q=qpath.read_text(encoding='utf-8')
q=q.replace('function repairUnsupportedV23Timing(data:any,payload:any,map:Map<string,any>){','function applyUnsupportedV23TimingRepair(data:any,payload:any,map:Map<string,any>){',1)
anchor='''  return changed;\n}\nfunction claimStrings(data:any){'''
insert='''  return changed;\n}\n\nexport function repairUnsupportedV23Timing(input:any,payload:any){\n  const data=structuredClone(input??{});\n  const changed=applyUnsupportedV23TimingRepair(data,payload,ledgerMap(payload) as Map<string,any>);\n  return {data,changed};\n}\nfunction claimStrings(data:any){'''
assert anchor in q, 'repair export anchor missing'
q=q.replace(anchor,insert,1)
old='''export function inspectInterpretationQuality(data:any,payload:any){\n  const map=ledgerMap(payload),kind=String(payload?.period_kind??"day"),stages:any[]=[];\n  const localTimingRepair=repairUnsupportedV23Timing(data,payload,map as Map<string,any>);\n'''
new='''export function inspectInterpretationQuality(data:any,payload:any){\n  const map=ledgerMap(payload),kind=String(payload?.period_kind??"day"),stages:any[]=[];\n'''
assert old in q, 'pure inspector anchor missing'
q=q.replace(old,new,1)
q=q.replace('return {version:QUALITY_VERSION,ok:passed===6,score:Math.round(passed/6*100),stages,refs_used:refsUsed.length,ledger_size:map.size,local_timing_repair:localTimingRepair};','return {version:QUALITY_VERSION,ok:passed===6,score:Math.round(passed/6*100),stages,refs_used:refsUsed.length,ledger_size:map.size};',1)

old='''  const minSummary=kind==="annual"?240:kind==="month"?170:110;\n  const maxSummary=kind==="annual"?1100:kind==="month"?800:650;\n  const summaryLength=String(data?.overall?.summary??"").length;\n  if(summaryLength<minSummary)s5.push(`총평 깊이 부족(${summaryLength}/${minSummary})`);\n  if(summaryLength>maxSummary)s5.push(`총평이 핵심보다 지나치게 김(${summaryLength}/${maxSummary})`);\n  for(const x of data?.cross_checks??[]){\n    if(String(x?.synthesis??"").length<45)s5.push(`교차검증 종합이 너무 짧음: ${x?.label}`);\n    if(String(x?.western??"").length<25)s5.push(`교차검증 Western 설명이 너무 짧음: ${x?.label}`);\n  }\n  for(const d of data?.decisions??[]){\n    if(String(d?.watch??"").length<14)s5.push(`결정 가이드 확인조건이 너무 짧음: ${txt(d?.action,45)}`);\n    if(String(d?.avoid??"").length<14)s5.push(`결정 가이드 회피조건이 너무 짧음: ${txt(d?.action,45)}`);'''
new='''  const maxSummary=kind==="annual"?1100:kind==="month"?800:650;\n  const summaryLength=String(data?.overall?.summary??"").trim().length;\n  if(!summaryLength)s5.push("총평 누락");\n  if(summaryLength>maxSummary)s5.push(`총평이 핵심보다 지나치게 김(${summaryLength}/${maxSummary})`);\n  for(const x of data?.cross_checks??[]){\n    if(!String(x?.synthesis??"").trim())s5.push(`교차검증 종합 누락: ${x?.label}`);\n    if(!String(x?.western??"").trim())s5.push(`교차검증 Western 설명 누락: ${x?.label}`);\n  }\n  for(const d of data?.decisions??[]){\n    if(!String(d?.watch??"").trim())s5.push(`결정 가이드 확인조건 누락: ${txt(d?.action,45)}`);\n    if(!String(d?.avoid??"").trim())s5.push(`결정 가이드 회피조건 누락: ${txt(d?.action,45)}`);'''
assert old in q, 'stage5 summary block missing'
q=q.replace(old,new,1)
old='''  for(const w of data?.key_windows??[]){\n    if(String(w?.summary??"").length<45)s5.push(`핵심 시기 설명이 너무 짧음: ${w?.label}`);\n    if(String(w?.summary??"").length>750)s5.push(`핵심 시기 설명이 지나치게 김: ${w?.label}`);\n    if(String(w?.action??"").length<18)s5.push(`핵심 시기 행동이 너무 짧음: ${w?.label}`);'''
new='''  for(const w of data?.key_windows??[]){\n    if(!String(w?.summary??"").trim())s5.push(`핵심 시기 설명 누락: ${w?.label}`);\n    if(String(w?.summary??"").length>750)s5.push(`핵심 시기 설명이 지나치게 김: ${w?.label}`);\n    if(!String(w?.action??"").trim())s5.push(`핵심 시기 행동 누락: ${w?.label}`);'''
assert old in q, 'stage5 window block missing'
q=q.replace(old,new,1)
old='''    if(String(rr?.context??"").length<35)s5.push("관계·재회 관계 맥락 설명 부족");\n    if(String(rr?.flow??"").length<55)s5.push("관계·재회 이어지는 흐름 설명 부족");\n    if(String(rr?.focus_timing??"").length<20)s5.push("관계·재회 주목 시기 설명 부족");\n    if(String(rr?.watch??"").length<20)s5.push("관계·재회 현실 확인 신호 부족");\n    if(String(rr?.avoid??"").length<20)s5.push("관계·재회 과대해석 방지 설명 부족");'''
new='''    if(!String(rr?.context??"").trim())s5.push("관계·재회 관계 맥락 누락");\n    if(!String(rr?.flow??"").trim())s5.push("관계·재회 이어지는 흐름 누락");\n    if(!String(rr?.focus_timing??"").trim())s5.push("관계·재회 주목 시기 누락");\n    if(!String(rr?.watch??"").trim())s5.push("관계·재회 현실 확인 신호 누락");\n    if(!String(rr?.avoid??"").trim())s5.push("관계·재회 과대해석 방지 설명 누락");'''
assert old in q, 'relationship stage5 block missing'
q=q.replace(old,new,1)
q=q.replace('if(String(cf?.incoming??"").length<15)s5.push("관계·재회 상대→나 방향 설명 부족");','if(!String(cf?.incoming??"").trim())s5.push("관계·재회 상대→나 방향 설명 누락");',1)
q=q.replace('if(String(cf?.outgoing??"").length<15)s5.push("관계·재회 나→상대 방향 설명 부족");','if(!String(cf?.outgoing??"").trim())s5.push("관계·재회 나→상대 방향 설명 누락");',1)
q=q.replace('if(String(cf?.reconnection??"").length<15)s5.push("관계·재회 과거인연 방향 설명 부족");','if(!String(cf?.reconnection??"").trim())s5.push("관계·재회 과거인연 방향 설명 누락");',1)
q=q.replace('&&String(ir?.[field]??"").length<20)s5.push(`${topic} 중요 분야인데 투자 상세 설명 부족`);','&&!String(ir?.[field]??"").trim())s5.push(`${topic} 중요 분야인데 투자 상세 설명 누락`);',1)
old='''    const minReason=importance==="핵심"?(kind==="annual"?85:60):importance==="주목"?(kind==="annual"?55:40):(kind==="annual"?25:18);\n    const maxReason=importance==="핵심"?1200:importance==="주목"?700:320;\n    const reasonLength=String(x?.reason??"").length;\n    if(reasonLength<minReason)s5.push(`${topic} ${importance} 근거 설명이 얕음`);'''
new='''    const maxReason=importance==="핵심"?1200:importance==="주목"?700:320;\n    const reasonLength=String(x?.reason??"").trim().length;\n    if(importance!=="참고"&&!reasonLength)s5.push(`${topic} ${importance} 근거 설명 누락`);'''
assert old in q, 'topic reason stage5 block missing'
q=q.replace(old,new,1)
q=q.replace("- '핵심 근거 설명이 얕음'이면 해당 topic reason에 구체 추세/평균과 실제 시기·근거를 연결해 충분히 늘려라. '주목 근거 설명이 얕음'도 변화 방향과 시기 근거를 최소 두 문장 수준으로 보강해라. 참고 분야를 대신 장문화하지 마라.","- topic reason에 직접 연결된 추세·시기·근거가 빠졌을 때만 보완해라. 이미 구체적인 문장을 길이만 맞추려고 늘리지 마라.",1)
q=q.replace("- 관계·재회 주목 시기 설명 부족이면 focus_timing을 최소 35자 정도로 실제 관계 evidence_refs가 직접 지지하는 날짜/구간 + 흐름 + 현실 확인 방식까지 포함해 보강해라.","- 관계·재회 focus_timing은 실제 관계 evidence_refs가 직접 지지하는 날짜/구간만 남기고, 필요한 현실 확인 기준만 보완해라. 길이만 늘리지 마라.",1)
q=q.replace("- 교차검증 종합이 너무 짧으면 해당 synthesis를 최소 60자 정도로 Western과 다른 체계의 공통점/차이를 구체적으로 풀어라.","- 교차검증 synthesis가 비어 있거나 의미가 빠졌다면 Western과 다른 체계의 공통점/차이만 구체적으로 보완해라. 길이만 늘리지 마라.",1)
qpath.write_text(q,encoding='utf-8')

ipath=Path('supabase/functions/fortune-interpret-v23-preview/index.ts')
i=ipath.read_text(encoding='utf-8')
i=i.replace('import { QUALITY_VERSION, inspectInterpretationQuality, strictQualityRetryInstruction } from "../fortune-interpret-v6-preview/qualityV2.ts";','import { QUALITY_VERSION, inspectInterpretationQuality, repairUnsupportedV23Timing, strictQualityRetryInstruction } from "../fortune-interpret-v6-preview/qualityV2.ts";',1)
i=i.replace('const VERSION="supabase-ai-v23.5-prose-ownership-v1";','const VERSION="supabase-ai-v23.6-pure-quality-v1";',1)
old='''  data=polishV23EditorialDepth(data,payload);\n  traceStages.push(captureEditorialStage("post_editorial_polish",data));\n  const quality=inspectInterpretationQuality(data,payload);\n  traceStages.push(captureEditorialStage("post_quality_repair",data));'''
new='''  data=polishV23EditorialDepth(data,payload);\n  traceStages.push(captureEditorialStage("post_editorial_polish",data));\n  const timingRepair=repairUnsupportedV23Timing(data,payload);\n  data=timingRepair.data;\n  traceStages.push(captureEditorialStage("post_targeted_timing_repair",data));\n  const quality={...inspectInterpretationQuality(data,payload),local_timing_repair:timingRepair.changed};\n  traceStages.push(captureEditorialStage("post_quality_validation",data));'''
assert old in i, 'index quality block missing'
i=i.replace(old,new,1)
old='''    const criticalPassed=criticalQualityPassed(quality);\n    const locallyRepairedTiming=quality?.local_timing_repair===true&&criticalPassed;\n    if((resultMeta?.allow_degraded_quality===true&&criticalPassed)||locallyRepairedTiming){\n      const warning=locallyRepairedTiming\n        ? "직접 근거가 없는 날짜·구간만 로컬에서 제거했고 구조·근거·의미 방향·일관성은 통과했어. 같은 결과를 고치려고 Gemini를 한 번 더 호출하지 않아."\n        : String(resultMeta?.quality_warning??"5단계 깊이·실용성 일부 항목은 보정본으로 표시해.");'''
new='''    const criticalPassed=criticalQualityPassed(quality);\n    const semanticPassed=semanticQualityPassed(quality);\n    const locallyRepairedTiming=quality?.local_timing_repair===true&&criticalPassed;\n    const stage5OnlyGap=criticalPassed&&semanticPassed&&(quality?.stages??[]).some((row:any)=>Number(row?.stage)===5&&row?.passed===false);\n    if((resultMeta?.allow_degraded_quality===true&&criticalPassed)||locallyRepairedTiming||stage5OnlyGap){\n      const warning=locallyRepairedTiming\n        ? "직접 근거가 없는 날짜·구간만 targeted repair로 제거했고 validator는 원고를 다시 쓰지 않았어."\n        : stage5OnlyGap\n          ? "구조·근거·의미 방향·일관성·상담 유용성은 통과했고 길이·구성 보조 기준만 남아 원고를 재작성하지 않았어."\n          : String(resultMeta?.quality_warning??"5단계 깊이·실용성 일부 항목은 보정본으로 표시해.");'''
assert old in i, 'degraded quality block missing'
i=i.replace(old,new,1)
ipath.write_text(i,encoding='utf-8')

tpath=Path('supabase/functions/fortune-interpret-v6-preview/qualityV23TimingRepair.test.mjs')
t=tpath.read_text(encoding='utf-8')
t=t.replace("import { inspectInterpretationQuality } from './qualityV2.ts'","import { inspectInterpretationQuality, repairUnsupportedV23Timing } from './qualityV2.ts'",1)
start=t.index("test('V23 locally removes unsupported timing claims before traceability scoring'")
end=t.index("test('legacy quality validation keeps unsupported timing visible for retry'")
replacement='''test('Quality validator is pure and targeted timing repair is explicit', () => {\n  const data=candidate()\n  const before=structuredClone(data)\n  const rawReport=inspectInterpretationQuality(data,payload(true))\n  assert.deepEqual(data,before)\n  const rawStage2=rawReport.stages.find(stage=>stage.stage===2)\n  assert.match(rawStage2.issues.join(' '),/key_window 날짜를 뒷받침하지 않는 근거|관계·재회 주목 날짜에 직접 날짜 근거 미연결/)\n\n  const repaired=repairUnsupportedV23Timing(data,payload(true))\n  assert.equal(repaired.changed,true)\n  assert.deepEqual(data,before)\n  assert.equal(repaired.data.key_windows.length,1)\n  assert.equal(repaired.data.key_windows[0].start,'2026-09-16')\n  assert.equal(repaired.data.decisions.length,1)\n  assert.doesNotMatch(repaired.data.relationship_reading.focus_timing,/2026-09-18/)\n  const report=inspectInterpretationQuality(repaired.data,payload(true))\n  const stage2=report.stages.find(stage=>stage.stage===2)\n  assert.doesNotMatch(stage2.issues.join(' '),/key_window 날짜를 뒷받침하지 않는 근거|관계·재회 주목 날짜에 직접 날짜 근거 미연결/)\n})\n\n'''
t=t[:start]+replacement+t[end:]
t=t.replace("  assert.equal(report.local_timing_repair,false)\n",'',1)
tpath.write_text(t,encoding='utf-8')
