type ExportBlockKind = 'title' | 'heading' | 'body' | 'list' | 'meta'

type ExportBlock = {
  kind: ExportBlockKind
  text: string
}

type ExportResult = {
  pages: number
  shared: boolean
  cancelled: boolean
}

const PAGE_WIDTH = 1080
const PAGE_HEIGHT = 1440
const PAGE_PADDING = 76
const FOOTER_HEIGHT = 72
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

export function collectReadingExportBlocks(root: HTMLElement): ExportBlock[] {
  const blocks: ExportBlock[] = []
  const push = (kind: ExportBlockKind, value: string) => {
    const text = normalizeText(value)
    if (!text || blocks.at(-1)?.text === text) return
    blocks.push({ kind, text })
  }
  const walk = (element: HTMLElement) => {
    if (element !== root && (ignored(element) || hidden(element))) return
    if (element.tagName === 'DETAILS' && !(element as HTMLDetailsElement).open) return
    if (element.matches('.reunion-date-focus-list article')) {
      push('meta', element.innerText)
      return
    }
    if (/^H[1-4]$/.test(element.tagName)) {
      push(element.tagName === 'H1' || element.tagName === 'H2' ? 'title' : 'heading', element.innerText)
      return
    }
    if (element.tagName === 'P') {
      push('body', element.innerText)
      return
    }
    if (element.tagName === 'LI') {
      push('list', element.innerText)
      return
    }
    if (element.tagName === 'TIME' || element.tagName === 'SMALL' || element.tagName === 'SUMMARY') {
      push('meta', element.innerText)
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
  return normalizeText(value).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').slice(0, 48) || '결과'
}

function localDateStamp() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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
    ctx.fillStyle = '#f8fbfc'
    ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT)
    const wash = ctx.createLinearGradient(0, 0, PAGE_WIDTH, 0)
    wash.addColorStop(0, '#eef8f7')
    wash.addColorStop(0.52, '#f8fbfc')
    wash.addColorStop(1, '#f6effb')
    ctx.fillStyle = wash
    ctx.fillRect(0, 0, PAGE_WIDTH, 190)
    ctx.fillStyle = '#59677e'
    ctx.font = '600 26px system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
    ctx.fillText('별빛의 운명', PAGE_PADDING, 72)
    canvases.push(canvas)
    y = 124
  }

  const styleFor = (kind: ExportBlockKind) => {
    if (kind === 'title') return { size: 50, weight: 700, line: 70, before: 24, after: 28, color: '#26344a', indent: 0 }
    if (kind === 'heading') return { size: 39, weight: 700, line: 58, before: 28, after: 14, color: '#32415b', indent: 0 }
    if (kind === 'list') return { size: 31, weight: 400, line: 50, before: 8, after: 18, color: '#344154', indent: 24 }
    if (kind === 'meta') return { size: 27, weight: 500, line: 44, before: 8, after: 16, color: '#6a7282', indent: 0 }
    return { size: 32, weight: 400, line: 52, before: 8, after: 22, color: '#344154', indent: 0 }
  }

  newPage()
  ctx.font = '700 54px system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
  ctx.fillStyle = '#26344a'
  for (const line of wrapText(ctx, label, TEXT_WIDTH)) {
    ctx.fillText(line, PAGE_PADDING, y)
    y += 72
  }
  y += 18

  for (const block of blocks) {
    const style = styleFor(block.kind)
    ctx.font = `${style.weight} ${style.size}px system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`
    const prefix = block.kind === 'list' ? '• ' : ''
    const lines = wrapText(ctx, `${prefix}${block.text}`, TEXT_WIDTH - style.indent)
    if (!lines.length) continue
    if ((block.kind === 'title' || block.kind === 'heading') && y + style.before + style.line * Math.min(2, lines.length) > PAGE_HEIGHT - FOOTER_HEIGHT) newPage()
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
    pageCtx.fillStyle = '#8a91a0'
    pageCtx.font = '500 23px system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
    pageCtx.fillText(`별빛의 운명 · ${index + 1}/${canvases.length}`, PAGE_PADDING, PAGE_HEIGHT - 34)
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
