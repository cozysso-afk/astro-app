type ExportTone = 'plain' | 'favorable' | 'caution' | 'love' | 'date' | 'system'
type ExportResult = { pages: number; shared: boolean; cancelled: boolean }
type ExportCard = { eyebrow?: string; title: string; body?: string; meta?: string; tone: ExportTone; emphasis?: boolean }
type ExportSection = { title?: string; cards: ExportCard[] }
type ExportModel = { title: string; date: string; hero: string; subtitle?: string; sections: ExportSection[] }
type LayoutItem = { section?: string; card: ExportCard }

const PAGE_WIDTH = 1206
const PAGE_HEIGHT = 1608
const PAGE_PADDING = 72
const HEADER_HEIGHT = 178
const FOOTER_HEIGHT = 70
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_PADDING * 2
const BODY_SIZE = 40
const BODY_LINE = 55
const SMALL_SIZE = 28
const SMALL_LINE = 39
const CARD_GAP = 28

const COLORS = {
  ink: '#34405d',
  inkSoft: '#52617a',
  muted: '#7b879c',
  favorable: ['rgba(220,250,239,.72)', 'rgba(244,255,251,.52)'],
  caution: ['rgba(255,230,239,.70)', 'rgba(255,247,232,.50)'],
  love: ['rgba(238,228,255,.72)', 'rgba(255,238,247,.50)'],
  date: ['rgba(221,240,255,.74)', 'rgba(241,249,255,.50)'],
  system: ['rgba(255,247,216,.60)', 'rgba(235,248,255,.50)'],
  plain: ['rgba(255,255,255,.72)', 'rgba(245,249,255,.50)'],
} as const

function normalizeText(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function firstSentences(value: unknown, limit = 2) {
  const text = normalizeText(value)
  if (!text) return ''
  return text
    .replace(/([.!?])\s+/g, '$1\n')
    .split('\n')
    .map(value => value.trim())
    .filter(Boolean)
    .slice(0, limit)
    .join(' ')
}

function textOf(root: ParentNode, selector: string) {
  return normalizeText(root.querySelector<HTMLElement>(selector)?.innerText ?? '')
}

function directParagraphs(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(':scope > p'))
    .map(paragraph => normalizeText(paragraph.innerText))
    .filter(Boolean)
}

function toneOf(element: HTMLElement): ExportTone {
  const explicit = element.closest<HTMLElement>('[data-reading-export-tone]')?.dataset.readingExportTone
  if (explicit === 'favorable' || explicit === 'caution' || explicit === 'love' || explicit === 'date' || explicit === 'system') return explicit
  const cls = `${element.className || ''} ${element.parentElement?.className || ''}`
  if (/caution|warning|avoid|주의/i.test(cls)) return 'caution'
  if (/good|favorable|best|change/i.test(cls)) return 'favorable'
  if (/love|relationship|reunion|contact/i.test(cls)) return 'love'
  if (/date|timing|timeline|window/i.test(cls)) return 'date'
  if (/system|social|interpersonal/i.test(cls)) return 'system'
  return 'plain'
}

function meaningfulCard(card: ExportCard) {
  return Boolean(normalizeText(card.title) && (normalizeText(card.body) || normalizeText(card.meta) || normalizeText(card.eyebrow)))
}

function dedupeCards(cards: ExportCard[]) {
  const seen = new Set<string>()
  return cards.filter(card => {
    if (!meaningfulCard(card)) return false
    const key = `${normalizeText(card.title).replace(/\s*·\s*(?:약함|보통|강함|낮음|높음)$/,'')}|${normalizeText(card.body)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function periodTopicCards(root: HTMLElement) {
  const nodes = [
    ...Array.from(root.querySelectorAll<HTMLElement>('.period-ai-user-focus .period-ai-topic')),
    ...Array.from(root.querySelectorAll<HTMLElement>('.period-ai-user-reference .period-ai-topic')),
  ]
  const cards = nodes.map(article => {
    const rawTitle = textOf(article, ':scope > strong')
    const title = rawTitle.replace(/\s*·\s*(?:약함|보통|강함|낮음|높음)\s*$/, '')
    const detail = textOf(article, ':scope > b')
    const paragraphs = directParagraphs(article)
    const body = [detail, ...paragraphs].filter(Boolean).join(' ')
    return { title, body: firstSentences(body, 3), tone: toneOf(article) } satisfies ExportCard
  })
  return dedupeCards(cards)
}

function periodModel(root: HTMLElement, label: string): ExportModel {
  const date = textOf(root, '.reading-period-date') || textOf(root, '.result-headline span')
  const hero = firstSentences(textOf(root, '.period-ai-head h3'), 2)
  const subtitle = firstSentences(textOf(root, '.reading-hero-subtitle'), 2)
  const sections: ExportSection[] = []

  for (const section of Array.from(root.querySelectorAll<HTMLElement>('.flow-section'))) {
    const cards = dedupeCards(Array.from(section.querySelectorAll<HTMLElement>('.flow-tile')).map(tile => ({
      eyebrow: textOf(tile, '.flow-band'),
      title: textOf(tile, '.flow-tile-heading strong'),
      body: firstSentences(textOf(tile, 'p'), 1),
      meta: textOf(tile, '.flow-score') ? `상대지수 ${textOf(tile, '.flow-score')}` : '',
      tone: toneOf(tile),
    } satisfies ExportCard)))
    if (cards.length) sections.push({ title: textOf(section, ':scope > h4') || '한눈에 보는 흐름', cards })
  }

  const loveCards = dedupeCards(Array.from(root.querySelectorAll<HTMLElement>('.love-context-card-v3')).map(card => ({
    title: textOf(card, ':scope > strong'),
    body: firstSentences(textOf(card, ':scope > p'), 2),
    tone: 'love' as const,
  })))
  if (loveCards.length) sections.push({ title: '내 상황에 맞춰 읽기', cards: loveCards })

  const interpersonal = root.querySelector<HTMLElement>('.interpersonal-reading-v3 .editorial-focus-card-v3')
  if (interpersonal) {
    const body = [textOf(interpersonal, ':scope > b'), ...directParagraphs(interpersonal)].filter(Boolean).join(' ')
    if (body) sections.push({ title: '대인관계', cards: [{ title: '사람 사이의 역할·거리·협력', body, tone: 'system' }] })
  }

  const contactCards: ExportCard[] = []
  const activation = root.querySelector<HTMLElement>('.contact-activation-v3')
  const direction = root.querySelector<HTMLElement>('.contact-direction-summary-v3')
  if (activation) {
    const body = [textOf(activation, ':scope > b'), ...directParagraphs(activation)].filter(Boolean).join(' ')
    contactCards.push({ eyebrow: '연락 전체', title: textOf(activation, ':scope > strong') || '연락 전체 활성도', body, meta: textOf(activation, ':scope > time'), tone: 'date' })
  }
  if (direction) contactCards.push({ eyebrow: '선연락 방향', title: textOf(direction, ':scope > strong') || '누가 먼저 움직이는가', body: textOf(direction, ':scope > b'), tone: 'love' })
  const cleanContactCards = dedupeCards(contactCards)
  if (cleanContactCards.length) sections.push({ title: '연락·소식', cards: cleanContactCards })

  const allTopicCards = periodTopicCards(root)
  if (allTopicCards.length) sections.push({ title: '분야별 해설', cards: allTopicCards })

  const dates: ExportCard[] = []
  const groups = Array.from(root.querySelectorAll<HTMLElement>('.period-ai-user-windows .reading-event-list > ol > li, .period-ai-user-windows .reading-more ol > li')).slice(0, 8)
  for (const group of groups) {
    const dateLabel = textOf(group, ':scope > time')
    if (!dateLabel) continue
    for (const event of Array.from(group.querySelectorAll<HTMLElement>('.reading-event')).slice(0, 2)) {
      const body = firstSentences(textOf(event, ':scope > p'), 1)
      if (!body) continue
      dates.push({ eyebrow: textOf(event, '.reading-state') || textOf(event, '.reading-badge') || '주목', title: dateLabel, body, tone: toneOf(event) })
    }
  }
  const cleanDates = dedupeCards(dates)
  if (cleanDates.length) sections.push({ title: '기억할 시기', cards: cleanDates })

  return { title: label, date, hero, subtitle, sections }
}

function reunionModel(root: HTMLElement, label: string): ExportModel {
  const date = textOf(root, '.reunion-result-meta strong')
  const hero = firstSentences(textOf(root, '.reunion-v3-hero p') || textOf(root, '.reading-conclusion'), 2)
  const sections: ExportSection[] = []

  const lead = dedupeCards(Array.from(root.querySelectorAll<HTMLElement>('.reunion-v3-grid .reunion-v3-card, .reunion-v3-change, .reunion-v3-next')).map(card => ({
    eyebrow: textOf(card, ':scope > small'),
    title: textOf(card, ':scope > h4'),
    body: [textOf(card, ':scope > b'), ...directParagraphs(card)].filter(Boolean).join(' '),
    meta: textOf(card, ':scope > time'),
    tone: toneOf(card),
    emphasis: true,
  })))
  if (lead.length) sections.push({ title: '핵심 판단', cards: lead })

  const dates: ExportCard[] = []
  for (const group of Array.from(root.querySelectorAll<HTMLElement>('.reunion-v3-timing .reading-event-list > ol > li, .reunion-v3-timing .reading-more ol > li'))) {
    const dateLabel = textOf(group, ':scope > time')
    if (!dateLabel) continue
    for (const event of Array.from(group.querySelectorAll<HTMLElement>('.reading-event'))) {
      const body = firstSentences(textOf(event, ':scope > p'), 1)
      if (!body) continue
      dates.push({ eyebrow: textOf(event, '.reading-state') || '주목', title: dateLabel, body, tone: 'date' })
    }
  }
  const cleanDates = dedupeCards(dates).slice(0, 4)
  if (cleanDates.length) sections.push({ title: '기억할 시기', cards: cleanDates })

  const meaning = dedupeCards(Array.from(root.querySelectorAll<HTMLElement>('.reunion-v3-meaning .reunion-v3-card')).map(card => ({
    title: textOf(card, ':scope > h4'),
    body: firstSentences([
      ...directParagraphs(card),
      ...Array.from(card.querySelectorAll<HTMLElement>('li')).map(li => normalizeText(li.innerText)),
    ].filter(Boolean).join(' '), 4),
    tone: toneOf(card),
  })))
  if (meaning.length) sections.push({ title: '관계를 판단할 기준', cards: meaning })

  const situations = dedupeCards(Array.from(root.querySelectorAll<HTMLElement>('.reunion-v3-situation')).map(card => ({
    title: textOf(card, ':scope > strong'),
    body: firstSentences(textOf(card, ':scope > p'), 2),
    tone: 'love' as const,
  })))
  if (situations.length) sections.push({ title: '내 현재 상황에 맞춰 읽기', cards: situations })

  return { title: label, date, hero, sections }
}

function genericModel(root: HTMLElement, label: string): ExportModel {
  const date = textOf(root, '.reading-period-date') || textOf(root, '.result-headline span') || textOf(root, '.reunion-result-meta strong')
  const hero = firstSentences(textOf(root, '.reading-hero h3') || textOf(root, '.period-ai-head h3') || textOf(root, 'h3'), 2)
  const cards: ExportCard[] = []
  for (const section of Array.from(root.querySelectorAll<HTMLElement>('section, article'))) {
    if (section.closest('[data-reading-export-ignore="true"]')) continue
    const title = textOf(section, ':scope > h4') || textOf(section, ':scope > h3') || textOf(section, ':scope > strong')
    const body = firstSentences(directParagraphs(section).join(' '), 2)
    if (title && body) cards.push({ title, body, tone: toneOf(section) })
  }
  return { title: label, date, hero, sections: dedupeCards(cards).length ? [{ cards: dedupeCards(cards).slice(0, 16) }] : [] }
}

export function buildReadingExportModel(root: HTMLElement, label: string): ExportModel {
  if (root.matches('[data-reading-export-root="period-fortune"]')) return periodModel(root, label)
  if (root.querySelector('.reunion-ui-v3')) return reunionModel(root, label)
  return genericModel(root, label)
}

function createCanvas() {
  const canvas = document.createElement('canvas')
  canvas.width = PAGE_WIDTH
  canvas.height = PAGE_HEIGHT
  const ctx = canvas.getContext('2d')!
  drawAuroraBackground(ctx)
  return { canvas, ctx }
}

function drawAuroraBackground(ctx: CanvasRenderingContext2D) {
  const base = ctx.createLinearGradient(0, 0, PAGE_WIDTH, PAGE_HEIGHT)
  base.addColorStop(0, '#f8fcff')
  base.addColorStop(.46, '#fbf9ff')
  base.addColorStop(1, '#f7fffb')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT)
  const glow = (x: number, y: number, r: number, inner: string) => {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r)
    gradient.addColorStop(0, inner)
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  glow(145, 125, 340, 'rgba(187,235,255,.34)')
  glow(1040, 185, 390, 'rgba(225,204,255,.32)')
  glow(860, 1320, 440, 'rgba(198,247,229,.28)')
  glow(130, 1220, 350, 'rgba(255,218,235,.24)')
  glow(620, 780, 360, 'rgba(255,244,197,.10)')
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const out: string[] = []
  let line = ''
  for (const ch of normalizeText(text)) {
    const next = line + ch
    if (line && ctx.measureText(next).width > width) {
      if (/^[,.;:!?%)\]}，。！？、]/.test(ch)) {
        line += ch
        out.push(line.trimEnd())
        line = ''
      } else {
        out.push(line.trimEnd())
        line = ch.trimStart()
      }
    } else line = next
  }
  if (line) out.push(line.trimEnd())
  return out
}

function font(ctx: CanvasRenderingContext2D, size: number, weight = 500) {
  ctx.font = `${weight} ${size}px system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans CJK KR", "Noto Sans KR", sans-serif`
}

function linesHeight(lines: number, lineHeight: number) {
  return Math.max(1, lines) * lineHeight
}

function toneGradient(ctx: CanvasRenderingContext2D, tone: ExportTone, x: number, y: number, width: number, height: number) {
  const colors = COLORS[tone] ?? COLORS.plain
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height)
  gradient.addColorStop(0, colors[0])
  gradient.addColorStop(.55, 'rgba(255,255,255,.52)')
  gradient.addColorStop(1, colors[1])
  return gradient
}

function measureCard(ctx: CanvasRenderingContext2D, card: ExportCard) {
  font(ctx, 35, 760)
  const titleLines = wrap(ctx, card.title, CONTENT_WIDTH - 62).slice(0, 2)
  font(ctx, BODY_SIZE, 480)
  const bodyLines = card.body ? wrap(ctx, card.body, CONTENT_WIDTH - 62).slice(0, card.emphasis ? 5 : 6) : []
  font(ctx, SMALL_SIZE, 650)
  const metaLines = card.meta ? wrap(ctx, card.meta, CONTENT_WIDTH - 62).slice(0, 2) : []
  const eyebrow = card.eyebrow ? 35 : 0
  return 32 + eyebrow + linesHeight(titleLines.length, 47) + (bodyLines.length ? 15 + linesHeight(bodyLines.length, BODY_LINE) : 0) + (metaLines.length ? 13 + linesHeight(metaLines.length, SMALL_LINE) : 0) + 28
}

function drawGlassCard(ctx: CanvasRenderingContext2D, card: ExportCard, y: number) {
  const height = measureCard(ctx, card)
  const x = PAGE_PADDING
  const width = CONTENT_WIDTH

  ctx.save()
  ctx.shadowColor = 'rgba(67,83,119,.10)'
  ctx.shadowBlur = 26
  ctx.shadowOffsetY = 11
  roundRect(ctx, x, y, width, height, 34)
  ctx.fillStyle = toneGradient(ctx, card.tone, x, y, width, height)
  ctx.fill()
  ctx.restore()

  roundRect(ctx, x, y, width, height, 34)
  ctx.strokeStyle = 'rgba(118,137,180,.20)'
  ctx.lineWidth = 2
  ctx.stroke()

  roundRect(ctx, x + 3, y + 3, width - 6, height - 6, 31)
  ctx.strokeStyle = 'rgba(255,255,255,.52)'
  ctx.lineWidth = 2
  ctx.stroke()

  const shine = ctx.createLinearGradient(0, y, 0, y + Math.max(72, height * .42))
  shine.addColorStop(0, 'rgba(255,255,255,.70)')
  shine.addColorStop(1, 'rgba(255,255,255,0)')
  roundRect(ctx, x + 5, y + 5, width - 10, Math.max(72, height * .42), 29)
  ctx.fillStyle = shine
  ctx.fill()

  let cy = y + 33
  if (card.eyebrow) {
    font(ctx, 26, 780)
    ctx.fillStyle = card.tone === 'caution' ? '#aa6878' : card.tone === 'favorable' ? '#458675' : card.tone === 'love' ? '#7965a6' : card.tone === 'date' ? '#557ca8' : '#6f7d96'
    ctx.fillText(card.eyebrow, x + 31, cy)
    cy += 35
  }

  font(ctx, 35, 760)
  ctx.fillStyle = COLORS.ink
  const titleLines = wrap(ctx, card.title, width - 62).slice(0, 2)
  titleLines.forEach((line, index) => ctx.fillText(line, x + 31, cy + index * 47))
  cy += linesHeight(titleLines.length, 47)

  if (card.body) {
    cy += 15
    font(ctx, BODY_SIZE, 480)
    ctx.fillStyle = COLORS.inkSoft
    const bodyLines = wrap(ctx, card.body, width - 62).slice(0, card.emphasis ? 5 : 6)
    bodyLines.forEach((line, index) => ctx.fillText(line, x + 31, cy + index * BODY_LINE))
    cy += linesHeight(bodyLines.length, BODY_LINE)
  }

  if (card.meta) {
    cy += 13
    font(ctx, SMALL_SIZE, 650)
    ctx.fillStyle = COLORS.muted
    const metaLines = wrap(ctx, card.meta, width - 62).slice(0, 2)
    metaLines.forEach((line, index) => ctx.fillText(line, x + 31, cy + index * SMALL_LINE))
  }

  return y + height
}

function drawHeader(ctx: CanvasRenderingContext2D, model: ExportModel, page: number, total: number) {
  font(ctx, 29, 720)
  ctx.fillStyle = '#71809a'
  ctx.fillText('별빛의 운명', PAGE_PADDING, 56)

  font(ctx, 55, 800)
  ctx.fillStyle = COLORS.ink
  const title = normalizeText(model.title.replace(/\s*·\s*\d{4}-\d{2}-\d{2}(?:~\d{4}-\d{2}-\d{2})?$/, ''))
  wrap(ctx, title, CONTENT_WIDTH - 240).slice(0, 2).forEach((line, index) => ctx.fillText(line, PAGE_PADDING, 118 + index * 62))

  if (model.date) {
    font(ctx, 28, 700)
    const width = ctx.measureText(model.date).width + 38
    roundRect(ctx, PAGE_WIDTH - PAGE_PADDING - width, 70, width, 52, 26)
    ctx.fillStyle = 'rgba(255,255,255,.60)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(123,140,180,.15)'
    ctx.stroke()
    ctx.fillStyle = '#677895'
    ctx.fillText(model.date, PAGE_WIDTH - PAGE_PADDING - width + 19, 105)
  }

  font(ctx, 25, 650)
  ctx.fillStyle = '#8a94a8'
  ctx.fillText(`${page}/${total}`, PAGE_WIDTH - PAGE_PADDING - 54, 157)
}

function drawFooter(ctx: CanvasRenderingContext2D) {
  const y = PAGE_HEIGHT - FOOTER_HEIGHT
  ctx.strokeStyle = 'rgba(123,140,180,.12)'
  ctx.beginPath()
  ctx.moveTo(PAGE_PADDING, y)
  ctx.lineTo(PAGE_WIDTH - PAGE_PADDING, y)
  ctx.stroke()
  font(ctx, 23, 550)
  ctx.fillStyle = '#96a0b2'
  ctx.fillText('점수는 사건 확률이 아니라 선택 기간 안의 상대적 활성도야.', PAGE_PADDING, y + 43)
}

function drawSectionTitle(ctx: CanvasRenderingContext2D, title: string, y: number) {
  font(ctx, 30, 800)
  ctx.fillStyle = '#64718b'
  ctx.fillText(title, PAGE_PADDING, y + 29)
  return y + 49
}

function pageCapacity() {
  return PAGE_HEIGHT - FOOTER_HEIGHT - 34
}

function itemHeight(ctx: CanvasRenderingContext2D, item: LayoutItem) {
  return (item.section ? 54 : 0) + measureCard(ctx, item.card) + CARD_GAP
}

function pageUsedHeight(ctx: CanvasRenderingContext2D, page: LayoutItem[]) {
  return page.reduce((sum, item) => sum + itemHeight(ctx, item), 0)
}

function layoutCards(ctx: CanvasRenderingContext2D, model: ExportModel) {
  const groups: LayoutItem[] = []
  if (model.hero) groups.push({ section: '핵심 요약', card: { title: '전체를 통틀어 보면', body: model.hero + (model.subtitle ? ` ${model.subtitle}` : ''), tone: 'love', emphasis: true } })
  for (const section of model.sections) {
    const clean = dedupeCards(section.cards)
    clean.forEach((card, index) => groups.push({ section: index === 0 ? section.title : undefined, card }))
  }

  const pages: LayoutItem[][] = [[]]
  const heights = [HEADER_HEIGHT]
  for (const item of groups) {
    const height = itemHeight(ctx, item)
    let pageIndex = pages.length - 1
    if (heights[pageIndex] + height > pageCapacity() && pages[pageIndex].length) {
      pages.push([])
      heights.push(HEADER_HEIGHT)
      pageIndex++
    }
    pages[pageIndex].push(item)
    heights[pageIndex] += height
  }

  for (let pass = 0; pass < 5; pass++) {
    for (let pageIndex = pages.length - 1; pageIndex > 0; pageIndex--) {
      const current = pages[pageIndex]
      const previous = pages[pageIndex - 1]
      if (!current.length || previous.length < 2) continue
      const currentUsed = pageUsedHeight(ctx, current)
      const available = pageCapacity() - HEADER_HEIGHT
      if (current.length >= 2 && currentUsed >= available * .50) continue
      const candidate = previous[previous.length - 1]
      const candidateHeight = itemHeight(ctx, candidate)
      if (HEADER_HEIGHT + currentUsed + candidateHeight > pageCapacity()) continue
      previous.pop()
      current.unshift(candidate)
    }
  }

  return pages.filter(page => page.length)
}

function pageVisualSpacing(ctx: CanvasRenderingContext2D, items: LayoutItem[]) {
  const available = pageCapacity() - HEADER_HEIGHT
  const used = pageUsedHeight(ctx, items)
  const spare = Math.max(0, available - used)
  const topOffset = spare > 160 ? Math.min(62, Math.round(spare * .14)) : 0
  const extraGap = items.length > 1 && spare > 190 ? Math.min(24, Math.round((spare - topOffset) / (items.length - 1) * .20)) : 0
  return { topOffset, extraGap }
}

function renderPages(model: ExportModel) {
  const probe = createCanvas()
  const layouts = layoutCards(probe.ctx, model)
  const canvases: HTMLCanvasElement[] = []

  layouts.forEach((items, index) => {
    const { canvas, ctx } = createCanvas()
    drawHeader(ctx, model, index + 1, layouts.length)
    const spacing = pageVisualSpacing(ctx, items)
    let y = HEADER_HEIGHT + spacing.topOffset
    items.forEach((item, itemIndex) => {
      if (item.section) y = drawSectionTitle(ctx, item.section, y)
      y = drawGlassCard(ctx, item.card, y) + (itemIndex < items.length - 1 ? CARD_GAP + spacing.extraGap : 0)
    })
    drawFooter(ctx)
    canvases.push(canvas)
  })

  return canvases
}

function safeFileName(value: string) {
  return normalizeText(value).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').slice(0, 72) || '별빛의운명'
}

function localDateStamp() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('이미지를 만들지 못했어.')), 'image/png'))
}

export async function exportReadingImages(root: HTMLElement, label: string): Promise<ExportResult> {
  const model = buildReadingExportModel(root, label)
  if (!model.hero && !model.sections.some(section => section.cards.length)) throw new Error('저장할 결과 내용을 찾지 못했어.')
  const canvases = renderPages(model)
  const blobs = await Promise.all(canvases.map(canvasToBlob))
  const base = safeFileName(label)
  const stamp = localDateStamp()
  const files = blobs.map((blob, index) => new File([blob], `${base}_${stamp}_${index + 1}of${blobs.length}.png`, { type: 'image/png' }))

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files })) {
      await navigator.share({ files, title: label, text: `별빛의 운명 · ${label}` })
      return { pages: files.length, shared: true, cancelled: false }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return { pages: files.length, shared: false, cancelled: true }
  }

  for (const file of files) {
    const href = URL.createObjectURL(file)
    const anchor = document.createElement('a')
    anchor.href = href
    anchor.download = file.name
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(href), 1200)
  }
  return { pages: files.length, shared: false, cancelled: false }
}
