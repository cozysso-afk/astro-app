import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { strictQualityRetryInstruction } from "./qualityV2.ts";

const source=fs.readFileSync(new URL("./index.ts",import.meta.url),"utf8");

test("split prompt forbids inferred dates and binds decisions to windows",()=>{
  assert.match(source,/임의로 앞뒤 날짜를 늘려 범위를 만들지 말고 start=end/);
  assert.match(source,/supportive와 caution이 함께 있으면 signal은 반드시 '혼합'/);
  assert.match(source,/decisions의 각 항목은 반드시 적어도 하나의 evidence_ref를 실제로 출력한 key_window와 공유/);
  assert.match(source,/W:window 근거가 있으면 최소 한 결정의 timing에 그 정확한 HH:MM~HH:MM/);
});

test("topic split prompt states adaptive depth floors",()=>{
  assert.match(source,/연간은 최소 85자/);
  assert.match(source,/연간 최소 55자/);
  assert.match(source,/근거를 충분히 설명할 수 없는 분야를 핵심\/주목으로 올리지 마/);
});

test("quality retry gives targeted grounding repairs",()=>{
  const text=strictQualityRetryInstruction({stages:[{stage:2,name:"근거 추적성",passed:false,issues:["계산근거에서 찾을 수 없는 날짜 언급: 2026-10-15"]}]});
  assert.match(text,/한 날짜 근거로 임의 범위를 만들지 마라/);
  assert.match(text,/signal='혼합'/);
  assert.match(text,/key_window와 공유/);
});
