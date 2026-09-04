import type { AiInterpretationResponse } from '../appTypes'

type InterpretationData = NonNullable<AiInterpretationResponse['data']>

function normalize(text?: string) {
  return String(text ?? '').replace(/\s+/g, ' ').trim()
}

function metricDense(text: string) {
  const metricHits = text.match(/평균|변동폭|최고(?:값)?|최저(?:값)?|최댓값|최솟값|점수|상승폭|하락폭/g)?.length ?? 0
  const numberHits = text.match(/[+-]?\d+(?:\.\d+)?\s*(?:점|%|회|개)?/g)?.length ?? 0
  return metricHits >= 2 || (metricHits >= 1 && numberHits >= 2) || numberHits >= 4
}

function sentences(text?: string) {
  const clean = normalize(text)
  if (!clean) return []
  return clean.split(/(?<=[.!?])\s+|[\n;]+/).map(normalize).filter(Boolean)
}

function compact(text: string, max = 180) {
  const clean = normalize(text)
  if (clean.length <= max) return clean
  const clipped = clean.slice(0, max - 1)
  const lastSpace = clipped.lastIndexOf(' ')
  return `${(lastSpace > max * 0.65 ? clipped.slice(0, lastSpace) : clipped).trim()}…`
}

function firstNarrative(text?: string) {
  const parts = sentences(text)
  return parts.find((part) => !metricDense(part)) ?? ''
}

export function buildInterpretationBrief(data: InterpretationData) {
  const flowSource = firstNarrative(data.overall.dominant_pattern)
    || firstNarrative(data.overall.summary)
    || normalize(data.headline)

  const priority = (data.priorities ?? []).map(normalize).find((item) => item && !metricDense(item))
  const decision = normalize(data.decisions?.[0]?.action)
  const windowLabel = normalize(data.key_windows?.[0]?.label)
  const rememberSource = priority || decision || windowLabel

  return {
    flow: compact(flowSource, 190),
    remember: rememberSource && rememberSource !== flowSource ? compact(rememberSource, 150) : '',
  }
}
