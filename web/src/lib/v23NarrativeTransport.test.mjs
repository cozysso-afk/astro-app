import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { installIntegratedPrecisionFetch } from './precisionTransport.ts'

const exact=()=>({contract_version:'integrated-precision-v2',time_available:true,time_exact:true,status:'exact',time_source:'official_record',time_confidence:'exact',scoring_mode:'full_exact',allow_natal_moon_scoring:true,allow_angles_houses_scoring:true,allow_house_ruler_bonus:true,allow_intraday_timing:true,allow_saju_ai:true,allow_thai_ai:true,layer_policy:{natal_moon:'allow',angles_houses:'allow',house_ruler_bonus:'allow',intraday_timing:'allow',saju_ai:'allow',thai_ai:'allow'}})

async function capture(action,extra={}){
  const before={window:globalThis.window,location:globalThis.location,fetch:globalThis.fetch}
  let seen=null
  try{
    Object.defineProperty(globalThis,'window',{configurable:true,value:globalThis})
    Object.defineProperty(globalThis,'location',{configurable:true,value:{href:'https://astro-app.test/'}})
    delete globalThis.__starlightIntegratedPrecisionFetchV2__
    globalThis.fetch=async(input,init)=>{const r=new Request(input,init);seen={url:r.url,body:JSON.parse(await r.text())};return new Response('{"ok":true}',{headers:{'content-type':'application/json'}})}
    installIntegratedPrecisionFetch()
    await globalThis.fetch('https://project.supabase.co/functions/v1/fortune-interpret-v21-preview',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,...extra})})
    return seen
  } finally {
    globalThis.fetch=before.fetch;delete globalThis.__starlightIntegratedPrecisionFetchV2__
    if(before.window===undefined)delete globalThis.window;else Object.defineProperty(globalThis,'window',{configurable:true,value:before.window})
    if(before.location===undefined)delete globalThis.location;else Object.defineProperty(globalThis,'location',{configurable:true,value:before.location})
  }
}

test('active exact start prompt and inspect opt into V23 while status stays compatibility-safe',async()=>{
  for(const action of ['start','prompt','inspect']){
    const seen=await capture(action,{calculation:{precision:exact()}})
    assert.match(seen.url,/fortune-interpret-v22-preview$/)
    assert.equal(seen.body.narrative_engine,'v23',action)
  }
  const status=await capture('status',{job_id:'job-test'})
  assert.match(status.url,/fortune-interpret-v22-preview$/)
  assert.equal(status.body.narrative_engine,undefined)
})

test('browser Fortune cache keeps V21 interpreter identity but adds a V23 narrative identity to invalidate old prose',()=>{
  const source=readFileSync(new URL('./readingCache.ts',import.meta.url),'utf8')
  assert.match(source,/FORTUNE_AI_CACHE_CONTRACT = 'supabase-ai-v21\.4-e2e-evidence'/)
  assert.match(source,/FORTUNE_NARRATIVE_CACHE_CONTRACT = 'v23-period-narrative-v1'/)
  assert.match(source,/FORTUNE_DAY_WEEK_NARRATIVE_CACHE_CONTRACT = 'v23-period-narrative-dw-v2'/)
  assert.match(source,/periodKind === 'day' \|\| periodKind === 'week'/)
  assert.match(source,/narrative_contract: narrativeContract/)
})
