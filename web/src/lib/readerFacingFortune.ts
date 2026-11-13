import type { AiInterpretationResponse } from '../appTypes'

type FortuneData = NonNullable<AiInterpretationResponse['data']>

// Older reports sometimes include a source identifier in an otherwise complete
// sentence. Keep the source arrays for provenance and strip only the inline citations.
const sourceId = String.raw`\b[WST]:[\p{L}\p{N}_-]+(?::[\p{L}\p{N}_-]+)*`
const inlineCitations = new RegExp(`${sourceId}(?:[ \t]*[,;·/][ \t]*${sourceId})*`, 'gu')
function cleanCitation(value: string) {
  if (!/\b[WST]:/.test(value)) return value
  return value.replace(inlineCitations, '').replace(/[ \t]*(?:\(\s*\)|\[\s*\])/g, '')
    .replace(/ +([.,!?])/g, '$1').replace(/ {2,}/g, ' ').trim()
}

function project(value: unknown): unknown {
  if (typeof value === 'string') return cleanCitation(value)
  if (Array.isArray(value)) return value.map(project)
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, key === 'evidence_refs' ? entry : project(entry)])
  )
  return value
}

export function readerFacingFortune(data: FortuneData): FortuneData {
  return project(data) as FortuneData
}
