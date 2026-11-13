import test from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {fileURLToPath} from 'node:url'
import {encodePendingFortuneAiJob,decodePendingFortuneAiJob} from './fortuneAiJob.ts'

// Exercise the real period save, resume, local persistence and cloud payload code.
// The Supabase double implements only the four PostgREST operations these paths use.
const compiled = await build({
  stdin:{resolveDir:fileURLToPath(new URL('.',import.meta.url)),contents:`
    export {savePeriodArchive,resumePeriodArchive} from './periodArchive'
    export {listLocalArchive,importArchiveItems} from './archive'
    export {currentCalculationCacheId,storedFortuneCalculationId} from './readingCache'`},
  plugins:[{name:'archive-transport',setup(b){
    b.onResolve({filter:/^\.\/(auth|supabase)$/}, args => ({path:args.path,namespace:'fake'}))
    b.onLoad({filter:/.*/,namespace:'fake'}, args => ({contents:args.path==='./auth'
      ? 'export const getAuthorizedSessionSnapshot=()=>({user:{id:"tester"}})'
      : 'export const ensureSupabaseSession=async()=>({user:{id:"tester"}}); export const supabase={from:()=>globalThis.archiveTestQuery()}'}))
  }}],bundle:true,platform:'node',format:'esm',write:false,
})
const archive=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'))
const request={profile:{birth_date:'1998-06-03',birth_time:'08:30',time_known:true,time_source:'family_memory',time_confidence:'high'},start_date:'2026-06-01',end_date:'2026-06-30'}
const calculation={period:{start:request.start_date,end:request.end_date},engine:'fixture-engine'}
const prose={ok:true,origin:'gemini',provenance_verified:true,data:{headline:'이달의 약속'}}
const aiRequest={...request,interpretation_current_date:'2026-06-03',interpretation_timezone:'Asia/Seoul',reading_revision_job:'job1'}
const archiveKey='starlight-destiny.archive.v1'
function setup(t) {
  const db=new Map(),store=new Map()
  const oldWindow=globalThis.window
  globalThis.window={localStorage:{getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value)}}
  t.after(()=>{if(oldWindow)globalThis.window=oldWindow;else delete globalThis.window;delete globalThis.archiveTestQuery})
  globalThis.archiveTestQuery=()=>{
    let id,localId,write,insert=false,projection
    return {
      select(cols){projection=cols;return this},eq(col,value){if(col==='id')id=value;return this},
      contains(col,value){localId=value.local_id;return this},order(){return this},limit(){return this},
      update(value){write=value;return this},insert(value){insert=true;id=value.id;write=value;return this},
      async single(){if(insert && db.has(id))return {error:{code:'23505'}};if(write)db.set(id,{id,created_at:'2026-06-03T15:00:00Z',...write}); return {data:db.get(id)}},
      async maybeSingle(){const row=id?db.get(id):[...db.values()].find(r=>r.calculation_json.local_id===localId)
        return {data:row&&{...row,legacy_ai:projection.includes('legacy_ai:')?row.calculation_json.interpretation:undefined}}}
    }
  }
  return {db,store}
}

test('period cache hits, fresh writes, revisions and duplicate calculation clicks share one full archive',async t=>{
  const {db,store}=setup(t)
  const save=(r,ai)=>archive.savePeriodArchive(calculation,r,'month',ai)
  await Promise.all([save(request),save(aiRequest,prose),save(request)])
  assert.equal(db.size,1)
  const [item]=archive.listLocalArchive()
  assert.equal(item.id,'period:'+archive.storedFortuneCalculationId(request))
  assert.deepEqual(item.interpretation,prose)
  assert.equal(db.values().next().value.interpretation_json.ai.data.headline,prose.data.headline)
  const newer={...prose,data:{headline:'다른 기기에서 보강한 원고'}}
  db.values().next().value.interpretation_json.ai=newer
  await save(request)
  assert.deepEqual(archive.listLocalArchive()[0].interpretation,newer)
  const remote=db.values().next().value
  remote.interpretation_json.ai=null
  remote.calculation_json.interpretation=null
  await save(request)
  assert.equal(remote.interpretation_json.ai,null)
  assert.deepEqual(archive.listLocalArchive()[0].interpretation,newer)
  assert.equal(archive.listLocalArchive()[0].syncState,'local')
  remote.interpretation_json.ai=newer
  store.delete(archiveKey)
  await save(request)
  assert.deepEqual(archive.listLocalArchive()[0].interpretation,newer)
})

test('resumed job restores its original period and exact saved profile, including legacy archive IDs',async t=>{
  const {store}=setup(t)
  const other={...request,profile:{...request.profile,birth_date:'1999-06-03'}}
  const otherEntry=await archive.savePeriodArchive(calculation,other,'month')
  const saved=await archive.savePeriodArchive(calculation,request,'month',prose)
  const legacy={...saved.item,id:'old-id-with-interpretation-metadata',request:{...aiRequest,archive_mode:'period_fortune_v16'}}
  store.set(archiveKey,JSON.stringify([otherEntry.item,legacy]))
  const pending=decodePendingFortuneAiJob(encodePendingFortuneAiJob({jobId:'123',request:aiRequest,archivePeriod:'month'}))
  assert.equal(pending.archivePeriod,'month')
  const revised={...prose,data:{headline:'수정된 월간 원고'}}
  await archive.resumePeriodArchive(pending.request,pending.archivePeriod,revised)
  let entries=archive.listLocalArchive()
  assert.deepEqual(entries.find(x=>x.id===saved.item.id).interpretation,revised)
  assert.equal(entries.find(x=>x.id===otherEntry.item.id).interpretation,undefined)
  assert.deepEqual(entries.find(x=>x.id===legacy.id).interpretation,prose)
  const optional=await archive.resumePeriodArchive(request,null,prose)
  assert.equal(optional,undefined)
  await archive.resumePeriodArchive(aiRequest,undefined,prose)
  entries=archive.listLocalArchive()
  assert.deepEqual(entries.find(x=>x.id===saved.item.id).interpretation,prose)
  assert.equal(await archive.resumePeriodArchive({...request,profile:{...request.profile,birth_time:'11:10'}},'month',prose),undefined)
})


test('new calculations bypass older evidence while saved archive identities stay stable', () => {
  assert.notEqual(archive.currentCalculationCacheId(request), archive.storedFortuneCalculationId(request))
  assert.equal(archive.currentCalculationCacheId(request), archive.currentCalculationCacheId(aiRequest))
  assert.equal(archive.storedFortuneCalculationId(request), archive.storedFortuneCalculationId(aiRequest))
})
