import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const app = fs.readFileSync(path.resolve(here, '../AppNext.tsx'), 'utf8')
const api = fs.readFileSync(path.resolve(here, '../../../api/main.py'), 'utf8')

test('reunion runtime contract blocks stale API before paid interpretation', () => {
  assert.match(api, /REUNION_EVIDENCE_CONTRACT_VERSION/)
  assert.match(api, /"reunion_evidence_contract": REUNION_EVIDENCE_CONTRACT_VERSION/)
  assert.match(api, /"runtime_git_sha": os\.getenv\("RENDER_GIT_COMMIT", ""\)/)
  assert.match(app, /REQUIRED_REUNION_EVIDENCE_CONTRACT = 'reunion-evidence-contract-v1'/)
  assert.match(app, /fetch\(`\$\{API_BASE\}\/v1\/meta`\)/)
  assert.match(app, /setReunionContractStatus\(payload\?\.reunion_evidence_contract === REQUIRED_REUNION_EVIDENCE_CONTRACT \? 'ready' : 'stale'\)/)
  assert.match(app, /reunionRequest && reunionContractStatus !== 'ready'/)
  assert.match(app, /relationshipResult\.result\.reunion_evidence_contract\?\.version !== REQUIRED_REUNION_EVIDENCE_CONTRACT/)
  assert.match(app, /relationshipPurpose==='reunion'&&reunionContractStatus!=='ready'/)
  assert.match(app, /유료 AI 해설을 새로 호출하지 않아/)
})
