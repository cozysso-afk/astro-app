export type FortuneNarrativeOrigin = 'gemini' | 'deterministic_safe'

export function isDeterministicFortuneModel(model?: string) {
  return /^deterministic-provisional-v\d+(?:\.|$)/i.test(String(model ?? ''))
}

export function fortuneNarrativeOrigin(model?: string, declared?: FortuneNarrativeOrigin): FortuneNarrativeOrigin {
  if (declared === 'gemini' || declared === 'deterministic_safe') return declared
  // Missing provenance is fail-closed. A Gemini-looking model name is not proof
  // that a successful provider call produced the stored reader-facing result.
  return 'deterministic_safe'
}
