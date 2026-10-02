const ROOT_SELECTOR = '.period-ai-v4'
const TOPIC_SELECTOR = '.period-ai-user-focus .period-ai-topic'

function explanationText(topic: HTMLElement) {
  return Array.from(topic.querySelectorAll<HTMLElement>('.reading-topic-depth .reading-explanation > p'))
    .map(node => node.innerText.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ')
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
