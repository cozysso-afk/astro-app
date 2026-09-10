export type PrecisionMode = 'exact' | 'provisional'

function precisionModeFromProvenance(source: unknown, confidence: unknown, timeKnown: unknown, birthTime: unknown): PrecisionMode | null {
  const available = Boolean(timeKnown && birthTime)
  if (!available) return null
  return confidence === 'exact' && (source === 'official_record' || source === 'rectified') ? 'exact' : 'provisional'
}

export const FORTUNE_AI_JOB_CONTRACT = 'fortune-ai-job-release-v22-integrated-precision-v2'
export const FORTUNE_AI_JOB_STORAGE_KEY = 'starlight-destiny.ai-job.v7'

export type PendingFortuneAiJob = {
  contract: string
  precisionMode: PrecisionMode
  jobId: string
  periodStart?: string
  periodEnd?: string
  cacheId?: string
  ttlDays?: number
  request?: Record<string, unknown>
}

type EncodablePendingJob = Omit<PendingFortuneAiJob, 'contract' | 'precisionMode'> & { precisionMode?: PrecisionMode }

function requestPrecisionMode(request?: Record<string, unknown>): PrecisionMode | null {
  const profile = request?.profile
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return null
  const p = profile as Record<string, unknown>
  return precisionModeFromProvenance(p.time_source, p.time_confidence, p.time_known, p.birth_time)
}

export function encodePendingFortuneAiJob(job: EncodablePendingJob): string {
  const precisionMode = job.precisionMode ?? requestPrecisionMode(job.request)
  if (!precisionMode) return ''
  return JSON.stringify({ ...job, precisionMode, contract: FORTUNE_AI_JOB_CONTRACT })
}

export function decodePendingFortuneAiJob(raw: string): PendingFortuneAiJob | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<PendingFortuneAiJob>
    if (value.contract !== FORTUNE_AI_JOB_CONTRACT) return null
    if (!value.jobId || typeof value.jobId !== 'string') return null
    if (value.precisionMode !== 'exact' && value.precisionMode !== 'provisional') return null
    const request = value.request && typeof value.request === 'object' && !Array.isArray(value.request)
      ? value.request as Record<string, unknown> : undefined
    const derived = requestPrecisionMode(request)
    if (!derived || derived !== value.precisionMode) return null
    return {
      contract: FORTUNE_AI_JOB_CONTRACT,
      precisionMode: value.precisionMode,
      jobId: value.jobId,
      periodStart: typeof value.periodStart === 'string' ? value.periodStart : undefined,
      periodEnd: typeof value.periodEnd === 'string' ? value.periodEnd : undefined,
      cacheId: typeof value.cacheId === 'string' ? value.cacheId : undefined,
      ttlDays: typeof value.ttlDays === 'number' && Number.isFinite(value.ttlDays) ? value.ttlDays : undefined,
      request,
    }
  } catch { return null }
}
