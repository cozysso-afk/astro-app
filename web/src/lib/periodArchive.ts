import type {AiInterpretationResponse, IntegratedApiResponse, PeriodKey} from '../appTypes'
import {hydrateArchiveItem, listLocalArchive, saveArchive, type ArchiveItem} from './archive'
import {readReadingCache, storedFortuneCalculationId} from './readingCache'

const periodTitles: Record<PeriodKey, string> = {today:'오늘', week:'주간', month:'월간', year:'연간'}

export function savePeriodArchive(calculation: IntegratedApiResponse, request: Record<string,unknown>, period: PeriodKey, interpretation?: AiInterpretationResponse) {
  const {start, end} = calculation.period
  return saveArchive({
    kind:'daily', periodKey:period, title:`${periodTitles[period]}운세 · ${start}`,
    periodStart:start, periodEnd:end, engine:calculation.engine,
    request:{...request, archive_mode:'period_fortune_v16'}, result:calculation as unknown as Record<string,unknown>,
    interpretation:interpretation as unknown as Record<string,unknown> | undefined,
  }, `period:${storedFortuneCalculationId(request)}`)
}

function matches(entry: ArchiveItem, id: string, request: Record<string,unknown>) {
  return entry.kind === 'daily' && entry.request.archive_mode === 'period_fortune_v16'
    && entry.periodStart === request.start_date && entry.periodEnd === request.end_date
    && storedFortuneCalculationId(entry.request) === id
}

export async function resumePeriodArchive(
  request: Record<string,unknown>, archivePeriod: PeriodKey | null | undefined, interpretation: AiInterpretationResponse,
) {
  if (archivePeriod === null || !request.profile) return
  const id = storedFortuneCalculationId(request)
  const entries = listLocalArchive().filter(item => matches(item, id, request))
  const entry = entries.find(item => item.id === `period:${id}`) ?? entries[0]
  // Older jobs did not store their originating screen. Only an exact period archive
  // can establish that such a job belongs in the period archive.
  const period = archivePeriod ?? entry?.periodKey
  if (!period) return
  const cached = await readReadingCache<{request:Record<string,unknown>; result:IntegratedApiResponse}>(id)
  let calc = cached && storedFortuneCalculationId(cached.request) === id ? cached.result : undefined
  if (!calc && entry) {
    const full = await hydrateArchiveItem(entry)
    if (matches(full,id,request)) calc = full.result as unknown as IntegratedApiResponse
  }
  if (calc?.period?.start !== request.start_date || calc?.period?.end !== request.end_date || !calc?.engine) return
  return savePeriodArchive(calc, request, period, interpretation)
}
