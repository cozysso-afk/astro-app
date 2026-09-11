import assert from 'node:assert/strict'
import test from 'node:test'
import { applyIntegratedPrecisionToRequest, fortuneAiPrecisionReadiness, installIntegratedPrecisionFetch, precisionModeFromProvenance, sanitizeCalculationForExternalAi, sanitizeExternalFortuneText } from './precisionTransport.ts'

function exactPrecision(){return {contract_version:'integrated-precision-v2',time_available:true,time_exact:true,status:'exact',time_source:'official_record',time_confidence:'exact',scoring_mode:'full_exact',allow_natal_moon_scoring:true,allow_angles_houses_scoring:true,allow_house_ruler_bonus:true,allow_intraday_timing:true,allow_saju_ai:true,allow_thai_ai:true,layer_policy:{natal_moon:'allow',angles_houses:'allow',house_ruler_bonus:'allow',intraday_timing:'allow',saju_ai:'allow',thai_ai:'allow'}}}
function provisionalPrecision(){return {contract_version:'integrated-precision-v2',time_available:true,time_exact:false,status:'provisional',time_source:'family_memory',time_confidence:'medium',scoring_mode:'planet_only_provisional',allow_natal_moon_scoring:false,allow_angles_houses_scoring:false,allow_house_ruler_bonus:false,allow_intraday_timing:false,allow_saju_ai:false,allow_thai_ai:false,layer_policy:{natal_moon:'exclude',angles_houses:'exclude',house_ruler_bonus:'exclude',intraday_timing:'exclude',saju_ai:'exclude',thai_ai:'exclude'}}}

test('provenance classifier keeps entered time distinct from exact',()=>{
  assert.equal(precisionModeFromProvenance('official_record','exact',true,'07:26'),'exact')
  assert.equal(precisionModeFromProvenance('family_memory','medium',true,'07:26'),'provisional')
  assert.equal(precisionModeFromProvenance('unknown','unknown',true,'07:26'),'provisional')
  assert.equal(precisionModeFromProvenance('official_record','exact',false,'07:26'),null)
})

test('AI readiness fails closed on legacy and inconsistent contracts',()=>{
  assert.equal(fortuneAiPrecisionReadiness({}).ok,false)
  assert.deepEqual(fortuneAiPrecisionReadiness({precision:exactPrecision()}).mode,'exact')
  assert.deepEqual(fortuneAiPrecisionReadiness({precision:provisionalPrecision()}).mode,'provisional')
  assert.equal(fortuneAiPrecisionReadiness({precision:{...exactPrecision(),time_source:'family_memory'}}).ok,false)
})

test('request transport writes explicit unknown provenance when no snapshot is available',()=>{
  const original=globalThis.localStorage
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem(){return null},setItem(){}}})
  try{
    const request={profile:{birth_date:'1991-03-21',birth_time:'07:26',latitude:34.7,longitude:127.6,place_key:'yeosu'}}
    applyIntegratedPrecisionToRequest(request)
    assert.equal(request.profile.time_known,true)
    assert.equal(request.profile.time_source,'unknown')
    assert.equal(request.profile.time_confidence,'unknown')
    assert.equal(request.profile.rectified_window,null)
  } finally { Object.defineProperty(globalThis,'localStorage',{configurable:true,value:original}) }
})

test('provisional external AI calculation strips Saju Thai angles and sensitive evidence',()=>{
  const calc={precision:provisionalPrecision(),saju:{pillars:{hour:'庚辰'}},thai:{thai_day:'Thursday'},western:{natal:{asc:1,mc:2,house_system:{used:'Placidus'}},detail_days:[{date:'2026-09-10'}],daily_scores:[{evidence:[{kind:'aspect',transit:'Moon',target:'Venus',text:'Moon→Venus trine'},{kind:'aspect',transit:'Venus',target:'Moon',text:'Venus→Moon trine'},{kind:'house',whole_house:7,text:'Venus Whole Sign 7H'}]}]}}
  const safe=sanitizeCalculationForExternalAi(calc)
  assert.equal(safe.saju.provisional_excluded_from_ai,true)
  assert.equal(safe.thai.provisional_excluded_from_ai,true)
  assert.equal(safe.western.natal.asc,null)
  assert.equal(safe.western.detail_days.length,0)
  assert.equal(safe.western.daily_scores[0].evidence.length,1)
  assert.equal(safe.western.daily_scores[0].evidence[0].target,'Venus')
})

test('provisional clipboard text becomes Western-only and parse failure blocks original copy',()=>{
  const calc={precision:provisionalPrecision(),saju:{pillars:{hour:'庚辰'}},thai:{thai_day:'Thursday'},western:{natal:{asc:null,mc:null,house_system:null},detail_days:[],daily_scores:[]}}
  const text=`header\n[원본 계산 JSON]\n${JSON.stringify(calc)}`
  const safe=sanitizeExternalFortuneText(text)
  assert.match(safe,/Western-only/)
  assert.doesNotMatch(safe,/庚辰|Thursday/)
  const malformed='header\n"contract_version": "integrated-precision-v2"\n"status": "provisional"\n[원본 계산 JSON]\n{oops'
  assert.match(sanitizeExternalFortuneText(malformed),/차단/)
})

test('active Fortune AI transport rewrites start status and cancel to V22 only', { concurrency:false }, async()=>{
  const originalWindow=globalThis.window
  const originalLocation=globalThis.location
  const originalFetch=globalThis.fetch
  const calls=[]
  try{
    Object.defineProperty(globalThis,'window',{configurable:true,value:globalThis})
    Object.defineProperty(globalThis,'location',{configurable:true,value:{href:'https://astro-app.test/'}})
    delete globalThis.__starlightIntegratedPrecisionFetchV2__
    globalThis.fetch=async(input,init)=>{
      calls.push({url:typeof input==='string'?input:input.toString(),body:init?.body})
      return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json'}})
    }
    const dynamicFetch=(input,init)=>globalThis.fetch(input,init)
    installIntegratedPrecisionFetch()
    const v21='https://project.supabase.co/functions/v1/fortune-interpret-v21-preview'
    for(const action of ['start','status','cancel']){
      const body=action==='start'
        ? {action,calculation:{precision:provisionalPrecision()}}
        : {action,job_id:'job-test'}
      await dynamicFetch(v21,{method:'POST',body:JSON.stringify(body)})
    }
    await dynamicFetch('https://project.supabase.co/rest/v1/readings',{method:'GET'})
    assert.deepEqual(calls.slice(0,3).map(x=>x.url),Array(3).fill('https://project.supabase.co/functions/v1/fortune-interpret-v22-preview'))
    assert.equal(calls[3].url,'https://project.supabase.co/rest/v1/readings')

    const malformed={url:v21,clone(){throw new Error('cannot clone')}}
    const blocked=await dynamicFetch(malformed,{method:'POST',body:JSON.stringify({action:'status',job_id:'job-test'})})
    assert.equal(blocked.status,409)
    assert.equal(calls.length,4)
  }finally{
    globalThis.fetch=originalFetch
    delete globalThis.__starlightIntegratedPrecisionFetchV2__
    if(originalWindow===undefined)delete globalThis.window
    else Object.defineProperty(globalThis,'window',{configurable:true,value:originalWindow})
    if(originalLocation===undefined)delete globalThis.location
    else Object.defineProperty(globalThis,'location',{configurable:true,value:originalLocation})
  }
})

async function withTransport(run) {
  const before = { window:globalThis.window, location:globalThis.location, fetch:globalThis.fetch }
  const calls=[]
  try {
    Object.defineProperty(globalThis,'window',{configurable:true,value:globalThis})
    Object.defineProperty(globalThis,'location',{configurable:true,value:{href:'https://astro-app.test/'}})
    delete globalThis.__starlightIntegratedPrecisionFetchV2__
    globalThis.fetch=async(input,init)=>{
      const request=new Request(input,init)
      calls.push({url:request.url,body:await request.text(),headers:Object.fromEntries(request.headers)})
      return new Response('{"ok":true}',{headers:{'content-type':'application/json'}})
    }
    installIntegratedPrecisionFetch()
    await run(calls)
  } finally {
    globalThis.fetch=before.fetch
    delete globalThis.__starlightIntegratedPrecisionFetchV2__
    for(const key of ['window','location']) {
      if(before[key]===undefined)delete globalThis[key]
      else Object.defineProperty(globalThis,key,{configurable:true,value:before[key]})
    }
  }
}

test('query/hash rewrite preserves string URL and POST Request body headers and init overrides', async()=>{
  await withTransport(async(calls)=>{
    for(const suffix of ['?forceFunctionRegion=ap-northeast-2','#status','?forceFunctionRegion=ap-northeast-2#status']) {
      for(const kind of ['string','URL','Request']) {
        const url='https://project.supabase.co/functions/v1/fortune-interpret-v21-preview'+suffix
        const body=JSON.stringify({action:'status',job_id:'job-test'})
        const init={method:'POST',body,headers:{Authorization:'Bearer synthetic-token',apikey:'synthetic-key'}}
        const input=kind==='string'?url:kind==='URL'?new URL(url):new Request(url,init)
        const response=await globalThis.fetch(input,kind==='Request'?undefined:init)
        assert.equal(response.status,200,kind+suffix)
        const last=calls.at(-1)
        assert.equal(last.url,url.replace('/fortune-interpret-v21-preview','/fortune-interpret-v22-preview'))
        assert.equal(last.body,body)
        assert.equal(last.headers.authorization,'Bearer synthetic-token')
        assert.equal(last.headers.apikey,'synthetic-key')
      }
    }
    const req=new Request('https://project.supabase.co/functions/v1/fortune-interpret-v21-preview?x=1',{
      method:'POST',body:'original',headers:{Authorization:'original',apikey:'original'},
    })
    await globalThis.fetch(req,{body:'override',headers:{Authorization:'override',apikey:'override'}})
    assert.equal(calls.at(-1).body,'override')
    assert.equal(calls.at(-1).headers.authorization,'override')
    assert.equal(calls.at(-1).headers.apikey,'override')
    const unrelated='https://project.supabase.co/rest/v1/readings?select=*#other'
    await globalThis.fetch(unrelated)
    assert.equal(calls.at(-1).url,unrelated)
  })
})

test('installed Supabase SDK region invoke uses dynamic fetch and reaches V22', async()=>{
  const { createClient }=await import('@supabase/supabase-js')
  const client=createClient('https://project.supabase.co','synthetic-key',{
    global:{fetch:(...args)=>globalThis.fetch(...args)},auth:{persistSession:false,autoRefreshToken:false},
  })
  await withTransport(async(calls)=>{
    const {error}=await client.functions.invoke('fortune-interpret-v21-preview',{
      region:'ap-northeast-2',body:{action:'status',job_id:'job-test'},headers:{Authorization:'Bearer synthetic-token'},
    })
    assert.equal(error,null)
    assert.equal(calls.length,1)
    const url=new URL(calls[0].url)
    assert.equal(url.pathname,'/functions/v1/fortune-interpret-v22-preview')
    assert.equal(url.searchParams.get('forceFunctionRegion'),'ap-northeast-2')
    assert.equal(calls[0].headers.authorization,'Bearer synthetic-token')
    assert.equal(calls[0].headers.apikey,'synthetic-key')
    assert.equal(JSON.parse(calls[0].body).action,'status')
  })
})
