import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const source=fs.readFileSync(new URL("./index.ts",import.meta.url),"utf8");
const quality=fs.readFileSync(new URL("./qualityV2.ts",import.meta.url),"utf8");

test("mixed evidence is normalized deterministically before quality validation",()=>{
  assert.match(source,/function normalizeDirectionalWindows/);
  assert.match(source,/supportive&&caution\)window\.signal="혼합"/);
  assert.match(source,/const data=normalizeDirectionalWindows\(validated,payload\)/);
});

test("fallback core has enough structured-output headroom",()=>{
  assert.match(source,/part==="core"\?\(compactMode\?10000:12000\)/);
});

test("core prompt keeps depth while Quality retry avoids padding-only rewrites",()=>{
  assert.match(source,/focus_timing은 최소 35자/);
  assert.match(source,/synthesis는 최소 60자/);
  assert.match(quality,/교차검증 synthesis가 비어 있거나 의미가 빠졌을 때만/);
  assert.match(quality,/길이만 늘리지 마라/);
});