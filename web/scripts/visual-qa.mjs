import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const runtimeModules = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
const { chromium } = (() => {
  try { return require('playwright') }
  catch (error) {
    if (!runtimeModules) throw error
    return require(path.join(runtimeModules, 'playwright'))
  }
})()

const baseUrl = process.env.VISUAL_QA_URL || 'http://127.0.0.1:4173/?qa=visual'
const outDir = path.resolve(process.env.VISUAL_QA_OUT || 'visual-qa-artifacts')
await mkdir(outDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  acceptDownloads: true,
})
const page = await context.newPage()
const downloads = []
page.on('download', download => {
  downloads.push(download)
})

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30_000 })
  await page.waitForSelector('[data-qa-ready="true"]', { timeout: 10_000 })

  const diagnostics = await page.evaluate(() => {
    const slackFor = (selector) => Array.from(document.querySelectorAll(selector)).map((node) => {
      const el = node
      const rect = el.getBoundingClientRect()
      const visibleChildren = Array.from(el.children).filter(child => {
        const style = getComputedStyle(child)
        return style.display !== 'none' && style.visibility !== 'hidden'
      })
      const last = visibleChildren.at(-1)
      const lastRect = last?.getBoundingClientRect()
      const style = getComputedStyle(el)
      const paddingBottom = Number.parseFloat(style.paddingBottom) || 0
      return {
        height: Math.round(rect.height * 10) / 10,
        slack: lastRect ? Math.round((rect.bottom - lastRect.bottom - paddingBottom) * 10) / 10 : 0,
        title: el.querySelector('strong,h4')?.textContent?.trim() || '',
      }
    })

    const systemGrid = document.querySelector('[data-qa-block="systems"] .system-overview-grid')
    const reunionMeaning = document.querySelector('.reunion-v4-stage-rail')
    const situations = document.querySelector('.reunion-v5-directions')
    const birthRange = document.querySelector('[data-qa-block="birth-time-range"]')
    const birthRangeFields = Array.from(birthRange?.querySelectorAll('.birth-time-range-field') || []).map(node => {
      const rect = node.getBoundingClientRect()
      const input = node.querySelector('input')?.getBoundingClientRect()
      return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,inputLeft:input?.left ?? 0,inputRight:input?.right ?? 0}
    })
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      systemDisplay: systemGrid ? getComputedStyle(systemGrid).display : 'missing',
      systemAlignItems: systemGrid ? getComputedStyle(systemGrid).alignItems : 'missing',
      systemCards: slackFor('[data-qa-block="systems"] .system-overview-grid > article'),
      reunionDisplay: reunionMeaning ? getComputedStyle(reunionMeaning).display : 'missing',
      reunionAlignItems: reunionMeaning ? getComputedStyle(reunionMeaning).alignItems : 'missing',
      reunionCards: slackFor('.reunion-v4-stage-rail > li'),
      situationsDisplay: situations ? getComputedStyle(situations).display : 'missing',
      situationCount: document.querySelectorAll('.reunion-v5-answer').length,
      reunionOverflow: document.querySelector('[data-qa-block="reunion"]') ? Math.ceil(document.querySelector('[data-qa-block="reunion"]').scrollWidth-document.querySelector('[data-qa-block="reunion"]').clientWidth) : 999,
      birthRangeFields,
      birthRangeOverflow: birthRange ? Math.ceil(birthRange.scrollWidth-birthRange.clientWidth) : 999,
    }
  })

  const assert = (condition, message) => {
    if (!condition) throw new Error(message)
  }

  assert(diagnostics.viewport.width === 430, `unexpected QA viewport: ${diagnostics.viewport.width}`)
  assert(diagnostics.systemCards.length === 3, 'system overview fixture did not render 3 cards')
  assert(diagnostics.reunionCards.length === 6, 'production reunion component did not render 6 stages')
  assert(diagnostics.systemAlignItems === 'flex-start', `system cards are stretching: align-items=${diagnostics.systemAlignItems}`)
  assert(diagnostics.reunionDisplay === 'grid', `reunion meaning cards must stay vertical on mobile, got ${diagnostics.reunionDisplay}`)
  assert(Math.max(...diagnostics.systemCards.map(card => Math.abs(card.slack))) < 32, `system card has excessive empty tail: ${JSON.stringify(diagnostics.systemCards)}`)
  assert(Math.max(...diagnostics.reunionCards.map(card => Math.abs(card.slack))) < 32, `reunion card has excessive empty tail: ${JSON.stringify(diagnostics.reunionCards)}`)
  assert(diagnostics.situationsDisplay === 'grid', `reunion situations must stay vertical on mobile, got ${diagnostics.situationsDisplay}`)
  assert(diagnostics.situationCount === 1, `only the selected observed state should render, got ${diagnostics.situationCount}`)
  assert(diagnostics.reunionOverflow <= 1, `reunion cards overflow the iPhone viewport by ${diagnostics.reunionOverflow}px`)
  assert(diagnostics.birthRangeFields.length === 2, `birth-time range fixture did not render 2 fields`)
  assert(diagnostics.birthRangeOverflow <= 1, `birth-time range overflows by ${diagnostics.birthRangeOverflow}px`)
  assert(diagnostics.birthRangeFields[0].bottom <= diagnostics.birthRangeFields[1].top, `birth-time range fields overlap: ${JSON.stringify(diagnostics.birthRangeFields)}`)
  assert(diagnostics.birthRangeFields.every(field=>field.inputLeft>=field.left-1&&field.inputRight<=field.right+1), `birth-time input escaped its field: ${JSON.stringify(diagnostics.birthRangeFields)}`)

  const quality = page.locator('[data-qa-block="interpretation-v2"]')
  const qualityText = await quality.innerText()
  assert(!qualityText.includes('흐름이 점수가'), 'double subject returned')
  const past = quality.locator('.reading-event').filter({hasText:'지난 구간 · 회고'})
  assert(await past.count() === 1, 'past window must remain retrospective')
  assert(!(await past.innerText()).includes('진행 후보'), 'past window promoted to future action')
  assert(qualityText.includes('진행 중'), 'current window missing')
  await quality.locator('summary').filter({hasText:/시기 .* 더 보기/}).click()
  assert((await quality.innerText()).includes('예정 구간'), 'upcoming window missing')
  await quality.screenshot({path:path.join(outDir, 'interpretation-v2-mobile.png')})

  const reunion = page.locator('[data-qa-block="reunion"]')
  const reunionText = await reunion.innerText()
  assert(reunionText.includes('수신 · 상대 → 나') && reunionText.includes('발신 · 나 → 상대'), 'contact directions missing')
  assert(reunionText.includes('입력한 관계 기록') && reunionText.includes('지금은 서로 연락을 주고받고 있어요'), 'recorded relationship state missing')
  assert(reunionText.includes('앞 단계 미확인'), 'later stage was not gated by the missing meeting stage')
  assert(!(await reunion.locator('.reunion-v5-answer p').count()), 'calculated data generated a substitute interpretation')
  assert(!reunionText.includes('활성도 21.1') && !reunionText.includes('활성도 24.1'), 'technical scores leaked into the default reading')
  assert(!reunionText.split('\\n').some(line=>line.trim()==='0'), 'stray zero leaked into reading')
  const mobileWidths = []
  for (const width of [320, 350, 393, 430]) {
    await page.setViewportSize({width,height:932})
    const size = await reunion.evaluate(el=>{
      const title=el.querySelector('.reunion-v5-answer h3')
      const body=el.querySelector('.reunion-v5-directions article > p')
      const current=el.querySelectorAll('[aria-current="step"]').length
      const stageOverlap=Array.from(el.querySelectorAll('.reunion-v4-stage-rail > li')).some(row=>{
        const label=row.querySelector('span')?.getBoundingClientRect()
        const status=row.querySelector('strong')?.getBoundingClientRect()
        return label&&status&&label.right>status.left+1&&label.bottom>status.top+1&&status.bottom>label.top+1
      })
      return {width:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,title:parseFloat(getComputedStyle(title).fontSize),body:parseFloat(getComputedStyle(body).fontSize),current,stageOverlap}
    })
    assert(size.overflow<=1, 'reunion horizontal overflow: '+JSON.stringify(size))
    assert(size.title>=20 && size.title<=23 && size.body>=13 && size.body<=16, 'reunion font sizes out of range: '+JSON.stringify(size))
    assert(size.current<=1, 'reunion has more than one current stage: '+JSON.stringify(size))
    assert(!size.stageOverlap, 'reunion stage label and status overlap: '+JSON.stringify(size))
    mobileWidths.push(size)
    await reunion.screenshot({path:path.join(outDir,'reunion-mobile-'+width+'.png')})
  }
  diagnostics.mobileWidths = mobileWidths
  await page.setViewportSize({width:430,height:932})

  await reunion.locator('summary').filter({hasText:'계산 근거와 점수 보기'}).click()
  const evidenceText = await reunion.innerText()
  assert(evidenceText.includes('상대 차트 활성도: 21.1') && evidenceText.includes('내 차트 활성도: 24.1'), 'technical direction scores missing from evidence disclosure')

  await page.screenshot({ path: path.join(outDir, 'mobile-full.png'), fullPage: true })
  await page.locator('[data-qa-block="systems"]').screenshot({ path: path.join(outDir, 'systems-mobile.png') })
  await page.locator('[data-qa-block="birth-time-range"]').screenshot({ path: path.join(outDir, 'birth-time-range-mobile.png') })
  await page.locator('[data-qa-block="reunion"]').screenshot({ path: path.join(outDir, 'reunion-mobile.png') })
  const daily = page.locator('[data-qa-block="daily-reading"]')
  await page.setViewportSize({width:393,height:852})
  await daily.getByRole('button',{name:'저장 원고 유무 전환'}).click()
  assert(await daily.getByRole('button',{name:'해설 생성',exact:true}).isVisible(),'missing manuscript must offer generation')
  assert(!await daily.locator('.daily-reading-headline').count(),'missing manuscript was replaced with prose')
  await daily.screenshot({path:path.join(outDir,'daily-missing-393.png')})

  await daily.getByRole('button',{name:'저장 원고 유무 전환'}).click()
  await daily.locator('[data-daily-state="ready"]').waitFor()
  await daily.getByRole('button',{name:'학업',exact:true}).click()
  const study = daily.locator('.daily-reading')
  assert(await study.locator('.daily-reading-headline').innerText()==='새 진도를 더하기 전에 배운 내용을 한 번 설명해봐.','authored answer changed')
  assert(await study.locator('[data-daily-block="work_study.study:condition"] p').innerText()==='설명하다 막히는 부분이 있으면 그 부분부터 다시 읽어.','condition missing from the field')
  await study.screenshot({path:path.join(outDir,'daily-authored-study-393.png')})

  await daily.getByRole('button',{name:'전체',exact:true}).click()
  await daily.locator('.daily-reading').screenshot({path:path.join(outDir,'export-source-mobile.png')})
  await daily.getByRole('button',{name:'핵심 해설 이미지 저장',exact:true}).click()
  const status=daily.getByRole('status').filter({hasText:'저장 요청 완료'})
  await status.waitFor({timeout:20000})
  const expectedPages=Number((await status.innerText()).match(/(\d+)장/)?.[1])
  assert(expectedPages>=2,'all authored core paragraphs and conditions must span multiple pages')
  const deadline = Date.now() + 8_000
  while (downloads.length < expectedPages && Date.now() < deadline) await page.waitForTimeout(100)
  assert(downloads.length === expectedPages, `expected ${expectedPages} saved images, received ${downloads.length}`)
  for (let index = 0; index < downloads.length; index += 1) {
    await downloads[index].saveAs(path.join(outDir, `saved-result-${index + 1}.png`))
  }

  const formPage = await context.newPage()
  await formPage.route('**/*', route => {
    const url = new URL(route.request().url())
    return url.protocol.startsWith('http') && url.origin !== new URL(baseUrl).origin
      ? route.abort() : route.continue()
  })
  const formUrl = new URL(baseUrl)
  formUrl.searchParams.set('screen','partner-form')
  await formPage.goto(formUrl.href)
  await formPage.getByRole('button',{name:/궁합운/}).first().click()
  const form = formPage.locator('.counterpart-birth-form')
  const birthDate = form.locator('input[type=date]')
  const birthTime = form.locator('#counterpart-birth-time')
  await birthDate.fill('1990-06-15')
  await birthTime.fill('08:45')
  for (const width of [320,375,393,402,430]) {
    await formPage.setViewportSize({width,height:874})
    await form.waitFor()
    const issues = await form.evaluate(root=>{
      const bounds = root.getBoundingClientRect()
      return [...root.children].flatMap(el=>{
        const rect = el.getBoundingClientRect()
        if (!rect.width) return []
        return Math.abs(rect.width - bounds.width) > 3 || rect.left < bounds.left - 1 || rect.right > bounds.right + 1
          ? [el.textContent.trim().slice(0,24)] : []
      })
    })
    assert(!issues.length,'partner form clipped or only partly fills row at '+width+'px: '+issues.join(', '))
    const settings = form.locator('.counterpart-time-settings')
    await settings.locator('summary').click()
    const note = form.locator('.counterpart-time-note:visible')
    assert(await note.count()===1,'duplicate birth time hint')
    const range = settings.locator('.birth-time-range-field input')
    await range.nth(0).fill('08:00')
    await range.nth(1).fill('09:00')
    assert((await note.innerText()).includes('08:00~09:00'),'time range missing from the form hint')
    await settings.locator('summary').click()
    await form.screenshot({path:path.join(outDir,'partner-form-'+width+'.png')})
    const clearance = await formPage.getByRole('button',{name:'궁합 정밀 계산',exact:true}).evaluate(button=>{
      window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'})
      return document.querySelector('.bottom-nav').getBoundingClientRect().top - button.getBoundingClientRect().bottom
    })
    assert(clearance >= -1,'bottom navigation covers the calculation button at '+width+'px')
  }
  const unknown = form.getByRole('checkbox')
  await unknown.check()
  assert(!await form.getByRole('button',{name:'출생시간 신뢰도'}).count(),'inactive time precision is still visible')
  assert(!await birthTime.count(),'unknown time still exposes the time input')
  await form.getByRole('button',{name:'출생 시·도'}).click()
  await formPage.getByRole('listbox',{name:'출생 시·도'}).getByRole('option').nth(1).click()
  assert(await form.getByRole('button',{name:'출생 시·군·구'}).isEnabled(),'district control did not activate')
  await form.getByRole('button',{name:'출생 시·군·구'}).click()
  await formPage.getByRole('listbox',{name:'출생 시·군·구'}).getByRole('option').nth(1).click()
  await unknown.uncheck()
  assert(await birthTime.inputValue()==='08:45' && await birthDate.inputValue()==='1990-06-15','toggling unknown time discarded entered values')
  await formPage.close()

  await writeFile(path.join(outDir, 'diagnostics.json'), JSON.stringify({ ...diagnostics, expectedPages, downloadCount: downloads.length }, null, 2))
  console.log(JSON.stringify({ ok: true, ...diagnostics, expectedPages, downloadCount: downloads.length }, null, 2))
} finally {
  await browser.close()
}
