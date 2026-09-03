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

test("core and retry prompts require relationship and cross-check depth",()=>{
  assert.match(source,/focus_timing은 최소 35자/);
  assert.match(source,/synthesis는 최소 60자/);
  assert.match(quality,/교차검증 종합이 너무 짧으면 해당 synthesis를 최소 60자/);
});
