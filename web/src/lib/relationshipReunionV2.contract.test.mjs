import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const server=readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/index.ts',import.meta.url),'utf8')
const publicError=readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/publicError.ts',import.meta.url),'utf8')
const panel=readFileSync(new URL('../RelationshipInterpretationPanel.tsx',import.meta.url),'utf8')
const types=readFileSync(new URL('../appTypes.ts',import.meta.url),'utf8')

test('reunion v2 is reunion-only and preserves other relationship cache version',()=>{
  assert.match(server,/REUNION_VERSION="relationship-v11\.8-evidence-v2"/)
  assert.match(server,/versionForPurpose=\(purpose:Purpose\)=>purpose==="reunion"\?REUNION_VERSION:VERSION/)
  assert.match(server,/stable\(\{version:versionForPurpose\(purpose\),purpose,preferred,payload\}\)/)
})

test('server compiles question-first evidence and validates returned evidence refs',()=>{
  assert.match(server,/buildReunionEvidenceV2/)
  assert.match(server,/base\.reunion_evidence_v2=buildReunionEvidenceV2\(base\)/)
  assert.match(server,/reunion_synthesis_v2:REUNION_V2_SCHEMA/)
  assert.match(server,/validEvidenceRefs/)
  assert.match(server,/refs\.some\(\(x:any\)=>!validEvidenceRefs\.has/)
  assert.match(publicError,/publicReunionV2/)
})

test('web prefers v2 question flow while retaining old reunion fallback',()=>{
  assert.match(types,/reunion_synthesis_v2\?:/)
  assert.match(panel,/const reunionV2/)
  assert.match(panel,/다시 연결될 여지가 있는 이유/)
  assert.match(panel,/누가 먼저 움직일 흐름인가/)
  assert.match(panel,/접점이 강해지는 시기/)
  assert.match(panel,/다시 붙었을 때 관계 구조/)
  assert.match(panel,/다시 깨뜨릴 수 있는 반복 패턴/)
  assert.match(panel,/reunion && reunionAi/)
})
