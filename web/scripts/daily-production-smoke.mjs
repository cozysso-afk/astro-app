// Paid-call capable: run only in the explicitly authorized QA workflow.
// A fresh run passes one generation start at most. An existing-job rerun passes zero.
import assert from 'node:assert/strict'
import {mkdir, writeFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import path from 'node:path'
import {readerFacingFortune} from '../src/lib/readerFacingFortune.ts'
import {buildDailyReadingDocument} from '../src/lib/dailyReadingDocument.ts'
import {buildPeriodReadingDocument} from '../src/lib/authoredReadingDocument.ts'
import {fortuneGroup} from '../src/lib/fortuneFields.ts'

const require = createRequire(import.meta.url)
const {chromium} = require('playwright')
const out = path.resolve('daily-production-artifacts')
const origin = 'https://astro-app-web-ten.vercel.app'
const mode = process.env.QA_RUN_MODE
const period = process.env.QA_PERIOD
const date = process.env.QA_REPLAY_DATE?.trim()
const version = process.env.QA_REPLAY_VERSION?.trim()
const start = new Date(date+'T00:00:00Z')
const daily = period === 'day'
let endDate
const model = 'gemini-3.7-flash'
const endpoint = 'fortune-interpret-v22-preview'
const existingJobId = process.env.QA_EXISTING_JOB_ID || ''
const profile = {name:'synthetic-qa-only',birthDate:'1987-06-15',birthTime:'08:30',placeKey:'',latitude:'37.5665',longitude:'126.978',utcOffset:'9',gender:'female',timeSource:'official_record',timeConfidence:'exact',rectifiedWindowStart:'',rectifiedWindowEnd:''}
const report = {source:'Authenticated production homepage, synthetic QA profile',url:origin,period,date,mode,expectedVersion:version,expectedModel:model,replay:!!existingJobId,replayPolicy:existingJobId?'Only start response bridges to explicitly supplied real existing job; authentication, calculation, polling and UI are production':'No route responses mocked',startAttempts:0,forwardedStarts:0,blockedStarts:0,geminiCallsThisRun:0,jobGeminiCalls:null,reused:null,rawManuscriptPresent:false,widths:[],scopes:[],exportedImages:0,errors:[],stage:'configuration'}
let browser, page, session, calculation, finalStatus, jobId = existingJobId
let explicitGeneration = false
const pending = new Set()
const downloads = []
const fileWrites = new Map()
let exportScope = 'overall'
await mkdir(out,{recursive:true})
const save = (name,data) => {
  const json=JSON.stringify(data,null,2)
  const writing=(fileWrites.get(name)||Promise.resolve()).catch(()=>{}).then(()=>writeFile(path.join(out,name),json))
  fileWrites.set(name,writing)
  return writing
}
const required = name => {assert.ok(process.env[name],`Missing ${name}`);return process.env[name].trim()}
const safeError = error => {
  let message=String(error?.message || error)
  for(const secret of [process.env.QA_USER_EMAIL,process.env.QA_USER_PASSWORD,process.env.QA_SUPABASE_ANON_KEY,session?.access_token,session?.refresh_token]) if(secret)message=message.split(secret).join('[redacted]')
  return message.replace(/Bearer\s+\S+/gi,'Bearer [redacted]').replace(/eyJ[\w.-]+/g,'[token]').replace(/[\w.+-]+@[\w.-]+/g,'[email]').slice(0,700)
}
async function post(url,body,headers={}) {
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)})
  assert.ok(response.ok,`QA upstream HTTP ${response.status}`)
  return response.json()
}
async function persistCandidate() {
  await save('candidate.json',{synthetic_profile:true,replay_policy:report.replayPolicy,job_id:jobId,calculation:calculation ?? null,status:finalStatus ? {ok:finalStatus.ok,status:finalStatus.status,job_id:jobId,model:finalStatus.model,origin:finalStatus.origin,usage:finalStatus.usage,interpreter_version:finalStatus.interpreter_version,provenance_verified:finalStatus.provenance_verified,period_start:finalStatus.period_start,period_end:finalStatus.period_end,data:finalStatus.data} : null})
}
function observeJob(data) {
  const usage = data?.usage
  const count = Number.isInteger(usage?.attempt_count) ? usage.attempt_count : (usage?.call_trace?.length || null)
  report.jobGeminiCalls = count
  report.geminiCallsThisRun = !report.forwardedStarts || report.reused === true ? 0 : count
  report.rawManuscriptPresent = Boolean(data?.provenance_verified && data?.origin === 'gemini' && data?.data?.headline?.trim())
}
function indexManuscript(raw,display,fieldPath='',index=new Map()) {
  if (typeof display==='string' && display.trim() && !index.has(display.trim())) {
    index.set(display.trim(),{fieldPath,raw})
  } else if (display && typeof display==='object') {
    for (const [key,value] of Object.entries(display)) {
      if (key!=='evidence_refs') indexManuscript(raw?.[key],value,fieldPath?fieldPath+'.'+key:key,index)
    }
  }
  return index
}
function track(promise) {
  pending.add(promise)
  promise.catch(error=>report.errors.push(safeError(error))).finally(()=>pending.delete(promise))
}
function assertHealthy() {
  assert.ok(!report.generationFailed,'Production generation failed; no retry attempted')
  assert.ok(!report.calculationFailed,'Production calculation failed; no generation attempted')
  assert.equal(report.errors.length,0,report.errors[0]||'Browser verification failed')
}
async function withHealth(promise) {
  let timer
  try {
    return await Promise.race([promise,new Promise((_,reject)=>{
      timer=setInterval(()=>{try{assertHealthy()}catch(error){reject(error)}},250)
    })])
  } finally {clearInterval(timer)}
}
const heartbeat=setInterval(()=>{
  console.log(JSON.stringify({event:'qa-heartbeat',stage:report.stage,forwardedStarts:report.forwardedStarts,blockedStarts:report.blockedStarts,jobObserved:!!jobId,calculationObserved:!!calculation,generationStatus:report.generationStatus||null,errorCount:report.errors.length}))
},15000)
heartbeat.unref()
try {
  assert.ok(['replay','generate'].includes(mode),'Choose replay or generate')
  assert.ok(['day','week','month'].includes(period),'Choose day, week, or month')
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(start.getTime()) && start.toISOString().slice(0,10) === date,'Invalid period start date')
  if (period === 'week') assert.equal(start.getUTCDay(),1,'Weekly start must be Monday')
  if (period === 'month') assert.equal(start.getUTCDate(),1,'Monthly start must be the first of the month')
  const end = new Date(start)
  if (period === 'week') end.setUTCDate(end.getUTCDate()+6)
  if (period === 'month') end.setUTCMonth(end.getUTCMonth()+1,0)
  endDate = end.toISOString().slice(0,10)
  assert.match(version ?? '',/^supabase-ai-v23\.[a-zA-Z0-9._-]+$/,'Exact V23 version required')
  if (mode === 'replay') {
    assert.match(existingJobId,/^[a-fA-F0-9]{8}-(?:[a-fA-F0-9]{4}-){3}[a-fA-F0-9]{12}$/,'Replay requires a completed synthetic job ID')
    assert.notEqual(process.env.QA_CONFIRM_PAID_CALLS,'true','Replay must not authorize generation')
  } else {
    assert.equal(existingJobId,'','Generation cannot accept a saved job ID')
    assert.equal(process.env.QA_CONFIRM_PAID_CALLS,'true','One-job generation must be explicitly authorized')
  }
  const supabase=required('QA_SUPABASE_URL').replace(/\/$/,'')
  const anon=required('QA_SUPABASE_ANON_KEY')
  report.stage='password-login'
  session=await post(`${supabase}/auth/v1/token?grant_type=password`,{email:required('QA_USER_EMAIL'),password:required('QA_USER_PASSWORD')},{apikey:anon})
  assert.ok(session.access_token && session.refresh_token && session.user?.id,'Password login did not return a persistent session')
  session.expires_at ||= Math.floor(Date.now()/1000)+session.expires_in
  const headers={apikey:anon,Authorization:`Bearer ${session.access_token}`}
  const request = body => post(`${supabase}/functions/v1/${endpoint}`,{narrative_engine:'v23',...body},headers)
  if(existingJobId) {
    const stored=await request({action:'status',job_id:existingJobId})
    assert.equal(stored.period_start,date,'Existing job date mismatch')
    assert.equal(stored.period_end,endDate,'Existing job end date mismatch')
    assert.equal(stored.model,model,'Existing job model mismatch')
    assert.equal(stored.interpreter_version,version,'Existing job engine mismatch')
    assert.equal(stored.status,'done','Replay needs a completed job')
    assert.equal(stored.provenance_verified,true,'Stored job lacks verified Gemini authorship')
    assert.equal(stored.origin,'gemini')
    finalStatus=stored
    observeJob(stored)
    await persistCandidate()
  }
  report.stage='browser-login'
  browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH || undefined,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']})
  const context=await browser.newContext({viewport:{width:393,height:852},acceptDownloads:true,timezoneId:'Asia/Seoul',serviceWorkers:'block'})
  page=await context.newPage()
  page.setDefaultTimeout(30000)
  await context.addInitScript(({session,key,profile,contactDate})=>{
    if(location.origin!=='https://astro-app-web-ten.vercel.app')return
    // New browser context: never reads or changes a real user's existing profile.
    localStorage.setItem(key,JSON.stringify(session))
    localStorage.setItem('starlight-destiny.birth-profile.v1',JSON.stringify(profile))
    localStorage.setItem('starlight-destiny.ui-settings.v1',JSON.stringify({glow:true,motion:false}))
    if (contactDate) localStorage.setItem('starlight-destiny.relationship-outcomes.v2',JSON.stringify([
      {date:contactDate,event:'both',note:'QA 연락 기록 확인',scores:{수신신호:52},past_connection:true,saved_at:contactDate+'T19:00:00Z'},
    ]))
    // Leave model unset to exercise the deployed 3.7 default; validate before start.
    window.__dailyQaDrawn=[]
    const fill=CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...args){window.__dailyQaDrawn.push({text,y,height:this.canvas.height});return fill.call(this,text,x,y,...args)}
  },{session,key:`sb-${new URL(supabase).hostname.split('.')[0]}-auth-token`,profile,contactDate:date})
  page.on('pageerror',error=>report.errors.push(safeError(error)))
  page.on('download',download=>{
    const filename=`${exportScope}-export-${downloads.length+1}.png`
    const saving=download.saveAs(path.join(out,filename))
    downloads.push(saving);track(saving)
  })
  // Guard every Edge function interpreter, including legacy non-action generation calls.
  await context.route('**/functions/v1/**',async route=>{
    const req=route.request()
    if(req.method()!=='POST')return route.continue()
    let body
    try {body=req.postDataJSON()} catch {return route.abort('blockedbyclient')}
    const functionName=new URL(req.url()).pathname.split('/').at(-1)
    if(!/interpret|generat|portrait/i.test(functionName))return route.continue()
    if(['meta','status','inspect','prompt','cancel'].includes(body?.action))return route.continue()
    report.startAttempts++
    try {
      assert.equal(report.startAttempts,1,'Additional generation blocked')
      assert.ok(explicitGeneration,'Generation before clicking the separate generation button was blocked')
      assert.equal(functionName,endpoint,'Unexpected generation endpoint blocked')
      assert.equal(body.action,'start','Legacy generation blocked')
      assert.equal(body.narrative_engine,'v23','Unexpected engine blocked')
      assert.equal(body.model,model,'Non-3.7 model blocked before paid start')
      assert.equal(body.calculation?.period?.start,date,'Unexpected generation start date')
      assert.equal(body.calculation?.period?.end,endDate,'Unexpected generation end date')
      // Playwright response-body decoding can finish after the app has decoded its copy.
      // Join those reads before allowing React's immediately following generation request.
      await Promise.all([...pending])
      assertHealthy()
      assert.ok(calculation,'Synthetic calculation was not observed')
      if(existingJobId) {
        return route.fulfill({status:202,contentType:'application/json',body:JSON.stringify({ok:true,job_id:existingJobId,status:'queued',reused:true,interpreter_version:version})})
      }
      report.stage='prepaid-inspection'
      // The public V22 gateway intentionally omits cost estimates. Read the
      // authenticated V23 inspector directly; the real UI start still uses V22.
      const inspection=await post(`${supabase}/functions/v1/fortune-interpret-v23-preview`,{action:'inspect',calculation:body.calculation,model:body.model},headers)
      assert.equal(inspection.interpreter_version,version,'Unexpected live engine; no paid start')
      assert.equal(inspection.prompt_budget_ok,true,'Prompt budget rejected; no paid start')
      assert.ok(Number.isInteger(inspection.max_gemini_calls_per_job) && inspection.max_gemini_calls_per_job > 0 && inspection.max_gemini_calls_per_job <= 2,'Unverified model-call limit; no paid start')
      assert.ok(Number.isFinite(inspection.estimated_max_job_krw)&&inspection.estimated_max_job_krw<=300,'Cost estimate exceeds 300 KRW; no paid start')
      report.inspection={interpreter_version:inspection.interpreter_version,prompt_budget_ok:true,max_gemini_calls_per_job:inspection.max_gemini_calls_per_job,estimated_max_job_krw:inspection.estimated_max_job_krw}
      await persistCandidate()
      report.forwardedStarts++
      report.geminiCallsThisRun=null
      report.stage='generation-started'
      return route.continue()
    } catch(error) {
      report.blockedStarts++;report.errors.push(safeError(error))
      return route.abort('blockedbyclient')
    }
  })
  // Validate the actual calculator input before allowing it onto the network.
  await context.route('**/v1/fortune/integrated/start',async route=>{
    if(route.request().method()!=='POST')return route.continue()
    try {
      const body=route.request().postDataJSON()
      assert.equal(body.profile?.birth_date,profile.birthDate,'Non-synthetic birth date blocked')
      assert.ok(String(body.profile?.birth_time).startsWith(profile.birthTime),'Non-synthetic birth time blocked')
      assert.equal(body.start_date,date);assert.equal(body.end_date,endDate)
      report.syntheticCalculationVerified=true
      report.precisionInput={time_known:body.profile.time_known,time_source:body.profile.time_source,time_confidence:body.profile.time_confidence}
      report.stage='calculation-started'
      await route.continue()
    } catch(error) {report.errors.push(safeError(error));await route.abort('blockedbyclient')}
  })
  page.on('response',response=>{
    const url=new URL(response.url())
    if(url.pathname==='/v1/fortune/integrated/start')report.calculationStartHttp=response.status()
    if(url.pathname.includes('/v1/fortune/integrated/jobs/'))track((async()=>{
      const data=await response.json().catch(()=>null)
      report.calculationStatus=data?.status||`HTTP ${response.status()}`
      if(data?.status==='failed'){report.calculationFailed=true;report.errors.push(safeError(data.error||'Calculation failed'))}
      if(data?.status==='done'&&data.result&&report.syntheticCalculationVerified){calculation=data.result;report.stage='calculation-complete';report.precisionResult={contract:calculation.precision?.contract_version,status:calculation.precision?.status};await persistCandidate()}
    })())
    if(url.pathname.endsWith(`/functions/v1/${endpoint}`)&&response.request().method()==='POST')track((async()=>{
      const body=response.request().postDataJSON()
      const data=await response.json().catch(()=>null)
      if(body?.action==='start'){report.generationStartHttp=response.status();if(!data?.ok||!data?.job_id){report.generationFailed=true;report.errors.push(safeError(data?.error||`Generation start HTTP ${response.status()}`))}}
      if(body?.action==='start'&&data?.job_id){
        jobId=data.job_id
        report.job_id=jobId
        report.reused=data.reused ?? null
        if (report.reused === true) report.geminiCallsThisRun=0
        await save('job.json',{synthetic_profile:true,job_id:jobId,date,mode,reused:report.reused})
        await persistCandidate()
      }
      if(body?.action==='status')report.generationStatus=data?.status||`HTTP ${response.status()}`
      if(body?.action==='status'&&data?.status==='done'){finalStatus=data;observeJob(data);await persistCandidate()}
      if(body?.action==='status'&&data?.status==='failed'){report.generationFailed=true;observeJob(data);await save('job-failure.json',{job_id:jobId,status:'failed',error:safeError(data.error||'Generation failed')})}
    })())
  })
  const kind = {day:'daily',week:'weekly',month:'monthly'}[period]
  await page.goto(`${origin}/?date=${date}&kind=${kind}`,{waitUntil:'domcontentloaded',timeout:60000})
  const root=page.locator('[data-reading-export-root="period-fortune"]')
  const calculate=page.locator('.period-fortune-report').getByRole('button',{name:{day:'오늘운세 계산',week:'주간운세 계산',month:'월간운세 계산'}[period],exact:true})
  report.stage='calculate-click'
  await withHealth(calculate.click({timeout:90000}))
  const generate=root.getByRole('button',{name:'해설 생성',exact:true})
  await withHealth(generate.waitFor({timeout:180000}))
  assert.equal(report.startAttempts,0,'Calculation attempted to generate a reading automatically')
  report.stage='explicit-generate-click'
  explicitGeneration=true
  await generate.click()
  const panel=root.locator(daily?'.daily-reading':'.authored-reading')
  const stateAttr=daily?'data-daily-state':'data-authored-state'
  await withHealth(root.locator(`[${stateAttr}="ready"]`).waitFor({timeout:420000}))
  await Promise.all([...pending])
  assert.ok(finalStatus,'Completed production status was not captured')
  assert.equal(finalStatus.interpreter_version,version)
  assert.equal(finalStatus.model,model)
  assert.equal(finalStatus.provenance_verified,true)
  assert.equal(finalStatus.origin,'gemini')
  assert.equal(finalStatus.period_start,date)
  assert.equal(finalStatus.period_end,endDate)
  assert.equal(report.rawManuscriptPresent,true)
  assert.equal(report.startAttempts,1)
  assert.equal(report.forwardedStarts,existingJobId?0:1)
  assert.equal(typeof report.reused,'boolean','Server did not identify whether the job was reused')
  assert.ok(Number.isInteger(report.jobGeminiCalls) && report.jobGeminiCalls > 0,'Gemini job usage is missing')
  if (!existingJobId) assert.ok(report.jobGeminiCalls <= report.inspection.max_gemini_calls_per_job,'Recorded Gemini calls exceed the inspected cap')
  const manuscript=readerFacingFortune(finalStatus.data)
  const originalFields=indexManuscript(finalStatus.data,manuscript)
  report.stage='mobile-and-export-verification'
  for(const [index,label] of ['전체','애정','대인','학업','직업','금전','컨디션'].entries()) {
    exportScope=String(index)
    await root.getByRole('group',{name:'생활 분야 선택'}).getByRole('button',{name:label,exact:true}).click()
    const field=fortuneGroup(label)
    const expected=daily ? buildDailyReadingDocument(manuscript,date,field,true)
      : buildPeriodReadingDocument(manuscript,period,date,endDate,field,true,version)
    const sourceValues=daily ? expected.blocks : expected.core
    const coreSelector=daily ? '.daily-reading-blocks [data-daily-block]' : '.authored-reading-core [data-reading-block]'
    const coreText=panel.locator(coreSelector+' p')
    const headingElement=panel.locator(daily?'.daily-reading-headline':'.authored-reading-headline')
    await panel.waitFor()
    if (label==='애정') {
      const recorded=root.getByRole('region',{name:'연락운과 실제 기록'})
      if (daily) await recorded.getByText(/QA 연락 기록 확인/).first().waitFor()
      else await recorded.getByText(/서로 주고받음 1일/).waitFor()
      report.contactRecordShown=true
    }
    const state=await panel.getAttribute(stateAttr)
    assert.equal(state,expected.state,`${label}: manuscript state differs from screen`)
    assert.ok(state==='ready' || state==='insufficient',`${label}: incomplete manuscript (${state})`)
    for(const width of [320,350,393,430]) {
      await page.setViewportSize({width,height:852})
      await page.evaluate(()=>document.fonts.ready)
      const stats=await panel.evaluate((el,sel)=>{
        const first=el.querySelector(sel+' p')
        const textNodes=[...el.querySelectorAll('h3,'+sel+' p')].filter(node=>node.getClientRects().length)
        return {width:innerWidth,overflow:Math.max(document.documentElement.scrollWidth-innerWidth,el.scrollWidth-el.clientWidth),clipped:textNodes.some(node=>node.scrollHeight>node.clientHeight+1),bodyFont:first?getComputedStyle(first).fontFamily:null}
      },coreSelector)
      assert.ok(stats.overflow<=1&&!stats.clipped,`${label}: clipped at ${width}`)
      if (daily && state==='ready') assert.match(stats.bodyFont,/Noto Sans KR/)
      report.widths.push({label,state,...stats})
    }
    await page.setViewportSize({width:393,height:852})
    await panel.screenshot({path:path.join(out,`${index}-mobile-393.png`)})
    const exportButton=panel.getByRole('button',{name:/이미지 저장$/})
    if(state==='insufficient') {
      assert.equal(await exportButton.count(),0,'An insufficient reading cannot be exported')
      report.scopes.push({label,state,sourceState:expected.state})
      continue
    }
    const heading=await headingElement.innerText()
    const blocks=await coreText.allTextContents()
    const sourceFields=[heading,...blocks].map(text=>originalFields.get(text.trim()) ?? null)
    const scopeReport={label,state,heading,blocks,sourceFields,sourceTextParity:false,exportTextParity:null,images:0}
    report.scopes.push(scopeReport)
    assert.ok(sourceFields.every(Boolean),`${label}: at least one screen sentence is absent from the Gemini manuscript`)
    assert.equal(heading,expected.headline,`${label}: screen headline differs from Gemini`)
    assert.deepEqual(blocks,sourceValues.map(value=>value.text),`${label}: screen core text differs from Gemini`)
    scopeReport.sourceTextParity=true
    const exportIds=daily ? sourceValues.map(block=>block.id) : expected.exportBlockIds
    if (!exportIds.length && !daily) {
      assert.equal(await exportButton.count(),0,'No actionable core can be exported')
      continue
    }
    await page.evaluate(()=>{window.__dailyQaDrawn=[]})
    const before=downloads.length
    await exportButton.click()
    await panel.getByRole('status').filter({hasText:'저장 요청 완료'}).waitFor({timeout:30000})
    await Promise.all(downloads)
    assert.ok(downloads.length>before,`${label}: zero exported images`)
    const drawn=await page.evaluate(()=>window.__dailyQaDrawn)
    const normalized=drawn.map(row=>row.text).join('').replace(/\s/g,'')
    for(const text of [heading,...sourceValues.filter(block=>exportIds.includes(block.id)).map(block=>block.text)]) {
      assert.ok(normalized.includes(text.replace(/\s/g,'')),`${label}: export text missing`)
    }
    assert.ok(drawn.every(row=>row.y>=0&&row.y<row.height-10),`${label}: export overflow`)
    scopeReport.exportTextParity=true
    scopeReport.images=downloads.length-before
  }
  const ready=report.scopes.filter(row=>row.state==='ready')
  assert.equal(new Set(ready.map(row=>row.heading)).size,ready.length,'Duplicate scope headings')
  await Promise.all([...pending])
  assert.deepEqual(report.errors,[])
  assert.equal(report.blockedStarts,0)
  assert.ok(existingJobId || report.reused===false,'Server reused a prior job. No new Gemini reading was verified; do not retry automatically.')
  report.stage='passed'
} catch(error) {
  report.failure=safeError(error)
  if(page) {
    const notices=await page.locator('.period-fortune-report .status-banner.error,.period-fortune-report [role="alert"],.private-auth-error').allTextContents().catch(()=>[])
    report.visibleErrors=notices.slice(0,5).map(safeError)
    report.loginVisible=await page.locator('.private-auth-shell').count().catch(()=>0)
    report.visibleState=await page.locator('.daily-reading').evaluateAll(nodes=>nodes.map(n=>({state:n.getAttribute('data-daily-state'),scope:n.getAttribute('data-daily-scope')}))).catch(()=>[])
    // Only the synthetic reading panel may be captured, never login/account UI.
    if(calculation)await page.locator('.daily-reading').first().screenshot({path:path.join(out,'failure-reading.png'),timeout:5000}).catch(()=>{})
  }
  process.exitCode=1
} finally {
  clearInterval(heartbeat)
  await Promise.allSettled([...pending,...downloads])
  report.exportedImages=downloads.length
  await persistCandidate()
  await save('browser-report.json',report)
  console.log(JSON.stringify({stage:report.stage,passed:!process.exitCode,job_id:jobId||null,forwardedStarts:report.forwardedStarts,jobGeminiCalls:report.jobGeminiCalls,geminiCallsThisRun:report.geminiCallsThisRun,reused:report.reused,blockedStarts:report.blockedStarts,scopeCount:report.scopes.length,exportedImages:report.exportedImages,failure:report.failure||null}))
  await browser?.close()
}
