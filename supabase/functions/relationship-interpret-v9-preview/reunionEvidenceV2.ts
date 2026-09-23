export const REUNION_EVIDENCE_VERSION = 'reunion-evidence-v2.7-directional-contract'

type QuestionKey = 'why_reconnect' | 'initiative' | 'timing' | 'rebuild' | 'repeat_risks'
type EvidenceRole = 'support' | 'counter' | 'context'

type Evidence = {
  id: string
  question: QuestionKey
  layer: string
  family: string
  independence_group: string
  role: EvidenceRole
  direction?: 'incoming' | 'outgoing' | 'shared' | 'relationship_itself' | null
  period?: string | null
  phase?: string | null
  date?: string | null
  aspect?: string | null
  orb?: number | null
  tone?: string | null
  facts?: string[]
}

const QUESTION_KEYS: QuestionKey[] = ['why_reconnect','initiative','timing','rebuild','repeat_risks']
const arr = (v: unknown): any[] => Array.isArray(v) ? v : []
const num = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : null
const short = (v: unknown, n=120) => String(v ?? '').trim().slice(0,n)

function aspectText(a: any) {
  if (!a || typeof a !== 'object') return ''
  const left = short(a.a, 40), rel = short(a.aspect, 40), right = short(a.b, 40)
  return [left, rel, right].filter(Boolean).join(' ')
}

function chartFacts(chart: any, limit=6) {
  const p = chart?.positions ?? {}
  const preferred = ['Sun','Moon','Mercury','Venus','Mars','Saturn','Jupiter','Uranus','Neptune','Pluto','True Node']
  return preferred.filter(k => p?.[k]).slice(0,limit).map(k => {
    const x = p[k] ?? {}
    const sign = x.sign ? ` ${x.sign}` : ''
    const house = x.house ? ` H${x.house}` : ''
    const lon = num(x.lon)
    return `${k}${sign}${house}${lon === null ? '' : ` ${lon.toFixed(1)}°`}`
  })
}

function keyFor(e: Evidence) {
  return [e.question,e.independence_group,e.layer,e.direction ?? '',e.period ?? '',e.date ?? '',e.aspect ?? '',e.orb ?? ''].join('|')
}

function priority(e: Evidence) {
  const family = ({natal:90,secondary:100,relationship_chart:82,house:76,transit:68,return:66,tertiary:58,metric:64} as Record<string,number>)[e.family] ?? 50
  const role = e.role === 'support' ? 4 : e.role === 'counter' ? 3 : 0
  const tight = typeof e.orb === 'number' ? Math.max(0, 8 - e.orb * 3) : 0
  return family + role + tight
}

function makeEvidence(input: Omit<Evidence,'id'>, idx: number): Evidence {
  return { ...input, id: `R2:${input.question}:${input.layer}:${idx}` }
}

function addAspect(items: Evidence[], question: QuestionKey, layer: string, family: string, group: string, a: any, role?: EvidenceRole, period?: string, direction?: Evidence['direction']) {
  const text = aspectText(a)
  if (!text) return
  items.push(makeEvidence({question,layer,family,independence_group:group,role:role ?? (a?.tone === 'challenging' ? 'counter' : 'support'),direction:direction ?? null,period:period ?? null,date:null,aspect:text,orb:num(a?.orb),tone:a?.tone ?? null,facts:[]}, items.length+1))
}

function addChart(items: Evidence[], question: QuestionKey, layer: string, group: string, chart: any, role: EvidenceRole='context', direction?: Evidence['direction']) {
  const facts = chartFacts(chart)
  if (!facts.length) return
  items.push(makeEvidence({question,layer,family:'relationship_chart',independence_group:group,role,direction:direction ?? null,period:null,date:null,aspect:null,orb:null,tone:null,facts}, items.length+1))
}

function addMetric(items: Evidence[], question: QuestionKey, layer: string, group: string, stat: any, direction: Evidence['direction']) {
  if (!stat || typeof stat !== 'object') return
  const avg = num(stat.average)
  if (avg === null) return
  const best = arr(stat.best_days).slice(0,3).map(x => `${x?.date}:${Number(x?.score ?? 0).toFixed(1)}`)
  items.push(makeEvidence({question,layer,family:'metric',independence_group:group,role:'context',direction,period:null,date:best[0]?.split(':')[0] ?? null,aspect:null,orb:null,tone:null,facts:[`average=${avg.toFixed(1)}`,`band=${short(stat.band,30)}`,...best]}, items.length+1))
}

function addReturnContext(items: Evidence[], packet: any) {
  const support = packet?.reunion_return_support
  if (!support || typeof support !== 'object' || support?.available === false) return
  const addEvents = (kind: 'solar_return'|'lunar_return', group: string, question: QuestionKey) => {
    const block = support?.[kind] ?? {}
    for (const person of ['user','counterpart']) {
      for (const row of arr(block?.[person]?.events).slice(0,8)) {
        const score = num(row?.activation_score)
        const start = short(row?.window_start, 16)
        const end = short(row?.window_end_exclusive, 16)
        const facts = [
          `${kind} background=${score === null ? '-' : score.toFixed(1)}`,
          `balance=${short(row?.balance,24)}`,
          `precision=${short(row?.precision,24)}`,
          `independent_bonus_eligible=false`,
          `directional_use=forbidden`,
          ...arr(row?.top_aspects).slice(0,3).map((a:any)=>`${aspectText(a)} orb=${Number(a?.orb ?? 0).toFixed(2)}°`),
        ]
        items.push(makeEvidence({
          question, layer:`return.${kind}.${person}`, family:'return', independence_group:group,
          role:'context', direction:'shared', period:start && end ? `${start}..${end}` : start || null,
          date:null, aspect:null, orb:null, tone:row?.balance ?? null, facts,
        }, items.length+1))
      }
    }
  }
  addEvents('solar_return','solar_return_context','why_reconnect')
  addEvents('solar_return','solar_return_context','rebuild')
  addEvents('lunar_return','lunar_return_context','timing')

  for (const row of arr(support?.candidate_dates).slice(0,10)) {
    if (!row?.date || row?.exact_date_basis !== 'fast_transit_trigger') continue
    const bg = num(row?.return_context?.background_score)
    items.push(makeEvidence({
      question:'timing', layer:'return.candidate_context', family:'return', independence_group:'return_context_annotation',
      role:'context', direction:'shared', period:null, date:short(row.date,16), aspect:null, orb:null, tone:null,
      facts:[
        `fast_trigger_score=${Number(row?.fast_trigger_score ?? 0).toFixed(1)}`,
        `return_background=${bg === null ? '-' : bg.toFixed(1)}`,
        `priority_index=${Number(row?.priority_index ?? 0).toFixed(1)}`,
        'return_role=background_tiebreaker_only',
        'independent_bonus_eligible=false',
      ],
    }, items.length+1))
  }
}

function compactReturnAspect(a: any) {
  if (!a || typeof a !== 'object') return null
  return {a:short(a?.a,24),aspect:short(a?.aspect,24),b:short(a?.b,24),orb:num(a?.orb),tone:short(a?.tone,16)}
}

function compactReturnEvent(row: any) {
  if (!row || typeof row !== 'object') return null
  return {
    window_start:short(row?.window_start,16) || null,
    window_end_exclusive:short(row?.window_end_exclusive,16) || null,
    activation_score:num(row?.activation_score),
    balance:short(row?.balance,20) || null,
    precision:short(row?.precision,20) || null,
    top_aspects:arr(row?.top_aspects).slice(0,2).map(compactReturnAspect).filter(Boolean),
  }
}

function compactReturnPerson(block: any, limit: number) {
  if (!block || typeof block !== 'object') return {available:false,events:[]}
  const events = arr(block?.events)
    .map(compactReturnEvent)
    .filter(Boolean)
    .sort((a:any,b:any)=>Number(b?.activation_score ?? 0)-Number(a?.activation_score ?? 0))
    .slice(0,limit)
  return {available:Boolean(block?.available),reason:block?.reason??null,events}
}

function compactReturnSupportForPrompt(support: any) {
  if (!support || typeof support !== 'object') return support ?? null
  const candidate_dates = arr(support?.candidate_dates).slice(0,8).map((row:any)=>({
    date:short(row?.date,16),
    stages:arr(row?.stages).slice(0,4).map((x:any)=>short(x,28)),
    fast_trigger_score:num(row?.fast_trigger_score),
    priority_index:num(row?.priority_index),
    exact_date_basis:short(row?.exact_date_basis,32),
    return_role:short(row?.return_role,40),
    return_context:{
      background_score:num(row?.return_context?.background_score),
      solar_return:{pair_activation_score:num(row?.return_context?.solar_return?.pair_activation_score),shared_activation:Boolean(row?.return_context?.solar_return?.shared_activation)},
      lunar_return:{pair_activation_score:num(row?.return_context?.lunar_return?.pair_activation_score),shared_activation:Boolean(row?.return_context?.lunar_return?.shared_activation)},
    },
  }))
  return {
    engine:short(support?.engine,64),
    period:support?.period??null,
    solar_return:{role:'annual_background',user:compactReturnPerson(support?.solar_return?.user,2),counterpart:compactReturnPerson(support?.solar_return?.counterpart,2)},
    lunar_return:{role:'monthly_emotional_background',user:compactReturnPerson(support?.lunar_return?.user,4),counterpart:compactReturnPerson(support?.lunar_return?.counterpart,4)},
    candidate_dates,
    weight_policy:support?.weight_policy??null,
    display_policy:support?.display_policy??null,
    policy:short(support?.policy,280),
    event_probability:'not_calculated',
  }
}

function compactStageStat(stat: any) {
  if (!stat || typeof stat !== 'object') return null
  return {
    average:num(stat?.average),
    band:short(stat?.band,24),
    spread:num(stat?.spread),
    best_days:arr(stat?.best_days).slice(0,3).map((row:any)=>({date:short(row?.date,16),score:num(row?.score)})),
    caution_days:arr(stat?.caution_days).slice(0,2).map((row:any)=>({date:short(row?.date,16),score:num(row?.score)})),
    exact_date_policy:short(stat?.exact_date_policy,32) || null,
  }
}

function compactDimensionsForPrompt(raw: any) {
  if (!raw || typeof raw !== 'object') return raw ?? null
  const stage = (value: any) => value && typeof value === 'object' ? {
    incoming:compactStageStat(value?.incoming),
    outgoing:compactStageStat(value?.outgoing),
    reconnection:compactStageStat(value?.reconnection),
    top_evidence:arr(value?.top_evidence).slice(0,4).map((row:any)=>({
      date:short(row?.date,16),
      score:num(row?.score),
      user_score:num(row?.user_score),
      counterpart_score:num(row?.counterpart_score),
      exact_date_basis:short(row?.exact_date_basis,32) || 'fast_transit_trigger',
    })),
  } : null
  return {
    emotional_reactivation:stage(raw?.emotional_reactivation),
    contact_recontact:stage(raw?.contact_recontact),
    in_person_meeting:stage(raw?.in_person_meeting),
    relationship_rebuilding:stage(raw?.relationship_rebuilding),
    policy:short(raw?.policy,320),
  }
}

function compactTimingEvidence(value: any) {
  if (!value || typeof value !== 'object') return null
  const a = short(value?.a ?? value?.transit,24)
  const aspect = short(value?.aspect,24)
  const b = short(value?.b ?? value?.target,24)
  if (!a && !aspect && !b) return null
  return {a,aspect,b,orb:num(value?.orb),tone:short(value?.tone,16)}
}

function compactTimingWindowsForPrompt(raw: any) {
  if (!raw || typeof raw !== 'object') return raw ?? null
  const source = arr(raw?.windows)
  const chosen: any[] = []
  const seen = new Set<string>()
  const add = (row:any) => {
    const key = `${row?.date ?? ''}|${row?.stage ?? ''}`
    if (!row || seen.has(key)) return
    seen.add(key)
    chosen.push(row)
  }
  for (const stage of ['emotional_reactivation','contact_recontact','in_person_meeting','relationship_rebuilding']) {
    source.filter((row:any)=>row?.stage===stage).slice(0,3).forEach(add)
  }
  source.forEach((row:any)=>{ if (chosen.length < 16) add(row) })
  return {
    as_of_date:raw.as_of_date, validation:raw.validation,
    windows:chosen.slice(0,16).map((row:any)=>({
      date:short(row?.date,16),
      stage:short(row?.stage,32),
      label:short(row?.label,80),
      components:row?.components, eligible:row?.eligible, start:row?.start, end:row?.end,
      activation:num(row?.activation),
      rank_weight:num(row?.rank_weight),
      fast_evidence:arr(row?.fast_evidence).slice(0,2).map(compactTimingEvidence).filter(Boolean),
      period_support:arr(row?.period_support).slice(0,2).map(compactTimingEvidence).filter(Boolean),
      independent_systems:arr(row?.independent_systems).slice(0,3).map((x:any)=>short(x,32)),
      independent_system_count:Number(row?.independent_system_count ?? 0),
      convergence:Boolean(row?.convergence),
      exact_date_basis:short(row?.exact_date_basis,32) || 'fast_transit_trigger',
      event_probability:'not_calculated',
    })),
    policy:short(raw?.policy,320),
    event_probability:'not_calculated',
  }
}

function compactSecondarySupportForPrompt(raw: any) {
  if (!raw || typeof raw !== 'object') return raw ?? null
  return {
    represented_in:'reunion_evidence_v2',
    policy:short(raw?.policy,220),
    event_probability:'not_calculated',
  }
}

function addNormalizedProgressionContract(items: Evidence[], packet: any) {
  const rows = arr(packet?.reunion_evidence_contract?.evidence)
  if (!rows.length) return false
  const directionMap: Record<string,Evidence['direction']> = {user_to_counterpart:'outgoing',counterpart_to_user:'incoming',shared:'shared',relationship_itself:'relationship_itself'}
  const questionsFor = (row:any): QuestionKey[] => {
    const domains = new Set(arr(row?.relationship_domains).map(String))
    const stages = new Set(arr(row?.stage_hints).map(String))
    const out = new Set<QuestionKey>()
    if (stages.has('emotional_reactivation') || ['emotion','affection_attraction','identity_direction','intensity_transformation'].some(x=>domains.has(x))) out.add('why_reconnect')
    if (stages.has('contact_recontact') || domains.has('communication')) out.add('initiative')
    if (stages.has('contact_recontact') || stages.has('in_person_meeting')) out.add('timing')
    if (stages.has('relationship_rebuilding') || domains.has('commitment_structure') || row?.direction === 'relationship_itself') out.add('rebuild')
    if (row?.tone === 'challenging' || domains.has('instability_uncertainty')) out.add('repeat_risks')
    return [...out]
  }
  for (const row of rows.slice(0,48)) {
    const text = aspectText(row)
    if (!text) continue
    const direction = directionMap[String(row?.direction ?? '')] ?? 'shared'
    const group = row?.direction === 'relationship_itself' ? 'secondary_composite' : 'secondary_progression'
    const house = row?.target_house && typeof row.target_house === 'object' ? `house=whole:${row.target_house.whole_house ?? '-'},quadrant:${row.target_house.quadrant_house ?? '-'}` : ''
    const facts = [
      `contract_direction=${short(row?.direction,32)}`, `phase=${short(row?.phase,20)}`, `phase_basis=${short(row?.phase_basis,32)}`,
      `reference_date=${short(row?.reference_date,16)}`, row?.exact_at ? `exact_at=${short(row.exact_at,16)}` : 'exact_at=unresolved',
      house, `domains=${arr(row?.relationship_domains).map((x:any)=>short(x,28)).join(',')}`, `stage_hints=${arr(row?.stage_hints).map((x:any)=>short(x,32)).join(',')}`,
      'directional_activation_not_private_feeling=true',
    ].filter(Boolean)
    for (const q of questionsFor(row)) {
      const role: EvidenceRole = q === 'initiative' ? 'context' : row?.tone === 'challenging' ? 'counter' : 'support'
      items.push(makeEvidence({question:q,layer:short(row?.source_path,80)||'reunion_evidence_contract',family:'secondary',independence_group:group,role,direction,period:short(row?.calendar_month ?? row?.reference_date,16)||null,date:null,aspect:text,orb:num(row?.orb),tone:row?.tone??null,phase:short(row?.phase,20)||null,facts},items.length+1))
    }
  }
  return true
}

function compact(items: Evidence[]) {
  const seen = new Set<string>(), out: Evidence[] = []
  for (const e of [...items].sort((a,b)=>priority(b)-priority(a))) {
    const k = keyFor(e)
    if (seen.has(k)) continue
    seen.add(k); out.push(e)
  }
  return out
}

export function buildReunionEvidenceV2(packet: any) {
  const items: Evidence[] = []
  const normalizedProgressionAvailable = addNormalizedProgressionContract(items, packet)
  const focus = packet?.focus ?? {}
  const focusMap: Array<[string, QuestionKey, EvidenceRole]> = [
    ['core_identity_emotion','why_reconnect','support'],['attraction_romance','why_reconnect','support'],['sexual_intimacy','why_reconnect','support'],
    ['stability_commitment','rebuild','support'],['communication','rebuild','support'],['home_marriage','rebuild','support'],
    ['conflict_reactivity','repeat_risks','counter'],['idealization_confusion','repeat_risks','counter'],['freedom_unpredictability','repeat_risks','counter'],['power_attachment','repeat_risks','counter'],
  ]
  for (const [group,q,role] of focusMap) for (const a of arr(focus?.[group]).slice(0,4)) addAspect(items,q,`natal.${group}`,'natal','natal_synastry',a,role)

  const house = packet?.house_overlays
  if (house?.available) {
    for (const [side,dir] of [['user_in_counterpart','outgoing'],['counterpart_in_user','incoming']] as const) {
      const rows = arr(house?.[side]?.relationship_houses).slice(0,5)
      if (rows.length) items.push(makeEvidence({question:'why_reconnect',layer:`house_overlays.${side}`,family:'house',independence_group:'house_overlay',role:'context',direction:dir,period:null,date:null,aspect:null,orb:null,tone:null,facts:rows.map((x:any)=>`${x.planet}: whole=${x.whole_house ?? '-'}, quadrant=${x.placidus_house ?? '-'}`)},items.length+1))
    }
  }

  const adv = packet?.advanced ?? {}
  if (adv?.composite?.available) {
    addChart(items,'why_reconnect','composite','midpoint_composite',adv.composite.chart,'context','shared')
    addChart(items,'rebuild','composite','midpoint_composite',adv.composite.chart,'context','shared')
  }
  if (adv?.davison?.available) {
    addChart(items,'rebuild','davison','davison',adv.davison.chart,'context','shared')
    addChart(items,'repeat_risks','davison','davison',adv.davison.chart,'context','shared')
  }
  if (adv?.marks?.available) {
    addChart(items,'initiative','marks.user','marks_directional',adv.marks.user,'context','outgoing')
    addChart(items,'initiative','marks.counterpart','marks_directional',adv.marks.counterpart,'context','incoming')
    addChart(items,'rebuild','marks.user','marks_directional',adv.marks.user,'context','outgoing')
    addChart(items,'rebuild','marks.counterpart','marks_directional',adv.marks.counterpart,'context','incoming')
  }

  for (const m of arr(adv?.months)) {
    const period = m?.calendar_month ?? m?.representative_date ?? null
    const ps = m?.progressed_synastry
    if (ps?.available && !normalizedProgressionAvailable) {
      for (const a of arr(ps.user_progressed_to_partner_natal).slice(0,3)) addAspect(items,'initiative','progressed_synastry.user_to_partner','secondary','secondary_progression',a,undefined,period,'outgoing')
      for (const a of arr(ps.partner_progressed_to_user_natal).slice(0,3)) addAspect(items,'initiative','progressed_synastry.partner_to_user','secondary','secondary_progression',a,undefined,period,'incoming')
      for (const a of arr(ps.progressed_to_progressed).slice(0,3)) addAspect(items,'timing','progressed_synastry.progressed_to_progressed','secondary','secondary_progression',a,undefined,period,'shared')
    }
    const pc = m?.progressed_composite
    if (pc?.available && !normalizedProgressionAvailable) for (const a of arr(pc.to_natal_composite_aspects).slice(0,4)) addAspect(items,'rebuild','progressed_composite','secondary','secondary_composite',a,undefined,period,'shared')
    const mt = m?.marks_tertiary
    if (mt?.available) {
      for (const a of arr(mt?.user?.to_base_marks_aspects).slice(0,2)) addAspect(items,'initiative','marks_tertiary.user','tertiary','marks_tertiary',a,undefined,period,'outgoing')
      for (const a of arr(mt?.counterpart?.to_base_marks_aspects).slice(0,2)) addAspect(items,'initiative','marks_tertiary.counterpart','tertiary','marks_tertiary',a,undefined,period,'incoming')
      for (const a of arr(mt?.directional_cross_aspects).slice(0,2)) addAspect(items,'timing','marks_tertiary.cross','tertiary','marks_tertiary',a,undefined,period,'shared')
    }
  }

  addMetric(items,'initiative','directional.incoming','directional_metric',packet?.directional?.incoming,'incoming')
  addMetric(items,'initiative','directional.outgoing','directional_metric',packet?.directional?.outgoing,'outgoing')
  addMetric(items,'timing','directional.reconnection','directional_metric',packet?.directional?.reconnection,'shared')

  const dims = packet?.reunion_dimensions ?? {}
  addMetric(items,'why_reconnect','dimension.emotional_reactivation','dimension_metric',dims?.emotional_reactivation?.reconnection,'shared')
  addMetric(items,'timing','dimension.contact_recontact','dimension_metric',dims?.contact_recontact?.reconnection,'shared')
  addMetric(items,'timing','dimension.in_person_meeting','dimension_metric',dims?.in_person_meeting?.reconnection,'shared')
  addMetric(items,'rebuild','dimension.relationship_rebuilding','dimension_metric',dims?.relationship_rebuilding?.reconnection,'shared')

  for (const d of arr(packet?.transit_triggers?.top_days).slice(0,8)) {
    for (const h of arr(d?.hits).slice(0,4)) {
      addAspect(items,'timing','daily_transit','transit','daily_transit',h,undefined,d?.date,h?.person === 'counterpart' ? 'incoming' : h?.person === 'user' ? 'outgoing' : 'shared')
    }
  }

  for (const m of arr(packet?.reunion_secondary_support?.months)) {
    for (const [name,q] of [['emotional_reactivation','why_reconnect'],['contact_recontact','timing'],['in_person_meeting','timing'],['relationship_rebuilding','rebuild']] as const) {
      const x = m?.dimensions?.[name]
      if (!x) continue
      for (const a of arr(x.evidence).slice(0,3)) addAspect(items,q,`secondary_support.${name}`,'secondary','secondary_progression',a,undefined,m?.calendar_month,'shared')
    }
  }

  addReturnContext(items, packet)

  const evidence = compact(items)
  const questions = Object.fromEntries(QUESTION_KEYS.map(q => {
    const rows = evidence.filter(e => e.question === q).slice(0,8)
    return [q,{evidence_refs:rows.map(e=>e.id),support_refs:rows.filter(e=>e.role==='support').map(e=>e.id),counter_refs:rows.filter(e=>e.role==='counter').map(e=>e.id),families:[...new Set(rows.map(e=>e.independence_group))]}]
  }))
  const convergence = QUESTION_KEYS.flatMap(q => {
    const qrows = evidence.filter(e=>e.question===q)
    return (['support','counter'] as const).flatMap(role => {
      const aligned = qrows.filter(e=>e.role===role)
      const groups = [...new Set(aligned.map(e=>e.independence_group))]
      return groups.length >= 2 ? [{question:q,role,independent_groups:groups,evidence_refs:aligned.filter(e=>groups.includes(e.independence_group)).slice(0,6).map(e=>e.id)}] : []
    })
  })
  const actionTerms = ['Mercury','Venus','Mars','Sun']
  const directionalRows = evidence.filter(e => e.question === 'initiative' && (e.direction === 'incoming' || e.direction === 'outgoing') && e.aspect && (e.independence_group === 'secondary_progression' || e.independence_group === 'marks_tertiary') && actionTerms.some(term => String(e.aspect).includes(term)))
  const gateSide = (direction: 'incoming'|'outgoing') => {
    const rows = directionalRows.filter(e => e.direction === direction)
    const groups = [...new Set(rows.map(e=>e.independence_group))]
    return {independent_groups:groups,evidence_refs:rows.slice(0,6).map(e=>e.id),qualified:groups.length>=2}
  }
  const incomingGate = gateSide('incoming'), outgoingGate = gateSide('outgoing')
  const gateAvailable = false // Chart-side activation and Marks direction are not observed action direction.
  const initiative_gate = {
    available: gateAvailable,
    verdict: gateAvailable ? (incomingGate.qualified ? 'counterpart_to_user' : 'user_to_counterpart') : 'undetermined',
    incoming: incomingGate,
    outgoing: outgoingGate,
    policy: 'Side-level transit metrics are excluded. A first-move direction requires at least two independent directional action families aligned on one side; otherwise the result is undetermined.',
  }

  const coverage = {
    natal_synastry: evidence.some(e=>e.independence_group==='natal_synastry'),
    house_overlays: Boolean(house?.available), midpoint_composite:Boolean(adv?.composite?.available), davison:Boolean(adv?.davison?.available), marks:Boolean(adv?.marks?.available),
    progressed_synastry: normalizedProgressionAvailable || arr(adv?.months).some(m=>m?.progressed_synastry?.available), progressed_composite: normalizedProgressionAvailable || arr(adv?.months).some(m=>m?.progressed_composite?.available), marks_tertiary:arr(adv?.months).some(m=>m?.marks_tertiary?.available), daily_transit:arr(packet?.transit_triggers?.top_days).length>0,
    solar_return: Boolean(packet?.reunion_return_support?.solar_return?.user?.available || packet?.reunion_return_support?.solar_return?.counterpart?.available),
    lunar_return: Boolean(packet?.reunion_return_support?.lunar_return?.user?.available || packet?.reunion_return_support?.lunar_return?.counterpart?.available),
  }
  if (packet && typeof packet === 'object') {
    if (packet.reunion_return_support) packet.reunion_return_support = compactReturnSupportForPrompt(packet.reunion_return_support)
    if (packet.reunion_timing_windows) packet.reunion_timing_windows = compactTimingWindowsForPrompt(packet.reunion_timing_windows)
    if (packet.reunion_dimensions) packet.reunion_dimensions = compactDimensionsForPrompt(packet.reunion_dimensions)
    if (packet.reunion_secondary_support) packet.reunion_secondary_support = compactSecondarySupportForPrompt(packet.reunion_secondary_support)
  }
  return {version:REUNION_EVIDENCE_VERSION,policy:'Question-first evidence matrix. Normalized reunion progression evidence preserves direction, monthly phase, house context, relationship domains, and stage hints without treating directional activation as observed private feeling or action.  Convergence requires at least two independent families aligned as support or counter evidence; context and derived duplicates are not additive probabilities. Emotion, contact, meeting, and reunion are separate stages. Progression is period context; exact dates require fast triggers. Solar Return is annual background and Lunar Return is monthly/emotional background. Return context may cross-check or break ties among dates that already passed the fast-trigger gate, but never creates an exact date and never adds an independent convergence vote against the same underlying transit phenomenon. Return activation is non-directional and cannot identify who contacts first. In user-facing prose, do not re-explain the same aspect across multiple questions, prefer Korean planet/aspect names, and display angular precision to 0.01° with values below 0.01° shown as <0.01°.',coverage,questions,evidence:evidence.slice(0,64),convergence,initiative_gate}
}
