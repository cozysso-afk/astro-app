import { readFileSync } from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')

test('reunion keeps the 300 KRW hard cap but uses smaller purpose-specific output budgets', () => {
  assert.match(source, /MAX_AI_JOB_ESTIMATED_KRW=300/)
  assert.match(source, /purpose==="reunion"\?\{first:9000,retry:6500\}:\{first:16000,retry:12000\}/)
  assert.match(source, /relationshipEstimatedJobKrw\(inputTokens:number,purpose:Purpose\)/)
  assert.match(source, /maxOutputTokens:compactMode\?caps\.retry:caps\.first/)

  const inputTokens = Math.ceil(180000 / 2.6)
  const inputRate = .75
  const outputRate = 3.75
  const krw = 1384
  const thoughtReserve = 3000
  const one = output => ((inputTokens / 1_000_000) * inputRate + ((output + thoughtReserve) / 1_000_000) * outputRate) * krw
  const worstCase = one(9000) + one(6500)
  assert.ok(worstCase < 300, `reunion max-budget estimate must stay below 300 KRW, got ${worstCase}`)
})

test('only reunion gets a new cache/interpreter version', () => {
  assert.match(source, /BASE_VERSION="relationship-v11\.6-reunion-compact-evidence"/)
  assert.match(source, /REUNION_VERSION="relationship-v11\.7-reunion-direct-budget"/)
  assert.match(source, /function versionFor\(purpose:Purpose\)\{return purpose==="reunion"\?REUNION_VERSION:BASE_VERSION;\}/)
  assert.match(source, /const version=versionFor\(purpose\);const hash=/)
})

test('reunion prompt requires direct direction and concrete timing before general interpretation', () => {
  assert.match(source, /상대 → 나 방향이 강한지\/보통인지\/약한지/)
  assert.match(source, /나 → 상대 방향/)
  assert.match(source, /구체적인 재접점 시기 2~4개/)
  assert.match(source, /일반론만 반복하지 말고 실제 계산된 방향·날짜·애스펙트/)
  assert.match(source, /incoming_contact","outgoing_contact","relationship_filter"/)
  assert.match(source, /reconnection_windows/)
})
