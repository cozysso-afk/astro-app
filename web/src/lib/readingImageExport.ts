type ExportBlockKind = 'title' | 'heading' | 'body' | 'list' | 'meta'
type ExportTone = 'plain' | 'favorable' | 'caution' | 'love' | 'date' | 'system'

type ExportBlock = {
  kind: ExportBlockKind
  text: string
  tone: ExportTone
}

type ExportResult = {
  pages: number
  shared: boolean
  cancelled: boolean
}

// iPhone 17 Pro screenshots are 1206 px wide at 3x. 1206x1508 is effectively 4:5,
// so a saved card opens close to native width instead of becoming a tiny full-page screenshot.
const PAGE_WIDTH = 1206
const PAGE_HEIGHT = 1508
const PAGE_PADDING = 86
const FOOTER_HEIGHT = 86
const TEXT_WIDTH = PAGE_WIDTH - PAGE_PADDING * 2

function normalizeText(value: string) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function ignored(element: HTMLElement) {
  return Boolean(element.closest('[data-reading-export-ignore="true"], .relationship-technical, .ai-generated-cost, .ai-preflight-cost'))
}

function hidden(element: HTMLElement) {
  if (element.hidden || element.getAttribute('aria-hidden') === 'true') return true
  const style = window.getComputedStyle(element)
  return style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0
}

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
    if (element.matches('.reunion-date-focus-list article')) {
      push('meta', element.innerText, 'date')
      return
    }
    if (/^H[1-4]$/.test(element.tagName)) {
      push(element.tagName === 'H1' || element.tagName === 'H2' ? 'title' : 'heading', element.innerText, tone)
      return
    }
    if (element.tagName === 'P') {
      push('body', element.innerText, tone)
      return
    }
    if (element.tagName === 'LI') {
      push('list', element.innerText, tone)
      return
    }
    if (element.tagName === 'TIME' || element.tagName === 'SMALL' || element.tagName === 'SUMMARY' || element.matches('.reading-period-date')) {
      push('meta', element.innerText, tone === 'plain' ? 'date' : tone)
      return
    }
    for (const child of Array.from(element.children)) {
      if (child instanceof HTMLElement) walk(child)
    }
  }
  walk(root)
  return blocks
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = []
  for (const sourceLine of text.split(/\n+/)) {
    const clean = normalizeText(sourceLine)
    if (!clean) continue
    let line = ''
    for (const char of clean) {
      const next = line + char
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line.trimEnd())
        line = char.trimStart()
      } else {
        line = next
      }
    }
    if (line) lines.push(line.trimEnd())
  }
  return lines
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('이미지를 만들지 못했어.')), 'image/png')
  })
}

function safeFileName(value: string) {
  return normalizeText(value).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').slice(0, 64) || '결과'
}

function localDateStamp() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function toneFill(tone: ExportTone) {
  if (tone === 'favorable') return 'rgba(202, 244, 231, 0.58)'
  if (tone === 'caution') return 'rgba(255, 224, 204, 0.62)'
  if (tone === 'love') return 'rgba(238, 221, 252, 0.62)'
  if (tone === 'date') return 'rgba(225, 239, 255, 0.68)'
  if (tone === 'system') return 'rgba(242, 236, 207, 0.55)'
  return ''
}

function drawHighlight(ctx: CanvasRenderingContext2D, tone: ExportTone, top: number, height: number) {
  const fill = toneFill(tone)
  if (!fill) return
  ctx.fillStyle = fill
  ctx.fillRect(PAGE_PADDING - 18, top, TEXT_WIDTH + 36, height)
}

export async function exportReadingImages(root: HTMLElement, label: string): Promise<ExportResult> {
  const blocks = collectReadingExportBlocks(root)
  if (!blocks.length) throw new Error('저장할 결과 내용을 찾지 못했어.')

  const canvases: HTMLCanvasElement[] = []
  let canvas = document.createElement('canvas')
  let ctx = canvas.getContext('2d')!
  let y = 0

  const newPage = () => {
    canvas = document.createElement('canvas')
    canvas.width = PAGE_WIDTH
    canvas.height = PAGE_HEIGHT
    ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fbfcfd'
    ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT)
    const wash = ctx.createLinearGradient(0, 0, PAGE_WIDTH, 0)
    wash.addColorStop(0, '#eaf8f4')
    wash.addColorStop(0.5, '#f8fbfc')
    wash.addColorStop(1, '#f4edfb')
    ctx.fillStyle = wash
    ctx.fillRect(0, 0, PAGE_WIDTH, 220)
    ctx.fillStyle = '#53627a'
    ctx.font = '650 34px system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
    ctx.fillText('별빛의 운명', PAGE_PADDING, 82)
    canvases.push(canvas)
    y = 140
  }

  const styleFor = (kind: ExportBlockKind) => {
    if (kind === 'title') return { size: 68, weight: 750, line: 88, before: 28, after: 34, color: '#26344a', indent: 0 }
    if (kind === 'heading') return { size: 52, weight: 750, line: 70, before: 32, after: 18, color: '#31415a', indent: 0 }
    if (kind === 'list') return { size: 44, weight: 430, line: 66, before: 10, after: 22, color: '#344154', indent: 28 }
    if (kind === 'meta') return { size: 36, weight: 600, line: 54, before: 10, after: 18, color: '#647087', indent: 0 }
    return { size: 46, weight: 430, line: 68, before: 10, after: 26, color: '#334157', indent: 0 }
  }

  newPage()
  ctx.font = '760 72px system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
  ctx.fillStyle = '#243248'
  for (const line of wrapText(ctx, label, TEXT_WIDTH)) {
    ctx.fillText(line, PAGE_PADDING, y)
    y += 92
  }
  y += 20

  for (const block of blocks) {
    const style = styleFor(block.kind)
    ctx.font = `${style.weight} ${style.size}px system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`
    const prefix = block.kind === 'list' ? '• ' : ''
    const lines = wrapText(ctx, `${prefix}${block.text}`, TEXT_WIDTH - style.indent)
    if (!lines.length) continue
    const blockHeight = style.before + style.line * lines.length + style.after
    if ((block.kind === 'title' || block.kind === 'heading' || block.tone !== 'plain') && y + Math.min(blockHeight, style.before + style.line * 2) > PAGE_HEIGHT - FOOTER_HEIGHT) newPage()
    if (block.tone !== 'plain') drawHighlight(ctx, block.tone, y + Math.max(2, style.before - 8), Math.min(blockHeight - 4, style.line * lines.length + style.after + 12))
    y += style.before
    for (const line of lines) {
      if (y + style.line > PAGE_HEIGHT - FOOTER_HEIGHT) newPage()
      ctx.font = `${style.weight} ${style.size}px system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`
      ctx.fillStyle = style.color
      ctx.fillText(line, PAGE_PADDING + style.indent, y)
      y += style.line
    }
    y += style.after
  }

  canvases.forEach((page, index) => {
    const pageCtx = page.getContext('2d')!
    pageCtx.fillStyle = '#7e8797'
    pageCtx.font = '550 30px system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
    pageCtx.fillText(`별빛의 운명 · ${index + 1}/${canvases.length}`, PAGE_PADDING, PAGE_HEIGHT - 38)
  })

  const blobs = await Promise.all(canvases.map(canvasToBlob))
  const stem = `별빛의운명-${safeFileName(label)}-${localDateStamp()}`
  const files = blobs.map((blob, index) => new File([blob], `${stem}-${String(index + 1).padStart(2, '0')}.png`, { type: 'image/png' }))

  if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files })) {
    try {
      await navigator.share({ files, title: `별빛의 운명 · ${label}` })
      return { pages: files.length, shared: true, cancelled: false }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return { pages: files.length, shared: true, cancelled: true }
    }
  }

  files.forEach((file, index) => {
    const url = URL.createObjectURL(file)
    window.setTimeout(() => {
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = file.name
      anchor.rel = 'noopener'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 2000)
    }, index * 180)
  })
  return { pages: files.length, shared: false, cancelled: false }
}
