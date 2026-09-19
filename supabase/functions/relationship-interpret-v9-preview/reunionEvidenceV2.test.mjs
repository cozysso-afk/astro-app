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
  assert.equal(out.version,'reunion-evidence-v2.5-return-prompt-compact')
  assert.match(out.policy,/Emotion, contact, meeting, and reunion are separate stages/i)
  for(const key of ['natal_synastry','house_overlays','midpoint_composite','davison','marks','progressed_synastry','progressed_composite','marks_tertiary','daily_transit']) assert.equal(out.coverage[key],true,key)
  for(const q of ['why_reconnect','initiative','timing','rebuild','repeat_risks']) assert.ok(out.questions[q].evidence_refs.length>0,q)
  const rebuild=out.convergence.find(x=>x.question==='rebuild'&&x.role==='support')
  assert.ok(rebuild)
  assert.ok(rebuild.independent_groups.length>=2)
  assert.equal(out.initiative_gate.available,false)
  assert.equal(out.initiative_gate.verdict,'undetermined')
  assert.ok(out.evidence.some(e=>e.layer==='dimension.in_person_meeting'))
})

test('solar and lunar returns stay context-only and cannot create a convergence vote',()=>{
  const p=exactPacket()
  const solarEvent={window_start:'2026-03-21',window_end_exclusive:'2027-03-21',activation_score:58,balance:'supportive',precision:'exact',top_aspects:[asp('Venus','trine','Moon',.3)]}
  const lunarEvent={window_start:'2026-12-29',window_end_exclusive:'2027-01-26',activation_score:62,balance:'mixed',precision:'exact',top_aspects:[asp('Mercury','sextile','Venus',.2)]}
  p.reunion_return_support={
    engine:'relationship-return-v1.1-bounded-context-presentation',
    solar_return:{user:{available:true,events:[solarEvent]},counterpart:{available:true,events:[solarEvent]}},
    lunar_return:{user:{available:true,events:[lunarEvent]},counterpart:{available:true,events:[lunarEvent]}},
    monthly_context:Array.from({length:12},(_,i)=>({calendar_month:`2027-${String(i+1).padStart(2,'0')}`,huge:'x'.repeat(4000)})),
    candidate_dates:[{date:'2027-01-05',exact_date_basis:'fast_transit_trigger',fast_trigger_score:76,priority_index:73,return_context:{background_score:56,solar_return:{pair_activation_score:55,shared_activation:true},lunar_return:{pair_activation_score:57,shared_activation:false}}}],
  }
  const before=JSON.stringify(p.reunion_return_support).length
  const out=buildReunionEvidenceV2(p)
  assert.equal(out.coverage.solar_return,true)
  assert.equal(out.coverage.lunar_return,true)
  const returns=out.evidence.filter(e=>e.family==='return')
  assert.ok(returns.length>=5)
  assert.ok(returns.every(e=>e.role==='context'))
  assert.ok(returns.every(e=>e.direction==='shared'))
  assert.ok(returns.every(e=>e.question!=='initiative'))
  assert.ok(returns.some(e=>e.date==='2027-01-05'))
  assert.equal(out.convergence.some(x=>x.independent_groups.some(g=>g.includes('return'))),false)
  assert.match(out.policy,/never creates an exact date/i)
  const after=JSON.stringify(p.reunion_return_support).length
  assert.ok(after < before/4)
  assert.equal('monthly_context' in p.reunion_return_support,false)
  assert.equal(p.reunion_return_support.candidate_dates[0].exact_date_basis,'fast_transit_trigger')
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

test('direction gate opens only when two independent action families align on one side',()=>{
  const p=exactPacket()
  p.advanced.months[0].marks_tertiary.counterpart.to_base_marks_aspects=[]
  const out=buildReunionEvidenceV2(p)
  assert.equal(out.initiative_gate.available,true)
  assert.equal(out.initiative_gate.verdict,'user_to_counterpart')
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
  p.house_overlays={available:false}
  p.advanced.composite={available:false}
  p.reunion_secondary_support.months[0].dimensions.emotional_reactivation.evidence=[asp('Venus','square','Moon',.4,'challenging')]
  const out=buildReunionEvidenceV2(p)
  assert.ok(out.questions.why_reconnect.support_refs.length>0)
  assert.ok(out.questions.why_reconnect.counter_refs.length>0)
  assert.equal(out.convergence.some(x=>x.question==='why_reconnect'),false)
  assert.equal(out.convergence.some(x=>x.question==='repeat_risks'),false)
})