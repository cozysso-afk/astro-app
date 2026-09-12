import type { AiTopicInterpretation } from '../appTypes'

export type AiTopicEntry = [topic: string, interpretation: AiTopicInterpretation]

function isTopicInterpretation(value: unknown): value is AiTopicInterpretation {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function normalizeTopicEntries(topicAnalysis: unknown, allowedTopics: readonly string[]): AiTopicEntry[] {
  const knownTopics = new Set(allowedTopics)
  const candidates: Array<[string, unknown]> = Array.isArray(topicAnalysis)
    ? topicAnalysis.map((row) => {
      const value = isTopicInterpretation(row) ? row as AiTopicInterpretation & { topic?: unknown } : null
      return [typeof value?.topic === 'string' ? value.topic.trim() : '', row]
    })
    : topicAnalysis && typeof topicAnalysis === 'object'
      ? Object.entries(topicAnalysis as Record<string, unknown>)
      : []

  const seen = new Set<string>()
  const entries: AiTopicEntry[] = []
  for (const [topic, interpretation] of candidates) {
    if (!knownTopics.has(topic) || seen.has(topic) || !isTopicInterpretation(interpretation)) continue
    seen.add(topic)
    entries.push([topic, interpretation])
  }
  return entries
}

/** A total score must never override an explicitly failed stage. */
export function interpretationQualityPassed(validation?: {score?:number; stages?:Array<{passed?:boolean}>} | null): boolean {
  if (!validation || validation.stages?.some(stage => stage.passed !== true)) return false
  return validation.score === 100 || Boolean(validation.stages?.length && validation.stages.every(stage => stage.passed === true))
}
