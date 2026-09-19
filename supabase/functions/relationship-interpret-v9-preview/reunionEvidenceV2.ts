export const REUNION_EVIDENCE_VERSION = 'reunion-evidence-v2.4-return-neutral-direction'

type QuestionKey = 'why_reconnect' | 'initiative' | 'timing' | 'rebuild' | 'repeat_risks'
type EvidenceRole = 'support' | 'counter' | 'context'

type Evidence = {
  id: string
  question: QuestionKey
  layer: string
  family: string
  independence_group: string
  role: EvidenceRole
  direction?: 'incoming' | 'outgoing' | 'shared' | null
  period?: string | null
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
  const directionFor = (person: string): Evidence['direction'] => person === 'counterpart' ? 'incoming' : person === 'user' ? 'outgoing' : 'shared'
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
    if (ps?.available) {
      for (const a of arr(ps.user_progressed_to_partner_natal).slice(0,3)) addAspect(items,'initiative','progressed_synastry.user_to_partner','secondary','secondary_progression',a,undefined,period,'outgoing')
      for (const a of arr(ps.partner_progressed_to_user_natal).slice(0,3)) addAspect(items,'initiative','progressed_synastry.partner_to_user','secondary','secondary_progression',a,undefined,period,'incoming')
      for (const a of arr(ps.progressed_to_progressed).slice(0,3)) addAspect(items,'timing','progressed_synastry.progressed_to_progressed','secondary','secondary_progression',a,undefined,period,'shared')
    }
    const pc = m?.progressed_composite
    if (pc?.available) for (const a of arr(pc.to_natal_composite_aspects).slice(0,4)) addAspect(items,'rebuild','progressed_composite','secondary','secondary_composite',a,undefined,period,'shared')
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
  const gateAvailable = incomingGate.qualified !== outgoingGate.qualified && (incomingGate.qualified || outgoingGate.qualified)
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
    progressed_synastry: arr(adv?.months).some(m=>m?.progressed_synastry?.available), progressed_composite:arr(adv?.months).some(m=>m?.progressed_composite?.available), marks_tertiary:arr(adv?.months).some(m=>m?.marks_tertiary?.available), daily_transit:arr(packet?.transit_triggers?.top_days).length>0,
    solar_return: Boolean(packet?.reunion_return_support?.solar_return?.user?.available || packet?.reunion_return_support?.solar_return?.counterpart?.available),
    lunar_return: Boolean(packet?.reunion_return_support?.lunar_return?.user?.available || packet?.reunion_return_support?.lunar_return?.counterpart?.available),
  }
  return {version:REUNION_EVIDENCE_VERSION,policy:'Question-first evidence matrix. Convergence requires at least two independent families aligned as support or counter evidence; context and derived duplicates are not additive probabilities. Emotion, contact, meeting, and reunion are separate stages. Progression is period context; exact dates require fast triggers. Solar Return is annual background and Lunar Return is monthly/emotional background. Return context may cross-check or break ties among dates that already passed the fast-trigger gate, but never creates an exact date and never adds an independent convergence vote against the same underlying transit phenomenon. Return activation is non-directional and cannot identify who contacts first. In user-facing prose, do not re-explain the same aspect across multiple questions, prefer Korean planet/aspect names, and display angular precision to 0.01° with values below 0.01° shown as <0.01°.',coverage,questions,evidence:evidence.slice(0,36),convergence,initiative_gate}
}
