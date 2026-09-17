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

/**
 * A V23 timing-repaired reading may safely expose its generated narrative even
 * when stage 5 (depth/practicality) is the only failed stage. This does not
 * relax backend acceptance or evidence rules; it only prevents the frontend
 * from replacing an already accepted V23 narrative with generic score copy.
 */
export function interpretationHeroEligible(
  validation?: {score?:number; stages?:Array<{stage?:number; passed?:boolean}>} | null,
  usage?: {degraded_quality?:boolean; local_quality_fallback?:boolean; quality_warning?:string|null; cost_guard_version?:string} | null,
): boolean {
  if (interpretationQualityPassed(validation)) return !usage?.degraded_quality
  if (!usage?.degraded_quality || usage?.local_quality_fallback) return false
  if (!String(usage?.cost_guard_version ?? '').startsWith('supabase-ai-v23')) return false
  if (!/직접 근거가 없는 날짜·구간만 로컬에서 제거/.test(String(usage?.quality_warning ?? ''))) return false
  const stages = validation?.stages ?? []
  if (stages.length < 5) return false
  let sawDepthStage = false
  for (const stage of stages) {
    if (stage.stage === 5) { sawDepthStage = true; if (stage.passed !== false) return false; continue }
    if (stage.stage != null && stage.stage >= 1 && stage.stage <= 4 && stage.passed !== true) return false
  }
  return sawDepthStage
}
