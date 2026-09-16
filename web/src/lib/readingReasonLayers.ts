export type ReadingReasonLayers = {
  visible: string
  technical?: string
}

/**
 * Keep the first two complete sentences in the reader-facing explanation and
 * move any remaining detail behind a secondary disclosure. The source text is
 * preserved verbatim apart from whitespace normalization; this helper never
 * creates new astrological meaning.
 */
export function splitReadingReason(value: string): ReadingReasonLayers {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return { visible: '' }

  const sentences = (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text])
    .map((sentence) => sentence.trim())
    .filter(Boolean)

  if (sentences.length <= 2) return { visible: text }

  const visible = sentences.slice(0, 2).join(' ')
  const technical = sentences.slice(2).join(' ')
  return technical ? { visible, technical } : { visible: text }
}
