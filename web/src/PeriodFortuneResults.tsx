import type { LoveStatus } from './lib/loveReadingContext'
import { useObservedPromptContext } from './ContactObservationScope'
import { ExternalPromptCopy } from './ExternalPromptCopy'
import { fortuneField, type FortuneField } from './lib/fortuneFields'
import { SystemReadingViews } from './SystemReadingViews'
import type { ExternalCopyMode } from './lib/compactDeepPrompt'
import { CheckCircle2 } from 'lucide-react'
import type { AiInterpretationResponse, IntegratedApiResponse, PeriodKey } from './appTypes'
import { ContactOutcomeReading } from './ContactOutcomeReading'
import { DailyOutcomeCard, type DailyOutcomeRecord, type OutcomeCalibration } from './DailyOutcomeCard'
import { PeriodAiInterpretationPanel } from './PeriodAiInterpretationPanel'
import { PeriodFortuneNarrativeV2, verifiedFortuneNarrative } from './PeriodFortuneNarrativeV2'
import './reading-image-export.css'

type ActiveDayun = NonNullable<IntegratedApiResponse['saju']['dayun']>[number]

type PeriodFortuneResultsProps = {
  initialSystem?: 'integrated'|'western'|'saju'|'thai'
  loveStatus?: LoveStatus
  onLoveStatusChange?: (value: LoveStatus) => void
  fieldId?: string
  period: PeriodKey
  periodLabel?: string
  result: IntegratedApiResponse
  aiInterpretation: AiInterpretationResponse | null
  aiLoading: boolean
  aiError: string
  aiCacheSource: 'local' | 'server' | 'fresh' | ''
  activeDayun: ActiveDayun | null
  outcomeRecords?: DailyOutcomeRecord[]
  outcomeDraft: DailyOutcomeRecord
  outcomeSaved: boolean
  outcomeCalibration: OutcomeCalibration
  onRetryAi: (refreshIncomplete?:boolean) => void
  onCopyAiPrompt: (mode?: ExternalCopyMode, field?: FortuneField, observed?:string) => void
  onCancelAi: () => void
  aiCanCancel: boolean
  onOutcomeChange: (draft: DailyOutcomeRecord) => void
  onSaveOutcome: () => void
}

function SavedReadingPromptCopy({onCopy,field,westernOnly}: {onCopy: PeriodFortuneResultsProps['onCopyAiPrompt'];field?: FortuneField;westernOnly?: boolean}) {
  const observed = useObservedPromptContext()
  if (westernOnly) return null
  return <div data-reading-export-ignore="true"><ExternalPromptCopy onCopy={mode=>onCopy(mode,field,observed)}/></div>
}

export function PeriodFortuneResults({
  initialSystem='integrated',
  loveStatus = 'single',
  fieldId,
  period,
  periodLabel,
  result,
  aiInterpretation,
  aiLoading,
  aiError,
  aiCacheSource,
  activeDayun,
  outcomeRecords,
  outcomeDraft,
  outcomeSaved,
  outcomeCalibration,
  onRetryAi,
  onCopyAiPrompt,
  onCancelAi,
  aiCanCancel,
  onOutcomeChange,
  onSaveOutcome,
}: PeriodFortuneResultsProps) {
  const field = fortuneField(fieldId)
  const technicalDetails = <>

    <section className="result-card">
      <div className="result-card-title"><span>SYSTEMS</span><strong>체계별 보조 흐름</strong></div>
      <div className="saju-summary">
        {result.saju.ok && result.saju.day_master && <span>사주 일간 <b>{result.saju.day_master}</b></span>}
        {activeDayun && <span>현재 대운 <b>{activeDayun.ganzhi}</b> · {activeDayun.start_year}~{activeDayun.end_year}</span>}
        <span>Thai(태국점성술) <b>{result.thai.thai_day}</b> · {result.thai.ruler}</span>
      </div>
    </section>
  </>

  // Do not promote a provisional/unchecked result into a Gemini-authored reading.
  const hasNaturalReading = verifiedFortuneNarrative(aiInterpretation)
  return <div data-reading-export-root="period-fortune" className={`fortune-experience period-${period}`}>
    <div className="result-headline" data-reading-export-tone="date"><CheckCircle2 size={16}/><div><strong>{periodLabel} 운세</strong><span>{result.period.start}{result.period.start !== result.period.end ? ` — ${result.period.end}` : ''}</span></div></div>
    {hasNaturalReading && aiLoading && <p className="result-note" role="status">기존 해설을 보면서 새 Gemini 해설을 기다릴 수 있어.</p>}
    {hasNaturalReading && aiError && <p className="result-note" role="alert">{aiError}</p>}
    <SystemReadingViews outcomeRecords={outcomeRecords} initialSystem={initialSystem} periodKey={period} loveStatus={field?.id==='love'?loveStatus:undefined} key={`${fieldId}-${initialSystem}`} calculation={result} interpretation={aiInterpretation} onGenerate={()=>onRetryAi(hasNaturalReading)} generating={aiLoading} generationError={aiError} field={field}><>
      {hasNaturalReading && aiInterpretation ? <PeriodFortuneNarrativeV2 loveStatus={loveStatus} field={field} period={period} calculation={result} result={aiInterpretation} technicalDetails={technicalDetails} onRetry={aiLoading?undefined:onRetryAi}/> : <PeriodAiInterpretationPanel loveStatus={loveStatus} field={field} period={period} calculation={result} result={aiInterpretation} loading={aiLoading} error={aiError} cacheSource={aiCacheSource} onRetry={onRetryAi} onCopyPrompt={onCopyAiPrompt} onCancel={onCancelAi} canCancel={aiCanCancel} technicalDetails={technicalDetails}/>}
      {hasNaturalReading && <SavedReadingPromptCopy onCopy={onCopyAiPrompt}/>}
      {outcomeRecords && <ContactOutcomeReading calculation={result} localRecords={outcomeRecords}/>}
    </></SystemReadingViews>
    <p className="reading-safety-note">점수는 차트에서 계산한 0~100의 비교 지표야.</p>
    {period==='today' && <div className="reading-outcome"><DailyOutcomeCard
      draft={outcomeDraft}
      saved={outcomeSaved}
      calibration={outcomeCalibration}
      onChange={onOutcomeChange}
      onSave={onSaveOutcome}
    /></div>}
  </div>
}
