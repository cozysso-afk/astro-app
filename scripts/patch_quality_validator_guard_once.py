from pathlib import Path

q=Path('supabase/functions/fortune-interpret-v6-preview/qualityV2.ts')
s=q.read_text(encoding='utf-8')
s=s.replace('export const QUALITY_VERSION = "fortune-interpretation-quality-v6-semantic-usefulness";','export const QUALITY_VERSION = "fortune-interpretation-quality-v6.1-pure-validator";',1)
q.write_text(s,encoding='utf-8')

i=Path('supabase/functions/fortune-interpret-v23-preview/index.ts')
s=i.read_text(encoding='utf-8')
old='''    const criticalPassed=criticalQualityPassed(quality);\n    const semanticPassed=semanticQualityPassed(quality);\n    const locallyRepairedTiming=quality?.local_timing_repair===true&&criticalPassed;\n    const stage5OnlyGap=criticalPassed&&semanticPassed&&(quality?.stages??[]).some((row:any)=>Number(row?.stage)===5&&row?.passed===false);\n    if((resultMeta?.allow_degraded_quality===true&&criticalPassed)||locallyRepairedTiming||stage5OnlyGap){\n      const warning=locallyRepairedTiming\n        ? "직접 근거가 없는 날짜·구간만 targeted repair로 제거했고 validator는 원고를 다시 쓰지 않았어."\n        : stage5OnlyGap\n          ? "구조·근거·의미 방향·일관성·상담 유용성은 통과했고 길이·구성 보조 기준만 남아 원고를 재작성하지 않았어."\n          : String(resultMeta?.quality_warning??"5단계 깊이·실용성 일부 항목은 보정본으로 표시해.");'''
new='''    const criticalPassed=criticalQualityPassed(quality);\n    const locallyRepairedTiming=quality?.local_timing_repair===true&&criticalPassed;\n    if((resultMeta?.allow_degraded_quality===true&&criticalPassed)||locallyRepairedTiming){\n      const warning=locallyRepairedTiming\n        ? "직접 근거가 없는 날짜·구간만 targeted repair로 제거했고 validator는 원고를 다시 쓰지 않았어."\n        : String(resultMeta?.quality_warning??"5단계 깊이·실용성 일부 항목은 보정본으로 표시해.");'''
assert old in s, 'stage5-only bypass block not found'
s=s.replace(old,new,1)
i.write_text(s,encoding='utf-8')
