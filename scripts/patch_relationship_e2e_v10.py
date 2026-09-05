from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 anchor, found {count}")
    return text.replace(old, new, 1)


# 1) Internal relationship Gemini evidence packet.
edge_path = Path('supabase/functions/relationship-interpret-v9-preview/index.ts')
e = edge_path.read_text(encoding='utf-8')
e = replace_once(
    e,
    'VERSION="relationship-v11.1-adaptive-prompt-pack"',
    'VERSION="relationship-v11.2-evidence-pipeline"',
    'edge version',
)
helper_anchor = 'function compact(calc:any,ctx:any,purpose:Purpose,level=0){'
helper = '''function monthlyAdvancedPacket(m:any,n:number){
 const ps=m?.progressed_synastry,pc=m?.progressed_composite,mt=m?.marks_tertiary;
 const unavailable=(x:any,fallback:string)=>({available:false,reason:x?.reason??fallback});
 return {
   calendar_month:m?.calendar_month??null,representative_date:m?.representative_date??null,
   signal_summary:compactSignal(m?.signal_summary,n),
   progressed_synastry:ps?.available===true?{
     available:true,
     user_progressed_to_partner_natal:aspectList(ps?.user_progressed_to_partner_natal,n),
     partner_progressed_to_user_natal:aspectList(ps?.partner_progressed_to_user_natal,n),
     progressed_to_progressed:aspectList(ps?.progressed_to_progressed,n),
   }:unavailable(ps,"progressed synastry unavailable"),
   progressed_composite:pc?.available===true?{
     available:true,method:pc?.method??null,
     to_natal_composite_aspects:aspectList(pc?.to_natal_composite_aspects,n),
   }:unavailable(pc,"progressed composite unavailable"),
   marks_tertiary:mt?.available===true?{
     available:true,
     user:{completed_lunar_months:mt?.user?.completed_lunar_months??null,to_base_marks_aspects:aspectList(mt?.user?.to_base_marks_aspects,n)},
     counterpart:{completed_lunar_months:mt?.counterpart?.completed_lunar_months??null,to_base_marks_aspects:aspectList(mt?.counterpart?.to_base_marks_aspects,n)},
     directional_cross_aspects:aspectList(mt?.directional_cross_aspects,n),
     angle_policy:mt?.angle_policy??null,
   }:unavailable(mt,"Marks tertiary unavailable"),
 };
}
'''
e = replace_once(e, helper_anchor, helper + helper_anchor, 'edge monthly helper')
old_month = ' const advancedMonths=(Array.isArray(r?.months)?r.months:[]).slice(0,L.months).map((m:any)=>({calendar_month:m?.calendar_month,representative_date:m?.representative_date,signal_summary:compactSignal(m?.signal_summary,L.tight)}));'
new_month = ' const advancedMonths=(Array.isArray(r?.months)?r.months:[]).slice(0,L.months).map((m:any)=>monthlyAdvancedPacket(m,L.tight));'
e = replace_once(e, old_month, new_month, 'edge advanced months')
old_head = '   analysis_mode:r?.analysis_mode??null,period:calc?.period,relationship_status:calc?.relationship_status,\n   precision:'
new_head = '''   analysis_mode:r?.analysis_mode??null,period:calc?.period,relationship_status:calc?.relationship_status,
   timing_contract:{timing_timezone_policy:r?.timing_timezone_policy??null,secondary_key:r?.secondary_key??null,tertiary_key:r?.tertiary_key??null,orb_policy:r?.orb_policy??null,interpretation_policy:r?.interpretation_policy??null},
   precision:'''
e = replace_once(e, old_head, new_head, 'edge timing contract')
old_adv = '   advanced:{davison:advancedPacket(r?.davison,L.chart),marks:advancedPacket(r?.marks,L.chart),months:advancedMonths},'
new_adv = '   advanced:{composite:advancedPacket(r?.composite,L.chart),davison:advancedPacket(r?.davison,L.chart),marks:advancedPacket(r?.marks,L.chart),months:advancedMonths},'
e = replace_once(e, old_adv, new_adv, 'edge composite propagation')
rule_anchor = '- 점수와 접점 개수는 확률이 아니다. 좋은 말/나쁜 말을 억지로 균형 맞추지 않는다.\n'
rule_extra = '''- timing_contract의 fixed UTC offset·local noon 규칙을 그대로 따른다. IANA/DST를 임의 추정해 날짜를 바꾸지 않는다.
- advanced.composite와 advanced.months의 progressed_synastry·progressed_composite·marks_tertiary를 서로 다른 계산층으로 읽고 signal_summary 하나로 뭉개지 않는다.
'''
e = replace_once(e, rule_anchor, rule_anchor + rule_extra, 'edge system evidence rules')
edge_path.write_text(e, encoding='utf-8')


# 2) Browser/external-AI compact packet keeps the same evidence contract.
fmt_path = Path('web/src/lib/resultFormatters.ts')
f = fmt_path.read_text(encoding='utf-8')
fmt_anchor = 'function compactRelationshipExternalPacket(calculation: RelationshipApiResponse | null | undefined, reunionContext: ReunionTimingContext | null | undefined, level: number) {'
fmt_helpers = '''const RELATIONSHIP_CORE_POINTS = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto','True Node','ASC','MC']

function compactRelationshipChartForExternal(value: unknown, limit = 10) {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const positions = (row.positions && typeof row.positions === 'object' ? row.positions : {}) as Record<string, unknown>
  const keys = RELATIONSHIP_CORE_POINTS.filter((key)=>positions[key]).slice(0,limit)
  const compactPositions = Object.fromEntries(keys.map((key)=>{
    const source = (positions[key] && typeof positions[key] === 'object' ? positions[key] : {}) as Record<string, unknown>
    const lon = Number(source.lon ?? source.longitude ?? source.longitude_deg ?? 0)
    return [key,{ lon:Number.isFinite(lon)?Number(lon.toFixed(4)):0, sign:source.sign ?? source.sign_ko ?? null, house:source.house ?? null }]
  }))
  const angles = (row.angles && typeof row.angles === 'object' ? row.angles : null) as Record<string, unknown> | null
  return { positions:compactPositions, angles:angles?{ASC:angles.ASC??null,MC:angles.MC??null,IC:angles.IC??null,DSC:angles.DSC??null}:null }
}

function compactAdvancedStaticForExternal(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (row.available === false) return { available:false, reason:row.reason ?? null }
  return {
    available:row.available ?? true, reason:row.reason ?? null, method:row.method ?? null,
    chart:compactRelationshipChartForExternal(row.chart),
    user:compactRelationshipChartForExternal(row.user),
    counterpart:compactRelationshipChartForExternal(row.counterpart),
  }
}

function compactAdvancedMonthForExternal(value: unknown, limit: number) {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const ps = (row.progressed_synastry && typeof row.progressed_synastry === 'object' ? row.progressed_synastry : {}) as Record<string, unknown>
  const pc = (row.progressed_composite && typeof row.progressed_composite === 'object' ? row.progressed_composite : {}) as Record<string, unknown>
  const mt = (row.marks_tertiary && typeof row.marks_tertiary === 'object' ? row.marks_tertiary : {}) as Record<string, unknown>
  const mtUser = (mt.user && typeof mt.user === 'object' ? mt.user : {}) as Record<string, unknown>
  const mtCounterpart = (mt.counterpart && typeof mt.counterpart === 'object' ? mt.counterpart : {}) as Record<string, unknown>
  const list = (x: unknown) => (Array.isArray(x) ? x : []).slice(0,limit).map(compactAspectForExternal).filter(Boolean)
  const summary = (row.signal_summary && typeof row.signal_summary === 'object' ? row.signal_summary : {}) as Record<string, unknown>
  return {
    calendar_month:row.calendar_month ?? null, representative_date:row.representative_date ?? null,
    signal_summary:{
      exact_contacts:Number(summary.exact_contacts ?? 0), supportive_contacts:Number(summary.supportive_contacts ?? 0), challenging_contacts:Number(summary.challenging_contacts ?? 0), tightest:list(summary.tightest),
    },
    progressed_synastry:ps.available === true ? {
      available:true, user_progressed_to_partner_natal:list(ps.user_progressed_to_partner_natal), partner_progressed_to_user_natal:list(ps.partner_progressed_to_user_natal), progressed_to_progressed:list(ps.progressed_to_progressed),
    } : { available:false, reason:ps.reason ?? null },
    progressed_composite:pc.available === true ? { available:true, method:pc.method ?? null, to_natal_composite_aspects:list(pc.to_natal_composite_aspects) } : { available:false, reason:pc.reason ?? null },
    marks_tertiary:mt.available === true ? {
      available:true,
      user:{completed_lunar_months:mtUser.completed_lunar_months ?? null,to_base_marks_aspects:list(mtUser.to_base_marks_aspects)},
      counterpart:{completed_lunar_months:mtCounterpart.completed_lunar_months ?? null,to_base_marks_aspects:list(mtCounterpart.to_base_marks_aspects)},
      directional_cross_aspects:list(mt.directional_cross_aspects), angle_policy:mt.angle_policy ?? null,
    } : { available:false, reason:mt.reason ?? null },
  }
}

'''
f = replace_once(f, fmt_anchor, fmt_helpers + fmt_anchor, 'formatter helpers')
month_pattern = re.compile(r"  const months = \(rawResult\.months \?\? \[\]\)\.slice\(0,caps\.months\)\.map\(\(month\) => \(\{.*?\n  \}\)\)\n  const transits", re.S)
match = month_pattern.search(f)
if not match:
    raise SystemExit('formatter months: anchor not found')
f = f[:match.start()] + "  const months = (rawResult.months ?? []).slice(0,caps.months).map((month) => compactAdvancedMonthForExternal(month,caps.tight))\n  const transits" + f[match.end():]
old_packet_head = '    precision: { partner_time_exact:Boolean(natal?.partner_time_exact), note:natal?.note ?? null },\n    natal_synastry:'
new_packet_head = '''    timing_contract: {
      timing_timezone_policy:rawResult.timing_timezone_policy ?? null,
      secondary_key:rawResult.secondary_key ?? null,
      tertiary_key:rawResult.tertiary_key ?? null,
      orb_policy:rawResult.orb_policy ?? null,
      interpretation_policy:rawResult.interpretation_policy ?? null,
    },
    precision: { partner_time_exact:Boolean(natal?.partner_time_exact), note:natal?.note ?? null },
    natal_synastry:'''
f = replace_once(f, old_packet_head, new_packet_head, 'formatter timing contract')
old_packet_adv = '    advanced: { davison:rawResult.davison ?? null, marks:rawResult.marks ?? null, months },'
new_packet_adv = '    advanced: { composite:compactAdvancedStaticForExternal(rawResult.composite), davison:compactAdvancedStaticForExternal(rawResult.davison), marks:compactAdvancedStaticForExternal(rawResult.marks), months },'
f = replace_once(f, old_packet_adv, new_packet_adv, 'formatter advanced propagation')
rule_anchor2 = "    '- 좁은 오브의 실제 접점과 서로 독립된 레이어에서 반복되는 근거를 우선한다. 접점 수·점수는 연락/재회/결혼 확률이 아니다.',\n"
rule_extra2 = "    '- timing_contract의 fixed UTC offset·local noon 정책을 그대로 유지하고, advanced.composite 및 월별 progressed_synastry·progressed_composite·marks_tertiary를 서로 다른 층으로 읽는다.',\n"
f = replace_once(f, rule_anchor2, rule_anchor2 + rule_extra2, 'external prompt evidence rule')
fmt_path.write_text(f, encoding='utf-8')


# 3) Shared TypeScript contract reflects what the API already returns.
type_path = Path('web/src/appTypes.ts')
t = type_path.read_text(encoding='utf-8')
old_month_type = '''export type RelationshipMonth = {
  calendar_month: string
  representative_date: string
  signal_summary: SignalSummary
}
'''
new_month_type = '''export type RelationshipProgressedSynastry = {
  available: boolean
  reason?: string
  user_progressed_to_partner_natal?: Aspect[]
  partner_progressed_to_user_natal?: Aspect[]
  progressed_to_progressed?: Aspect[]
}

export type RelationshipProgressedComposite = {
  available: boolean
  reason?: string
  method?: string
  chart?: Record<string, unknown>
  to_natal_composite_aspects?: Aspect[]
}

export type RelationshipMarksTertiary = {
  available: boolean
  reason?: string
  user?: { completed_lunar_months?: number; chart?: Record<string, unknown>; to_base_marks_aspects?: Aspect[] }
  counterpart?: { completed_lunar_months?: number; chart?: Record<string, unknown>; to_base_marks_aspects?: Aspect[] }
  directional_cross_aspects?: Aspect[]
  angle_policy?: string
}

export type RelationshipMonth = {
  calendar_month: string
  representative_date: string
  signal_summary: SignalSummary
  progressed_synastry?: RelationshipProgressedSynastry
  progressed_composite?: RelationshipProgressedComposite
  marks_tertiary?: RelationshipMarksTertiary
}
'''
t = replace_once(t, old_month_type, new_month_type, 'relationship month type')
old_result_head = '''  result: {
    limitations?: string[]
    natal_synastry?:'''
new_result_head = '''  result: {
    limitations?: string[]
    timing_timezone_policy?: string
    secondary_key?: string
    tertiary_key?: string
    orb_policy?: string
    interpretation_policy?: Record<string, string>
    relationship_focus?: { available: boolean; groups?: Record<string, Aspect[]>; policy?: string }
    saju_relationship?: Record<string, unknown>
    composite?: { available: boolean; reason?: string; chart?: Record<string, unknown>; note?: string }
    natal_synastry?:'''
t = replace_once(t, old_result_head, new_result_head, 'relationship result metadata type')
t = replace_once(
    t,
    '    davison?: { available: boolean; reason?: string }\n    marks?: { available: boolean; reason?: string }',
    '    davison?: { available: boolean; reason?: string; chart?: Record<string, unknown> }\n    marks?: { available: boolean; reason?: string; method?: string; user?: Record<string, unknown>; counterpart?: Record<string, unknown> }',
    'advanced static types',
)
type_path.write_text(t, encoding='utf-8')


# 4) Invalidate old client-side relationship AI cache after the evidence contract changes.
cache_path = Path('web/src/lib/readingCache.ts')
c = cache_path.read_text(encoding='utf-8')
c = replace_once(c, "RELATIONSHIP_AI_CACHE_CONTRACT = 'relationship-v11.1-adaptive-prompt-pack'", "RELATIONSHIP_AI_CACHE_CONTRACT = 'relationship-v11.2-evidence-pipeline'", 'relationship cache contract')
cache_path.write_text(c, encoding='utf-8')


# 5) Permanent cross-layer evidence pipeline contract test.
test_path = Path('web/src/lib/relationshipEvidencePipeline.test.mjs')
test_path.write_text('''import assert from 'node:assert/strict'\nimport { readFileSync } from 'node:fs'\nimport test from 'node:test'\n\nconst engine = readFileSync(new URL('../../../relationship_western_v1.py', import.meta.url), 'utf8')\nconst api = readFileSync(new URL('../../../api/main.py', import.meta.url), 'utf8')\nconst types = readFileSync(new URL('../appTypes.ts', import.meta.url), 'utf8')\nconst edge = readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/index.ts', import.meta.url), 'utf8')\nconst formatters = readFileSync(new URL('./resultFormatters.ts', import.meta.url), 'utf8')\nconst cache = readFileSync(new URL('./readingCache.ts', import.meta.url), 'utf8')\n\ntest('calculation evidence survives API to internal Gemini and external-AI prompt contracts', () => {\n  for (const field of ['composite','progressed_synastry','progressed_composite','marks_tertiary','timing_timezone_policy']) {\n    assert.match(engine, new RegExp(`[\\"']${field}[\\"']`), `engine must emit ${field}`)\n    assert.match(edge, new RegExp(field), `internal Gemini packet must retain ${field}`)\n    assert.match(formatters, new RegExp(field), `external AI packet must retain ${field}`)\n  }\n  assert.match(api, /result[\\"']:\\s*result/)\n  assert.match(types, /progressed_synastry\\?: RelationshipProgressedSynastry/)\n  assert.match(types, /progressed_composite\\?: RelationshipProgressedComposite/)\n  assert.match(types, /marks_tertiary\\?: RelationshipMarksTertiary/)\n  assert.match(edge, /advanced:\\{composite:advancedPacket/)\n  assert.match(edge, /monthlyAdvancedPacket\\(m,L\\.tight\\)/)\n  assert.match(edge, /timing_contract:\\{timing_timezone_policy:/)\n  assert.match(formatters, /compactAdvancedMonthForExternal\\(month,caps\\.tight\\)/)\n  assert.match(formatters, /composite:compactAdvancedStaticForExternal\\(rawResult\\.composite\\)/)\n  assert.match(formatters, /timing_contract:\\s*\\{/)\n})\n\ntest('relationship interpretation cache version changes with the evidence packet contract', () => {\n  assert.match(edge, /relationship-v11\\.2-evidence-pipeline/)\n  assert.match(cache, /relationship-v11\\.2-evidence-pipeline/)\n})\n''', encoding='utf-8')


# 6) Existing relationship contract test and interpretation CI follow the new version/test.
contract_path = Path('web/src/lib/relationshipModeContract.test.mjs')
r = contract_path.read_text(encoding='utf-8')
r = r.replace('relationship-v11\\.1-adaptive-prompt-pack', 'relationship-v11\\.2-evidence-pipeline')
contract_path.write_text(r, encoding='utf-8')

ci_path = Path('.github/workflows/interpretation-v3-ci.yml')
y = ci_path.read_text(encoding='utf-8')
ci_anchor = '          node --test web/src/lib/relationshipModeContract.test.mjs\n'
y = replace_once(y, ci_anchor, ci_anchor + '          node --test web/src/lib/relationshipEvidencePipeline.test.mjs\n', 'interpretation CI test')
ci_path.write_text(y, encoding='utf-8')

print('relationship E2E V10 patch applied')
