export const FORTUNE_PROVISIONAL_SYNTHESIS_CONTRACT = 'deterministic-provisional-single-day-evidence-v2'

export function fortuneProvisionalSynthesisSignature(mode: string): Record<string, string> {
  return mode === 'provisional'
    ? { provisional_synthesis_contract: FORTUNE_PROVISIONAL_SYNTHESIS_CONTRACT }
    : {}
}
