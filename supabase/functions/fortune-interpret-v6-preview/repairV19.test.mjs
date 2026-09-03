import assert from "node:assert/strict";
import test from "node:test";
import { classifyQualityRepair } from "./repairV19.ts";

const report=(...issues)=>({stages:[{stage:4,issues}]});
const candidate={topic_analysis:{직장:{evidence_refs:["BAD:REF"],reason:"2026-09-04 언급"}}};

test("decision and cross-check failures repair core only when no deterministic link is safe",()=>{
  assert.deepEqual(classifyQualityRepair(report("핵심 시기와 연결되지 않은 결정 조언: 시험 학습 집중"),candidate),{core:true,topics:false});
  assert.deepEqual(classifyQualityRepair(report("교차검증 종합이 너무 짧음: 관계 피크"),candidate),{core:true,topics:false});
});

test("topic depth and topic evidence failures repair topics only",()=>{
  assert.deepEqual(classifyQualityRepair(report("직장 핵심 근거 설명이 얕음"),candidate),{core:false,topics:true});
  assert.deepEqual(classifyQualityRepair(report("컨디션 참고 근거 설명이 얕음"),candidate),{core:false,topics:true});
  assert.deepEqual(classifyQualityRepair(report("존재하지 않는 근거 ID: BAD:REF"),candidate),{core:false,topics:true});
  assert.deepEqual(classifyQualityRepair(report("계산근거에서 찾을 수 없는 날짜 언급: 2026-09-04"),candidate),{core:false,topics:true});
});

test("mixed failures repair both parts",()=>{
  assert.deepEqual(classifyQualityRepair(report("직장 핵심 근거 설명이 얕음","핵심 시기와 연결되지 않은 결정 조언: 시험"),candidate),{core:true,topics:true});
});

test("same-date same-topic decision link is repaired with an existing window ref and skips regeneration",()=>{
  const value={
    key_windows:[{
      label:"시험 집중 시간창",start:"2026-09-03",end:"2026-09-03",topics:["시험"],
      evidence_refs:["W:window:2026-09-03:시험:best","W:detail:2026-09-03:시험:1"],
    }],
    decisions:[{
      action:"시험 학습 집중 및 모의고사 풀이",timing:"10:00~11:30",
      reason:"시험 집중 근거",evidence_refs:["W:detail:2026-09-03:시험:2"],
    }],
    topic_analysis:{시험:{importance:"핵심",evidence_refs:["W:detail:2026-09-03:시험:2"]}},
  };
  const repair=classifyQualityRepair(report("핵심 시기와 연결되지 않은 결정 조언: 시험 학습 집중 및 모의고사 풀이"),value);
  assert.deepEqual(repair,{core:false,topics:false});
  assert.ok(value.decisions[0].evidence_refs.includes("W:window:2026-09-03:시험:best"));
});

test("decision link repair refuses unrelated window topics",()=>{
  const value={
    key_windows:[{label:"직장",start:"2026-09-03",end:"2026-09-03",topics:["직장"],evidence_refs:["W:window:2026-09-03:직장:best"]}],
    decisions:[{action:"시험 학습 집중",timing:"10:00~11:30",reason:"시험",evidence_refs:["W:detail:2026-09-03:시험:1"]}],
    topic_analysis:{시험:{importance:"핵심",evidence_refs:["W:detail:2026-09-03:시험:1"]}},
  };
  const repair=classifyQualityRepair(report("핵심 시기와 연결되지 않은 결정 조언: 시험 학습 집중"),value);
  assert.deepEqual(repair,{core:true,topics:false});
  assert.deepEqual(value.decisions[0].evidence_refs,["W:detail:2026-09-03:시험:1"]);
});
