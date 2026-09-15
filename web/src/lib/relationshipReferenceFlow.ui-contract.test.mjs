import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const panel=readFileSync(fileURLToPath(new URL('../PeriodAiInterpretationPanel.tsx',import.meta.url)),'utf8')

test('summary UI renders a separate reference flow between favorable and caution sections',()=>{
  assert.match(panel,/relationshipReferenceFlowCards\(userSummary, calculation\)/)
  assert.match(panel,/FortuneFlowCards title="참고할 흐름" items=\{referenceFlowCards\}/)
})
