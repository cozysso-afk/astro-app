from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def read(path): return (ROOT / path).read_text()
def write(path, text): (ROOT / path).write_text(text)
def rep(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing target: {label}')
    return text.replace(old, new, 1)

# 1) Compact reunion hierarchy before Gemini. Calculation output stays untouched.
p = 'supabase/functions/relationship-interpret-v9-preview/index.ts'
s = read(p)
s = rep(s,
'const REUNION_VERSION="relationship-v12.7-provisional-full-analysis";',
'const REUNION_VERSION="relationship-v12.8-prompt-grounding-resilience";',
'reunion version')
s = rep(s,
'const MAX_GEMINI_CALLS=2,MAX_PROMPT_BYTES=180000,MAX_AI_JOB_ESTIMATED_KRW=300;',
'const MAX_GEMINI_CALLS=2,MAX_PROMPT_BYTES=180000,REUNION_PROMPT_TARGET_BYTES=85000,MAX_AI_JOB_ESTIMATED_KRW=300;',
'prompt target constant')
old = 'function hierarchyPacket(h:any){if(!h)return null;return {version:h.version,as_of_date:h.as_of_date,validation:h.validation,weights:h.weights,thresholds:h.thresholds,stages:h.stages,top_periods:h.top_periods,nearest_window:h.nearest_window,initiative:h.initiative,coverage:h.coverage,limitations:h.limitations,score_meaning:h.score_meaning,stability_structure:h.stability_structure};}'
new = '''function compactHierarchyEvidence(x:any){if(!x||typeof x!=="object")return null;return {a:x?.a??x?.transit??null,aspect:x?.aspect??null,b:x?.b??x?.target??null,orb:Number.isFinite(Number(x?.orb))?Number(x.orb):null,tone:x?.tone??null,family:x?.family??null,person:x?.person??null,system:x?.system??null,precision:x?.precision??x?.return_precision??null};}
function compactHierarchyWindow(x:any){if(!x||typeof x!=="object")return null;const c=x?.components??{},audit=x?.medium_precision_audit??{};const compactList=(v:any,n:number)=>(Array.isArray(v)?v:[]).slice(0,n).map(compactHierarchyEvidence).filter(Boolean);return {date:x?.date??null,start:x?.start??null,end:x?.end??null,stage:x?.stage??null,label:x?.label??null,final:Number.isFinite(Number(x?.final))?Number(x.final):null,eligible:Boolean(x?.eligible),local_peak:Boolean(x?.local_peak),temporal_status:x?.temporal_status??null,components:{long_term:c?.long_term??null,mid_term:c?.mid_term??null,event_trigger:c?.event_trigger??null,cross_system:c?.cross_system??null,convergence_bonus:c?.convergence_bonus??null,independent_systems:Array.isArray(c?.independent_systems)?c.independent_systems.slice(0,4):[],primary_trigger_orb:c?.primary_trigger_orb??null,primary_trigger_strength:c?.primary_trigger_strength??null,event_probability:"not_calculated"},fast_evidence:compactList(x?.fast_evidence,2),mid_evidence:compactList(x?.mid_evidence,2),period_support:compactList(x?.period_support,2),medium_precision_audit:{status:audit?.status??null,exact_only_gate_pass:audit?.exact_only_gate_pass??null,exact_evidence_count:audit?.exact_evidence_count??null,provisional_evidence_count:audit?.provisional_evidence_count??null}};}
function hierarchyPacket(h:any,level=0){if(!h)return null;const limit=level===0?10:level===1?8:6;return {version:h.version,as_of_date:h.as_of_date,validation:h.validation,weights:h.weights,thresholds:h.thresholds,stages:h.stages,top_periods:(Array.isArray(h?.top_periods)?h.top_periods:[]).slice(0,limit).map(compactHierarchyWindow).filter(Boolean),nearest_window:compactHierarchyWindow(h?.nearest_window),initiative:h.initiative,coverage:h.coverage,limitations:Array.isArray(h?.limitations)?h.limitations.slice(0,8):[],score_meaning:h.score_meaning,stability_structure:h.stability_structure};}'''
s = rep(s, old, new, 'hierarchy packet')
s = rep(s,
'reunion_hierarchy:purpose==="reunion"?hierarchyPacket(r?.reunion_hierarchy):null,',
'reunion_hierarchy:purpose==="reunion"?hierarchyPacket(r?.reunion_hierarchy,level):null,',
'hierarchy level')
old = 'function promptBudget(payload:any,purpose:Purpose){const bytes=enc.encode(SYSTEM+promptText(payload,purpose,false)).length,estimated_input_tokens=Math.ceil(bytes/2.6),estimated_max_job_krw=relationshipEstimatedJobKrw(estimated_input_tokens,purpose);return {bytes,max_bytes:MAX_PROMPT_BYTES,estimated_input_tokens,estimated_max_job_krw,max_job_krw:MAX_AI_JOB_ESTIMATED_KRW,ok:bytes<=MAX_PROMPT_BYTES&&estimated_max_job_krw<=MAX_AI_JOB_ESTIMATED_KRW};}'
new = 'function promptBudget(payload:any,purpose:Purpose){const bytes=enc.encode(SYSTEM+promptText(payload,purpose,false)).length,maxBytes=purpose==="reunion"?REUNION_PROMPT_TARGET_BYTES:MAX_PROMPT_BYTES,estimated_input_tokens=Math.ceil(bytes/2.6),estimated_max_job_krw=relationshipEstimatedJobKrw(estimated_input_tokens,purpose);return {bytes,max_bytes:maxBytes,estimated_input_tokens,estimated_max_job_krw,max_job_krw:MAX_AI_JOB_ESTIMATED_KRW,ok:bytes<=maxBytes&&estimated_max_job_krw<=MAX_AI_JOB_ESTIMATED_KRW};}'
s = rep(s, old, new, 'prompt budget')
write(p, s)

# 2) Repair unsupported deterministic wording instead of discarding an otherwise grounded answer.
p = 'supabase/functions/relationship-interpret-v9-preview/reunionGroundingV2.ts'
s = read(p)
marker = 'export function repairReunionGroundingV2(data: any, payload: any): RepairResult {'
insert = '''function sanitizeUnsupportedClaims(value: any): any {
  if (typeof value === 'string') return value
    .replace(/끊어지지 않는 인연|끊을 수 없는 인연|서로를 지울 수 없다/g, '쉽게 정리되지 않는 느낌이 들 수 있는 관계')
    .replace(/카르마적 인연|운명적 인연|천생연분/g, '강하게 체감될 수 있는 관계')
    .replace(/운명적으로 다시 만난다/g, '다시 접점이 생길 수 있는 흐름이 보인다')
    .replace(/반드시 연락한다/g, '연락을 확정할 수는 없지만 관련 활성 신호가 있다')
    .replace(/상대가 아직 사랑한다/g, '상대의 실제 감정은 차트만으로 확정할 수 없다')
    .replace(/(연락|만남|재회)\\s*확률\\s*\\d+(?:\\.\\d+)?\\s*%/g, '$1 관련 활성 점수는 사건 확률이 아니다')
  if (Array.isArray(value)) return value.map(sanitizeUnsupportedClaims)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, sanitizeUnsupportedClaims(v)]))
  return value
}

'''
if insert.strip() not in s:
    s = rep(s, marker, insert + marker, 'claim sanitizer insertion')
old = '''  if (/끊어지지 않는 인연|끊을 수 없는 인연|카르마적 인연|운명적 인연|운명적으로 다시 만난다|천생연분|서로를 지울 수 없다|반드시 연락한다|상대가 아직 사랑한다|(?:연락|만남|재회)\\s*확률\\s*\\d+(?:\\.\\d+)?\\s*%/.test(JSON.stringify(next))) {
    return { ok:false, repaired:false, data, reason:'unsupported_deterministic_claim' }
  }
  return { ok: true, repaired: before !== JSON.stringify(next), data: next }
'''
new = '''  const safeNext = sanitizeUnsupportedClaims(next)
  if (/끊어지지 않는 인연|끊을 수 없는 인연|카르마적 인연|운명적 인연|운명적으로 다시 만난다|천생연분|서로를 지울 수 없다|반드시 연락한다|상대가 아직 사랑한다|(?:연락|만남|재회)\\s*확률\\s*\\d+(?:\\.\\d+)?\\s*%/.test(JSON.stringify(safeNext))) {
    return { ok:false, repaired:false, data, reason:'unsupported_deterministic_claim' }
  }
  return { ok: true, repaired: before !== JSON.stringify(safeNext), data: safeNext }
'''
s = rep(s, old, new, 'claim rejection repair')
write(p, s)

# 3) Bump cache contract so old failed hashes/results cannot be reused.
for rel in [
    'web/src/lib/readingCache.ts',
    'web/src/lib/relationshipModeContract.test.mjs',
    'web/src/lib/relationshipEvidencePipeline.test.mjs',
    'web/src/lib/relationshipReunionV2.contract.test.mjs',
    'web/src/lib/reunionEditorialV126.test.mjs',
    'web/src/lib/humanLanguageV25.test.mjs',
    'web/src/lib/provisionalFullAnalysisV127.test.mjs',
]:
    path = ROOT / rel
    if not path.exists(): continue
    t = path.read_text()
    t = t.replace('relationship-v12.7-provisional-full-analysis-v1','relationship-v12.8-prompt-grounding-resilience-v1')
    t = t.replace('relationship-v12\\.7-provisional-full-analysis-v1','relationship-v12\\.8-prompt-grounding-resilience-v1')
    t = t.replace('relationship-v12.7-provisional-full-analysis','relationship-v12.8-prompt-grounding-resilience')
    t = t.replace('relationship-v12\\.7-provisional-full-analysis','relationship-v12\\.8-prompt-grounding-resilience')
    path.write_text(t)

# 4) Focused source/behavior regression.
p = ROOT / 'web/src/lib/reunionAiResilienceV128.test.mjs'
p.write_text(r'''import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { repairReunionGroundingV2 } from '../../../supabase/functions/relationship-interpret-v9-preview/reunionGroundingV2.ts'

const server=readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/index.ts',import.meta.url),'utf8')
const cache=readFileSync(new URL('./readingCache.ts',import.meta.url),'utf8')

test('reunion Gemini packet has a tighter target and compact hierarchy windows',()=>{
  assert.match(server,/REUNION_PROMPT_TARGET_BYTES=85000/)
  assert.match(server,/relationship-v12\.8-prompt-grounding-resilience/)
  assert.match(server,/slice\(0,limit\)\.map\(compactHierarchyWindow\)/)
  assert.match(server,/fast_evidence:compactList\(x\?\.fast_evidence,2\)/)
  assert.match(server,/period_support:compactList\(x\?\.period_support,2\)/)
  assert.doesNotMatch(server,/top_periods:h\.top_periods/)
  assert.doesNotMatch(server,/past_windows:h\.past_windows/)
  assert.match(cache,/relationship-v12\.8-prompt-grounding-resilience-v1/)
})

test('unsupported deterministic wording is repaired instead of discarding grounded result',()=>{
  const ids=['R2:why:1','R2:init:2','R2:timing:3','R2:rebuild:4','R2:risk:5']
  const evidence=ids.map(id=>({id}))
  const questions={
    why_reconnect:{evidence_refs:[ids[0]]},initiative:{evidence_refs:[ids[1]]},timing:{evidence_refs:[ids[2]]},rebuild:{evidence_refs:[ids[3]]},repeat_risks:{evidence_refs:[ids[4]]},
  }
  const payload={precision:{partner_time_exact:false},reunion_hierarchy:{as_of_date:'2026-09-25'},reunion_timing_windows:{windows:[]},reunion_evidence_v2:{evidence,questions,initiative_gate:{available:false}}}
  const data={headline:'테스트',overview:'',timing:'',reunion_context:'',practical_advice:[],top_aspects:[],limits:'',reunion_synthesis_v2:{
    summary:'운명적 인연이라 반드시 연락한다는 식으로 단정하는 문장이 들어왔지만 이 전체 답변을 버리지 않고 안전하게 교정해야 한다. 상대가 아직 사랑한다는 표현이나 재회 확률 80% 같은 표현도 같은 방식으로 고쳐야 하며, 계산 근거 자체와 나머지 설명은 그대로 보존해야 한다. 이 문장은 길이 검증도 통과하도록 충분한 설명을 포함한다.',
    why_reconnect:{conclusion:'운명적 인연처럼 느껴질 수 있다는 표현이 들어왔다.',interpretation:'끊을 수 없는 인연이라는 단정 대신 실제 계산 근거가 가리키는 관계의 반복 패턴을 설명하는 충분한 문장이다.',evidence_refs:[ids[0]]},
    initiative:{conclusion:'상대가 아직 사랑한다는 식의 단정은 피해야 한다.',interpretation:'누가 먼저 연락할지는 실제 행동 방향 근거가 부족하므로 차트 활성만으로 판정하지 않는 충분한 설명이다.',evidence_refs:[ids[1]]},
    timing:{conclusion:'연락 확률 80%라고 단정하면 안 되고 활성 시기만 설명한다.',windows:[],evidence_refs:[ids[2]]},
    rebuild:{conclusion:'천생연분이라는 표현 없이 관계 재구축 조건을 실제 근거에 따라 설명한다.',conditions:[],evidence_refs:[ids[3]]},
    repeat_risks:{conclusion:'서로를 지울 수 없다는 식의 표현 대신 반복 위험을 설명한다.',patterns:[],evidence_refs:[ids[4]]},
    convergence:[],precision_note:''
  }}
  const out=repairReunionGroundingV2(data,payload)
  assert.equal(out.ok,true)
  const text=JSON.stringify(out.data)
  assert.doesNotMatch(text,/운명적 인연|반드시 연락한다|상대가 아직 사랑한다|천생연분|서로를 지울 수 없다|연락\s*확률\s*80%/)
  assert.match(text,/사건 확률이 아니다|확정할 수 없다|강하게 체감될 수 있는 관계/)
})
''')
print('reunion AI prompt + grounding resilience patch staged')
