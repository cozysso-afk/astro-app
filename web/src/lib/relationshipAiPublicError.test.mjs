import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),ts=require('typescript'),sdk=require('@supabase/supabase-js')
const {FunctionsClient}=require('@supabase/functions-js')
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
const server={};vm.runInNewContext(compile(fs.readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/publicError.ts',import.meta.url),'utf8')),{exports:server})
const boundary={};vm.runInNewContext(compile(fs.readFileSync(new URL('./relationshipAiPublicError.ts',import.meta.url),'utf8')),{exports:boundary,require:id=>id==='@supabase/supabase-js'?sdk:server,Error,Response})
const app=fs.readFileSync(new URL('../AppNext.tsx',import.meta.url),'utf8'),start=app.indexOf('  const runRelationshipAi ='),end=app.indexOf('\n  const ',start+10),run=app.slice(start,end)
assert(run.includes('relationshipAiCatchMessage'))
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json',...headers}})
const canaries=['authorization: Bearer TEST_CANARY','{"authorization":"Bearer TEST_CANARY"}','client_secret=TEST_CANARY','cookie=session-TEST_CANARY','https://example.test/#access_token=TEST_CANARY','authorization%3ABearer%20TEST_CANARY','%253Fclient_secret%253DTEST_CANARY','client_\u200bsecret=TEST_CANARY','%ZZ%61%70%69%6b%65%79%3DTEST_CANARY','%FF%61%70%69%6b%65%79%3DTEST_CANARY',JSON.stringify(JSON.stringify({error:'client_secret=TEST_CANARY'})),'x'.repeat(20001)+'TEST_CANARY']
async function invoke(fetcher,cache=null,session=async()=>{}){
  let error='',saved=null,state=null,calls=0
  const client=new FunctionsClient('https://example.test/functions/v1',{customFetch:async(...args)=>{calls++;return fetcher(...args)}})
  const ctx=vm.createContext({...boundary,Error,relationshipResult:{},relationshipRevisionRef:{current:1},selectedTool:'relationship',marriageMode:'unmarried',relationshipPurpose:'compatibility',relationshipRequestSnapshot:null,reunionTiming:null,aiModel:'gemini-3.7-flash',relationshipAiCacheId:()=> 'synthetic-cache',setRelationshipAiLoading:()=>{},setRelationshipAiError:x=>error=x,readReadingCache:async()=>cache,ensureSupabaseSession:session,supabase:{functions:client},annotatePayload:x=>x,writeReadingCache:async(_id,_kind,x)=>saved=x,RELATIONSHIP_AI_CACHE_TTL_DAYS:30,setRelationshipAi:x=>state=x,setRelationshipAiCacheSource:()=>{}})
  vm.runInContext(compile(run+'\nglobalThis.runTest=runRelationshipAi'),ctx);await ctx.runTest();return {error,saved,state,calls}
}
test('FunctionsHttpError known Relationship code maps locally despite hostile extras',async()=>{
  const r=await invoke(async()=>json({error_code:'REL_GENERATION_TIMEOUT',error:canaries[0],stage:canaries[0]},503))
  assert.equal(r.error,'관계 AI 해설 시간이 초과됐어.')
})
for(const status of [200,500])test(`HTTP ${status}: 12 raw/encoded/nested/long adversarial errors fail closed`,async()=>{
  for(const error of canaries){const r=await invoke(async()=>json({ok:false,error},status));assert.equal(r.error,boundary.RELATIONSHIP_ERROR_FALLBACK);assert.equal(r.saved,null);assert.equal(r.state,null)}
})
test('FunctionsFetchError has fixed connection message',async()=>{
  const r=await invoke(async()=>{throw new Error(canaries[0])});assert.equal(r.error,boundary.RELATIONSHIP_CONNECTION_FALLBACK)
})
test('FunctionsRelayError never trusts its Response body',async()=>{
  const r=await invoke(async()=>json({error:canaries[0],error_code:'REL_GENERATION_TIMEOUT'},502,{'x-relay-error':'true'}));assert.equal(r.error,boundary.RELATIONSHIP_RELAY_FALLBACK)
})
test('malformed HTTP JSON and unknown final-catch exceptions fall back',async()=>{
  for(const status of [200,500]){
    const r=await invoke(async()=>new Response('client_secret=TEST_CANARY',{status,headers:{'content-type':'application/json'}}));assert.equal(r.error,boundary.RELATIONSHIP_ERROR_FALLBACK)
  }
  const r=await invoke(async()=>{throw Error('must not fetch')},null,async()=>{throw new Error(canaries[0])});assert.equal(r.error,boundary.RELATIONSHIP_ERROR_FALLBACK);assert.equal(r.calls,0)
})
test('prototype-looking codes are not inherited public messages; harmless legacy strings survive',()=>{
  for(const error_code of ['proto','constructor','toString']){
    assert.equal(boundary.relationshipAiPublicErrorMessage({error_code}),boundary.RELATIONSHIP_ERROR_FALLBACK)
    assert.equal(boundary.relationshipAiPublicErrorMessage({error_code,error:'relationship request failed'}),'relationship request failed')
  }
  for(const error of ['관계 AI 해설 시간이 초과됐어.','인증이 필요해.','relationship request failed','cookie parsing failed','ordinary malformed %ZZ text'])assert.equal(boundary.relationshipAiPublicErrorMessage({error}),error)
})
test('additional double encoding, invalid UTF and Cf combinations are unsafe',()=>{
  for(const s of ['https://example.test/#access_token=TEST_CANARY','upstream;client_secret=TEST_CANARY','%FF%61%70%69%6b%65%79%3DTEST_CANARY','%ZZclient_\u200bsecret%3DTEST_CANARY']){
    for(const value of [s,encodeURIComponent(s)])assert.equal(boundary.relationshipAiPublicErrorMessage({error:value}),boundary.RELATIONSHIP_ERROR_FALLBACK)
  }
})
function success(){
  const data=Object.fromEntries(['headline','overview','chemistry','emotional_dynamic','communication','conflict_pattern','power_boundaries','long_term','timing','reunion_context','limits'].map(k=>[k,'합성 본문']))
  data.felt_scenarios=['합성'];data.practical_advice=['합성'];data.top_aspects=[{label:'합성',meaning:'합성'}]
  data.reunion_reading=Object.fromEntries(['bottom_line','contact_recontact','emotional_reactivation','relationship_rebuilding','incoming_contact','outgoing_contact','reconnection_windows','low_windows','relationship_filter','precision_note'].map(k=>[k,'']))
  data.marriage_reading=Object.fromEntries(['mode','bottom_line','bond','emotional_home','daily_life','intimacy_resources','conflict_repair','commitment_or_current_cycle','timing','caution','precision_note'].map(k=>[k,'']))
  return {ok:true,model:'gemini-3.7-flash',interpreter_version:'relationship-v11.6-reunion-compact-evidence',data,usage:{total_tokens:33}}
}
test('unexpected 2xx success envelopes cannot populate state/cache',async()=>{
  for(const payload of [{message:canaries[0]},{ok:true,data:{debug:canaries[0]}},{ok:1,data:{}},[]]){const r=await invoke(async()=>json(payload));assert.equal(r.error,boundary.RELATIONSHIP_ERROR_FALLBACK);assert.equal(r.state,null);assert.equal(r.saved,null)}
})
test('valid fresh/local cached results preserve text, usage and metadata while removing diagnostics',async()=>{
  for(const local of [true,false]){
    const payload=success();payload.data.overview='Legitimate prose about authorization and cookie parsing.';payload.debug={authorization:canaries[0]};payload.usage.debug={authorization:canaries[0]}
    const r=await invoke(async()=>json(payload),local?payload:null);assert.equal(r.error,'');assert.equal(r.calls,local?0:1);assert.equal(r.state.data.overview,payload.data.overview);assert.equal(r.state.model,payload.model);assert.equal(r.state.usage.total_tokens,33);assert(!JSON.stringify(r.state).includes('TEST_CANARY'));assert(!JSON.stringify(r.saved).includes('TEST_CANARY'))
  }
})
