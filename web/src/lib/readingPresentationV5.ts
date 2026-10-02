const ROOT_SELECTOR = '.period-ai-v4'
const TOPIC_SELECTOR = '.period-ai-user-focus .period-ai-topic:not(.reading-export-system-v7)'

function normalizedClause(value: unknown) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?]+(?=\s|$)/g, ' ·')
    .replace(/(?:\s*·\s*)+/g, ' · ')
    .replace(/\s*·\s*$/, '')
    .trim()
}

function naturalClause(value: unknown) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\s*(?:근거|시기|주의)\s*[·:]\s*/i, '')
    .replace(/^실제로는\s*/, '')
    .replace(/^확인할 것\s*/, '')
    .replace(/움직임가\b/g, '움직임이')
    .replace(/\s*·\s*/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .trim()
}

function asSentence(value: unknown) {
  const text = naturalClause(value)
  if (!text) return ''
  return /[.!?]$/.test(text) ? text : `${text}.`
}

function firstSentence(value: unknown) {
  const text = naturalClause(value)
  if (!text) return ''
  const match = text.match(/^.*?[.!?](?=\s|$)/)
  return (match?.[0] ?? text).trim()
}

function nodeText(topic: HTMLElement, selector: string) {
  return normalizedClause(topic.querySelector<HTMLElement>(selector)?.textContent ?? '')
}

function explanationText(topic: HTMLElement) {
  const technical = nodeText(topic, '.reading-topic-depth .reading-reason-more > p')
  const reason = nodeText(topic, '.reading-topic-depth .reading-explanation.is-reason > p')
  const timing = nodeText(topic, '.reading-topic-depth .reading-explanation.is-timing > p')
  const caution = nodeText(topic, '.reading-topic-depth .reading-explanation.is-caution > p')
  const primaryReason = technical || reason
  return [primaryReason, timing, caution]
    .map(asSentence)
    .filter(Boolean)
    .join(' ')
    .trim()
}

function applyExportOnlyStyle(element: HTMLElement) {
  element.style.position = 'absolute'
  element.style.left = '-10000px'
  element.style.top = '0'
  element.style.width = '640px'
  element.style.height = 'auto'
  element.style.opacity = '0'
  element.style.pointerEvents = 'none'
}

function ensureExportHeroCompact(reading: HTMLElement) {
  if (reading.dataset.exportHeroV7Initialized) return
  const visibleSubtitle = reading.querySelector<HTMLElement>('.period-ai-head .reading-hero-subtitle:not(.reading-export-subtitle-v7)')
  if (!visibleSubtitle?.parentElement) return
  const bridge = document.createElement('p')
  bridge.className = 'reading-hero-subtitle reading-export-subtitle-v7'
  bridge.setAttribute('aria-hidden', 'true')
  bridge.textContent = ''
  applyExportOnlyStyle(bridge)
  visibleSubtitle.parentElement.insertBefore(bridge, visibleSubtitle)
  reading.dataset.exportHeroV7Initialized = 'true'
}

function ensureExportConclusion(topic: HTMLElement) {
  if (topic.dataset.exportConclusionV7Initialized) return
  const visibleConclusion = Array.from(topic.children)
    .find((child): child is HTMLElement => child instanceof HTMLElement && child.tagName === 'B' && !child.classList.contains('reading-export-conclusion-v7'))
  const compact = firstSentence(visibleConclusion?.textContent ?? '')
  if (!visibleConclusion || !compact) return
  const bridge = document.createElement('b')
  bridge.className = 'reading-export-conclusion-v7'
  bridge.setAttribute('aria-hidden', 'true')
  bridge.textContent = compact
  applyExportOnlyStyle(bridge)
  topic.insertBefore(bridge, visibleConclusion)
  topic.dataset.exportConclusionV7Initialized = 'true'
}

function ensureExportDepth(topic: HTMLElement) {
  if (topic.dataset.exportDepthV5Initialized) return
  const depth = explanationText(topic)
  if (!depth) return
  const paragraph = document.createElement('p')
  paragraph.className = 'reading-export-depth-v5'
  paragraph.setAttribute('aria-hidden', 'true')
  paragraph.textContent = depth
  applyExportOnlyStyle(paragraph)
  const firstDirectParagraph = Array.from(topic.children).find(child => child.tagName === 'P')
  topic.insertBefore(paragraph, firstDirectParagraph ?? topic.querySelector('details.reading-topic-depth'))
  ensureExportConclusion(topic)
  topic.dataset.exportDepthV5Initialized = 'true'
}

function systemSummarySentence(article: HTMLElement) {
  const label = naturalClause(article.querySelector<HTMLElement>(':scope > strong')?.textContent ?? '')
  const copy = firstSentence(article.querySelector<HTMLElement>(':scope > p')?.textContent ?? '')
  if (!label || !copy) return ''
  return `${label}: ${copy}`
}

function ensureExportSystemSummary(reading: HTMLElement) {
  if (reading.dataset.exportSystemV7Initialized) return
  const list = reading.querySelector<HTMLElement>('.period-ai-user-focus .period-ai-topic-list')
  if (!list) return
  const body = Array.from(reading.querySelectorAll<HTMLElement>('.system-overview-grid > article'))
    .slice(0, 3)
    .map(systemSummarySentence)
    .filter(Boolean)
    .join(' ')
  if (!body) return
  const article = document.createElement('article')
  article.className = 'period-ai-topic reading-export-system-v7'
  article.setAttribute('data-reading-export-tone', 'system')
  article.setAttribute('aria-hidden', 'true')
  const title = document.createElement('strong')
  title.textContent = '세 체계 한눈에'
  const detail = document.createElement('b')
  detail.textContent = body
  article.append(title, detail)
  applyExportOnlyStyle(article)
  list.appendChild(article)
  reading.dataset.exportSystemV7Initialized = 'true'
}

function exposePrimaryTopicDepth(root: ParentNode) {
  for (const reading of Array.from(root.querySelectorAll<HTMLElement>(ROOT_SELECTOR))) {
    ensureExportHeroCompact(reading)
    const topics = Array.from(reading.querySelectorAll<HTMLElement>(TOPIC_SELECTOR))
    topics.forEach((topic, index) => {
      const details = topic.querySelector<HTMLDetailsElement>('details.reading-topic-depth')
      if (index < 2 && details && !details.dataset.depthV5Initialized) {
        details.open = true
        details.dataset.depthV5Initialized = 'true'
      }
      if (index < 3) ensureExportDepth(topic)
    })
    ensureExportSystemSummary(reading)
  }
}

export function installReadingPresentationV5() {
  if (typeof document === 'undefined') return
  const apply = () => exposePrimaryTopicDepth(document)
  apply()
  const observer = new MutationObserver(() => apply())
  observer.observe(document.documentElement, { childList: true, subtree: true })
}
