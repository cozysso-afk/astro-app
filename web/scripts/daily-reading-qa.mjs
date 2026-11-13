import assert from 'node:assert/strict'
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
const require=createRequire(import.meta.url)
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright') : 'playwright')
const out=path.resolve(process.env.DAILY_QA_OUT || '../docs/daily-reading-review')
await mkdir(out,{recursive:true})
const server=process.env.QA_START_SERVER ? await (await import('vite')).createServer({server:{host:'127.0.0.1',port:4173,strictPort:true},optimizeDeps:{include:['react','react-dom/client','react/jsx-runtime','lucide-react','@supabase/supabase-js','admdongkor']}}) : null
await server?.listen()
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']})
const page=await browser.newPage({viewport:{width:393,height:852},acceptDownloads:true})
const errors=[],downloads=[]
page.on('pageerror',e=>errors.push(String(e)))
page.on('download',d=>downloads.push(d.saveAs(path.join(out,`daily-export-${downloads.length+1}.png`))))
// Prove the daily reading does not depend on Google Fonts availability.
await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort())
await page.addInitScript(()=>{
  window.__drawn=[]
  const original=CanvasRenderingContext2D.prototype.fillText
  CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...rest){window.__drawn.push({text:String(text),x,y,height:this.canvas.height});return original.call(this,text,x,y,...rest)}
})
try {
  await page.goto(process.env.VISUAL_QA_URL || 'http://127.0.0.1:4173/?qa=visual',{waitUntil:'networkidle'})
  const root=page.locator('[data-qa-block="daily-reading"]')
  await root.locator('[data-daily-state="ready"]').waitFor({timeout:10000}).catch(async e=>{console.error(JSON.stringify({errors,body:(await page.locator('body').innerText()).slice(0,1500)}));throw e})
  const widths=[]
  for(const width of [320,350,393,430]) {
    await page.setViewportSize({width,height:852})
    const stats=await root.evaluate(el=>{
      const title=el.querySelector('.daily-reading-headline'),body=el.querySelector('.daily-reading-block p')
      return {width:innerWidth,overflow:el.scrollWidth-el.clientWidth,title:parseFloat(getComputedStyle(title).fontSize),titleFont:getComputedStyle(title).fontFamily,body:parseFloat(getComputedStyle(body).fontSize),font:getComputedStyle(body).fontFamily,clipped:[...el.querySelectorAll('.daily-reading-headline,.daily-reading-block p')].some(n=>n.scrollHeight>n.clientHeight+1)}
    })
    assert.ok(stats.overflow<=1,JSON.stringify(stats));assert.ok(!stats.clipped,JSON.stringify(stats));assert.ok(stats.title>=20 && stats.title<=22 && stats.body>=15,JSON.stringify(stats));assert.match(stats.font,/Noto Sans KR/);assert.match(stats.titleFont,/Nanum Myeongjo/)
    widths.push(stats)
  }
  const headings=[]
  for(const label of ['전체','애정','대인','학업','직업','금전','컨디션']) {
    await root.getByRole('button',{name:label,exact:true}).click()
    headings.push(await root.locator('.daily-reading-headline').innerText())
  }
  assert.equal(new Set(headings).size,7,'topic tabs reuse the same conclusion')
  await root.getByRole('button',{name:'금전 원고 누락 테스트',exact:true}).click()
  await root.getByRole('button',{name:'금전',exact:true}).click()
  await root.locator('[data-daily-state="missing"]').waitFor()
  assert.equal(await root.locator('.daily-reading-save').count(),0)
  await root.getByRole('button',{name:'금전 원고 누락 테스트',exact:true}).click()
  await root.getByRole('button',{name:'전체',exact:true}).click()
  await page.setViewportSize({width:393,height:852})
  await page.evaluate(()=>document.fonts.ready)
  await root.screenshot({path:path.join(out,'daily-mobile-393.png')})
  const expected=await root.locator('.daily-reading-blocks .daily-reading-block p').allTextContents()
  await root.getByRole('button',{name:'핵심 해설 이미지 저장',exact:true}).click()
  await root.getByRole('status').filter({hasText:'저장 요청 완료'}).waitFor({timeout:20000})
  await Promise.all(downloads)
  const drawn=await page.evaluate(()=>window.__drawn)
  const joined=drawn.map(r=>r.text).join('').replace(/\s/g,'')
  for(const copy of expected)assert.ok(joined.includes(copy.replace(/\s/g,'')),`saved image lost text: ${copy}`)
  assert.ok(drawn.every(r=>r.y<r.height-10),'canvas text overflows')
  const longResult=await page.evaluate(async()=>{
    const {buildDailyReadingDocument}=await import('/src/lib/dailyReadingDocument.ts')
    const {dailyQaData}=await import('/src/DailyReadingQaPreview.tsx')
    const {exportDailyReadingImages}=await import('/src/lib/readingImageExport.ts')
    const doc=buildDailyReadingDocument(dailyQaData,'2026-11-04',undefined,true)
    doc.blocks=[{id:'long',label:'긴 문장 보존 검사',text:'긴 원고에서도 문장을 삭제하지 않고 다음 이미지로 이어가야 해. '.repeat(70)+'끝까지 보존한 마지막 조건.'}]
    window.__drawn=[]
    const result=await exportDailyReadingImages(doc,new AbortController().signal)
    const text=window.__drawn.map(r=>r.text).join('').replace(/\s/g,'')
    const aborted=new AbortController();aborted.abort()
    let cancelled=false
    try{await exportDailyReadingImages(doc,aborted.signal)}catch(e){cancelled=e.name==='AbortError'}
    return {pages:result.pages,tail:text.includes('끝까지보존한마지막조건.'),overflow:window.__drawn.some(r=>r.y>=r.height-10),cancelled}
  })
  assert.ok(longResult.pages>1 && longResult.tail && !longResult.overflow && longResult.cancelled,JSON.stringify(longResult))
  await Promise.all(downloads)
  const before=downloads.length
  await page.evaluate(()=>{
    window.__fontLoad=document.fonts.load.bind(document.fonts);window.__release=[]
    document.fonts.load=(...args)=>new Promise(resolve=>window.__release.push(()=>window.__fontLoad(...args).then(resolve)))
  })
  await root.getByRole('button',{name:'핵심 해설 이미지 저장',exact:true}).click()
  await root.getByRole('button',{name:'애정',exact:true}).click()
  await page.evaluate(async()=>{document.fonts.load=window.__fontLoad;await Promise.all(window.__release.map(f=>f()))})
  await page.waitForTimeout(150)
  assert.equal(downloads.length,before,'scope switch saved the previous field')
  assert.equal(await root.getByRole('status').count(),0,'stale notice leaked into next field')
  await page.evaluate(()=>{document.fonts.load=async()=>{throw new Error('글꼴 로딩 실패 검수')}})
  await root.getByRole('button',{name:'핵심 해설 이미지 저장',exact:true}).click()
  await root.getByRole('status').filter({hasText:'글꼴 로딩 실패 검수'}).waitFor()
  assert.equal(downloads.length,before,'font failure silently saved fallback text')
  await page.evaluate(()=>{document.fonts.load=window.__fontLoad})
  assert.deepEqual(errors,[])
  const report={fixture:'synthetic; not live fortune quality verification',widths,distinctScopes:headings.length,exportTextParity:true,longResult,scopeChangeCancelled:true,fontFailureBlocked:true,errors}
  await writeFile(path.join(out,'qa-report.json'),JSON.stringify(report,null,2))
  // Keep the normal two-page sample; the stress-case files are reproducible.
  await Promise.all(downloads.slice(2).map((_,i)=>unlink(path.join(out,`daily-export-${i+3}.png`))))
  console.log(JSON.stringify(report))
} finally {await browser.close();await server?.close()}
