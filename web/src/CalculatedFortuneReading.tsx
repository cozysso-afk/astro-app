import type {IntegratedApiResponse,PeriodKey} from './appTypes'
import {AuthoredReadingPanel} from './AuthoredReadingPanel'
import {CalculatedDailyReading} from './CalculatedDailyReading'
import {calculatedPeriodQuestions} from './lib/authoredReadingDocument'
import type {FortuneField} from './lib/fortuneFields'
import {monthlyPeriodSupplements} from './lib/monthlyLoveSupplement'
import {monthlyReadingCore} from './lib/monthlyReadingCore'
import {weeklyPeriodSupplements} from './lib/weeklyPeriodSupplement'
import {calculatedWeeklyQuestions} from './lib/weeklyQuestionEvidence'
import {weeklyReadingCore} from './lib/weeklyReadingCore'

export function CalculatedFortuneReading({period,calculation,field}:{period:PeriodKey;calculation:IntegratedApiResponse;field?:FortuneField}) {
  if(period==='today') return <CalculatedDailyReading calculation={calculation} field={field}/>
  if(period!=='week' && period!=='month') return null
  const {start,end}=calculation.period
  const questions=calculatedPeriodQuestions(period,start,end,field)
  const weekly=period==='week'
  if(weekly) questions.sections.push(...calculatedWeeklyQuestions(field))
  const doc=weekly ? weeklyReadingCore(questions,undefined,calculation,field) : monthlyReadingCore(questions,calculation,field)
  const supplements=weekly ? weeklyPeriodSupplements(doc,calculation) : monthlyPeriodSupplements(doc,calculation)
  // Bring the selected field's answer into the body even if there is no usable date comparison.
  const lead=field ? supplements.find(row=>row.id===doc.sections[0]?.id) : undefined
  const core=lead ? [
    ...doc.core.filter(block=>block.id!=='month:segments:'+field?.topics[0]),
    {id:lead.id+':calculation',label:lead.label,text:lead.text},
  ] : doc.core
  return <AuthoredReadingPanel doc={{...doc,core,exportBlockIds:core.map(block=>block.id)}} period={period} supplements={supplements.filter(row=>row!==lead)}/>
}
