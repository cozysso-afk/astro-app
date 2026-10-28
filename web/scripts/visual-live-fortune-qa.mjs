import { readFile, mkdir, writeFile } from 'node:fs/promises'
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

const outputDir = path.resolve(process.env.LIVE_FORTUNE_QA_OUT || 'visual-live-fortune-artifacts')
const baseUrl = process.env.VISUAL_QA_URL || 'http://127.0.0.1:4173/?qa=fortune-live'
const localInput = process.env.LIVE_FORTUNE_QA_INPUT || process.argv[2] || ''
const jobId = String(process.env.LIVE_FORTUNE_QA_JOB_ID || '').trim()
if (!localInput && !jobId) throw new Error('LIVE_FORTUNE_QA_INPUT or LIVE_FORTUNE_QA_JOB_ID is required')

function hasStoredGeminiEvidence(status) {
  const usage = status?.usage
  const generationVersion = String(usage?.generation_version ?? '')
  const trace = Array.isArray(usage?.call_trace) ? usage.call_trace : []
  const stages = usage?.quality_validation?.stages
  return status?.status === 'done' && Boolean(status?.data)
    && generationVersion.startsWith('supabase-ai-v23.')
    && usage?.cost_guard_version === generationVersion
    && usage?.gemini_paid_call === true
    && trace.some(row => Number(row?.http_status) >= 200 && Number(row?.http_status) < 300
      && String(row?.model ?? '') === String(status?.model ?? ''))
    && Array.isArray(stages) && stages.length === 6 && stages.every(stage => stage?.passed === true)
}

async function loadStoredResult() {
  if (localInput) return JSON.parse(await readFile(path.resolve(localInput), 'utf8'))
  const { buildQaConfig } = await import('./fortune-live-qa.mjs')
  const config = await buildQaConfig()
  const response = await fetch(config.fortuneUrl, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', ...config.headers },
    body: JSON.stringify({ narrative_engine:'v23', action:'status', job_id:jobId }),
    signal: AbortSignal.timeout(30_000),
  })
  const status = await response.json().catch(() => null)
  if (!response.ok || !hasStoredGeminiEvidence(status)) {
    throw new Error('Stored verified Gemini QA job was not available')
  }
  return {
    id: jobId,
    status: status.status,
    model: status.model,
    period_start: status.period_start,
    period_end: status.period_end,
    result_json: status.data,
    usage_json: status.usage,
  }
}

const row = await loadStoredResult()
if (!row?.result_json || row?.status !== 'done') throw new Error('A completed QA job with result_json is required')

const neutralStat = { average: 50, band: '보통', spread: 0, best_days: [], caution_days: [] }
const topics = Object.keys(row.result_json.topic_analysis ?? {})
const calculation = {
  ok: true,
  engine: 'live-qa-display-scaffold',
  period: { start: row.period_start, end: row.period_end, day_count: 1, month_segments: 1 },
  precision: {
    contract_version: 'integrated-precision-v2', status: 'exact', time_available: true, time_exact: true,
    time_source: 'official_record', time_confidence: 'exact', scoring_mode: 'full_exact',
    allow_natal_moon_scoring: true, allow_angles_houses_scoring: true, allow_house_ruler_bonus: true,
    allow_intraday_timing: true, allow_saju_ai: true, allow_thai_ai: true,
    layer_policy: { natal_moon:'allow', angles_houses:'allow', house_ruler_bonus:'allow', intraday_timing:'allow', saju_ai:'allow', thai_ai:'allow' },
  },
  western: {
    ok: true,
    overall: Object.fromEntries(topics.map(topic => [topic, { ...neutralStat }])),
    relationship_signals: { 수신신호:{...neutralStat}, 발신적합:{...neutralStat}, 과거인연접점:{...neutralStat} },
    daily_scores: [], detail_days: [], months: [],
  },
  saju: { ok: true },
  thai: { ok: true },
}
const payload = {
  jobId: row.id,
  model: row.model,
  periodStart: row.period_start,
  periodEnd: row.period_end,
  calculation,
  interpretation: {
    ok: true,
    origin: 'gemini',
    provenance_verified: true,
    model: row.model,
    interpreter_version: row.usage_json?.generation_version,
    usage: row.usage_json,
    data: row.result_json,
  },
}

await mkdir(outputDir, { recursive: true })
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
})
const context = await browser.newContext({ viewport:{width:430,height:932}, deviceScaleFactor:1, isMobile:true, hasTouch:true, acceptDownloads:true })
const page = await context.newPage()
await page.addInitScript(value => { window.__FORTUNE_LIVE_QA__ = value }, payload)
let downloadCount = 0
const downloadPromises = []
page.on('download', download => {
  downloadCount += 1
  downloadPromises.push(download.saveAs(path.join(outputDir, `live-saved-result-${downloadCount}.png`)))
})

const assert = (condition, message) => { if (!condition) throw new Error(message) }
try {
  await page.goto(baseUrl, { waitUntil:'networkidle', timeout:30_000 })
  await page.waitForSelector('[data-qa-live-ready="true"]', { timeout:10_000 })
  const root = page.locator('[data-qa-live-root]')
  const visibleText = await root.innerText()
  assert(visibleText.includes(row.result_json.headline), 'actual Gemini headline is not visible')
  assert(visibleText.includes(row.result_json.overall.summary.slice(0, 40)), 'actual Gemini summary is not visible')
  assert(await root.locator('.period-ai-topic').count() >= 2, 'field cards are missing')
  assert(await root.locator('.reading-period-date').count() === 1, 'fortune date label is missing')

  const widths = []
  for (const width of [320, 350, 393, 430]) {
    await page.setViewportSize({ width, height:932 })
    const diagnostics = await root.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const clipped = Array.from(element.querySelectorAll('h1,h2,h3,h4,p,strong,b,li,button,summary')).filter(node => {
        const box = node.getBoundingClientRect()
        const style = getComputedStyle(node)
        return style.display !== 'none' && box.width > 0 && (box.left < -1 || box.right > innerWidth + 1)
      }).length
      return {
        width: innerWidth,
        documentOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
        rootOverflow: Math.max(0, element.scrollWidth - element.clientWidth),
        clipped,
        height: Math.round(rect.height),
      }
    })
    assert(diagnostics.documentOverflow <= 1, `document overflows at ${width}px: ${JSON.stringify(diagnostics)}`)
    assert(diagnostics.rootOverflow <= 1, `reading overflows at ${width}px: ${JSON.stringify(diagnostics)}`)
    assert(diagnostics.clipped === 0, `reader text is clipped at ${width}px: ${JSON.stringify(diagnostics)}`)
    assert(diagnostics.height > 300, `reading is unexpectedly blank at ${width}px`)
    widths.push(diagnostics)
    await root.screenshot({ path:path.join(outputDir, `live-fortune-${width}.png`) })
  }

  const details = root.locator('details.period-ai-details')
  await details.locator('summary').click()
  assert(await details.locator('[data-qa-live-evidence] li').count() >= 3, 'evidence references are missing after disclosure')
  await details.screenshot({ path:path.join(outputDir, 'live-evidence-expanded.png') })

  await page.setViewportSize({ width:430, height:932 })
  await page.locator('[data-qa-live-export]').click()
  await page.waitForFunction(() => {
    const value = document.querySelector('[data-qa-live-export-status]')?.textContent || ''
    return value.startsWith('done:') || value.startsWith('error:')
  }, null, { timeout:30_000 })
  const exportState = (await page.locator('[data-qa-live-export-status]').textContent()) || ''
  assert(!exportState.startsWith('error:'), `image export failed: ${exportState}`)
  const expectedPages = Number(exportState.split(':')[1])
  const deadline = Date.now() + 10_000
  while (downloadCount < expectedPages && Date.now() < deadline) await page.waitForTimeout(100)
  await Promise.all(downloadPromises)
  assert(expectedPages > 0 && downloadCount === expectedPages, `expected ${expectedPages} saved images, received ${downloadCount}`)

  const languageIssues = []
  if (/한\s*바이트\s*쉬/.test(visibleText)) languageIssues.push('UNNATURAL_KOREAN_BYTE_PAUSE')
  const diagnostics = { ok:true, source:'live-gemini', jobId:row.id, model:row.model, widths, evidenceRefs:await details.locator('li').count(), expectedPages, downloadCount, languageIssues }
  await writeFile(path.join(outputDir, 'diagnostics.json'), JSON.stringify(diagnostics, null, 2))
  console.log(JSON.stringify(diagnostics, null, 2))
} finally {
  await browser.close()
}
