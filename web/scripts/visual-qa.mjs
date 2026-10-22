import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

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
const downloadPromises = []
let downloadCount = 0
page.on('download', download => {
  downloadCount += 1
  const target = path.join(outDir, `saved-result-${downloadCount}.png`)
  downloadPromises.push(download.saveAs(target))
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
    const reunionMeaning = document.querySelector('.reunion-v5-stages')
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
      reunionCards: slackFor('.reunion-v5-stages > article'),
      situationsDisplay: situations ? getComputedStyle(situations).display : 'missing',
      situationCount: document.querySelectorAll('.reunion-v5-answer').length,
      reunionOverflow: document.querySelector('[data-qa-block="reunion"]') ? Math.ceil(document.querySelector('[data-qa-block="reunion"]').scrollWidth-document.querySelector('[data-qa-block="reunion"]').clientWidth) : 999,
      exportSystemCards: document.querySelectorAll('[data-qa-block="export-source"] .reading-export-system-v7').length,
      birthRangeFields,
      birthRangeOverflow: birthRange ? Math.ceil(birthRange.scrollWidth-birthRange.clientWidth) : 999,
    }
  })

  const assert = (condition, message) => {
    if (!condition) throw new Error(message)
  }

  assert(diagnostics.viewport.width === 430, `unexpected QA viewport: ${diagnostics.viewport.width}`)
  assert(diagnostics.systemCards.length === 3, 'system overview fixture did not render 3 cards')
  assert(diagnostics.reunionCards.length === 4, 'production reunion component did not render 4 stages')
  assert(diagnostics.systemAlignItems === 'flex-start', `system cards are stretching: align-items=${diagnostics.systemAlignItems}`)
  assert(diagnostics.reunionDisplay === 'grid', `reunion meaning cards must stay vertical on mobile, got ${diagnostics.reunionDisplay}`)
  assert(Math.max(...diagnostics.systemCards.map(card => Math.abs(card.slack))) < 32, `system card has excessive empty tail: ${JSON.stringify(diagnostics.systemCards)}`)
  assert(Math.max(...diagnostics.reunionCards.map(card => Math.abs(card.slack))) < 32, `reunion card has excessive empty tail: ${JSON.stringify(diagnostics.reunionCards)}`)
  assert(diagnostics.situationsDisplay === 'grid', `reunion situations must stay vertical on mobile, got ${diagnostics.situationsDisplay}`)
  assert(diagnostics.situationCount === 1, `only the selected observed state should render, got ${diagnostics.situationCount}`)
  assert(diagnostics.reunionOverflow <= 1, `reunion cards overflow the iPhone viewport by ${diagnostics.reunionOverflow}px`)
  assert(diagnostics.exportSystemCards === 1, `saved system synthesis bridge missing: ${diagnostics.exportSystemCards}`)
  assert(diagnostics.birthRangeFields.length === 2, `birth-time range fixture did not render 2 fields`)
  assert(diagnostics.birthRangeOverflow <= 1, `birth-time range overflows by ${diagnostics.birthRangeOverflow}px`)
  assert(diagnostics.birthRangeFields[0].bottom <= diagnostics.birthRangeFields[1].top, `birth-time range fields overlap: ${JSON.stringify(diagnostics.birthRangeFields)}`)
  assert(diagnostics.birthRangeFields.every(field=>field.inputLeft>=field.left-1&&field.inputRight<=field.right+1), `birth-time input escaped its field: ${JSON.stringify(diagnostics.birthRangeFields)}`)

  const quality = page.locator('[data-qa-block="interpretation-v2"]')
  const qualityText = await quality.innerText()
  assert(qualityText.includes('연애·연락·재회 중 재회의 점수가 가장 높아.'), 'relative comparison missing')
  assert(qualityText.includes('다른 분야보다 높더라도 재회 활성도는 ‘약함’'), 'absolute activation missing')
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
  assert(reunionText.includes('재회 성립 쪽에 무게를 싣기는 어려워요'), 'direct reunion verdict missing')
  assert(reunionText.includes('앞 단계 미확인'), 'later stage was not gated by the missing meeting stage')
  assert(reunionText.includes('활성도 21.1') && reunionText.includes('활성도 24.1'), 'direction scores were hidden')
  assert(!reunionText.split('\\n').some(line=>line.trim()==='0'), 'stray zero leaked into reading')
  const mobileWidths = []
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({width,height:932})
    const size = await reunion.evaluate(el=>{
      const title=el.querySelector('.reunion-v5-answer h3')
      const body=el.querySelector('.reunion-v5-answer p')
      return {width:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,title:parseFloat(getComputedStyle(title).fontSize),body:parseFloat(getComputedStyle(body).fontSize)}
    })
    assert(size.overflow<=1, 'reunion horizontal overflow: '+JSON.stringify(size))
    assert(size.title>=17 && size.title<=24 && size.body>=14 && size.body<=17, 'reunion font sizes out of range: '+JSON.stringify(size))
    mobileWidths.push(size)
    await reunion.screenshot({path:path.join(outDir,'reunion-mobile-'+width+'.png')})
  }
  diagnostics.mobileWidths = mobileWidths
  await page.setViewportSize({width:430,height:932})

  await page.screenshot({ path: path.join(outDir, 'mobile-full.png'), fullPage: true })
  await page.locator('[data-qa-block="systems"]').screenshot({ path: path.join(outDir, 'systems-mobile.png') })
  await page.locator('[data-qa-block="birth-time-range"]').screenshot({ path: path.join(outDir, 'birth-time-range-mobile.png') })
  await page.locator('[data-qa-block="reunion"]').screenshot({ path: path.join(outDir, 'reunion-mobile.png') })
  await page.locator('[data-qa-block="export-source"]').screenshot({ path: path.join(outDir, 'export-source-mobile.png') })

  await page.locator('[data-qa-export]').click()
  await page.waitForFunction(() => {
    const value = document.querySelector('[data-qa-export-status]')?.textContent || ''
    return value.startsWith('done:') || value.startsWith('error:')
  }, null, { timeout: 20_000 })
  const state = (await page.locator('[data-qa-export-status]').textContent()) || ''
  assert(!state.startsWith('error:'), `saved-image QA failed: ${state}`)
  const expectedPages = Number(state.split(':')[1])
  assert(expectedPages === 2, `visual fixture must stay at 2 saved pages, got ${state}`)

  const deadline = Date.now() + 8_000
  while (downloadCount < expectedPages && Date.now() < deadline) await page.waitForTimeout(100)
  await Promise.all(downloadPromises)
  assert(downloadCount === expectedPages, `expected ${expectedPages} saved images, received ${downloadCount}`)

  await writeFile(path.join(outDir, 'diagnostics.json'), JSON.stringify({ ...diagnostics, expectedPages, downloadCount }, null, 2))
  console.log(JSON.stringify({ ok: true, ...diagnostics, expectedPages, downloadCount }, null, 2))
} finally {
  await browser.close()
}
