import assert from "node:assert/strict";
import test from "node:test";
import { classifyQualityRepair } from "./repairV19.ts";

const report=(...issues)=>({stages:[{stage:4,issues}]});
const candidate={topic_analysis:{직장:{evidence_refs:["BAD:REF"],reason:"2026-09-04 언급"}}};

test("decision and cross-check failures repair core only",()=>{
  assert.deepEqual(classifyQualityRepair(report("핵심 시기와 연결되지 않은 결정 조언: 시험 학습 집중"),candidate),{core:true,topics:false});
  assert.deepEqual(classifyQualityRepair(report("교차검증 종합이 너무 짧음: 관계 피크"),candidate),{core:true,topics:false});
});

test("topic depth and topic evidence failures repair topics only",()=>{
  assert.deepEqual(classifyQualityRepair(report("직장 핵심 근거 설명이 얕음"),candidate),{core:false,topics:true});
  assert.deepEqual(classifyQualityRepair(report("존재하지 않는 근거 ID: BAD:REF"),candidate),{core:false,topics:true});
  assert.deepEqual(classifyQualityRepair(report("계산근거에서 찾을 수 없는 날짜 언급: 2026-09-04"),candidate),{core:false,topics:true});
});

test("mixed failures repair both parts",()=>{
  assert.deepEqual(classifyQualityRepair(report("직장 핵심 근거 설명이 얕음","핵심 시기와 연결되지 않은 결정 조언: 시험"),candidate),{core:true,topics:true});
});
