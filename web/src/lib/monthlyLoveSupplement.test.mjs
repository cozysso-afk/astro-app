import test from 'node:test'
import assert from 'node:assert/strict'
import {monthlyLoveSupplements} from './monthlyLoveSupplement.ts'

const keys=['love_single','love_crush','love_flirting','love_ambiguous','love_couple','contact_activation','contact_continuity','love_reunion_interest']
const doc={scope:'love',state:'ready',date:'2026-11-01 → 2026-11-30',sections:keys.map(key=>({id:'relationship.'+key,label:key,state:'missing'}))}
const period={start:'2026-11-01',end:'2026-11-30'}
const stat={average:44,band:'다소 약함',best_days:[{date:'2026-12-01',score:77},{date:'2026-11-21',score:62}],caution_days:[]}
const topics={연애:stat,연락:{...stat,average:47},재회:{...stat,average:34}}
const calc={period,western:{months:[{...period,topics}]}}
test('eight distinct explanations for old month, with only real selected-month dates',()=>{
  const original=structuredClone(doc)
  const items=monthlyLoveSupplements(doc,calc)
  assert.equal(items.length,8)
  assert.equal(new Set(items.map(item=>item.text)).size,8)
  assert.ok(items.every(item=>item.evidence.includes('2026-11-21')&&!item.evidence.includes('2026-12')))
  assert.ok(items.find(item=>item.id.endsWith('continuity')).evidence.includes('47점'))
  assert.ok(items.find(item=>item.id.endsWith('reunion_interest')).evidence.includes('34점'))
  assert.deepEqual(doc,original)
})
test('authored, insufficient, non-love, mismatched, unverified and missing evidence are never filled',()=>{
  const changed=structuredClone(doc);changed.sections[0].state='ready';changed.sections[1].state='insufficient'
  assert.equal(monthlyLoveSupplements(changed,calc).length,6)
  for (const outside of [{...doc,scope:'work'},{...doc,state:'unverified'},{...doc,date:'other period'}])assert.deepEqual(monthlyLoveSupplements(outside,calc),[])
  assert.equal(monthlyLoveSupplements(doc,{period,western:{overall:{연락:topics.연락}}}).length,2)
})
