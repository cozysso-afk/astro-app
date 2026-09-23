import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const guard = readFileSync(new URL('./releaseCompatibility.ts', import.meta.url), 'utf8')
const app = readFileSync(new URL('../AppNext.tsx', import.meta.url), 'utf8')
const types = readFileSync(new URL('../appTypes.ts', import.meta.url), 'utf8')
const vite = readFileSync(new URL('../../vite.config.ts', import.meta.url), 'utf8')
const envTypes = readFileSync(new URL('../vite-env.d.ts', import.meta.url), 'utf8')
const api = readFileSync(new URL('../../../api/main.py', import.meta.url), 'utf8')

test('reunion release guard requires calculation schema, interpretation contract, and matching known git sha', () => {
  assert.match(guard, /relationship-schema-v1\.14-directional-evidence/)
  assert.match(guard, /relationship-v12\.5-directional-evidence-narrative/)
  assert.match(guard, /backendSha && frontendSha && backendSha !== frontendSha/)
  assert.match(guard, /계산 서버 버전이 화면 버전과 맞지 않아/)
  assert.match(guard, /화면과 계산 서버의 배포 버전이 달라/)
})

test('relationship response and health expose release provenance', () => {
  assert.match(api, /CALCULATION_SCHEMA_VERSION = "relationship-schema-v1\.14-directional-evidence"/)
  assert.match(api, /INTERPRETATION_CONTRACT_VERSION = "relationship-v12\.5-directional-evidence-narrative"/)
  assert.match(api, /GIT_SHA = .*RENDER_GIT_COMMIT/)
  assert.match(api, /"calculation_schema_version": CALCULATION_SCHEMA_VERSION/)
  assert.match(api, /"interpretation_version": INTERPRETATION_CONTRACT_VERSION/)
  assert.match(api, /"git_sha": GIT_SHA/)
  assert.match(types, /calculation_schema_version\?: string/)
  assert.match(types, /interpretation_version\?: string/)
  assert.match(types, /git_sha\?: string/)
})

test('reunion request blocks incompatible current results before rendering or fallback timing', () => {
  assert.match(app, /reunionReleaseCompatibility\(typed\)/)
  assert.match(app, /if \(!releaseCompatibility\.ok\) throw new Error/)
  assert.match(app, /setRelationshipResult\(typed\)/)
  assert.ok(app.indexOf('if (!releaseCompatibility.ok) throw new Error') < app.indexOf('setRelationshipResult(typed)'))
})

test('web build embeds deployment sha without requiring VITE-prefixed env vars', () => {
  assert.match(vite, /VERCEL_GIT_COMMIT_SHA/)
  assert.match(vite, /__APP_GIT_SHA__/)
  assert.match(envTypes, /declare const __APP_GIT_SHA__: string/)
})
