import assert from 'node:assert/strict'
import test from 'node:test'
import { EDITORIAL_V3_CACHE_VERSION, exactV23JobKind, provisionalV23JobKind } from './cacheIdentityV23.ts'

const hash='1234567890abcdef1234567890abcdefZZ'

test('exact V23 invalidates old cache identities for every period under editorial v3',()=>{
  const version='supabase-ai-v23.0-phenomenon-first'
  const legacy=`${version}:${hash.slice(0,32)}`
  for(const kind of ['day','week','month','annual']) {
    const next=exactV23JobKind(version,{period_kind:kind},hash)
    assert.notEqual(next,legacy)
    assert.match(next,new RegExp(EDITORIAL_V3_CACHE_VERSION))
  }
})

test('provisional V23 invalidates old cache identities for every period under editorial v3',()=>{
  const version='supabase-ai-v22-integrated-precision-v2.1'
  const legacy=`${version}:v23-period-aware:${hash.slice(0,32)}`
  for(const kind of ['day','week','month','annual']) {
    const next=provisionalV23JobKind(version,{period_kind:kind},hash)
    assert.notEqual(next,legacy)
    assert.match(next,new RegExp(EDITORIAL_V3_CACHE_VERSION))
  }
})

test('day/week keep their additional period-shape cache marker while aliases and date spans resolve correctly',()=>{
  const version='supabase-ai-v23.0-phenomenon-first'
  assert.match(exactV23JobKind(version,{period_kind:'today'},hash),/dw-period-distinct/)
  assert.match(exactV23JobKind(version,{period:{start:'2026-09-18',end:'2026-09-18'}},hash),/dw-period-distinct/)
  assert.match(exactV23JobKind(version,{period:{start:'2026-09-14',end:'2026-09-20'}},hash),/dw-period-distinct/)
  assert.doesNotMatch(exactV23JobKind(version,{period:{start:'2026-09-01',end:'2026-09-30'}},hash),/dw-period-distinct/)
  assert.match(exactV23JobKind(version,{period:{start:'2026-09-01',end:'2026-09-30'}},hash),/editorial-v3/)
})
