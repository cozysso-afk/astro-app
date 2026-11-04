import assert from 'node:assert/strict'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import path from 'node:path'
const require=createRequire(import.meta.url)
const {chromium}=(()=>{try{return require('playwright')}catch{return require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'))}})()
const input=JSON.parse(await readFile(process.env.DAILY_LIVE_INPUT,'utf8'))
assert.equal(input.synthetic_profile,true,'Only the synthetic QA account fixture may be published')
const {status,calculation}=input
assert.equal(status.status,'done');assert.equal(status.provenance_verified,true)
assert.ok(status.interpreter_version.startsWith('supabase-ai-v23.11'))
const out=path.resolve(process.env.DAILY_LIVE_OUT||'../docs/daily-reading-review/live-candidate')
await mkdir(out,{recursive:true})
const server=await(await import('vite')).createServer({server:{host:'127.0.0.1',port:4173,strictPort:true},optimizeDeps:{include:['react','react-dom/client','react/jsx-runtime','lucide-react','@supabase/supabase-js','admdongkor']}})
await server.listen()
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']})
const page=await browser.newPage({viewport:{width:393,height:852},acceptDownloads:true})
const errors=[],downloads=[];let scope='overall'
page.on('pageerror',e=>errors.push(String(e)))
page.on('download',d=>downloads.push(d.saveAs(path.join(out,`${scope}-export-${downloads.length+1}.png`))))
await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort())
await page.addInitScript(payload=>{
  window.__FORTUNE_LIVE_QA__=payload
  window.__drawn=[]
  const original=CanvasRenderingContext2D.prototype.fillText
  CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...rest){window.__drawn.push({text,y,height:this.canvas.height});return original.call(this,text,x,y,...rest)}
},{jobId:status.job_id,model:status.model,periodStart:calculation.period.start,periodEnd:calculation.period.end,calculation,interpretation:status})
try{
  await page.goto('http://127.0.0.1:4173/?qa=fortune-live',{waitUntil:'networkidle'})
  const root=page.locator('[data-qa-live-root]')
  await root.locator('[data-daily-state="ready"]').waitFor()
  const widths=[]
  for(const width of [320,350,393,430]){
    await page.setViewportSize({width,height:852})
    const stats=await root.evaluate(el=>({width:innerWidth,overflow:Math.max(document.documentElement.scrollWidth-innerWidth,el.scrollWidth-el.clientWidth),clipped:[...el.querySelectorAll('.daily-reading-headline,.daily-reading-block p')].some(n=>n.scrollHeight>n.clientHeight+1),bodyFont:getComputedStyle(el.querySelector('.daily-reading-block p')).fontFamily}))
    assert.ok(stats.overflow<=1&&!stats.clipped,JSON.stringify(stats));assert.match(stats.bodyFont,/Nanum Myeongjo/);widths.push(stats)
  }
  await page.setViewportSize({width:393,height:852})
  const scopes=[]
  for(const [i,label] of ['전체','애정','대인','학업','직업','금전','컨디션'].entries()){
    scope=String(i)
    await root.getByRole('button',{name:label,exact:true}).click()
    const panel=root.locator('.daily-reading')
    const state=await panel.getAttribute('data-daily-state')
    assert.ok(['ready','insufficient'].includes(state),`${label}: ${state}`)
    await page.evaluate(()=>document.fonts.ready)
    await root.screenshot({path:path.join(out,`${i}-mobile-393.png`)})
    if(state!=='ready'){
      assert.equal(await panel.locator('.daily-reading-save').count(),0)
      scopes.push({label,state});continue
    }
    const heading=await panel.locator('.daily-reading-headline').innerText()
    const blocks=await panel.locator('.daily-reading-blocks .daily-reading-block p').allTextContents()
    await page.evaluate(()=>{window.__drawn=[]})
    await panel.getByRole('button',{name:'핵심 해설 이미지 저장'}).click()
    await panel.getByRole('status').filter({hasText:'저장 요청 완료'}).waitFor({timeout:20000})
    await Promise.all(downloads)
    const drawn=await page.evaluate(()=>window.__drawn)
    const normalized=drawn.map(r=>r.text).join('').replace(/\s/g,'')
    for(const text of [heading,...blocks])assert.ok(normalized.includes(text.replace(/\s/g,'')),`${label}: lost export text`)
    assert.ok(drawn.every(r=>r.y<r.height-10),`${label}: export overflow`)
    scopes.push({label,state,heading,blockCount:blocks.length,exportTextParity:true})
  }
  assert.equal(new Set(scopes.filter(r=>r.state==='ready').map(r=>r.heading)).size,scopes.filter(r=>r.state==='ready').length)
  assert.deepEqual(errors,[])
  const report={source:'Actual Gemini output for synthetic QA profile; not handwritten copy',replay_policy:input.replay_policy??null,job_id:status.job_id,model:status.model,date:calculation.period.start,widths,scopes,exportedImages:downloads.length,errors}
  await writeFile(path.join(out,'browser-report.json'),JSON.stringify(report,null,2))
  console.log(JSON.stringify(report))
}finally{await browser.close();await server.close()}
