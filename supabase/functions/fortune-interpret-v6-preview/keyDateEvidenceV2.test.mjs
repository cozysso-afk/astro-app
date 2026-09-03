import assert from "node:assert/strict";
import test from "node:test";

import { attachActualKeyDateEvidence, KEY_DATE_LEDGER_VERSION } from "./keyDateEvidenceV2.ts";

function fixture(){
  const packet={
    western:{key_date_details:[]},
    evidence_ledger:[{id:"W:date:2026-07-21:직장:best",system:"western",scope:"best_day",direction:"supportive",date:"2026-07-21",text:"base"}],
    key_dates:[{date:"2026-07-21",western_refs:["W:date:2026-07-21:직장:best"]}],
    cross_system_timeline:[{date:"2026-07-21",western_refs:["W:date:2026-07-21:직장:best"],saju_context_refs:[],thai_context_refs:[]}],
  };
  const calculation={western:{
    key_date_evidence_policy:{version:"test",available:true,exact_peak_time:false},
    key_dates:[{
      date:"2026-07-21",salience:91.2,hits:4,
      triggers:[{topic:"직장",kind:"best",score:82}],
      source_topics:["직장"],scan_policy:"08:00~22:00 / 120m",sample_count:8,
      sampled_scores:{직장:{average:74,min:69,min_time:"08:00",max:82,max_time:"14:00"}},
      evidence:[
        {kind:"aspect",sample_time:"14:00",source_topics:["직장"],contribution:.91,text:"Jupiter→MC trine · orb 0.22°",transit:"Jupiter",target:"MC",aspect:"trine",orb:.22,motion:"Applying",direction:"direct"},
        {kind:"house",sample_time:"14:00",source_topics:["직장"],contribution:.21,text:"Saturn · Whole Sign 10H · Placidus 10H",transit:"Saturn",whole_house:10,placidus_house:10},
      ],
    }],
  }};
  return {packet,calculation};
}

test("actual evidence receives immutable refs and is joined to date/timeline",()=>{
  const {packet,calculation}=fixture();
  const out=attachActualKeyDateEvidence(packet,calculation);
  assert.equal(out.key_date_ledger_version,KEY_DATE_LEDGER_VERSION);
  assert.equal(out.western.key_date_details.length,1);
  assert.equal(out.western.key_date_details[0].evidence_refs.length,2);
  assert.equal(out.evidence_ledger.filter(x=>x.id.startsWith("W:keydate:")).length,2);
  assert.ok(out.key_dates[0].western_refs.includes("W:keydate:2026-07-21:1"));
  assert.ok(out.cross_system_timeline[0].western_refs.includes("W:keydate:2026-07-21:2"));
  const aspect=out.evidence_ledger.find(x=>x.id==="W:keydate:2026-07-21:1");
  assert.equal(aspect.calculation.transit,"Jupiter");
  assert.equal(aspect.calculation.orb,.22);
});

test("transport is idempotent and does not duplicate ledger rows",()=>{
  const {packet,calculation}=fixture();
  attachActualKeyDateEvidence(packet,calculation);
  attachActualKeyDateEvidence(packet,calculation);
  assert.equal(packet.evidence_ledger.filter(x=>x.id.startsWith("W:keydate:")).length,2);
  assert.equal(new Set(packet.key_dates[0].western_refs).size,packet.key_dates[0].western_refs.length);
});
