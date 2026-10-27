export type FortuneNarrativeOrigin = 'gemini' | 'deterministic_safe'

export function isDeterministicFortuneModel(model?: string) {
  return /^deterministic-provisional-v\d+(?:\.|$)/i.test(String(model ?? ''))
}

export function fortuneNarrativeOrigin(model?: string, declared?: FortuneNarrativeOrigin): FortuneNarrativeOrigin {
  if (declared === 'gemini' || declared === 'deterministic_safe') return declared
  // Unknown/empty model identities are not proof of Gemini authorship.
  // Older deterministic jobs may lack an explicit origin field.
  return /^gemini-[\w.-]+$/i.test(String(model ?? '')) && !isDeterministicFortuneModel(model)
    ? 'gemini'
    : 'deterministic_safe'
}
