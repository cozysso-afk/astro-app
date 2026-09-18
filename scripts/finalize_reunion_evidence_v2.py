from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]

def read(path): return (ROOT/path).read_text()
def write(path,text): (ROOT/path).write_text(text)
def require(cond,label):
    if not cond: raise SystemExit(f'missing/invalid marker: {label}')

# 1) Server: prune reunion prompt to evidence matrix + fix grounding declaration order.
p=Path('supabase/functions/relationship-interpret-v9-preview/index.ts')
s=read(p)
old=''' if(purpose==="reunion")base.reunion_evidence_v2=buildReunionEvidenceV2(base);\n return base;\n}'''
new=''' if(purpose==="reunion"){\n   const reunion_evidence_v2=buildReunionEvidenceV2(base);\n   return {analysis_mode:base.analysis_mode,period:base.period,relationship_status:base.relationship_status,timing_contract:base.timing_contract,precision:base.precision,saju_relationship:base.saju_relationship,reunion_evidence_v2,limitations:base.limitations};\n }\n return base;\n}'''
require(old in s,'reunion compact return')
s=s.replace(old,new,1)
block=re.compile(r'''\n if\(p==="reunion"\)\{\n   const v2=data\?\.reunion_synthesis_v2\?\?\{\};\n   const validEvidenceRefs=new Set\(\(payload\?\.reunion_evidence_v2\?\.evidence\?\?\[\]\)\.map\(\(x:any\)=>String\(x\?\.id\?\?""\)\)\.filter\(Boolean\)\);\n   const refs=\[\.\.\.\(v2\?\.why_reconnect\?\.evidence_refs\?\?\[\]\),\.\.\.\(v2\?\.initiative\?\.evidence_refs\?\?\[\]\),\.\.\.\(v2\?\.timing\?\.evidence_refs\?\?\[\]\),\.\.\.\(v2\?\.rebuild\?\.evidence_refs\?\?\[\]\),\.\.\.\(v2\?\.repeat_risks\?\.evidence_refs\?\?\[\]\),\.\.\.\(v2\?\.timing\?\.windows\?\?\[\]\)\.flatMap\(\(x:any\)=>x\?\.evidence_refs\?\?\[\]\),\.\.\.\(v2\?\.convergence\?\?\[\]\)\.flatMap\(\(x:any\)=>x\?\.evidence_refs\?\?\[\]\)\];\n   if\(String\(v2\?\.summary\?\?""\)\.length<need\(180\)\|\|refs\.length<5\|\|refs\.some\(\(x:any\)=>!validEvidenceRefs\.has\(String\(x\)\)\)\)return false;\n }''')
m=block.search(s)
require(m is not None,'grounding v2 block')
v2block=m.group(0)
s=s[:m.start()]+s[m.end():]
need_line=' const need=(n:number)=>Math.max(40,Math.floor(n*scale));'
require(need_line in s,'need declaration')
s=s.replace(need_line,need_line+v2block,1)
# Make the intended transport explicit for future regression tests and model instructions.
marker='- 연락·재접촉 / 감정 재활성 / 관계 재구축 지원층을 하나의 재회 점수로 합치지 않는다. 연락이 열리는 것과 안정적 재결합은 별개로 결론낸다.'
extra='- 재회 모드에서는 원시 advanced/directional/transit 표를 중복 전달하지 않고 reunion_evidence_v2가 질문별로 압축한 근거를 사용한다.'
if extra not in s:
    require(marker in s,'reunion instruction marker')
    s=s.replace(marker,marker+'\n'+extra,1)
write(p,s)

# 2) Browser cache: invalidate only reunion, preserve compatibility/marriage cache identity.
p=Path('web/src/lib/readingCache.ts'); s=read(p)
old="const RELATIONSHIP_AI_CACHE_CONTRACT = 'relationship-v11.7-reunion-specific'"
new=old+"\nconst RELATIONSHIP_REUNION_AI_CACHE_CONTRACT = 'relationship-v11.8-evidence-v2'"
if 'RELATIONSHIP_REUNION_AI_CACHE_CONTRACT' not in s:
    require(old in s,'relationship cache contract')
    s=s.replace(old,new,1)
old_func="""export function relationshipAiCacheId(calculation: Record<string, unknown>, purpose: string, model: string, context?: unknown): string {\n  return `relationship-ai:${hashText(stableStringify({ contract: RELATIONSHIP_AI_CACHE_CONTRACT, model, purpose, calculation, context: context ?? null }))}`\n}"""
new_func="""export function relationshipAiCacheId(calculation: Record<string, unknown>, purpose: string, model: string, context?: unknown): string {\n  const contract = purpose === 'reunion' ? RELATIONSHIP_REUNION_AI_CACHE_CONTRACT : RELATIONSHIP_AI_CACHE_CONTRACT\n  return `relationship-ai:${hashText(stableStringify({ contract, model, purpose, calculation, context: context ?? null }))}`\n}"""
require(old_func in s,'relationship cache id')
s=s.replace(old_func,new_func,1)
write(p,s)

# 3) Update stale relationship mode contract to assert the new stronger reunion contract.
p=Path('web/src/lib/relationshipModeContract.test.mjs'); s=read(p)
s=s.replace("  assert.match(relationshipFn, /수신\\/발신\\/재접점을 분리/)\n", "  assert.match(relationshipFn, /CALCULATED_DATA\\.reunion_evidence_v2/)\n  assert.match(relationshipFn, /왜 다시 연결될 여지가 있는가/)\n  assert.match(relationshipFn, /같은 파생계열 반복은 수렴 근거로 세지 않는다/)\n  assert.match(relationshipFn, /reunion_synthesis_v2:REUNION_V2_SCHEMA/)\n")
s=s.replace("  assert.match(cache, /RELATIONSHIP_AI_CACHE_CONTRACT = 'relationship-v11\\.7-reunion-specific'/)\n  assert.match(cache, /contract: RELATIONSHIP_AI_CACHE_CONTRACT/)\n", "  assert.match(cache, /RELATIONSHIP_AI_CACHE_CONTRACT = 'relationship-v11\\.7-reunion-specific'/)\n  assert.match(cache, /RELATIONSHIP_REUNION_AI_CACHE_CONTRACT = 'relationship-v11\\.8-evidence-v2'/)\n  assert.match(cache, /purpose === 'reunion' \\? RELATIONSHIP_REUNION_AI_CACHE_CONTRACT : RELATIONSHIP_AI_CACHE_CONTRACT/)\n")
write(p,s)

# 4) Permanent CI: run V2 evidence/compiler contracts every PR.
p=Path('.github/workflows/interpretation-v3-ci.yml'); s=read(p)
anchor='''          node --test web/src/lib/relationshipEvidencePipeline.test.mjs\n          node --test supabase/functions/relationship-interpret-v9-preview/jobStatusContract.test.mjs\n'''
addition='''          node --test web/src/lib/relationshipEvidencePipeline.test.mjs\n          node --experimental-strip-types --test supabase/functions/relationship-interpret-v9-preview/reunionEvidenceV2.test.mjs\n          node --test web/src/lib/relationshipReunionV2.contract.test.mjs\n          node --test supabase/functions/relationship-interpret-v9-preview/jobStatusContract.test.mjs\n'''
require(anchor in s,'interpretation ci anchor')
s=s.replace(anchor,addition,1)
write(p,s)

# 5) Strengthen V2 static contract: reunion prompt must be matrix-only rather than duplicated raw layers.
p=Path('web/src/lib/relationshipReunionV2.contract.test.mjs'); s=read(p)
needle="""  assert.match(server,/base\\.reunion_evidence_v2=buildReunionEvidenceV2\\(base\\)/)\n"""
replacement="""  assert.match(server,/const reunion_evidence_v2=buildReunionEvidenceV2\\(base\\)/)\n  assert.match(server,/return \\{analysis_mode:base\\.analysis_mode,period:base\\.period,relationship_status:base\\.relationship_status,timing_contract:base\\.timing_contract,precision:base\\.precision,saju_relationship:base\\.saju_relationship,reunion_evidence_v2,limitations:base\\.limitations\\}/)\n"""
require(needle in s,'v2 contract compiler assertion')
s=s.replace(needle,replacement,1)
write(p,s)
print('finalized reunion evidence v2')
