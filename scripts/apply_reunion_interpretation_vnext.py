from pathlib import Path


def rep(path: str, old: str, new: str) -> None:
    p = Path(path)
    s = p.read_text(encoding="utf-8")
    if new in s:
        return
    if old not in s:
        raise RuntimeError(f"anchor missing: {path}: {old[:160]!r}")
    p.write_text(s.replace(old, new, 1), encoding="utf-8")

# Internal interpretation packet + prompt contract.
idx = "supabase/functions/relationship-interpret-v9-preview/index.ts"
rep(idx,
    'const REUNION_VERSION="relationship-v12.4-stage-grounded-narrative";',
    'const REUNION_VERSION="relationship-v12.5-directional-evidence-narrative";')
rep(idx,
    '''function secondarySupportPacket(raw:any,n:number){\n if(!raw||typeof raw!=="object")return null;\n const months=(Array.isArray(raw?.months)?raw.months:[]).slice(0,n).map((m:any)=>({calendar_month:m?.calendar_month??null,representative_date:m?.representative_date??null,dimensions:{emotional_reactivation:secondaryDimensionPacket(m?.dimensions?.emotional_reactivation,n),contact_recontact:secondaryDimensionPacket(m?.dimensions?.contact_recontact,n),in_person_meeting:secondaryDimensionPacket(m?.dimensions?.in_person_meeting,n),relationship_rebuilding:secondaryDimensionPacket(m?.dimensions?.relationship_rebuilding,n)}}));\n return {months,policy:raw?.policy??null,event_probability:"not_calculated"};\n}\nfunction compact(calc:any,ctx:any,purpose:Purpose,level=0){''',
    '''function secondarySupportPacket(raw:any,n:number){\n if(!raw||typeof raw!=="object")return null;\n const months=(Array.isArray(raw?.months)?raw.months:[]).slice(0,n).map((m:any)=>({calendar_month:m?.calendar_month??null,representative_date:m?.representative_date??null,dimensions:{emotional_reactivation:secondaryDimensionPacket(m?.dimensions?.emotional_reactivation,n),contact_recontact:secondaryDimensionPacket(m?.dimensions?.contact_recontact,n),in_person_meeting:secondaryDimensionPacket(m?.dimensions?.in_person_meeting,n),relationship_rebuilding:secondaryDimensionPacket(m?.dimensions?.relationship_rebuilding,n)}}));\n return {months,policy:raw?.policy??null,event_probability:"not_calculated"};\n}\nfunction reunionEvidenceContractPacket(raw:any,n:number){\n if(!raw||typeof raw!=="object")return null;\n const all=Array.isArray(raw?.evidence)?raw.evidence:[];\n const dirs=["counterpart_to_user","user_to_counterpart","shared","relationship_itself"];\n const per=Math.max(3,Math.min(12,n));\n const chosen=dirs.flatMap(direction=>all.filter((x:any)=>x?.direction===direction).sort((a:any,b:any)=>Number(a?.orb??99)-Number(b?.orb??99)).slice(0,per));\n return {version:raw?.version??null,available:Boolean(raw?.available),evidence:chosen.slice(0,48).map((x:any)=>({a:x?.a??null,aspect:x?.aspect??null,b:x?.b??null,orb:Number(x?.orb??99),tone:x?.tone??null,direction:x?.direction??null,phase:x?.phase??null,phase_basis:x?.phase_basis??null,exact_at:x?.exact_at??null,exact_at_basis:x?.exact_at_basis??null,reference_date:x?.reference_date??null,source_path:x?.source_path??null,relationship_domains:Array.isArray(x?.relationship_domains)?x.relationship_domains.slice(0,5):[],stage_hints:Array.isArray(x?.stage_hints)?x.stage_hints.slice(0,4):[],target_house:x?.target_house??null,event_probability:"not_calculated"})),policy:raw?.policy??null};\n}\nfunction compact(calc:any,ctx:any,purpose:Purpose,level=0){''')
rep(idx,
    '''   reunion_secondary_support:purpose==="reunion"?secondarySupportPacket(r?.reunion_secondary_support,L.months):null,\n   reunion_timing_windows:purpose==="reunion"?r?.reunion_timing_windows??null:null,''',
    '''   reunion_secondary_support:purpose==="reunion"?secondarySupportPacket(r?.reunion_secondary_support,L.months):null,\n   reunion_evidence_contract:purpose==="reunion"?reunionEvidenceContractPacket(r?.reunion_evidence_contract,L.months):null,\n   reunion_timing_windows:purpose==="reunion"?r?.reunion_timing_windows??null:null,''')
rep(idx,
    '''- advanced.composite와 advanced.months의 progressed_synastry·progressed_composite·marks_tertiary를 서로 다른 계산층으로 읽고 signal_summary 하나로 뭉개지 않는다.\n- 영어·한자·전문용어는 바로 뒤 괄호에 한글 읽기/뜻을 붙인다.''',
    '''- advanced.composite와 advanced.months의 progressed_synastry·progressed_composite·marks_tertiary를 서로 다른 계산층으로 읽고 signal_summary 하나로 뭉개지 않는다.\n- CALCULATED_DATA.reunion_evidence_contract가 있으면 진행 근거의 방향을 반드시 구분한다: counterpart_to_user=상대 진행차트가 사용자 출생차트를 자극하는 방향, user_to_counterpart=사용자 진행차트가 상대 출생차트를 자극하는 방향, shared=현재 두 진행차트의 상호 접점, relationship_itself=진행 컴포지트로 본 관계 자체의 현재 단계다. 이 방향은 실제 속마음이나 실제 행동의 관측값이 아니다.\n- reunion_evidence_contract.phase는 applying=월별 오브가 더 가까워지는 흐름, separating=가장 가까운 구간을 지나 멀어지는 흐름, exact=샘플 날짜에서 0.02° 이내인 근접 정점으로만 읽는다. exact_at이 null이면 정확일을 새로 만들지 않는다.\n- 전문용어를 전부 숨기지 않는다. 핵심 문단에는 실제 행성·각·오브 1~2개를 보여준 뒤 바로 사람 말로 뜻을 풀어 쓴다. 기술값만 나열하거나 기술값 없는 추상 요약만 쓰지 않는다.\n- 영어·한자·전문용어는 바로 뒤 괄호에 한글 읽기/뜻을 붙인다.''')
rep(idx,
    '''- 시기창은 기간 신호와 날짜 트리거를 분리한다. Secondary Progression은 기간 배경만 만들고, 특정 날짜는 reunion_timing_windows에 실제 fast transit trigger가 있을 때만 제시한다.\n\n[미혼 결혼 marriage_unmarried]''',
    '''- 시기창은 기간 신호와 날짜 트리거를 분리한다. Secondary Progression은 기간 배경만 만들고, 특정 날짜는 reunion_timing_windows에 실제 fast transit trigger가 있을 때만 제시한다.\n- reunion_evidence_contract가 있으면 why_reconnect와 rebuild 해설 안에서 가능한 범위에 한해 네 층을 빠뜨리지 않는다: ① 나→상대 ② 상대→나 ③ 현재 두 사람의 진행차트끼리 ④ 진행 컴포지트로 본 관계 자체. 근거가 없는 층은 만들지 않는다.\n- 각 핵심 해설 단락은 '계산 근거 → 쉬운 뜻 → 실제 관계에서 나타날 수 있는 장면 → 함께 걸리는 반대/제약 근거 → 종합' 순서로 쓴다. 좋은 각 하나로 재회를 확정하거나 나쁜 각 하나로 종료를 확정하지 않는다.\n- applying과 separating을 문장에 반영한다. applying은 앞으로 강해지는 배경, separating은 최근 강했던 흐름의 흔적으로 설명하며, separating 근거를 미래 예고처럼 쓰지 않는다.\n- 진행 시너스트리의 counterpart_to_user는 '상대가 실제로 이렇게 느낀다'가 아니라 '상대의 현재 진행 흐름이 사용자의 어떤 영역을 자극하는 구도'라고 표현한다. 관측되지 않은 속마음·의도·행동을 사실처럼 쓰지 않는다.\n\n[미혼 결혼 marriage_unmarried]''')

# Evidence matrix consumes the normalized progression contract instead of re-deriving it loosely.
ev = "supabase/functions/relationship-interpret-v9-preview/reunionEvidenceV2.ts"
rep(ev,
    "export const REUNION_EVIDENCE_VERSION = 'reunion-evidence-v2.6-prompt-budget-hardening'",
    "export const REUNION_EVIDENCE_VERSION = 'reunion-evidence-v2.7-directional-contract'")
rep(ev,
    "  direction?: 'incoming' | 'outgoing' | 'shared' | null\n  period?: string | null",
    "  direction?: 'incoming' | 'outgoing' | 'shared' | 'relationship_itself' | null\n  period?: string | null\n  phase?: string | null")
rep(ev,
    '''function compact(items: Evidence[]) {''',
    '''function addNormalizedProgressionContract(items: Evidence[], packet: any) {\n  const rows = arr(packet?.reunion_evidence_contract?.evidence)\n  if (!rows.length) return false\n  const directionMap: Record<string,Evidence['direction']> = {user_to_counterpart:'outgoing',counterpart_to_user:'incoming',shared:'shared',relationship_itself:'relationship_itself'}\n  const questionsFor = (row:any): QuestionKey[] => {\n    const domains = new Set(arr(row?.relationship_domains).map(String))\n    const stages = new Set(arr(row?.stage_hints).map(String))\n    const out = new Set<QuestionKey>()\n    if (stages.has('emotional_reactivation') || ['emotion','affection_attraction','identity_direction','intensity_transformation'].some(x=>domains.has(x))) out.add('why_reconnect')\n    if (stages.has('contact_recontact') || domains.has('communication')) out.add('initiative')\n    if (stages.has('contact_recontact') || stages.has('in_person_meeting')) out.add('timing')\n    if (stages.has('relationship_rebuilding') || domains.has('commitment_structure') || row?.direction === 'relationship_itself') out.add('rebuild')\n    if (row?.tone === 'challenging' || domains.has('instability_uncertainty')) out.add('repeat_risks')\n    return [...out]\n  }\n  for (const row of rows.slice(0,48)) {\n    const text = aspectText(row)\n    if (!text) continue\n    const direction = directionMap[String(row?.direction ?? '')] ?? 'shared'\n    const group = row?.direction === 'relationship_itself' ? 'secondary_composite' : 'secondary_progression'\n    const house = row?.target_house && typeof row.target_house === 'object' ? `house=whole:${row.target_house.whole_house ?? '-'},quadrant:${row.target_house.quadrant_house ?? '-'}` : ''\n    const facts = [\n      `contract_direction=${short(row?.direction,32)}`, `phase=${short(row?.phase,20)}`, `phase_basis=${short(row?.phase_basis,32)}`,\n      `reference_date=${short(row?.reference_date,16)}`, row?.exact_at ? `exact_at=${short(row.exact_at,16)}` : 'exact_at=unresolved',\n      house, `domains=${arr(row?.relationship_domains).map((x:any)=>short(x,28)).join(',')}`, `stage_hints=${arr(row?.stage_hints).map((x:any)=>short(x,32)).join(',')}`,\n      'directional_activation_not_private_feeling=true',\n    ].filter(Boolean)\n    for (const q of questionsFor(row)) {\n      const role: EvidenceRole = q === 'initiative' ? 'context' : row?.tone === 'challenging' ? 'counter' : 'support'\n      items.push(makeEvidence({question:q,layer:short(row?.source_path,80)||'reunion_evidence_contract',family:'secondary',independence_group:group,role,direction,period:short(row?.calendar_month ?? row?.reference_date,16)||null,date:null,aspect:text,orb:num(row?.orb),tone:row?.tone??null,phase:short(row?.phase,20)||null,facts},items.length+1))\n    }\n  }\n  return true\n}\n\nfunction compact(items: Evidence[]) {''')
rep(ev,
    '''export function buildReunionEvidenceV2(packet: any) {\n  const items: Evidence[] = []\n  const focus = packet?.focus ?? {}''',
    '''export function buildReunionEvidenceV2(packet: any) {\n  const items: Evidence[] = []\n  const normalizedProgressionAvailable = addNormalizedProgressionContract(items, packet)\n  const focus = packet?.focus ?? {}''')
rep(ev,
    '''    if (ps?.available) {''',
    '''    if (ps?.available && !normalizedProgressionAvailable) {''')
rep(ev,
    '''    if (pc?.available) for (const a of arr(pc.to_natal_composite_aspects).slice(0,4)) addAspect(items,'rebuild','progressed_composite','secondary','secondary_composite',a,undefined,period,'shared')''',
    '''    if (pc?.available && !normalizedProgressionAvailable) for (const a of arr(pc.to_natal_composite_aspects).slice(0,4)) addAspect(items,'rebuild','progressed_composite','secondary','secondary_composite',a,undefined,period,'shared')''')
rep(ev,
    '''    progressed_synastry: arr(adv?.months).some(m=>m?.progressed_synastry?.available), progressed_composite:arr(adv?.months).some(m=>m?.progressed_composite?.available), marks_tertiary:arr(adv?.months).some(m=>m?.marks_tertiary?.available), daily_transit:arr(packet?.transit_triggers?.top_days).length>0,''',
    '''    progressed_synastry: normalizedProgressionAvailable || arr(adv?.months).some(m=>m?.progressed_synastry?.available), progressed_composite: normalizedProgressionAvailable || arr(adv?.months).some(m=>m?.progressed_composite?.available), marks_tertiary:arr(adv?.months).some(m=>m?.marks_tertiary?.available), daily_transit:arr(packet?.transit_triggers?.top_days).length>0,''')
rep(ev,
    '''  return {version:REUNION_EVIDENCE_VERSION,policy:'Question-first evidence matrix.''',
    '''  return {version:REUNION_EVIDENCE_VERSION,policy:'Question-first evidence matrix. Normalized reunion progression evidence preserves direction, monthly phase, house context, relationship domains, and stage hints without treating directional activation as observed private feeling or action. ''')

# Browser cache version: old v12.4 prose must not mask the new interpretation contract.
cache = "web/src/lib/readingCache.ts"
rep(cache,
    "const RELATIONSHIP_REUNION_AI_CACHE_CONTRACT = 'relationship-v12.4-stage-grounded-narrative-v1'",
    "const RELATIONSHIP_REUNION_AI_CACHE_CONTRACT = 'relationship-v12.5-directional-evidence-narrative-v1'")

# Contract tests.
rtest = "supabase/functions/relationship-interpret-v9-preview/reunionEvidenceV2.test.mjs"
rep(rtest,
    "  assert.equal(out.version,'reunion-evidence-v2.6-prompt-budget-hardening')",
    "  assert.equal(out.version,'reunion-evidence-v2.7-directional-contract')")
rep(rtest,
    '''  house_overlays:{available:true,user_in_counterpart:{relationship_houses:[{planet:'Venus',whole_house:7,placidus_house:7}]},counterpart_in_user:{relationship_houses:[{planet:'Moon',whole_house:4,placidus_house:4}]}},\n  advanced:{''',
    '''  house_overlays:{available:true,user_in_counterpart:{relationship_houses:[{planet:'Venus',whole_house:7,placidus_house:7}]},counterpart_in_user:{relationship_houses:[{planet:'Moon',whole_house:4,placidus_house:4}]}},\n  reunion_evidence_contract:{version:'reunion-evidence-contract-v1',available:true,evidence:[\n    {...asp('Mercury','conjunction','Sun',.10),direction:'counterpart_to_user',phase:'applying',phase_basis:'monthly_orb_trend',reference_date:'2027-01-15',calendar_month:'2027-01',source_path:'progressed_synastry.counterpart_to_user',relationship_domains:['communication','identity_direction'],stage_hints:['contact_recontact'],target_house:{whole_house:12,quadrant_house:12}},\n    {...asp('Venus','sextile','Sun',.01),direction:'shared',phase:'exact',phase_basis:'sampled_near_exact',reference_date:'2027-01-15',calendar_month:'2027-01',source_path:'progressed_synastry.progressed_to_progressed',relationship_domains:['affection_attraction','identity_direction'],stage_hints:['emotional_reactivation','contact_recontact']},\n    {...asp('Moon','square','Mercury',.07,'challenging'),direction:'relationship_itself',phase:'applying',phase_basis:'monthly_orb_trend',reference_date:'2027-01-15',calendar_month:'2027-01',source_path:'progressed_composite.to_natal_composite',relationship_domains:['emotion','communication'],stage_hints:['emotional_reactivation','contact_recontact','relationship_rebuilding']},\n  ]},\n  advanced:{''')
rep(rtest,
    '''  assert.ok(out.evidence.some(e=>e.layer==='dimension.in_person_meeting'))\n})''',
    '''  assert.ok(out.evidence.some(e=>e.layer==='dimension.in_person_meeting'))\n  const directional=out.evidence.find(e=>e.layer==='progressed_synastry.counterpart_to_user')\n  assert.equal(directional?.direction,'incoming')\n  assert.equal(directional?.phase,'applying')\n  assert.ok(directional?.facts.some(x=>x.includes('house=whole:12')) )\n  assert.ok(directional?.facts.some(x=>x.includes('directional_activation_not_private_feeling=true')))\n  assert.ok(out.evidence.some(e=>e.direction==='relationship_itself'&&e.layer==='progressed_composite.to_natal_composite'))\n})''')

contract = "web/src/lib/relationshipReunionV2.contract.test.mjs"
rep(contract,
    '''assert.match(server,/REUNION_VERSION="relationship-v12\\.4-stage-grounded-narrative"/)''',
    '''assert.match(server,/REUNION_VERSION="relationship-v12\\.5-directional-evidence-narrative"/)''')
rep(contract,
    '''assert.match(cache,/relationship-v12\\.4-stage-grounded-narrative-v1/)''',
    '''assert.match(cache,/relationship-v12\\.5-directional-evidence-narrative-v1/)''')
rep(contract,
    '''  assert.match(server,/repeat_risks는 현재 단계와 직접 연결되는 근거가 있는 문제만 최대 2개/)''',
    '''  assert.match(server,/repeat_risks는 현재 단계와 직접 연결되는 근거가 있는 문제만 최대 2개/)\n  assert.match(server,/counterpart_to_user=상대 진행차트가 사용자 출생차트를 자극하는 방향/)\n  assert.match(server,/계산 근거 → 쉬운 뜻 → 실제 관계에서 나타날 수 있는 장면 → 함께 걸리는 반대\\/제약 근거 → 종합/)\n  assert.match(server,/applying은 앞으로 강해지는 배경/)''')

pipeline = "web/src/lib/relationshipEvidencePipeline.test.mjs"
rep(pipeline,
    '''assert.match(edge, /VERSION="relationship-v11\\.8-provisional-time-reference"/)\n  assert.match(edge, /REUNION_VERSION="relationship-v12\\.4-stage-grounded-narrative"/)\n  assert.match(cache, /RELATIONSHIP_AI_CACHE_CONTRACT = 'relationship-v11\\.8-provisional-time-reference'/)\n  assert.match(cache, /RELATIONSHIP_REUNION_AI_CACHE_CONTRACT = 'relationship-v12\\.4-stage-grounded-narrative-v1'/)''',
    '''assert.match(edge, /VERSION="relationship-v11\\.8-provisional-time-reference"/)\n  assert.match(edge, /REUNION_VERSION="relationship-v12\\.5-directional-evidence-narrative"/)\n  assert.match(cache, /RELATIONSHIP_AI_CACHE_CONTRACT = 'relationship-v11\\.8-provisional-time-reference'/)\n  assert.match(cache, /RELATIONSHIP_REUNION_AI_CACHE_CONTRACT = 'relationship-v12\\.5-directional-evidence-narrative-v1'/)''')

print('reunion interpretation vNext patch applied')
