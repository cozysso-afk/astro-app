import type {ReactNode} from 'react'
import type {AiInterpretationResponse,IntegratedApiResponse,PeriodKey} from './appTypes'
import type {FortuneField} from './lib/fortuneFields'
import type {LoveStatus} from './lib/loveReadingContext'
import {DailyReadingPanel} from './DailyReadingPanel'
import {AuthoredReadingPanel} from './AuthoredReadingPanel'
import {weeklyPeriodSupplements} from './lib/weeklyPeriodSupplement'
import {monthlyReadingCore} from './lib/monthlyReadingCore'
import {weeklyReadingCore} from './lib/weeklyReadingCore'
import {monthlyPeriodSupplements} from './lib/monthlyLoveSupplement'
import {buildPeriodReadingDocument} from './lib/authoredReadingDocument'
import {fortuneNarrativeOrigin} from './lib/fortuneNarrativeOrigin'
import {interpretationHeroEligible} from './lib/interpretationTopics'

export function PeriodFortuneNarrativeV2({
  loveStatus: _loveStatus,
  systemOverview,
  westernOnly = false,
  field,
  period,
  calculation,
  result,
  technicalDetails,
  onRetry,
}: {
  loveStatus?: LoveStatus
  systemOverview?: ReactNode
  systemSummary?: string
  westernOnly?: boolean
  field?: FortuneField
  period: PeriodKey
  calculation: IntegratedApiResponse
  result: AiInterpretationResponse
  technicalDetails?: ReactNode
  onRetry?: (refreshMonthlyGaps?:boolean) => void
}) {
  if (!result.ok || !result.data) return null
  if (westernOnly) return null

  const data = result.data
  const verifiedNarrative = result.provenance_verified === true
    && fortuneNarrativeOrigin(result.model, result.origin) === 'gemini'
    && !result.usage?.local_quality_fallback
    && interpretationHeroEligible(result.usage?.quality_validation, result.usage)

  if (period === 'today' && !westernOnly) return <DailyReadingPanel calculation={calculation} data={data} date={calculation.period.start} field={field} verified={verifiedNarrative} technicalDetails={technicalDetails} onRetry={onRetry}/>
  const saved=buildPeriodReadingDocument(data,period,calculation.period.start,calculation.period.end,field,verifiedNarrative,result.interpreter_version)
  const weekly = period==='week' && verifiedNarrative
  const document = weekly ? weeklyReadingCore(saved,data,calculation,field)
    : period==='month' && verifiedNarrative ? monthlyReadingCore(saved,calculation,field) : saved
  const monthlyLove = period==='month' && field?.id==='love' && verifiedNarrative
  const supplements = weekly ? weeklyPeriodSupplements(document,calculation) : period==='month' && verifiedNarrative ? monthlyPeriodSupplements(document,calculation) : []
  const retry = onRetry && (weekly || (monthlyLove && document.sections.some(section=>section.state==='missing')))
    ? () => onRetry(true) : undefined
  return <AuthoredReadingPanel doc={document} technicalDetails={technicalDetails} supplements={supplements} period={period} onRefresh={retry}/>
}
