import type { ReaderManuscriptV4 } from './readingModelV4'

const META_LANGUAGE_RE = /(?:candidate_count|evidence_refs|threshold|\bTOP\b|계산\s*(?:엔진|스키마|로직|축)|사건\s*확률)/i
const EMPTY_VERDICT_RE = /^(?:별도로\s*확인|단정할\s*수\s*없|실제\s*상황을\s*보|흐름을\s*확인|가능성을\s*열어\s*두)/

export function narrativeFingerprint(value: unknown) {
  return String(value ?? '')
    .replace(/[\s.,!?·~→:;()\[\]"'\-]+/g, '')
    .replace(/(?:오늘|선택한운세일|이번주|이번달|올해)/g, '')
    .trim()
}

function tokens(value: string) {
  return new Set(value.replace(/[^0-9a-z가-힣]+/gi, ' ').split(' ').filter(token => token.length >= 2))
}

export function narrativeOverlap(a: string, b: string) {
  const left = tokens(a)
  const right = tokens(b)
  if (!left.size || !right.size) return 0
  const shared = [...left].filter(token => right.has(token)).length
  return shared / Math.min(left.size, right.size)
}

export function validateReaderManuscriptV4(manuscript: ReaderManuscriptV4) {
  const issues: string[] = []
  const visible = [
    manuscript.verdict.title,
    manuscript.verdict.answer,
    ...manuscript.reasons.map(row => row.text),
    manuscript.limitingFactor?.text ?? '',
    manuscript.nextCheckpoint.text,
    ...manuscript.risesWhen,
    ...manuscript.fallsWhen,
  ].filter(Boolean)

  if (!manuscript.verdict.title.trim() || !manuscript.verdict.answer.trim()) issues.push('missing_verdict')
  if (EMPTY_VERDICT_RE.test(manuscript.verdict.answer.trim())) issues.push('non_answer_verdict')
  if (!manuscript.nextCheckpoint.text.trim()) issues.push('missing_next_checkpoint')
  if (manuscript.reasons.length > 3) issues.push('too_many_reasons')
  if (visible.some(text => META_LANGUAGE_RE.test(text))) issues.push('technical_language_leak')

  for (let left = 0; left < visible.length; left += 1) {
    for (let right = left + 1; right < visible.length; right += 1) {
      const a = narrativeFingerprint(visible[left])
      const b = narrativeFingerprint(visible[right])
      if (!a || !b) continue
      if (a === b || (Math.min(a.length, b.length) >= 18 && (a.includes(b) || b.includes(a))) || narrativeOverlap(visible[left], visible[right]) >= 0.78) {
        issues.push(`duplicate_claim:${left}:${right}`)
      }
    }
  }
  return [...new Set(issues)]
}

