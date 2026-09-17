import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const exact={contract_version:'integrated-precision-v2',time_available:true,time_exact:true,status:'exact',time_source:'official_record',time_confidence:'exact',scoring_mode:'full_exact',allow_natal_moon_scoring:true,allow_angles_houses_scoring:true,allow_house_ruler_bonus:true,allow_intraday_timing:true,allow_saju_ai:true,allow_thai_ai:true,layer_policy:{natal_moon:'allow',angles_houses:'allow',house_ruler_bonus:'allow',intraday_timing:'allow',saju_ai:'allow',thai_ai:'allow'}}

async function loadV22(fakeFetch){
  const {stripTypeScriptTypes}=await import('node:module')
  const vm=await import('node:vm')
  const file=new URL('../fortune-interpret-v22-preview/index.ts',import.meta.url)
  const bindings={}
  let source=fs.readFileSync(file,'utf8')
  for(const match of source.matchAll(/^import \{([^}]+)\} from "([^"]+)";$/gm)){
    const imported=match[2].startsWith('npm:')?{createClient:()=>{throw new Error('DB must not be used on exact proxy route')}}:await import(new URL(match[2],file).href)
    for(const name of match[1].split(',').map(x=>x.trim()))bindings[name]=imported[name]
  }
  source=source.replace(/^import .*;\r?\n/gm,'')
  let handler
  vm.runInNewContext(stripTypeScriptTypes(source),{
    ...bindings,Request,Response,Headers,TextEncoder,TextDecoder,URL,structuredClone,crypto:globalThis.crypto,
    fetch:fakeFetch,setTimeout,clearTimeout,AbortController,
    Deno:{env:{get:key=>({SUPABASE_URL:'https://project.supabase.test',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service'}[key])},serve:fn=>{handler=fn}},
  })
  return handler
}

function req(extra={}){
  return new Request('https://project.supabase.test/functions/v1/fortune-interpret-v22-preview',{
    method:'POST',headers:{Authorization:'Bearer test',apikey:'anon','content-type':'application/json'},
    body:JSON.stringify({action:'start',calculation:{precision:exact},...extra}),
  })
}

test('exact request without V23 flag preserves V21 compatibility route',async()=>{
  const calls=[]
  const handler=await loadV22(async(url)=>{calls.push(String(url));return new Response(JSON.stringify({ok:true,job_id:'j1',status:'queued'}),{status:202})})
  const response=await handler(req())
  assert.equal(response.status,202)
  assert.equal(calls[0],'https://project.supabase.test/functions/v1/fortune-interpret-v21-preview')
  assert.equal(response.headers.get('x-starlight-upstream'),'fortune-interpret-v21-preview')
})

test('exact request with narrative_engine v23 routes generation to V23',async()=>{
  const calls=[]
  const handler=await loadV22(async(url)=>{calls.push(String(url));return new Response(JSON.stringify({ok:true,job_id:'j23',status:'queued',interpreter_version:'supabase-ai-v23.0-phenomenon-first'}),{status:202})})
  const response=await handler(req({narrative_engine:'v23'}))
  assert.equal(response.status,202)
  assert.equal(calls[0],'https://project.supabase.test/functions/v1/fortune-interpret-v23-preview')
  assert.equal(response.headers.get('x-starlight-upstream'),'fortune-interpret-v23-preview')
  const body=await response.json()
  assert.equal(body.job_id,'j23')
})
