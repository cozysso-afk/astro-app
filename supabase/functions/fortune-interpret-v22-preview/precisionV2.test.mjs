import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { precisionGateFromPayload, sanitizeProvisionalCalculation, auditProvisionalResidue, attachPrecisionPacketMetadata, sanitizeProvisionalInterpretationOutput } from './precisionV2.ts'
import { normalizeProxiedFortuneResponse, publicFortuneError } from '../_shared/fortuneAiPublicError.ts'

const exact={contract_version:'integrated-precision-v2',time_available:true,time_exact:true,status:'exact',time_source:'official_record',time_confidence:'exact',scoring_mode:'full_exact',allow_natal_moon_scoring:true,allow_angles_houses_scoring:true,allow_house_ruler_bonus:true,allow_intraday_timing:true,allow_saju_ai:true,allow_thai_ai:true,layer_policy:{natal_moon:'allow',angles_houses:'allow',house_ruler_bonus:'allow',intraday_timing:'allow',saju_ai:'allow',thai_ai:'allow'}}
const provisional={contract_version:'integrated-precision-v2',time_available:true,time_exact:false,status:'provisional',time_source:'family_memory',time_confidence:'medium',scoring_mode:'planet_only_provisional',allow_natal_moon_scoring:false,allow_angles_houses_scoring:false,allow_house_ruler_bonus:false,allow_intraday_timing:false,allow_saju_ai:false,allow_thai_ai:false,layer_policy:{natal_moon:'exclude',angles_houses:'exclude',house_ruler_bonus:'exclude',intraday_timing:'exclude',saju_ai:'exclude',thai_ai:'exclude'}}

test('classifies exact and provisional',()=>{assert.equal(precisionGateFromPayload({precision:exact}).mode,'exact');assert.equal(precisionGateFromPayload({precision:provisional}).mode,'provisional')})
test('rejects legacy and inconsistent provenance',()=>{assert.equal(precisionGateFromPayload({}).ok,false);assert.equal(precisionGateFromPayload({precision:{...exact,time_source:'family_memory'}}).ok,false)})
test('provisional sanitizer removes mixed-system and time-sensitive evidence',()=>{const c={precision:provisional,saju:{pillars:{}},thai:{x:1},western:{natal:{asc:1,mc:2,house_system:{used:'Placidus'}},detail_days:[{x:1}],daily_scores:[{evidence:[{kind:'aspect',transit:'Moon',target:'Venus',text:'Moon→Venus trine'},{kind:'aspect',transit:'Venus',target:'Moon',text:'Venus→Moon trine'},{kind:'house',whole_house:7,text:'Venus · Whole Sign 7H'}]}]}};const safe=sanitizeProvisionalCalculation(c);assert.equal(safe.saju.provisional_excluded_from_ai,true);assert.equal(safe.thai.provisional_excluded_from_ai,true);assert.equal(safe.western.daily_scores[0].evidence.length,1);assert.equal(safe.western.daily_scores[0].evidence[0].target,'Venus');assert.equal(auditProvisionalResidue(safe).ok,true)})
test('sanitizer scrubs backend explanatory policy text before residue audit',()=>{const c={precision:provisional,saju:{pillars:{}},thai:{x:1},western:{score_policy:'provisional: 출생 Moon·ASC/MC·하우스·하우스 룰러 보너스 제외',method:'provisional planet-only period sampling; exact clock timing is intentionally not exposed',natal:{asc:null,mc:null,house_system:null,precision_note:'provisional birth time: natal Moon, ASC/MC and all house-sensitive scoring are excluded'},daily_scores:[]}};const safe=sanitizeProvisionalCalculation(c);assert.doesNotMatch(safe.western.score_policy,/\b(?:ASC|MC)\b/);assert.equal(auditProvisionalResidue(safe).ok,true)})
test('residue audit catches time and house leaks',()=>{assert.equal(auditProvisionalResidue({x:'Placidus 7H 12:30'}).ok,false);assert.equal(auditProvisionalResidue({target:'MC'}).ok,false)})
test('packet metadata is Western-only in provisional',()=>{const p=attachPrecisionPacketMetadata({saju:{x:1},thai:{x:1},evidence_ledger:[{ref:'W:window:1'},{ref:'W:planet:1'}]},{precision:provisional});assert.equal(p.precision_mode,'provisional');assert.equal(p.saju,null);assert.equal(p.thai,null);assert.deepEqual(p.evidence_ledger,[{ref:'W:planet:1'}])})
test('final provisional output strips cross-system claims',()=>{const out=sanitizeProvisionalInterpretationOutput({overall:{summary:'Western flow. Thai says X.',dominant_pattern:'사주 흐름. stable.'},systems:{western:'ok',saju:'bad',thai:'bad'},cross_checks:[{mode:'복수체계',saju:'x',thai:'y',synthesis:'Thai match'}]});assert.equal(out.systems.saju,'');assert.equal(out.systems.thai,'');assert.equal(out.cross_checks[0].mode,'Western단독');assert.doesNotMatch(out.overall.summary,/Thai/)})
test('transit Moon to robust natal planet remains allowed',()=>{assert.equal(auditProvisionalResidue({evidence:[{kind:'aspect',transit:'Moon',target:'Venus',text:'Moon→Venus trine'}]}).ok,true)})
test('date-scoped western reference IDs are not mistaken for HH:MM clock evidence',()=>{
  const packet={key_dates:[{western_refs:['W:daily:2026-09-10:10']}]}
  assert.equal(auditProvisionalResidue(packet).ok,true)
  assert.equal(auditProvisionalResidue({text:'정확한 시각 10:10'}).ok,false)
  assert.equal(auditProvisionalResidue({ref:'W:daily:2026-09-10:ASC'}).ok,false)
})

test('V22 fixed public failures omit raw exception and residue diagnostics',()=>{
  const dbFailure=publicFortuneError('PROVISIONAL_DB_WRITE_FAILED',new Error('client_secret=TEST_SECRET_DO_NOT_EXPOSE'),{gemini_paid_call:false})
  assert.equal(dbFailure.error_code,'PROVISIONAL_DB_WRITE_FAILED')
  assert.equal(dbFailure.stage,'db_write')
  assert.equal(dbFailure.error,'AI 해설 저장에 실패했어.')
  assert.doesNotMatch(JSON.stringify(dbFailure),/TEST_SECRET_DO_NOT_EXPOSE|client_secret/)

  const src=fs.readFileSync(new URL('./index.ts',import.meta.url),'utf8')
  assert.doesNotMatch(src,/precision_residue/)
  assert.doesNotMatch(src,/error:\x60[^\x60]*\$\{[^}]*\.message/)
})

test('V22 proxy boundary normalizes raw V21 errors and failed job payloads',()=>{
  const raw='Authorization: Bearer TEST_SECRET_DO_NOT_EXPOSE'
  const non2xx=normalizeProxiedFortuneResponse({ok:false,error:raw},500,'start')
  assert.equal(non2xx.body.error_code,'UPSTREAM_FAILED')
  assert.equal(non2xx.body.stage,'upstream')
  assert.doesNotMatch(JSON.stringify(non2xx),/TEST_SECRET_DO_NOT_EXPOSE|Authorization/)

  const failed=normalizeProxiedFortuneResponse({ok:true,status:'failed',error:raw,job_id:'job-test',usage:{total_tokens:12,call_trace:[{error:raw}]}},200,'status')
  assert.equal(failed.body.status,'failed')
  assert.equal(failed.body.error_code,'JOB_GENERATION_FAILED')
  assert.deepEqual(failed.body.usage,{total_tokens:12})
  assert.doesNotMatch(JSON.stringify(failed),/TEST_SECRET_DO_NOT_EXPOSE|Authorization/)
})

// Execute the actual entrypoints and their relative imports; only external I/O is replaced.
// This catches handler status/serialization regressions that helper-only tests cannot prove.
async function loadHandler(name, {fetch:fakeFetch, createClient, env={}}={}) {
  const {stripTypeScriptTypes}=await import('node:module')
  const vm=await import('node:vm')
  const file=new URL(`../${name}/index.ts`,import.meta.url)
  const bindings={}
  let source=fs.readFileSync(file,'utf8')
  for(const match of source.matchAll(/^import \{([^}]+)\} from "([^"]+)";$/gm)) {
    const imported=match[2].startsWith('npm:')?{createClient}:await import(new URL(match[2],file).href)
    for(const name of match[1].split(',').map(n=>n.trim()))bindings[name]=imported[name]
  }
  source=source.replace(/^import .*;\r?\n/gm,'')
  let handler
  vm.runInNewContext(stripTypeScriptTypes(source),{
    ...bindings,Request,Response,Headers,TextEncoder,TextDecoder,URL,structuredClone,crypto:globalThis.crypto,
    setTimeout,clearTimeout,AbortController,
    fetch:fakeFetch??(()=>{throw new Error('unexpected network call') }),
    Deno:{env:{get:key=>({SUPABASE_URL:'https://project.supabase.test',SUPABASE_ANON_KEY:'test-anon',SUPABASE_SERVICE_ROLE_KEY:'test-service',...env}[key])},serve:fn=>{handler=fn}},
  },{filename:file.pathname})
  return handler
}
function request(action, extra={}) {
  return new Request('https://project.supabase.test/functions/v1/fortune-interpret-v22-preview',{
    method:'POST',headers:{Authorization:'Bearer test-session',apikey:'test-anon','content-type':'application/json'},
    body:JSON.stringify({action,...extra}),
  })
}

for(const status of [401,429,503])test(`actual V22 meta preserves normalized ${status}`,async()=>{
  const handler=await loadHandler('fortune-interpret-v22-preview',{fetch:async()=>new Response(JSON.stringify({
    ok:false,error:'client_secret=TEST_CANARY_7788',error_code:status===429?'COST_GUARD_BLOCKED':'UPSTREAM_FAILED',
    retry_after_seconds:60,cost_guard_blocked:status===429,missing_key:status===503,
  }),{status})})
  const response=await handler(request('meta'))
  const body=await response.json()
  assert.equal(response.status,status)
  assert.equal(body.ok,false)
  assert.equal(body.precision_gateway,true)
  assert.equal(body.error_code,status===429?'COST_GUARD_BLOCKED':'UPSTREAM_FAILED')
  assert.equal(body.retry_after_seconds,60)
  assert.equal(body.missing_key,status===503)
  assert.doesNotMatch(JSON.stringify(body),/TEST_CANARY_7788|client_secret/)
})

test('actual V22 fetch rejection is a fixed 502 on every proxy route',async()=>{
  const handler=await loadHandler('fortune-interpret-v22-preview',{fetch:async()=>{throw new Error('https://upstream.test/#client_secret=TEST_CANARY_7788')}})
  for(const action of ['meta','status','cancel','start','prompt','inspect']) {
    const response=await handler(request(action,{calculation:{precision:exact},job_id:'job-test'}))
    const body=await response.json()
    assert.equal(response.status,502,action)
    assert.equal(body.error_code,'UPSTREAM_FAILED')
    assert.equal(body.stage,'upstream')
    assert.equal(body.error,'AI 해설 서버 요청에 실패했어.')
    assert.doesNotMatch(JSON.stringify(body),/TEST_CANARY_7788|client_secret|upstream\.test/)
  }
})

test('actual V22 rejects unrecognized 200 records and malformed bodies for every action',async()=>{
  for(const upstream of ['{"message":"client_secret=TEST_CANARY_7788"}','<html>TEST_CANARY_7788</html>','null','[]']) {
    const handler=await loadHandler('fortune-interpret-v22-preview',{fetch:async()=>new Response(upstream,{status:200,headers:{'content-type':'text/plain'}})})
    for(const action of ['meta','start','status','cancel','prompt','inspect']) {
      const response=await handler(request(action,{calculation:{precision:exact},job_id:'job-test'}))
      const body=await response.json()
      assert.equal(response.status,502,action+upstream)
      assert.equal(body.error_code,'UPSTREAM_INVALID_RESPONSE')
      assert.doesNotMatch(JSON.stringify(body),/TEST_CANARY_7788|client_secret/)
    }
  }
})

function fakeClients(row, seen=[]) {
  return (_url,key)=>{
    if(key==='test-anon')return {auth:{getUser:async()=>({data:{user:{id:'synthetic-user'}},error:null})}}
    assert.equal(key,'test-service')
    return {from(table){
      assert.equal(table,'ai_interpret_jobs')
      const query={}
      for(const op of ['select','eq','in','or','order','limit','like','gte','update','insert'])query[op]=(...args)=>{seen.push({op,args});return query}
      query.maybeSingle=async()=>({data:structuredClone(row),error:null})
      query.single=query.maybeSingle
      query.then=(resolve)=>resolve({data:structuredClone(row),error:null,count:0})
      return query
    }}
  }
}
const exactCalculation={precision:exact,period:{start:'2026-09-11',end:'2026-09-11'},western:{daily_scores:[],key_dates:[]}}

test('actual V21 success envelopes survive V22 for meta start status cancel prompt inspect',async()=>{
  const now=new Date().toISOString()
  const result={headline:'원문 그대로',overall:{summary:'본문; authorization failed'},nested:{text:'result_json is opaque'}}
  const row={id:'job-test',status:'done',result_json:result,usage_json:{total_tokens:42,call_trace:[]},model:'gemini-3.7-flash',fallback_from:null,
    created_at:now,updated_at:now,completed_at:now,period_start:'2026-09-11',period_end:'2026-09-11'}
  const v21=await loadHandler('fortune-interpret-v21-preview',{createClient:fakeClients(row),env:{GEMINI_API_KEY:'synthetic-key-no-network'}})
  const v22=await loadHandler('fortune-interpret-v22-preview',{fetch:async(url,init)=>{
    assert.equal(url,'https://project.supabase.test/functions/v1/fortune-interpret-v21-preview')
    assert.equal(new Headers(init.headers).get('authorization'),'Bearer test-session')
    assert.equal(new Headers(init.headers).get('apikey'),'test-anon')
    return v21(new Request(url,init))
  }})
  for(const action of ['meta','start','status','cancel','prompt','inspect']) {
    const extra={calculation:exactCalculation,job_id:'job-test'}
    const direct=await v21(request(action,extra)), through=await v22(request(action,extra))
    const expected=await direct.json(), actual=await through.json()
    assert.equal(through.status,direct.status,action)
    assert.notEqual(actual.error_code,'UPSTREAM_INVALID_RESPONSE',action)
    if(action==='meta') {
      assert.equal(actual.configured,true)
      assert.deepEqual(actual.models,expected.models)
      for(const [key,value] of Object.entries(expected))if(key!=='interpreter_version')assert.deepEqual(actual[key],value,key)
    } else assert.deepEqual(actual,expected,action)
  }
  for(const state of ['queued','running','failed']) {
    row.status=state; row.result_json=null;row.error='client_secret=TEST_CANARY_7788'
    row.usage_json={total_tokens:42,call_trace:[{error:row.error}],unexpected:row.error}
    const through=await v22(request('status',{job_id:'job-test'}));const body=await through.json()
    assert.equal(through.status,200)
    assert.equal(body.status,state)
    assert.equal(body.usage.total_tokens,42)
    assert.doesNotMatch(JSON.stringify(body),/TEST_CANARY_7788|client_secret/)
  }
})

test('success-looking objects cannot smuggle unknown error siblings or invalid envelopes',()=>{
  const canary='client_secret=TEST_CANARY_7788'
  for(const [action,valid] of [
    ['meta',{configured:true}],['start',{ok:true,job_id:'job-test',status:'queued'}],
    ['status',{ok:true,job_id:'job-test',status:'done',data:{full:'reading'},result_json:{full:'reading'}}],
    ['cancel',{ok:true,job_id:'job-test',canceled:true}],['prompt',{ok:true,prompt:'full prompt'}],
    ['inspect',{ok:true,full_payload_bytes:1,prompt_payload_bytes:1,prompt_budget_ok:true}],
  ]) {
    const out=normalizeProxiedFortuneResponse({...valid,message:canary,error:canary,stage:canary,error_code:canary,call_trace:[canary]},200,action)
    assert.equal(out.status,200)
    assert.doesNotMatch(JSON.stringify(out),/TEST_CANARY_7788/)
    if(action==='status') {assert.deepEqual(out.body.data,valid.data);assert.deepEqual(out.body.result_json,valid.result_json)}
  }
  for(const [action,payload] of [
    ['start',{ok:true,job_id:'job-test',status:'unknown'}],['status',{ok:true,job_id:'job-test',status:['queued']}],['status',{ok:true,status:'done',job_id:'job-test'}],
    ['status',{ok:true,status:'running',job_id:{secret:canary}}],['cancel',{ok:true,job_id:'job-test',canceled:'yes'}],
    ['prompt',{ok:true,prompt:{secret:canary}}],['inspect',{ok:true,full_payload_bytes:1}],['meta',{configured:'yes'}],
  ])assert.equal(normalizeProxiedFortuneResponse(payload,200,action).status,502)
})

test('provisional deterministic completion and reuse remain local with zero fetch calls',async()=>{
  const calls=[]
  const handler=await loadHandler('fortune-interpret-v22-preview',{
    createClient:fakeClients({id:'provisional-job'},calls),fetch:()=>{throw new Error('provisional must never fetch')},
  })
  const calculation={...exactCalculation,precision:provisional}
  const fresh=await handler(request('start',{calculation}));const body=await fresh.json()
  assert.equal(fresh.status,200);assert.equal(body.status,'done');assert.equal(body.reused,false);assert.equal(body.gemini_paid_call,false)
  const inserted=calls.find(c=>c.op==='insert').args[0]
  assert.equal(inserted.usage_json.total_tokens,0)
  assert.equal(auditProvisionalResidue(inserted.result_json).ok,true)
  const cached=await loadHandler('fortune-interpret-v22-preview',{createClient:fakeClients({id:'provisional-job',result_json:inserted.result_json}),fetch:()=>{throw new Error('no fetch')}})
  const reused=await (await cached(request('start',{calculation}))).json()
  assert.equal(reused.reused,true);assert.equal(reused.gemini_paid_call,false)
})

test('V22 preserves accepted starts and HTTP-200 cost guard semantics',async()=>{
  for(const status of ['queued','running','done']) {
    const body={ok:true,job_id:'job-test',status,reused:true,inflight:status!=='done',interpreter_version:'v21',prompt_budget:{bytes:123,max_bytes:456,estimated_input_tokens:31}}
    const http=status==='done'?200:202
    const handler=await loadHandler('fortune-interpret-v22-preview',{fetch:async()=>new Response(JSON.stringify(body),{status:http})})
    const response=await handler(request('start',{calculation:exactCalculation}))
    assert.equal(response.status,http)
    assert.match(response.headers.get('content-type'),/^application\/json/)
    assert.deepEqual(await response.json(),body)
  }
  const body={ok:false,error_code:'COST_GUARD_BLOCKED',error:'TEST_CANARY_7788',cost_guard_blocked:true,rolling_job_guard:true,retry_after_seconds:120}
  const handler=await loadHandler('fortune-interpret-v22-preview',{fetch:async()=>new Response(JSON.stringify(body))})
  const response=await handler(request('start',{calculation:exactCalculation})), actual=await response.json()
  assert.equal(response.status,200)
  assert.equal(actual.error_code,'COST_GUARD_BLOCKED')
  assert.equal(actual.retry_after_seconds,120)
  assert.equal(actual.cost_guard_blocked,true)
  assert.equal(actual.rolling_job_guard,true)
  assert.doesNotMatch(JSON.stringify(actual),/TEST_CANARY_7788/)
})

test('historical canceled timeout and genuine failures retain identity and spent usage',async()=>{
  for(const [error,code] of [
    ['AI 해설 생성이 사용자 요청으로 취소됐어.','JOB_CANCELED'],
    ['AI 해설 작업이 제한시간을 넘겨 자동 종료됐어.','JOB_TIMEOUT'],
    ['client_secret=TEST_CANARY_7788','JOB_GENERATION_FAILED'],
  ]) {
    const row={id:'job-test',status:'failed',error,usage_json:{total_tokens:31,call_trace:[{error:'TEST_CANARY_7788'}]},result_json:null}
    const v21=await loadHandler('fortune-interpret-v21-preview',{createClient:fakeClients(row)})
    const v22=await loadHandler('fortune-interpret-v22-preview',{fetch:async(url,init)=>v21(new Request(url,init))})
    const response=await v22(request('status',{job_id:'job-test'})),actual=await response.json()
    assert.equal(response.status,200)
    assert.equal(actual.error_code,code)
    assert.equal(actual.usage.total_tokens,31)
    assert.doesNotMatch(JSON.stringify(actual),/TEST_CANARY_7788|client_secret/)
  }
})
