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

function nodeText(topic: HTMLElement, selector: string) {
  return normalizedClause(topic.querySelector<HTMLElement>(selector)?.textContent ?? '')
}

function explanationText(topic: HTMLElement) {
  const technical = nodeText(topic, '.reading-topic-depth .reading-reason-more > p')
  const reason = nodeText(topic, '.reading-topic-depth .reading-explanation.is-reason > p')
  const timing = nodeText(topic, '.reading-topic-depth .reading-explanation.is-timing > p')
  const caution = nodeText(topic, '.reading-topic-depth .reading-explanation.is-caution > p')
  const primaryReason = technical || reason
  const parts = [
    primaryReason ? `근거 · ${primaryReason}` : '',
    timing ? `시기 · ${timing}` : '',
    caution ? `주의 · ${caution}` : '',
  ].filter(Boolean)
  return parts.length ? `${parts.join(' · ')}.` : ''
}

function ensureExportDepth(topic: HTMLElement) {
  if (topic.dataset.exportDepthV5Initialized) return
  const depth = explanationText(topic)
  if (!depth) return
  const paragraph = document.createElement('p')
  paragraph.className = 'reading-export-depth-v5'
  paragraph.setAttribute('aria-hidden', 'true')
  paragraph.textContent = depth
  const firstDirectParagraph = Array.from(topic.children).find(child => child.tagName === 'P')
  topic.insertBefore(paragraph, firstDirectParagraph ?? topic.querySelector('details.reading-topic-depth'))
  topic.dataset.exportDepthV5Initialized = 'true'
}

function exposePrimaryTopicDepth(root: ParentNode) {
  for (const reading of Array.from(root.querySelectorAll<HTMLElement>(ROOT_SELECTOR))) {
    const topics = Array.from(reading.querySelectorAll<HTMLElement>(TOPIC_SELECTOR))
    topics.slice(0, 2).forEach(topic => {
      const details = topic.querySelector<HTMLDetailsElement>('details.reading-topic-depth')
      if (details && !details.dataset.depthV5Initialized) {
        details.open = true
        details.dataset.depthV5Initialized = 'true'
      }
      ensureExportDepth(topic)
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
