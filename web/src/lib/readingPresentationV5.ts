const ROOT_SELECTOR = '.period-ai-v4'
const TOPIC_SELECTOR = '.period-ai-user-focus .period-ai-topic'

function exposePrimaryTopicDepth(root: ParentNode) {
  for (const reading of Array.from(root.querySelectorAll<HTMLElement>(ROOT_SELECTOR))) {
    const topics = Array.from(reading.querySelectorAll<HTMLElement>(TOPIC_SELECTOR))
    topics.slice(0, 2).forEach(topic => {
      const details = topic.querySelector<HTMLDetailsElement>('details.reading-topic-depth')
      if (details && !details.dataset.depthV5Initialized) {
        details.open = true
        details.dataset.depthV5Initialized = 'true'
      }
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
