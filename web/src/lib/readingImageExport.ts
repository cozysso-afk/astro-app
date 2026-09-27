type ExportBlockKind = 'title' | 'heading' | 'body' | 'list' | 'meta'
type ExportTone = 'plain' | 'favorable' | 'caution' | 'love' | 'date' | 'system'

type ExportBlock = { kind: ExportBlockKind; text: string; tone: ExportTone }
type ExportResult = { pages: number; shared: boolean; cancelled: boolean }
type PeriodFlow = { title: string; band: string; score: string; text: string; tone: ExportTone }
type PeriodTopic = { title: string; conclusion: string; action?: string; observe?: string; tone: ExportTone }
type PeriodDate = { date: string; status: string; text: string; tone: ExportTone }
type PeriodExportModel = {
  date: string
  hero: string
  subtitle: string
  favorable: PeriodFlow[]
  caution: PeriodFlow[]
  reference: PeriodFlow[]
  topics: PeriodTopic[]
  dates: PeriodDate[]
}

const PAGE_WIDTH = 1206
const PAGE_HEIGHT = 1508
const PAGE_PADDING = 76
const FOOTER_HEIGHT = 86
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_PADDING * 2

const COLORS = {
  ink: '#26364f', muted: '#6b7890', line: '#dce4ec', paper: '#fbfcfd', white: '#ffffff',
  favorable: '#e2f6ef', favorableEdge: '#7bb9a5', caution: '#fff0e4', cautionEdge: '#d6a080',
  love: '#f0e6fb', loveEdge: '#a887ca', date: '#e8f2ff', dateEdge: '#7f9fc9', system: '#f5f1dd', systemEdge: '#b5a873',
}

function normalizeText(value: string) { return String(value ?? '').replace(/\s+/g, ' ').trim() }
function firstSentence(value: string) {
  const text = normalizeText(value)
  if (!text) return ''
  const match = text.match(/^.*?[.!?](?:\s|$)/)
  return normalizeText(match?.[0] ?? text)
}
function hidden(element: HTMLElement) {
  if (element.hidden || element.getAttribute('aria-hidden') === 'true') return true
  const style = window.getComputedStyle(element)
  return style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0
}
function ignored(element: HTMLElement) {
  return Boolean(element.closest('[data-reading-export-ignore="true"], .relationship-technical, .ai-generated-cost, .ai-preflight-cost'))
}
function textOf(root: ParentNode, selector: string) { return normalizeText(root.querySelector<HTMLElement>(selector)?.innerText ?? '') }
function exportTone(element: HTMLElement): ExportTone {
  const explicit = element.closest<HTMLElement>('[data-reading-export-tone]')?.dataset.readingExportTone
  if (explicit === 'favorable' || explicit === 'caution' || explicit === 'love' || explicit === 'date' || explicit === 'system') return explicit
  const classText = `${element.className || ''} ${element.parentElement?.className || ''}`
  if (/caution|warning|avoid|주의/i.test(classText)) return 'caution'
  if (/good|favorable|use|best/i.test(classText)) return 'favorable'
  if (/relationship|reunion|love|contact/i.test(classText)) return 'love'
  if (/date|window|timing|timeline/i.test(classText)) return 'date'
  if (/system|western|saju|thai/i.test(classText)) return 'system'
  return 'plain'
}

export function collectReadingExportBlocks(root: HTMLElement): ExportBlock[] {
  const blocks: ExportBlock[] = []
  const push = (kind: ExportBlockKind, value: string, tone: ExportTone = 'plain') => {
    const text = normalizeText(value)
    if (!text || blocks.at(-1)?.text === text) return
    blocks.push({ kind, text, tone })
  }
  const walk = (element: HTMLElement) => {
    if (element !== root && (ignored(element) || hidden(element))) return
    if (element.tagName === 'DETAILS' && !(element as HTMLDetailsElement).open) return
    const tone = exportTone(element)
    if (/^H[1-4]$/.test(element.tagName)) { push(element.tagName === 'H1' || element.tagName === 'H2' ? 'title' : 'heading', element.innerText, tone); return }
    if (element.tagName === 'P') { push('body', element.innerText, tone); return }
    if (element.tagName === 'LI') { push('list', element.innerText, tone); return }
    if (element.tagName === 'TIME' || element.tagName === 'SMALL' || element.tagName === 'SUMMARY') { push('meta', element.innerText, tone); return }
    for (const child of Array.from(element.children)) if (child instanceof HTMLElement) walk(child)
  }
  walk(root)
  return blocks
}

function collectPeriodExportModel(root: HTMLElement): PeriodExportModel {
  const flowSections = Array.from(root.querySelectorAll<HTMLElement>('.flow-section'))
  const flows = (section: HTMLElement, tone: ExportTone): PeriodFlow[] => Array.from(section.querySelectorAll<HTMLElement>('.flow-tile')).slice(0, 2).map(tile => ({
    title: textOf(tile, '.flow-tile-heading strong'),
    score: textOf(tile, '.flow-score'),
    band: textOf(tile, '.flow-band'),
    text: firstSentence(textOf(tile, 'p')),
    tone,
  })).filter(item => item.title && item.text)
  const favorable: PeriodFlow[] = []
  const caution: PeriodFlow[] = []
  const reference: PeriodFlow[] = []
  for (const section of flowSections) {
    if (section.classList.contains('is-caution')) caution.push(...flows(section, 'caution'))
    else if (section.classList.contains('is-reference-flow')) reference.push(...flows(section, 'system'))
    else favorable.push(...flows(section, 'favorable'))
  }

  const topics = Array.from(root.querySelectorAll<HTMLElement>('.period-ai-user-focus .period-ai-topic')).slice(0, 4).map(article => {
    const paragraphs = Array.from(article.querySelectorAll<HTMLElement>(':scope > p'))
    const labeled = (label: string) => normalizeText(paragraphs.find(p => textOf(p, 'em') === label)?.innerText.replace(label, '') ?? '')
    return {
      title: textOf(article, ':scope > strong'),
      conclusion: firstSentence(textOf(article, ':scope > b')),
      action: firstSentence(labeled('실제로는')),
      observe: firstSentence(labeled('확인할 것')),
      tone: exportTone(article),
    } satisfies PeriodTopic
  }).filter(item => item.title && item.conclusion)

  const dates: PeriodDate[] = []
  for (const group of Array.from(root.querySelectorAll<HTMLElement>('.period-ai-user-windows .reading-event-list > ol > li, .period-ai-user-windows .reading-more ol > li')).slice(0, 4)) {
    const date = textOf(group, ':scope > time')
    for (const event of Array.from(group.querySelectorAll<HTMLElement>('.reading-event')).slice(0, 2)) {
      const status = textOf(event, '.reading-state') || textOf(event, '.reading-badge')
      const text = firstSentence(textOf(event, ':scope > p'))
      if (date && text) dates.push({ date, status, text, tone: event.className.includes('caution') ? 'caution' : event.className.includes('favorable') ? 'favorable' : 'date' })
    }
  }

  return {
    date: textOf(root, '.reading-period-date') || textOf(root, '.result-headline span'),
    hero: firstSentence(textOf(root, '.period-ai-head h3')),
    subtitle: firstSentence(textOf(root, '.reading-hero-subtitle')),
    favorable,
    caution,
    reference,
    topics,
    dates: dates.slice(0, 5),
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = []
  const clean = normalizeText(text)
  if (!clean) return lines
  let line = ''
  for (const char of clean) {
    const next = line + char
    if (line && ctx.measureText(next).width > maxWidth) { lines.push(line.trimEnd()); line = char.trimStart() } else line = next
  }
  if (line) lines.push(line.trimEnd())
  return lines
}
function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('이미지를 만들지 못했어.')), 'image/png'))
}
function safeFileName(value: string) { return normalizeText(value).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').slice(0, 64) || '결과' }
function localDateStamp() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}` }

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w/2, h/2)
  ctx.beginPath(); ctx.moveTo(x+radius,y); ctx.arcTo(x+w,y,x+w,y+h,radius); ctx.arcTo(x+w,y+h,x,y+h,radius); ctx.arcTo(x,y+h,x,y,radius); ctx.arcTo(x,y,x+w,y,radius); ctx.closePath()
}
function toneStyle(tone: ExportTone) {
  if (tone === 'favorable') return [COLORS.favorable, COLORS.favorableEdge] as const
  if (tone === 'caution') return [COLORS.caution, COLORS.cautionEdge] as const
  if (tone === 'love') return [COLORS.love, COLORS.loveEdge] as const
  if (tone === 'date') return [COLORS.date, COLORS.dateEdge] as const
  if (tone === 'system') return [COLORS.system, COLORS.systemEdge] as const
  return [COLORS.white, COLORS.line] as const
}

function createPage() {
  const canvas = document.createElement('canvas'); canvas.width = PAGE_WIDTH; canvas.height = PAGE_HEIGHT
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = COLORS.paper; ctx.fillRect(0,0,PAGE_WIDTH,PAGE_HEIGHT)
  const wash = ctx.createLinearGradient(0,0,PAGE_WIDTH,230); wash.addColorStop(0,'#eaf8f4'); wash.addColorStop(.52,'#fbfcfd'); wash.addColorStop(1,'#f4edfb')
  ctx.fillStyle = wash; ctx.fillRect(0,0,PAGE_WIDTH,230)
  return { canvas, ctx }
}
function drawBrand(ctx: CanvasRenderingContext2D, label: string, date: string) {
  ctx.fillStyle = '#5d6e87'; ctx.font = '650 31px system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif'; ctx.fillText('별빛의 운명', PAGE_PADDING, 70)
  ctx.fillStyle = COLORS.ink; ctx.font = '760 58px system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif'
  const title = label.replace(/\s*·\s*\d{4}-\d{2}-\d{2}(?:~\d{4}-\d{2}-\d{2})?$/, '')
  const titleLines = wrapText(ctx, title, CONTENT_WIDTH - 260).slice(0,2)
  let y = 132; for (const line of titleLines) { ctx.fillText(line,PAGE_PADDING,y); y += 68 }
  if (date) {
    ctx.font = '650 32px system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif'; ctx.fillStyle = '#66738a';
    const width = Math.min(360, ctx.measureText(date).width + 46); roundRect(ctx,PAGE_WIDTH-PAGE_PADDING-width,80,width,58,29); ctx.fillStyle = 'rgba(255,255,255,.78)'; ctx.fill(); ctx.fillStyle = '#66738a'; ctx.fillText(date,PAGE_WIDTH-PAGE_PADDING-width+23,119)
  }
}
function drawSectionTitle(ctx: CanvasRenderingContext2D, title: string, y: number) {
  ctx.fillStyle = COLORS.ink; ctx.font = '750 39px system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif'; ctx.fillText(title,PAGE_PADDING,y)
  return y + 34
}
function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, size = 40, lineHeight = 58, weight = 450, color = COLORS.ink, maxLines = 6) {
  ctx.font = `${weight} ${size}px system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif`; ctx.fillStyle = color
  const lines = wrapText(ctx,text,width).slice(0,maxLines)
  lines.forEach((line,index)=>ctx.fillText(line,x,y+index*lineHeight))
  return y + lines.length*lineHeight
}
function drawCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, tone: ExportTone) {
  const [fill,edge] = toneStyle(tone); roundRect(ctx,x,y,w,h,30); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = 2; ctx.stroke()
}
function drawFlow(ctx: CanvasRenderingContext2D, item: PeriodFlow, y: number) {
  const h = 190; drawCard(ctx,PAGE_PADDING,y,CONTENT_WIDTH,h,item.tone)
  ctx.fillStyle = COLORS.ink; ctx.font = '750 36px system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif'; ctx.fillText(item.title,PAGE_PADDING+28,y+48)
  const badge = [item.band,item.score].filter(Boolean).join(' · '); ctx.font = '650 29px system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif'; ctx.fillStyle = COLORS.muted; ctx.fillText(badge,PAGE_PADDING+28,y+88)
  drawText(ctx,item.text,PAGE_PADDING+28,y+137,CONTENT_WIDTH-56,36,50,480,COLORS.ink,2)
  return y+h+20
}
function drawTopic(ctx: CanvasRenderingContext2D, item: PeriodTopic, y: number) {
  const bodyParts = [item.conclusion,item.action ? `→ ${item.action}` : '',item.observe ? `확인: ${item.observe}` : ''].filter(Boolean)
  ctx.font = '450 36px system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif'
  const lineCount = bodyParts.reduce((n,text)=>n+Math.min(2,wrapText(ctx,text,CONTENT_WIDTH-56).length),0)
  const h = 102 + Math.max(2,lineCount)*50
  drawCard(ctx,PAGE_PADDING,y,CONTENT_WIDTH,h,item.tone)
  ctx.fillStyle = COLORS.ink; ctx.font = '760 37px system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif'; ctx.fillText(item.title,PAGE_PADDING+28,y+50)
  let py = y+102
  for (const [index,text] of bodyParts.entries()) { py = drawText(ctx,text,PAGE_PADDING+28,py,CONTENT_WIDTH-56,index===0?37:33,index===0?52:47,index===0?520:430,index===0?COLORS.ink:COLORS.muted,2) + 6 }
  return y+h+20
}
function drawDate(ctx: CanvasRenderingContext2D, item: PeriodDate, y: number) {
  const h = 154; drawCard(ctx,PAGE_PADDING,y,CONTENT_WIDTH,h,item.tone)
  ctx.fillStyle = COLORS.ink; ctx.font = '760 34px system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif'; ctx.fillText(item.date,PAGE_PADDING+28,y+48)
  if (item.status) { ctx.fillStyle = COLORS.muted; ctx.font = '650 28px system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif'; ctx.fillText(item.status,PAGE_PADDING+28,y+87) }
  drawText(ctx,item.text,PAGE_PADDING+240,y+52,CONTENT_WIDTH-276,33,46,450,COLORS.ink,2)
  return y+h+18
}

function renderPeriodPages(model: PeriodExportModel, label: string) {
  const pages: HTMLCanvasElement[] = []
  const page1 = createPage(); pages.push(page1.canvas); drawBrand(page1.ctx,label,model.date)
  let y = 276
  y = drawSectionTitle(page1.ctx,'오늘 핵심',y)
  const heroLines = wrapText(page1.ctx,model.hero,CONTENT_WIDTH-60)
  const heroHeight = Math.max(190, 78 + Math.min(5,heroLines.length)*58 + (model.subtitle ? 58 : 0))
  drawCard(page1.ctx,PAGE_PADDING,y,CONTENT_WIDTH,heroHeight,'plain')
  let hy = drawText(page1.ctx,model.hero,PAGE_PADDING+30,y+62,CONTENT_WIDTH-60,43,58,650,COLORS.ink,5)
  if (model.subtitle) drawText(page1.ctx,model.subtitle,PAGE_PADDING+30,hy+10,CONTENT_WIDTH-60,31,44,430,COLORS.muted,2)
  y += heroHeight + 42
  const primaryFlows = [...model.favorable.slice(0,1),...model.caution.slice(0,1)]
  if (primaryFlows.length) { y = drawSectionTitle(page1.ctx,'한눈에 보는 흐름',y); for (const item of primaryFlows) y = drawFlow(page1.ctx,item,y+8) }

  const secondaryFlows = [...model.favorable.slice(1,2),...model.caution.slice(1,2),...model.reference.slice(0,1)]
  const detailItems = [...secondaryFlows.map(item=>({kind:'flow' as const,item})),...model.topics.map(item=>({kind:'topic' as const,item}))]
  if (detailItems.length || model.dates.length) {
    let current = createPage(); pages.push(current.canvas); drawBrand(current.ctx,label,model.date); let py = 276
    if (detailItems.length) py = drawSectionTitle(current.ctx,'분야별 핵심',py)
    for (const row of detailItems) {
      const estimated = row.kind === 'flow' ? 218 : 300
      if (py + estimated > PAGE_HEIGHT - FOOTER_HEIGHT - 80) { current = createPage(); pages.push(current.canvas); drawBrand(current.ctx,label,model.date); py = 276; py = drawSectionTitle(current.ctx,'분야별 핵심 · 계속',py) }
      py = row.kind === 'flow' ? drawFlow(current.ctx,row.item,py+8) : drawTopic(current.ctx,row.item,py+8)
    }
    if (model.dates.length) {
      if (py + 230 > PAGE_HEIGHT - FOOTER_HEIGHT) { current = createPage(); pages.push(current.canvas); drawBrand(current.ctx,label,model.date); py = 276 }
      py = drawSectionTitle(current.ctx,'기억할 시기',py+10)
      for (const item of model.dates) {
        if (py + 176 > PAGE_HEIGHT - FOOTER_HEIGHT - 50) { current = createPage(); pages.push(current.canvas); drawBrand(current.ctx,label,model.date); py = 276; py = drawSectionTitle(current.ctx,'기억할 시기 · 계속',py) }
        py = drawDate(current.ctx,item,py+8)
      }
    }
  }
  return pages
}

function renderGenericPages(root: HTMLElement, label: string) {
  const blocks = collectReadingExportBlocks(root)
  const pages: HTMLCanvasElement[] = []
  let current = createPage(); pages.push(current.canvas); drawBrand(current.ctx,label,''); let y = 280
  for (const block of blocks) {
    if (!block.text || /점수는 흐름의 강도야/.test(block.text)) continue
    const title = block.kind === 'title' || block.kind === 'heading'
    current.ctx.font = `${title?700:440} ${title?42:36}px system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif`
    const lines = wrapText(current.ctx,block.text,CONTENT_WIDTH-56); const h = 50 + Math.min(title?3:5,lines.length)*(title?54:48)
    if (y+h > PAGE_HEIGHT-FOOTER_HEIGHT-40) { current=createPage(); pages.push(current.canvas); drawBrand(current.ctx,label,''); y=280 }
    drawCard(current.ctx,PAGE_PADDING,y,CONTENT_WIDTH,h,block.tone)
    drawText(current.ctx,block.text,PAGE_PADDING+28,y+46,CONTENT_WIDTH-56,title?40:35,title?54:48,title?700:440,title?COLORS.ink:COLORS.ink,title?3:5)
    y += h+18
  }
  return pages
}

export async function exportReadingImages(root: HTMLElement, label: string): Promise<ExportResult> {
  const structured = root.dataset.readingExportRoot === 'period-fortune'
  const canvases = structured ? renderPeriodPages(collectPeriodExportModel(root),label) : renderGenericPages(root,label)
  const nonEmpty = canvases.filter(Boolean)
  nonEmpty.forEach((page,index)=>{
    const ctx=page.getContext('2d')!; ctx.fillStyle=COLORS.muted; ctx.font='550 27px system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif'
    ctx.fillText(`별빛의 운명 · ${index+1}/${nonEmpty.length}`,PAGE_PADDING,PAGE_HEIGHT-38)
    ctx.textAlign='right'; ctx.fillText('점수는 상대적 강도이며 사건 확률이 아님',PAGE_WIDTH-PAGE_PADDING,PAGE_HEIGHT-38); ctx.textAlign='left'
  })
  const blobs = await Promise.all(nonEmpty.map(canvasToBlob))
  const stem = `별빛의운명-${safeFileName(label)}-${localDateStamp()}`
  const files = blobs.map((blob,index)=>new File([blob],`${stem}-${String(index+1).padStart(2,'0')}.png`,{type:'image/png'}))
  if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({files})) {
    try { await navigator.share({files,title:`별빛의 운명 · ${label}`}); return {pages:files.length,shared:true,cancelled:false} }
    catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return {pages:files.length,shared:true,cancelled:true} }
  }
  files.forEach((file,index)=>{ const url=URL.createObjectURL(file); window.setTimeout(()=>{ const anchor=document.createElement('a'); anchor.href=url; anchor.download=file.name; anchor.rel='noopener'; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(()=>URL.revokeObjectURL(url),2000) },index*180) })
  return {pages:files.length,shared:false,cancelled:false}
}
