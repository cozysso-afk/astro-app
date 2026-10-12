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
    const reunionMeaning = document.querySelector('.reunion-v3-meaning')
    const situations = document.querySelector('.reunion-v3-situations')
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      systemDisplay: systemGrid ? getComputedStyle(systemGrid).display : 'missing',
      systemAlignItems: systemGrid ? getComputedStyle(systemGrid).alignItems : 'missing',
      systemCards: slackFor('[data-qa-block="systems"] .system-overview-grid > article'),
      reunionDisplay: reunionMeaning ? getComputedStyle(reunionMeaning).display : 'missing',
      reunionAlignItems: reunionMeaning ? getComputedStyle(reunionMeaning).alignItems : 'missing',
      reunionCards: slackFor('.reunion-v3-meaning > .reunion-v3-card'),
      situationsDisplay: situations ? getComputedStyle(situations).display : 'missing',
      situationCount: document.querySelectorAll('.reunion-v3-situation').length,
      reunionOverflow: document.querySelector('[data-qa-block="reunion"]') ? Math.ceil(document.querySelector('[data-qa-block="reunion"]').scrollWidth-document.querySelector('[data-qa-block="reunion"]').clientWidth) : 999,
      exportSystemCards: document.querySelectorAll('[data-qa-block="export-source"] .reading-export-system-v7').length,
    }
  })

  const assert = (condition, message) => {
    if (!condition) throw new Error(message)
  }

  assert(diagnostics.viewport.width === 430, `unexpected QA viewport: ${diagnostics.viewport.width}`)
  assert(diagnostics.systemCards.length === 3, 'system overview fixture did not render 3 cards')
  assert(diagnostics.reunionCards.length === 2, 'reunion meaning fixture did not render 2 cards')
  assert(diagnostics.systemAlignItems === 'flex-start', `system cards are stretching: align-items=${diagnostics.systemAlignItems}`)
  assert(diagnostics.reunionDisplay === 'grid', `reunion meaning cards must stay vertical on mobile, got ${diagnostics.reunionDisplay}`)
  assert(Math.max(...diagnostics.systemCards.map(card => Math.abs(card.slack))) < 32, `system card has excessive empty tail: ${JSON.stringify(diagnostics.systemCards)}`)
  assert(Math.max(...diagnostics.reunionCards.map(card => Math.abs(card.slack))) < 32, `reunion card has excessive empty tail: ${JSON.stringify(diagnostics.reunionCards)}`)
  assert(diagnostics.situationsDisplay === 'grid', `reunion situations must stay vertical on mobile, got ${diagnostics.situationsDisplay}`)
  assert(diagnostics.situationCount === 1, `only the selected observed state should render, got ${diagnostics.situationCount}`)
  assert(diagnostics.reunionOverflow <= 1, `reunion cards overflow the iPhone viewport by ${diagnostics.reunionOverflow}px`)
  assert(diagnostics.exportSystemCards === 1, `saved system synthesis bridge missing: ${diagnostics.exportSystemCards}`)

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

  await page.screenshot({ path: path.join(outDir, 'mobile-full.png'), fullPage: true })
  await page.locator('[data-qa-block="systems"]').screenshot({ path: path.join(outDir, 'systems-mobile.png') })
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
