import assert from 'node:assert/strict'
import test from 'node:test'
import { DAILY_OUTPUT_CACHE_VERSION, EDITORIAL_CACHE_VERSION, WEEKLY_OUTPUT_CACHE_VERSION, exactV23JobKind, provisionalV23JobKind } from './cacheIdentityV23.ts'
import { V23_PROMPT_VERSION } from './promptV23.ts'
import { PERIOD_NARRATIVE_VERSION } from './periodNarrativeV23.ts'

const hash='1234567890abcdef1234567890abcdefZZ'

test('exact V23 cache identity follows the active prompt and narrative contracts for every period',()=>{
  const version='supabase-ai-v23.0-phenomenon-first'
  const legacy=`${version}:${hash.slice(0,32)}`
  for(const kind of ['day','week','month','annual']) {
    const next=exactV23JobKind(version,{period_kind:kind},hash)
    assert.notEqual(next,legacy)
    assert.match(next,new RegExp(EDITORIAL_CACHE_VERSION.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')))
    assert.match(next,new RegExp(V23_PROMPT_VERSION.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')))
    assert.match(next,new RegExp(PERIOD_NARRATIVE_VERSION.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')))
  }
})

test('provisional V23 cache identity follows the active prompt and narrative contracts for every period',()=>{
  const version='supabase-ai-v22-integrated-precision-v2.1'
  const legacy=`${version}:v23-period-aware:${hash.slice(0,32)}`
  for(const kind of ['day','week','month','annual']) {
    const next=provisionalV23JobKind(version,{period_kind:kind},hash)
    assert.notEqual(next,legacy)
    assert.match(next,/editorial-runtime:/)
    assert.match(next,new RegExp(V23_PROMPT_VERSION.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')))
    assert.match(next,new RegExp(PERIOD_NARRATIVE_VERSION.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')))
  }
})

test('day/week keep their additional period-shape cache marker while aliases and date spans resolve correctly',()=>{
  const version='supabase-ai-v23.0-phenomenon-first'
  assert.match(exactV23JobKind(version,{period_kind:'today'},hash),/dw-period-distinct/)
  assert.match(exactV23JobKind(version,{period:{start:'2026-09-18',end:'2026-09-18'}},hash),/dw-period-distinct/)
  assert.match(exactV23JobKind(version,{period:{start:'2026-09-14',end:'2026-09-20'}},hash),/dw-period-distinct/)
  assert.doesNotMatch(exactV23JobKind(version,{period:{start:'2026-09-01',end:'2026-09-30'}},hash),/dw-period-distinct/)
  assert.match(exactV23JobKind(version,{period:{start:'2026-09-01',end:'2026-09-30'}},hash),/editorial-runtime/)
})

test('day and week get independent output-headroom cache markers',()=>{
  const version='supabase-ai-v23.1-structured-output-headroom'
  const daily=new RegExp(DAILY_OUTPUT_CACHE_VERSION)
  const weekly=new RegExp(WEEKLY_OUTPUT_CACHE_VERSION)
  const dayExact=exactV23JobKind(version,{period_kind:'day'},hash)
  const weekExact=exactV23JobKind(version,{period_kind:'week'},hash)
  assert.match(dayExact,daily)
  assert.doesNotMatch(dayExact,weekly)
  assert.match(weekExact,weekly)
  assert.doesNotMatch(weekExact,daily)
  assert.match(provisionalV23JobKind(version,{period:{start:'2026-10-04',end:'2026-10-04'}},hash),daily)
  assert.match(provisionalV23JobKind(version,{period:{start:'2026-09-28',end:'2026-10-04'}},hash),weekly)
  assert.doesNotMatch(exactV23JobKind(version,{period_kind:'month'},hash),daily)
  assert.doesNotMatch(exactV23JobKind(version,{period_kind:'month'},hash),weekly)
})
