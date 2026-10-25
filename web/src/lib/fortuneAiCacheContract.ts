export const FORTUNE_PROVISIONAL_SYNTHESIS_CONTRACT = 'gemini-provisional-planet-only-v3'

export function fortuneProvisionalSynthesisSignature(mode: string): Record<string, string> {
  return mode === 'provisional'
    ? { provisional_synthesis_contract: FORTUNE_PROVISIONAL_SYNTHESIS_CONTRACT }
    : {}
}
