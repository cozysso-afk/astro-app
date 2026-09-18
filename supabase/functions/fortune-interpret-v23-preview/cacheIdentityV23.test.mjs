import assert from 'node:assert/strict'
import test from 'node:test'
import { exactV23JobKind, provisionalV23JobKind } from './cacheIdentityV23.ts'

const hash='1234567890abcdef1234567890abcdefZZ'

test('exact V23 invalidates day and week while preserving month and annual cache identities',()=>{
  const version='supabase-ai-v23.0-phenomenon-first'
  const legacy=`${version}:${hash.slice(0,32)}`
  assert.notEqual(exactV23JobKind(version,{period_kind:'day'},hash),legacy)
  assert.notEqual(exactV23JobKind(version,{period_kind:'week'},hash),legacy)
  assert.equal(exactV23JobKind(version,{period_kind:'month'},hash),legacy)
  assert.equal(exactV23JobKind(version,{period_kind:'annual'},hash),legacy)
})

test('provisional V23 invalidates day and week while preserving month and annual cache identities',()=>{
  const version='supabase-ai-v22-integrated-precision-v2.1'
  const legacy=`${version}:v23-period-aware:${hash.slice(0,32)}`
  assert.notEqual(provisionalV23JobKind(version,{period_kind:'day'},hash),legacy)
  assert.notEqual(provisionalV23JobKind(version,{period_kind:'week'},hash),legacy)
  assert.equal(provisionalV23JobKind(version,{period_kind:'month'},hash),legacy)
  assert.equal(provisionalV23JobKind(version,{period_kind:'annual'},hash),legacy)
})
