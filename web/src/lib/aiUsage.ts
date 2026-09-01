/* Gemini usage/cost estimate shared by result panels. */

const GEMINI_USD_KRW_ESTIMATE = 1384
export function estimateGeminiUsage<T extends { prompt_tokens?: number; candidate_tokens?: number; thought_tokens?: number; total_tokens?: number; estimated_usd?: number; estimated_krw?: number }>(usage?: T) {
  if (!usage) return null
  const prompt = Number(usage.prompt_tokens ?? 0)
  const candidate = Number(usage.candidate_tokens ?? 0)
  const thought = Number(usage.thought_tokens ?? 0)
  const intro = new Date() <= new Date('2026-12-31T23:59:59Z')
  const calculatedUsd = (prompt / 1_000_000) * (intro ? .75 : 1.5) + ((candidate + thought) / 1_000_000) * (intro ? 3.75 : 7.5)
  const usd = Number.isFinite(Number(usage.estimated_usd)) ? Number(usage.estimated_usd) : calculatedUsd
  const krw = Number.isFinite(Number(usage.estimated_krw)) ? Number(usage.estimated_krw) : usd * GEMINI_USD_KRW_ESTIMATE
  return { ...usage, estimated_usd: usd, estimated_krw: krw }
}
