export const FORTUNE_AI_JOB_CONTRACT = 'fortune-ai-job-period-aware-v11'
export const FORTUNE_AI_JOB_STORAGE_KEY = 'starlight-destiny.ai-job.v2'

export type PendingFortuneAiJob = {
  contract: string
  jobId: string
  periodStart?: string
  periodEnd?: string
  cacheId?: string
  ttlDays?: number
  request?: Record<string, unknown>
}

export function encodePendingFortuneAiJob(job: Omit<PendingFortuneAiJob, 'contract'>): string {
  return JSON.stringify({ ...job, contract: FORTUNE_AI_JOB_CONTRACT })
}

export function decodePendingFortuneAiJob(raw: string): PendingFortuneAiJob | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<PendingFortuneAiJob>
    if (value.contract !== FORTUNE_AI_JOB_CONTRACT) return null
    if (!value.jobId || typeof value.jobId !== 'string') return null
    return {
      contract: FORTUNE_AI_JOB_CONTRACT,
      jobId: value.jobId,
      periodStart: typeof value.periodStart === 'string' ? value.periodStart : undefined,
      periodEnd: typeof value.periodEnd === 'string' ? value.periodEnd : undefined,
      cacheId: typeof value.cacheId === 'string' ? value.cacheId : undefined,
      ttlDays: typeof value.ttlDays === 'number' && Number.isFinite(value.ttlDays) ? value.ttlDays : undefined,
      request: value.request && typeof value.request === 'object' && !Array.isArray(value.request)
        ? value.request as Record<string, unknown>
        : undefined,
    }
  } catch {
    return null
  }
}
