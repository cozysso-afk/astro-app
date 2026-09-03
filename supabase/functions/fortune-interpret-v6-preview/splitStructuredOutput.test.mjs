import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const source=fs.readFileSync(new URL("./index.ts",import.meta.url),"utf8");

test("Gemini generation uses two smaller structured schemas in parallel",()=>{
  assert.match(source,/const CORE_SCHEMA:any=structuredClone\(SCHEMA\)/);
  assert.match(source,/delete CORE_SCHEMA\.properties\.topic_analysis/);
  assert.match(source,/const TOPIC_SCHEMA:any=/);
  assert.match(source,/Promise\.all\(\[/);
  assert.match(source,/generatePart\(payload,model,key,"core",CORE_SCHEMA/);
  assert.match(source,/generatePart\(payload,model,key,"topics",TOPIC_SCHEMA/);
  assert.doesNotMatch(source,/responseSchema:SCHEMA/);
  assert.match(source,/const merged=\{\.\.\.core\.partial,\.\.\.topics\.partial\}/);
  assert.match(source,/validateOutput\(merged\)/);
});
