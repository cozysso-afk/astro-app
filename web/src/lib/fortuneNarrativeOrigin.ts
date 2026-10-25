export type FortuneNarrativeOrigin = 'gemini' | 'deterministic_safe'

export function isDeterministicFortuneModel(model?: string) {
  return /^deterministic-provisional-v\d+(?:\.|$)/i.test(String(model ?? ''))
}

export function fortuneNarrativeOrigin(model?: string, declared?: FortuneNarrativeOrigin): FortuneNarrativeOrigin {
  if (declared === 'gemini' || declared === 'deterministic_safe') return declared
  return isDeterministicFortuneModel(model) ? 'deterministic_safe' : 'gemini'
}
