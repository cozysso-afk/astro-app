// Offline component QA. Existing private Gemini output is replayed, never regenerated.
// Screenshots/output stay in the explicitly supplied private directory.
import assert from 'node:assert/strict'
import {readFile,readdir,mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises'
import {createRequire} from 'node:module'
import path from 'node:path'
import {createServer} from 'vite'
const require=createRequire(import.meta.url)
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'):'playwright')
assert.ok(process.env.REMAINING_QA_INPUT&&process.env.REMAINING_QA_OUT,'Private input and output directories required')
const input=path.resolve(process.env.REMAINING_QA_INPUT),out=path.resolve(process.env.REMAINING_QA_OUT)
await mkdir(out,{recursive:true})
const temp=await mkdtemp(path.join(process.cwd(),'.remaining-preview-'))
let browser,server
const report={source:'Offline actual React components: private legacy Gemini replay and labelled synthetic contract fixtures',paidCalls:0,cases:[],errors:[],exports:0}
try{
  server=await createServer({server:{host:'127.0.0.1',port:4175,strictPort:true},optimizeDeps:{include:['react','react-dom/client','react/jsx-runtime','lucide-react']}})
  const {buildPeriodReadingDocument,buildRelationshipReadingDocument}=await server.ssrLoadModule('/src/lib/authoredReadingDocument.ts')
  const {fortuneGroup,fortuneField}=await server.ssrLoadModule('/src/lib/fortuneFields.ts')
  const cases=[]
  for(const file of (await readdir(input)).filter(f=>f.endsWith('.json'))){
    const row=JSON.parse(await readFile(path.join(input,file),'utf8'))
    if(!row.result_json)continue
    if(row.kind.startsWith('supabase-relationship')){
      const doc=buildRelationshipReadingDocument(row.result_json,'compatibility',`${row.period_start} → ${row.period_end}`)
      cases.push({id:'legacy-compatibility',source:'legacy-real-gemini',doc})
    }else{
      const days=(Date.parse(row.period_end)-Date.parse(row.period_start))/86400000
      const period=days<8?'week':days<32?'month':'year'
      for(const topic of ['전체','애정','대인','학업','직업','금전','컨디션'])cases.push({id:`legacy-${period}-${topic}`,source:'legacy-real-gemini',doc:buildPeriodReadingDocument(row.result_json,period,row.period_start,row.period_end,topic==='전체'?undefined:fortuneGroup(topic),true,row.kind)})
      for(const id of ['contact','exam','job-change','investment'])cases.push({id:`legacy-${period}-${id}`,source:'legacy-real-gemini',doc:buildPeriodReadingDocument(row.result_json,period,row.period_start,row.period_end,fortuneField(id),true,row.kind)})
    }
  }
  for(const mode of ['compatibility','marriage_unmarried','marriage_married','reunion']){
    const data={headline:`${mode} 합성 계약 검사용 제목`,core_summary:'관계의 실제 반응을 확인하면서 서로의 차이를 살펴봐.',core_reason:'각 질문에 붙은 이유 원문을 별도 블록으로 읽도록 만든 합성 예시야.',core_action:'기대와 역할을 한 가지씩 확인해.',core_conditions:['상대가 대화를 원하지 않으면 더 밀어붙이지 마.'],overview:'이 단락은 실제 생성 품질을 증명하지 않는 합성 상세 원고야. 중간 문장의 부정 조건을 지우지 않아. 마지막 문장도 그대로 남아.',chemistry:'서로 끌리는 지점을 설명한 합성 원고.',communication:'다른 소통 방식을 설명한 합성 원고.',limits:'이 화면 검사는 해석 내용의 정확성을 인증하지 않아.',marriage_reading:{mode,bottom_line:'생활의 역할을 나눠 확인해.',bond:'관계의 결속을 설명한 원고.',daily_life:'누가 어떤 일을 맡을지 실제 합의를 확인해.'}}
    cases.push({id:`synthetic-${mode}`,source:'synthetic-contract-only',doc:buildRelationshipReadingDocument({ok:true,origin:'gemini',provenance_verified:true,data},mode,'2026-11-04 → 2026-11-30')})
  }
  if(process.env.REMAINING_QA_CASES){const selected=new Set(process.env.REMAINING_QA_CASES.split(','));cases.splice(0,cases.length,...cases.filter(row=>selected.has(row.id)));assert.equal(cases.length,selected.size,'Requested QA case missing')}
  await writeFile(path.join(temp,'index.html'),'<html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f8f7fb"><div id="root"></div><script type="module" src="./main.tsx"></script></body></html>')
  await writeFile(path.join(temp,'main.tsx'),`import React from 'react';import{createRoot}from'react-dom/client';import{AuthoredReadingPanel}from'/src/AuthoredReadingPanel';const root=createRoot(document.getElementById('root'));window.showDoc=(doc)=>root.render(<main style={{padding:'12px',maxWidth:'700px',margin:'auto'}}><AuthoredReadingPanel doc={doc}/></main>);window.showDoc(window.initialDoc);`)
  await server.listen()
  browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']})
  const page=await browser.newPage({viewport:{width:393,height:852},acceptDownloads:true})
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort())
  await page.addInitScript(doc=>{window.initialDoc=doc;window.drawn=[];const fill=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...args){window.drawn.push({text,y,height:this.canvas.height});return fill.call(this,text,x,y,...args)}},cases[0].doc)
  page.on('pageerror',error=>report.errors.push(error.message))
  const downloads=[];let current=''
  page.on('download',download=>downloads.push(download.saveAs(path.join(out,`${current}-${downloads.length+1}.png`))))
  await page.goto(`http://127.0.0.1:4175/${path.basename(temp)}/index.html`,{waitUntil:'networkidle'})
  for(const entry of cases){
    current=entry.id
    await page.evaluate(doc=>window.showDoc(doc),entry.doc)
    const panel=page.locator('.authored-reading')
    await page.waitForFunction(revision=>document.querySelector('.authored-reading')?.getAttribute('data-authored-revision')===revision,entry.doc.revision)
    const metrics=[]
    for(const width of [320,350,393,430]){
      await page.setViewportSize({width,height:852});await page.evaluate(()=>document.fonts.ready)
      const metric=await panel.evaluate(el=>({width:innerWidth,overflow:Math.max(document.documentElement.scrollWidth-innerWidth,el.scrollWidth-el.clientWidth),clipped:[...el.querySelectorAll('.authored-reading-headline,.authored-reading-block p')].filter(n=>n.getBoundingClientRect().height>0).some(n=>n.scrollHeight>n.clientHeight+1),font:el.querySelector('.authored-reading-block p')?getComputedStyle(el.querySelector('.authored-reading-block p')).fontFamily:''}))
      assert.ok(metric.overflow<=1&&!metric.clipped,`${current} ${JSON.stringify(metric)}`)
      if(metric.font)assert.match(metric.font,/Nanum Myeongjo/)
      metrics.push(metric)
    }
    await page.setViewportSize({width:393,height:852})
    await panel.screenshot({path:path.join(out,`${current}.png`)})
    const row={id:current,source:entry.source,state:entry.doc.state,scope:entry.doc.scope,missingSections:entry.doc.sections.filter(s=>s.state==='missing').length,metrics,exportParity:null}
    if(entry.doc.exportBlockIds.length&&(entry.doc.scope==='overall'||entry.source==='synthetic-contract-only'||current==='legacy-week-애정')){
      await page.evaluate(()=>{window.drawn=[]})
      const before=downloads.length
      await panel.locator('.authored-reading-save').click()
      await panel.getByRole('status').filter({hasText:'저장 요청 완료'}).waitFor({timeout:30000})
      await Promise.all(downloads)
      const drawn=await page.evaluate(()=>window.drawn),joined=drawn.map(r=>r.text).join('').replace(/\s/g,'')
      for(const copy of [entry.doc.headline,...entry.doc.core.filter(b=>entry.doc.exportBlockIds.includes(b.id)).map(b=>b.text)])assert.ok(joined.includes(copy.replace(/\s/g,'')),`${current} lost text`)
      assert.ok(drawn.every(r=>r.y<r.height-10),`${current} export overflow`)
      assert.ok(downloads.length>before,`${current} zero export`)
      row.exportParity=true
    }
    report.cases.push(row)
  }
  await Promise.all(downloads);report.exports=downloads.length;assert.deepEqual(report.errors,[])
  await writeFile(path.join(out,'browser-report.json'),JSON.stringify(report,null,2))
  console.log(JSON.stringify({cases:report.cases.length,widthChecks:report.cases.length*4,exports:report.exports,paidCalls:0}))
}finally{await browser?.close();await server?.close();await rm(temp,{recursive:true,force:true})}
