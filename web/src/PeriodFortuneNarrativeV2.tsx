import type {ReactNode} from 'react'
import type {AiInterpretationResponse,IntegratedApiResponse,PeriodKey} from './appTypes'
import type {FortuneField} from './lib/fortuneFields'
import type {LoveStatus} from './lib/loveReadingContext'
import {DailyReadingPanel} from './DailyReadingPanel'
import {AuthoredReadingPanel} from './AuthoredReadingPanel'
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
  onRetry?: () => void
}) {
  if (!result.ok || !result.data) return null
  if (westernOnly) return null

  const data = result.data
  const verifiedNarrative = result.provenance_verified === true
    && fortuneNarrativeOrigin(result.model, result.origin) === 'gemini'
    && !result.usage?.local_quality_fallback
    && interpretationHeroEligible(result.usage?.quality_validation, result.usage)

  if (period === 'today' && !westernOnly) return <DailyReadingPanel data={data} date={calculation.period.start} field={field} verified={verifiedNarrative} technicalDetails={technicalDetails} onRetry={onRetry}/>
  const document=buildPeriodReadingDocument(data,period,calculation.period.start,calculation.period.end,field,verifiedNarrative,result.interpreter_version)
  return <AuthoredReadingPanel doc={document} technicalDetails={technicalDetails}/>
}
