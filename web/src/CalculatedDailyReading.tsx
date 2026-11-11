import { useMemo } from 'react'
import type { IntegratedApiResponse } from './appTypes'
import { DailyReadingDocumentView } from './DailyReadingPanel'
import {datedAspectReading} from './lib/fortuneUserSummary'
import { buildBasicFortuneReading } from './lib/basicFortuneReading'
import { calculatedDailyApplications, type DailyReadingDocument } from './lib/dailyReadingDocument'
import type { FortuneField } from './lib/fortuneFields'

function dailyCalculation(calculation:IntegratedApiResponse, field?:FortuneField):DailyReadingDocument|null {
  const {start,end}=calculation.period
  if (start!==end || calculation.period.day_count!==1 || !calculation.western?.overall) return null
  const basic=buildBasicFortuneReading(calculation,'today',field)
  const rows=[...basic.favorable,...basic.steady,...basic.caution]
  if (!rows.length) return null
  const applications=calculatedDailyApplications(start,field,calculation)
  const blocks=rows.map(row=>({
    id:'calculated:'+row.topic,
    label:row.topic+' · '+row.score+'점',
    text:[row.meaning,row.why,row.practice].filter(Boolean).join(' '),
  }))
  const dated=datedAspectReading(calculation,'day',field?.topics ?? rows.map(row=>row.topic))
  if(dated) blocks.splice(1,0,dated)
  return {...applications,title:'계산값으로 읽는 일간 '+(field?.label??'종합운세'),state:'ready',
    headline:basic.headline,blocks,slots:applications.slots?.filter(slot=>slot.state==='ready')}
}

export function CalculatedDailyReading({calculation,field}:{calculation:IntegratedApiResponse;field?:FortuneField}) {
  const doc=useMemo(()=>dailyCalculation(calculation,field),[calculation,field])
  return doc ? <DailyReadingDocumentView original={doc}/> : null
}
