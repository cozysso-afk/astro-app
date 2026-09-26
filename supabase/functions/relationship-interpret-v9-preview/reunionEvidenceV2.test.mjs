import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReunionEvidenceV2 } from './reunionEvidenceV2.ts'

const asp=(a,aspect,b,orb=.2,tone='supportive')=>({a,aspect,b,orb,tone})
const stat=(average,date='2027-01-05')=>({average,band:'상승',best_days:[{date,score:average}],caution_days:[]})

function exactPacket(){return {
  focus:{
    attraction_romance:[asp('Venus','trine','Mars',.18)],
    communication:[asp('Mercury','sextile','Mercury',.31)],
    stability_commitment:[asp('Saturn','trine','Venus',.44)],
    conflict_reactivity:[asp('Mars','square','Uranus',.22,'challenging')],
  },
  house_overlays:{available:true,user_in_counterpart:{relationship_houses:[{planet:'Venus',whole_house:7,placidus_house:7}]},counterpart_in_user:{relationship_houses:[{planet:'Moon',whole_house:4,placidus_house:4}]}},
  reunion_evidence_contract:{version:'reunion-evidence-contract-v1',available:true,evidence:[
    {...asp('Mercury','conjunction','Sun',.10),direction:'counterpart_to_user',phase:'applying',phase_basis:'monthly_orb_trend',reference_date:'2027-01-15',calendar_month:'2027-01',source_path:'progressed_synastry.counterpart_to_user',relationship_domains:['communication','identity_direction'],stage_hints:['contact_recontact'],target_house:{whole_house:12,quadrant_house:12}},
    {...asp('Venus','sextile','Sun',.01),direction:'shared',phase:'exact',phase_basis:'sampled_near_exact',reference_date:'2027-01-15',calendar_month:'2027-01',source_path:'progressed_synastry.progressed_to_progressed',relationship_domains:['affection_attraction','identity_direction'],stage_hints:['emotional_reactivation','contact_recontact']},
    {...asp('Moon','square','Mercury',.07,'challenging'),direction:'relationship_itself',phase:'applying',phase_basis:'monthly_orb_trend',reference_date:'2027-01-15',calendar_month:'2027-01',source_path:'progressed_composite.to_natal_composite',relationship_domains:['emotion','communication'],stage_hints:['emotional_reactivation','contact_recontact','relationship_rebuilding']},
  ]},
  advanced:{
    composite:{available:true,chart:{positions:{Sun:{lon:100,sign:'Cancer'},Venus:{lon:120,sign:'Leo'},Saturn:{lon:280,sign:'Capricorn'}}}},
    davison:{available:true,chart:{positions:{Sun:{lon:101,sign:'Cancer'},Mercury:{lon:130,sign:'Leo'},Saturn:{lon:281,sign:'Capricorn'}}}},
    marks:{available:true,user:{positions:{Sun:{lon:10,sign:'Aries'},Venus:{lon:40,sign:'Taurus'}}},counterpart:{positions:{Sun:{lon:190,sign:'Libra'},Mars:{lon:220,sign:'Scorpio'}}}},
    months:[{calendar_month:'2027-01',progressed_synastry:{available:true,user_progressed_to_partner_natal:[asp('Mercury','trine','Venus',.2)],partner_progressed_to_user_natal:[asp('Venus','sextile','Mercury',.3)],progressed_to_progressed:[asp('Mercury','trine','Mercury',.4)]},progressed_composite:{available:true,to_natal_composite_aspects:[asp('Sun','trine','Saturn',.35)]},marks_tertiary:{available:true,user:{to_base_marks_aspects:[asp('Mercury','sextile','Venus',.5)]},counterpart:{to_base_marks_aspects:[asp('Venus','trine','Moon',.4)]},directional_cross_aspects:[asp('Mercury','trine','Venus',.3)]}}]
  },
  directional:{incoming:stat(68.3,'2027-01-21'),outgoing:stat(53.9,'2026-10-21'),reconnection:stat(61.1,'2027-01-05')},
  reunion_dimensions:{emotional_reactivation:{reconnection:stat(59)},contact_recontact:{reconnection:stat(64)},in_person_meeting:{reconnection:stat(51)},relationship_rebuilding:{reconnection:stat(42)}},
  reunion_secondary_support:{months:[{calendar_month:'2027-01',dimensions:{emotional_reactivation:{evidence:[asp('Venus','sextile','Moon',.4)]},contact_recontact:{evidence:[asp('Mercury','trine','Venus',.2)]},in_person_meeting:{evidence:[asp('Venus','trine','Mars',.3)]},relationship_rebuilding:{evidence:[asp('Saturn','trine','Venus',.5)]}}}]},
  transit_triggers:{top_days:[{date:'2027-01-05',hits:[{person:'counterpart',transit:'Mercury',a:'Mercury',aspect:'trine',target:'Venus',b:'Venus',orb:.2,tone:'supportive'}]}]}
}}

test('maps every available relationship layer into question-first four-stage evidence',()=>{
  const out=buildReunionEvidenceV2(exactPacket())
  assert.equal(out.version,'reunion-evidence-v2.7-directional-contract')
  assert.match(out.policy,/Emotion, contact, meeting, and reunion are separate stages/i)
  for(const key of ['natal_synastry','house_overlays','midpoint_composite','davison','marks','progressed_synastry','progressed_composite','marks_tertiary','daily_transit']) assert.equal(out.coverage[key],true,key)
  for(const q of ['why_reconnect','initiative','timing','rebuild','repeat_risks']) assert.ok(out.questions[q].evidence_refs.length>0,q)
  const rebuild=out.convergence.find(x=>x.question==='rebuild'&&x.role==='support')
  assert.ok(rebuild)
  assert.ok(rebuild.independent_groups.length>=2)
  assert.equal(out.initiative_gate.available,false)
  assert.equal(out.initiative_gate.verdict,'undetermined')
  assert.ok(out.evidence.some(e=>e.layer==='dimension.in_person_meeting'))
  const directional=out.evidence.find(e=>e.layer==='progressed_synastry.counterpart_to_user')
  assert.equal(directional?.direction,'incoming')
  assert.equal(directional?.phase,'applying')
  assert.ok(directional?.facts.some(x=>x.includes('house=whole:12')) )
  assert.ok(directional?.facts.some(x=>x.includes('directional_activation_not_private_feeling=true')))
  assert.ok(out.evidence.some(e=>e.direction==='relationship_itself'&&e.layer==='progressed_composite.to_natal_composite'))
})

test('solar and lunar returns stay context-only and prompt copies shed duplicated bulk',()=>{
  const p=exactPacket()
  const solarEvent={window_start:'2026-03-21',window_end_exclusive:'2027-03-21',activation_score:58,balance:'supportive',precision:'exact',top_aspects:[asp('Venus','trine','Moon',.3),asp('Mercury','sextile','Venus',.2),asp('Mars','trine','Sun',.4)]}
  const lunarEvent={window_start:'2026-12-29',window_end_exclusive:'2027-01-26',activation_score:62,balance:'mixed',precision:'exact',top_aspects:[asp('Mercury','sextile','Venus',.2),asp('Venus','trine','Moon',.3),asp('Mars','square','Saturn',.4,'challenging')]}
  p.reunion_return_support={
    engine:'relationship-return-v1.1-bounded-context-presentation',
    solar_return:{user:{available:true,events:Array.from({length:8},()=>solarEvent)},counterpart:{available:true,events:Array.from({length:8},()=>solarEvent)}},
    lunar_return:{user:{available:true,events:Array.from({length:16},()=>lunarEvent)},counterpart:{available:true,events:Array.from({length:16},()=>lunarEvent)}},
    monthly_context:Array.from({length:12},(_,i)=>({calendar_month:`2027-${String(i+1).padStart(2,'0')}`,huge:'x'.repeat(4000)})),
    candidate_dates:Array.from({length:16},(_,i)=>({date:`2027-01-${String(i+1).padStart(2,'0')}`,stages:['contact_recontact'],exact_date_basis:'fast_transit_trigger',fast_trigger_score:76-i,priority_index:73-i,return_context:{background_score:56,solar_return:{pair_activation_score:55,shared_activation:true},lunar_return:{pair_activation_score:57,shared_activation:false}}})),
    policy:'Return context '.repeat(100),
  }
  p.reunion_timing_windows={
    policy:'Timing windows '.repeat(120),
    windows:Array.from({length:24},(_,i)=>({
      date:`2027-02-${String((i%24)+1).padStart(2,'0')}`,
      stage:['emotional_reactivation','contact_recontact','in_person_meeting','relationship_rebuilding'][i%4],
      label:'very long timing label '.repeat(10),activation:80-i,rank_weight:88-i,
      fast_evidence:Array.from({length:5},()=>({...asp('Mercury','trine','Venus',.2),noise:'x'.repeat(2000)})),
      period_support:Array.from({length:5},()=>({...asp('Venus','sextile','Moon',.3),noise:'x'.repeat(2000)})),
      independent_systems:['daily_transit','secondary_progression','duplicate'],independent_system_count:2,convergence:true,exact_date_basis:'fast_transit_trigger',event_probability:'not_calculated',
    })),
  }
  for(const key of ['emotional_reactivation','contact_recontact','in_person_meeting','relationship_rebuilding']) {
    p.reunion_dimensions[key]={...p.reunion_dimensions[key],incoming:stat(55),outgoing:stat(52),reconnection:stat(60),top_evidence:Array.from({length:8},(_,i)=>({date:`2027-03-${String(i+1).padStart(2,'0')}`,score:70-i,user_score:50,counterpart_score:55,user_evidence:Array.from({length:3},()=>({...asp('Venus','trine','Mars'),noise:'x'.repeat(1500)})),counterpart_evidence:Array.from({length:3},()=>({...asp('Mercury','sextile','Venus'),noise:'x'.repeat(1500)})),exact_date_basis:'fast_transit_trigger'}))}
  }
  const before=JSON.stringify(p).length
  const out=buildReunionEvidenceV2(p)
  assert.equal(out.coverage.solar_return,true)
  assert.equal(out.coverage.lunar_return,true)
  const returns=out.evidence.filter(e=>e.family==='return')
  assert.ok(returns.length>=5)
  assert.ok(returns.every(e=>e.role==='context'))
  assert.ok(returns.every(e=>e.direction==='shared'))
  assert.ok(returns.every(e=>e.question!=='initiative'))
  assert.equal(out.convergence.some(x=>x.independent_groups.some(g=>g.includes('return'))),false)
  assert.match(out.policy,/never creates an exact date/i)
  const after=JSON.stringify(p).length
  assert.ok(after < before/5,`expected strong prompt compaction: ${before} -> ${after}`)
  assert.equal('monthly_context' in p.reunion_return_support,false)
  assert.ok(p.reunion_return_support.solar_return.user.events.length<=2)
  assert.ok(p.reunion_return_support.lunar_return.user.events.length<=4)
  assert.ok(p.reunion_return_support.candidate_dates.length<=8)
  assert.equal(p.reunion_secondary_support.represented_in,'reunion_evidence_v2')
  assert.equal('months' in p.reunion_secondary_support,false)
  assert.ok(p.reunion_timing_windows.windows.length<=16)
  assert.ok(p.reunion_timing_windows.windows.every(row=>row.fast_evidence.length<=2&&row.period_support.length<=2))
  assert.ok(p.reunion_timing_windows.windows.some(row=>row.stage==='relationship_rebuilding'))
  assert.ok(p.reunion_dimensions.contact_recontact.top_evidence.every(row=>!('user_evidence' in row)&&!('counterpart_evidence' in row)))
})

test('does not invent exact-time layers when unavailable',()=>{
  const p=exactPacket(); p.house_overlays={available:false}; p.advanced.davison={available:false}; p.advanced.marks={available:false}; p.advanced.months[0].marks_tertiary={available:false}
  const out=buildReunionEvidenceV2(p)
  assert.equal(out.coverage.house_overlays,false)
  assert.equal(out.coverage.davison,false)
  assert.equal(out.coverage.marks,false)
  assert.equal(out.coverage.marks_tertiary,false)
  assert.equal(out.evidence.some(e=>['davison','marks.user','marks.counterpart'].includes(e.layer)),false)
})

test('side activation metrics alone never open the first-contact direction gate',()=>{
  const p=exactPacket()
  p.advanced.months[0].progressed_synastry.user_progressed_to_partner_natal=[]
  p.advanced.months[0].progressed_synastry.partner_progressed_to_user_natal=[]
  p.advanced.months[0].marks_tertiary.user.to_base_marks_aspects=[]
  p.advanced.months[0].marks_tertiary.counterpart.to_base_marks_aspects=[]
  p.directional.incoming=stat(99)
  p.directional.outgoing=stat(10)
  const out=buildReunionEvidenceV2(p)
  assert.equal(out.initiative_gate.available,false)
  assert.equal(out.initiative_gate.verdict,'undetermined')
})

test('progression and derived Marks activation do not establish first-contact direction',()=>{
  const p=exactPacket()
  delete p.reunion_evidence_contract
  p.advanced.months[0].marks_tertiary.counterpart.to_base_marks_aspects=[]
  const out=buildReunionEvidenceV2(p)
  assert.equal(out.initiative_gate.available,false)
  assert.equal(out.initiative_gate.verdict,'undetermined')
  assert.deepEqual(new Set(out.initiative_gate.outgoing.independent_groups),new Set(['secondary_progression','marks_tertiary']))
})

test('keeps conflicting natal evidence as counter evidence instead of averaging it away',()=>{
  const out=buildReunionEvidenceV2(exactPacket())
  const riskRefs=out.questions.repeat_risks.counter_refs
  assert.ok(riskRefs.length>0)
  assert.ok(out.evidence.some(e=>riskRefs.includes(e.id)&&e.aspect.includes('Mars square Uranus')))
})

test('convergence requires independent evidence aligned to the same role',()=>{
  const p=exactPacket()
  delete p.reunion_evidence_contract
  p.house_overlays={available:false}
  p.advanced.composite={available:false}
  p.reunion_secondary_support.months[0].dimensions.emotional_reactivation.evidence=[asp('Venus','square','Moon',.4,'challenging')]
  const out=buildReunionEvidenceV2(p)
  assert.ok(out.questions.why_reconnect.support_refs.length>0)
  assert.ok(out.questions.why_reconnect.counter_refs.length>0)
  assert.equal(out.convergence.some(x=>x.question==='why_reconnect'),false)
  assert.equal(out.convergence.some(x=>x.question==='repeat_risks'),false)
})
