import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'

let server
let origin

test.before(async()=>{
  server=await createServer({server:{middlewareMode:true},appType:'custom'})
  origin=await server.ssrLoadModule('/src/lib/fortuneNarrativeOrigin.ts')
})

test.after(async()=>{await server?.close()})

test('all deterministic provisional model versions are classified as safe local copy',()=>{
  assert.equal(origin.isDeterministicFortuneModel('deterministic-provisional-v2'),true)
  assert.equal(origin.isDeterministicFortuneModel('deterministic-provisional-v23'),true)
  assert.equal(origin.fortuneNarrativeOrigin('deterministic-provisional-v23'),'deterministic_safe')
})

test('declared origin wins and Gemini models remain Gemini authored',()=>{
  assert.equal(origin.fortuneNarrativeOrigin('gemini-2.5-flash'),'gemini')
  assert.equal(origin.fortuneNarrativeOrigin('gemini-2.5-flash','deterministic_safe'),'deterministic_safe')
})
