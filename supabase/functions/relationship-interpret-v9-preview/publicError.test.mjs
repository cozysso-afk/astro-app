import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require=createRequire(new URL('../../../web/package.json',import.meta.url));
const ts=require('typescript');
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const helper={};vm.runInNewContext(compile(fs.readFileSync(new URL('./publicError.ts',import.meta.url),'utf8')),{exports:helper});
const source=fs.readFileSync(new URL('./index.ts',import.meta.url),'utf8');
const canary='authorization: Bearer TEST_CANARY';
const prose='합성 관계 근거와 설명입니다. '.repeat(40);
const fixture={headline:'합성 해설',overview:prose,chemistry:prose,emotional_dynamic:prose,communication:prose,conflict_pattern:prose,power_boundaries:prose,long_term:prose,timing:prose,felt_scenarios:[prose,prose,prose],practical_advice:[prose],top_aspects:[{label:'근거',meaning:prose}],limits:prose,reunion_reading:{bottom_line:prose,incoming_contact:prose},marriage_reading:Object.fromEntries(['bottom_line','bond','emotional_home','daily_life','intimacy_resources','conflict_repair','commitment_or_current_cycle','timing','caution','precision_note'].map(k=>[k,prose]))};
const provider=(data=fixture)=>new Response(JSON.stringify({usageMetadata:{promptTokenCount:10,candidatesTokenCount:20,thoughtsTokenCount:3,totalTokenCount:33},candidates:[{content:{parts:[{text:JSON.stringify(data)}]}}]}));
function harness(options={}) {
  let handler;const rows=options.rows??[],writes=[],requests=[];let inserts=0;
  const admin={auth:{getUser:async()=>({data:{user:{id:'synthetic-user'}},error:null})},from(table){
    assert.equal(table,'ai_interpret_jobs');let mode='cache',patch;
    const q={select(_s,o){if(o?.head)mode='count';return q},eq(){return q},like(){return q},gte(){return q},order(){return q},limit(){return q},insert(value){mode='insert';patch=value;return q},update(value){mode='update';patch=value;return q},single(){return finish()},then(a,b){return finish().then(a,b)}};
    async function finish(){
      if(mode==='cache')return {data:rows,error:options.cacheError?{message:canary}:null};
      if(mode==='count')return {count:options.count??0,error:null};
      if(mode==='insert'){inserts++;rows.unshift({id:'synthetic-job',created_at:new Date().toISOString(),...patch});return {data:{id:'synthetic-job'},error:null}}
      writes.push(patch);if(options.finalizeThrows)throw new Error(canary);
      if(options.finalizeError)return {data:null,error:{message:canary}};
      if(options.finalizeEmpty)return {data:null,error:null};
      Object.assign(rows[0],patch);return {data:{id:'synthetic-job'},error:null};
    }return q;
  }};
  vm.runInNewContext(compile(source),{exports:{},require:id=>id==='./publicError.ts'?helper:id.startsWith('jsr:')?{}:id.startsWith('npm:')?{createClient:(_url,key)=>{assert.equal(key,'synthetic-service');return admin}}:(()=>{throw Error('Unexpected import')})(),Response,Request,Headers,TextEncoder,crypto,AbortController,DOMException,Error,setTimeout,clearTimeout,fetch:async(_url,init)=>{requests.push(JSON.parse(init.body));return options.fetch?options.fetch(requests.length):provider()},Deno:{env:{get:k=>({SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',GEMINI_API_KEY:'synthetic-key'}[k])},serve:h=>handler=h}});
  return {rows,writes,requests,get inserts(){return inserts},async run(purpose='compatibility'){const response=await handler(new Request('https://example.test/relationship',{method:'POST',headers:{authorization:'Bearer synthetic-session'},body:JSON.stringify({calculation:{result:{}},purpose})}));return {status:response.status,body:await response.json()}}};
}
function safe(value){assert(!JSON.stringify(value).includes('TEST_CANARY'));}
for(const mode of ['compatibility','reunion','marriage_unmarried','marriage_married'])test(`${mode}: actual handler happy path and valid cache reuse`,async()=>{
  const h=harness();const first=await h.run(mode);assert.equal(first.body.ok,true);assert.equal(first.body.data.headline,fixture.headline);assert.equal(first.body.data.overview,prose.trim());assert.equal(first.body.usage.total_tokens,33);assert.equal(first.body.usage.attempt_count,1);assert.equal(h.writes[0].status,'done');
  const second=await h.run(mode);assert.equal(second.body.reused,true);assert.deepEqual(second.body.data,first.body.data);assert.equal(second.body.model,first.body.model);assert.equal(second.body.interpreter_version,first.body.interpreter_version);assert.equal(h.requests.length,1);
});
test('generation exceptions produce fixed HTTP response and safe failed storage',async()=>{
  const h=harness({fetch:()=>{throw new Error(canary)}}),r=await h.run();assert.equal(r.body.error_code,'REL_GENERATION_FAILED');assert.equal(h.requests.length,2);assert.equal(h.writes[0].status,'failed');assert.equal(h.writes[0].error,r.body.error);safe(r);safe(h.writes);
});
test('timeout, provider HTTP body, malformed outer/inner JSON and validation failure are fixed',async()=>{
  for(const [fetch,code] of [[()=>{throw new DOMException(canary,'AbortError')},'REL_GENERATION_TIMEOUT'],[()=>new Response(canary,{status:503}),'REL_GENERATION_FAILED'],[()=>new Response(canary),'REL_RESULT_INVALID'],[()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:canary}]}}]})),'REL_RESULT_INVALID'],[()=>provider({}),'REL_RESULT_INVALID']]){
    const h=harness({fetch}),r=await h.run();assert.equal(r.body.error_code,code);safe(r);safe(h.writes);
  }
});
test('invalid done cache rejects arbitrary outer objects without provider calls',async()=>{
  for(const value of [{message:canary},{debug:{authorization:canary}},{ok:true,data:{}},null,[],{ok:true,data:fixture,model:canary,interpreter_version:'bad'}]){
    const h=harness({rows:[{status:'done',result_json:value}]}),r=await h.run();assert.equal(r.status,502);assert.equal(r.body.error_code,'REL_CACHED_RESULT_INVALID');safe(r);assert.equal(h.requests.length,0);
  }
});
test('cached metadata and usage projection strip unknown nested diagnostics without changing prose',async()=>{
  const h=harness(),first=await h.run();
  // Keywords in legitimate interpretation prose must not be generic-filtered.
  h.rows[0].result_json.data.overview='The word authorization appears in this interpretation.';
  h.rows[0].result_json.debug={authorization:canary};h.rows[0].result_json.data.debug={authorization:canary};
  for(const usage of [{...first.body.usage,debug:{authorization:canary}},[],canary,null]){
    h.rows[0].usage_json=usage;const r=await h.run();assert.equal(r.body.ok,true);safe(r);assert.equal(r.body.data.overview,h.rows[0].result_json.data.overview);assert.equal(typeof r.body.usage,'object');assert(!Array.isArray(r.body.usage));
  }
});
test('fallback keeps model/fallback_from and cumulative usage',async()=>{
  const h=harness({fetch:n=>n===1?provider({}):provider()}),r=await h.run();assert.equal(r.body.ok,true);assert.equal(r.body.model,'gemini-3.6-flash');assert.equal(r.body.fallback_from,'gemini-3.7-flash');assert.equal(r.body.usage.total_tokens,66);assert.equal(r.body.usage.attempt_count,2);
});
test('cost guard blocks new generation with unchanged limits',async()=>{
  const h=harness({count:6}),r=await h.run();assert.equal(r.body.cost_guard_blocked,true);assert.equal(r.body.rolling_job_guard,true);assert.equal(h.requests.length,0);assert.equal(h.inserts,0);
  for(const literal of ['MAX_USER_NEW_JOBS_10M=6','MAX_USER_NEW_JOBS_24H=20','MAX_GLOBAL_NEW_JOBS_10M=18','MAX_GLOBAL_NEW_JOBS_24H=60','MAX_GEMINI_CALLS=2','MAX_PROMPT_BYTES=110000'])assert(source.includes(literal));
});
for(const success of [true,false])test(`${success?'done':'failed'} final update errors and rejections never claim success or leak`,async()=>{
  for(const flag of ['finalizeError','finalizeThrows','finalizeEmpty']){
    const h=harness({[flag]:true,...(!success?{fetch:()=>{throw new Error(canary)}}:{})}),r=await h.run();assert.equal(r.body.ok,false);assert.equal(r.body.error_code,'REL_JOB_FINALIZE_FAILED');assert(r.status>=500);safe(r);assert.equal(h.rows[0].status,'queued');
  }
});
test('failed finalization then stale matching row can proceed under normal guards',async()=>{
  const options={finalizeError:true},h=harness(options);await h.run();assert.equal(h.rows[0].status,'queued');
  const fresh=await h.run();assert.equal(fresh.body.inflight,true);assert.equal(h.requests.length,1);
  h.rows[0].created_at=new Date(Date.now()-11*60*1000).toISOString();options.finalizeError=false;
  const next=await h.run();assert.equal(next.body.ok,true);assert.equal(next.body.inflight,undefined);assert.equal(h.inserts,2);
});
test('fresh/recently updated queued/running are protected; both stale states recover',async()=>{
  for(const status of ['queued','running']){
    for(const age of [0,5,11]){
      const h=harness({rows:[{status,created_at:new Date(Date.now()-age*60000).toISOString()}]}),r=await h.run();assert.equal(r.body.inflight,age<10?true:undefined);assert.equal(h.requests.length,age<10?0:1);
    }
    const h=harness({rows:[{status,created_at:'2020-01-01T00:00:00Z',updated_at:new Date().toISOString()}]});assert.equal((await h.run()).body.inflight,true);
  }
  assert(helper.STALE_RELATIONSHIP_JOB_MS>115000*2);assert.equal(helper.isStaleRelationshipJob({created_at:'invalid'}),false);
});
test('public helper ignores hostile extras, inherited codes and malformed usage',()=>{
  for(const code of ['constructor','toString','proto'])safe(helper.publicRelationshipError(code,{error:canary,stage:canary,usage:{total_tokens:Infinity,debug:canary},model:canary}));
  assert.equal(Object.keys(helper.publicUsage([canary])).length,0);
});
