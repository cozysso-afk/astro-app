/* Gemini usage/cost estimate shared by result panels. */

const GEMINI_USD_KRW_ESTIMATE = 1384
const GEMINI_JOB_SAFE_CAP_KRW = 300
const GEMINI_INTRO_END = new Date('2026-12-31T23:59:59Z')

export type GeminiCostPreviewKind = 'today' | 'week' | 'month' | 'year' | 'relationship'

const INTRO_COST_PREVIEW_KRW: Record<GeminiCostPreviewKind, { first: number; retry: number }> = {
  today: { first: 40, retry: 75 },
  week: { first: 40, retry: 80 },
  month: { first: 55, retry: 90 },
  year: { first: 70, retry: 120 },
  relationship: { first: 125, retry: 230 },
}

export function geminiCostPreview(kind: GeminiCostPreviewKind) {
  const factor = new Date() <= GEMINI_INTRO_END ? 1 : 2
  const base = INTRO_COST_PREVIEW_KRW[kind]
  const first = Math.min(GEMINI_JOB_SAFE_CAP_KRW, Math.round(base.first * factor))
  const retry = Math.min(GEMINI_JOB_SAFE_CAP_KRW, Math.round(base.retry * factor))
  return {
    first,
    retry,
    cap: GEMINI_JOB_SAFE_CAP_KRW,
    label: `예상 비용 · 1회 생성 약 ${first.toLocaleString()}원 안팎 · 재시도 시 약 ${retry.toLocaleString()}원 안팎 · 작업 안전상한 ${GEMINI_JOB_SAFE_CAP_KRW.toLocaleString()}원`,
  }
}

export function estimateGeminiUsage<T extends { prompt_tokens?: number; candidate_tokens?: number; thought_tokens?: number; total_tokens?: number; estimated_usd?: number; estimated_krw?: number }>(usage?: T) {
  if (!usage) return null
  const prompt = Number(usage.prompt_tokens ?? 0)
  const candidate = Number(usage.candidate_tokens ?? 0)
  const thought = Number(usage.thought_tokens ?? 0)
  const intro = new Date() <= GEMINI_INTRO_END
  const calculatedUsd = (prompt / 1_000_000) * (intro ? .75 : 1.5) + ((candidate + thought) / 1_000_000) * (intro ? 3.75 : 7.5)
  const usd = Number.isFinite(Number(usage.estimated_usd)) ? Number(usage.estimated_usd) : calculatedUsd
  const krw = Number.isFinite(Number(usage.estimated_krw)) ? Number(usage.estimated_krw) : usd * GEMINI_USD_KRW_ESTIMATE
  return { ...usage, estimated_usd: usd, estimated_krw: krw }
}
