const ROOT_SELECTOR = '.period-ai-v4'
const TOPIC_SELECTOR = '.period-ai-user-focus .period-ai-topic'

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
  element.style.width = '1px'
  element.style.height = '1px'
  element.style.overflow = 'hidden'
  element.style.clipPath = 'inset(50%)'
  element.style.whiteSpace = 'nowrap'
  element.style.opacity = '0'
  element.style.pointerEvents = 'none'
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

function exposePrimaryTopicDepth(root: ParentNode) {
  for (const reading of Array.from(root.querySelectorAll<HTMLElement>(ROOT_SELECTOR))) {
    const topics = Array.from(reading.querySelectorAll<HTMLElement>(TOPIC_SELECTOR))
    topics.forEach((topic, index) => {
      const details = topic.querySelector<HTMLDetailsElement>('details.reading-topic-depth')
      if (index < 2 && details && !details.dataset.depthV5Initialized) {
        details.open = true
        details.dataset.depthV5Initialized = 'true'
      }
      if (index < 3) ensureExportDepth(topic)
    })
  }
}

export function installReadingPresentationV5() {
  if (typeof document === 'undefined') return
  const apply = () => exposePrimaryTopicDepth(document)
  apply()
  const observer = new MutationObserver(() => apply())
  observer.observe(document.documentElement, { childList: true, subtree: true })
}
