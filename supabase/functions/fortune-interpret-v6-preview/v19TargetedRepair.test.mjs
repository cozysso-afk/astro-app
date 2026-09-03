import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
const source=fs.readFileSync(new URL("./index.ts",import.meta.url),"utf8");

test("quality failures preserve the first candidate and regenerate only selected parts",()=>{
  assert.match(source,/first\?\.candidate_data/);
  assert.match(source,/repairCandidateWithThaiSafety/);
  assert.match(source,/repair\.core\?generatePart/);
  assert.match(source,/repair\.topics\?generatePart/);
  assert.match(source,/const merged=\{\.\.\.candidate,\.\.\.\(core\.partial/);
  assert.match(source,/inspectInterpretationQuality\(data,payload\)/);
});
