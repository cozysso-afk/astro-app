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

    const systemGrid = document.querySelector('.system-overview-grid')
    const reunionMeaning = document.querySelector('.reunion-v3-meaning')
    const situations = document.querySelector('.reunion-v3-situations')
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      systemDisplay: systemGrid ? getComputedStyle(systemGrid).display : 'missing',
      systemAlignItems: systemGrid ? getComputedStyle(systemGrid).alignItems : 'missing',
      systemCards: slackFor('.system-overview-grid > article'),
      reunionDisplay: reunionMeaning ? getComputedStyle(reunionMeaning).display : 'missing',
      reunionAlignItems: reunionMeaning ? getComputedStyle(reunionMeaning).alignItems : 'missing',
      reunionCards: slackFor('.reunion-v3-meaning > .reunion-v3-card'),
      situationsDisplay: situations ? getComputedStyle(situations).display : 'missing',
    }
  })

  const assert = (condition, message) => {
    if (!condition) throw new Error(message)
  }

  assert(diagnostics.viewport.width === 430, `unexpected QA viewport: ${diagnostics.viewport.width}`)
  assert(diagnostics.systemCards.length === 3, 'system overview fixture did not render 3 cards')
  assert(diagnostics.reunionCards.length === 2, 'reunion meaning fixture did not render 2 cards')
  assert(diagnostics.systemAlignItems === 'flex-start', `system cards are stretching: align-items=${diagnostics.systemAlignItems}`)
  assert(diagnostics.reunionAlignItems === 'flex-start', `reunion cards are stretching: align-items=${diagnostics.reunionAlignItems}`)
  assert(Math.max(...diagnostics.systemCards.map(card => Math.abs(card.slack))) < 32, `system card has excessive empty tail: ${JSON.stringify(diagnostics.systemCards)}`)
  assert(Math.max(...diagnostics.reunionCards.map(card => Math.abs(card.slack))) < 32, `reunion card has excessive empty tail: ${JSON.stringify(diagnostics.reunionCards)}`)
  assert(diagnostics.situationsDisplay === 'grid', `reunion situations must stay vertical on mobile, got ${diagnostics.situationsDisplay}`)

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
  assert(Number.isFinite(expectedPages) && expectedPages >= 1 && expectedPages <= 3, `unexpected saved-image page count: ${state}`)

  const deadline = Date.now() + 8_000
  while (downloadCount < expectedPages && Date.now() < deadline) await page.waitForTimeout(100)
  await Promise.all(downloadPromises)
  assert(downloadCount === expectedPages, `expected ${expectedPages} saved images, received ${downloadCount}`)

  await writeFile(path.join(outDir, 'diagnostics.json'), JSON.stringify({ ...diagnostics, expectedPages, downloadCount }, null, 2))
  console.log(JSON.stringify({ ok: true, ...diagnostics, expectedPages, downloadCount }, null, 2))
} finally {
  await browser.close()
}
