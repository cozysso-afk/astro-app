import { readerFacingFortune } from './lib/readerFacingFortune'
import type {ReactNode} from 'react'
import type {AiInterpretationResponse,IntegratedApiResponse,PeriodKey} from './appTypes'
import type {FortuneField} from './lib/fortuneFields'
import type {LoveStatus} from './lib/loveReadingContext'
import {FortuneCalculationData} from './FortuneCalculationData'
import {DailyReadingPanel} from './DailyReadingPanel'
import {AuthoredReadingPanel} from './AuthoredReadingPanel'
import {buildPeriodReadingDocument} from './lib/authoredReadingDocument'
import {fortuneNarrativeOrigin} from './lib/fortuneNarrativeOrigin'
import {interpretationHeroEligible} from './lib/interpretationTopics'

export function verifiedFortuneNarrative(result:AiInterpretationResponse|null|undefined) {
  return Boolean(result?.ok && result.data && result.provenance_verified === true
    && fortuneNarrativeOrigin(result.model, result.origin) === 'gemini'
    && !result.usage?.local_quality_fallback
    && interpretationHeroEligible(result.usage?.quality_validation, result.usage))
}

export function PeriodFortuneNarrativeV2({
  loveStatus: _loveStatus,
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
  onRetry?: (refreshIncomplete?:boolean) => void
}) {
  if (westernOnly) return null
  const verifiedNarrative = verifiedFortuneNarrative(result)
  if (!verifiedNarrative || !result.data) return null
  const data = readerFacingFortune(result.data)
  const details = <><FortuneCalculationData calculation={calculation} topics={field?.topics} period={period}/>{technicalDetails}</>
  if (period === 'today') return <DailyReadingPanel calculation={calculation} data={data} date={calculation.period.start} field={field} verified={verifiedNarrative} technicalDetails={details} onRetry={onRetry ? () => onRetry(true) : undefined}/>
  const document = buildPeriodReadingDocument(data,period,calculation.period.start,calculation.period.end,field,verifiedNarrative,result.interpreter_version)
  const incomplete = document.state !== 'ready' || document.sections.some(section => section.state === 'missing')
  const retry = onRetry && incomplete ? () => onRetry(true) : undefined
  return <AuthoredReadingPanel doc={document} technicalDetails={details} period={period} onRefresh={retry}/>
}
