import test from 'node:test'
import assert from 'node:assert/strict'
import { saveCounterpart, readSavedCounterparts, removeCounterpart, toCounterpartProfile } from './savedCounterparts.ts'

function memory(){const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v))}}
const base={name:'진',birthDate:'1994-05-02',birthTime:'13:20',placeKey:'seoul',latitude:'37.5',longitude:'127',utcOffset:'9',gender:'male',timeSource:'unknown',timeConfidence:'unknown',rectifiedWindowStart:'',rectifiedWindowEnd:'',timeKnown:true}

test('saved people persist, update in place and come back as form values',()=>{
  const store=memory()
  saveCounterpart(base,store,new Date('2026-11-17T00:00:00Z'))
  saveCounterpart({...base,name:'A',birthDate:'1992-01-01'},store)
  saveCounterpart({...base,birthTime:'14:00'},store)
  const rows=readSavedCounterparts(store)
  assert.deepEqual(rows.map(r=>r.name),['진','A'])
  assert.equal(rows[0].birthTime,'14:00')
  assert.deepEqual(toCounterpartProfile(rows[0]),{...base,birthTime:'14:00'})
  assert.deepEqual(removeCounterpart(rows[0].id,store).map(r=>r.name),['A'])
})
test('nothing is saved without a birth date and broken storage reads as empty',()=>{
  const store=memory()
  assert.deepEqual(saveCounterpart({...base,birthDate:''},store),[])
  store.setItem('starlight-destiny.saved-counterparts.v1','{oops')
  assert.deepEqual(readSavedCounterparts(store),[])
})
