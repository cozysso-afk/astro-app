import { useEffect, useState } from 'react'
import type { IntegratedApiResponse } from './appTypes'
import type { FortuneField } from './lib/fortuneFields'
import { listLocalArchive, readCloudContactOutcomes } from './lib/archive'
import { browserLocalDateIso } from './lib/readingDateSemantics'
import { nextRelationshipQuestion, compareRecordedSignals, contactRecordReading, recordedSignalReading, observedContactRows } from './lib/contactOutcomeReading'

type Props = {
  calculation: IntegratedApiResponse
  localRecords: unknown[]
  field?: FortuneField
  westernOnly?: boolean
}

export function ContactOutcomeReading({ calculation, localRecords, field, westernOnly }: Props) {
  const visible = !westernOnly && ['love', 'contact', 'social'].includes(field?.id ?? '')
  const {start,end} = calculation.period
  const today = browserLocalDateIso()
  const through = end < today ? end : today
  const day = start === end
  const hasRelationshipContext = field?.id === 'love' || field?.id === 'contact'
  const from = day || hasRelationshipContext ? new Date(Date.parse(start + 'T00:00:00Z') - 30 * 86400000).toISOString().slice(0,10) : start
  const [cloud,setCloud] = useState<{from:string;end:string;values:unknown[];failed:boolean} | null>(null)
  useEffect(()=>{
    if (!visible) return
    let active = true
    setCloud(null)
    if (from > through) {
      setCloud({from,end:through,values:[],failed:false})
      return
    }
    readCloudContactOutcomes(from,through).then(values=>{
      if (active) setCloud({from,end:through,values,failed:false})
    }).catch(()=>{
      if (active) setCloud({from,end:through,values:[],failed:true})
    })
    return ()=>{active = false}
  },[from,through,visible,localRecords])
  if (!visible) return null
  const remote = cloud?.from === from && cloud.end === through ? cloud : null
  const archived = listLocalArchive().filter(row=>row.kind === 'outcome').map(row=>row.result)
  const observations = observedContactRows([...archived,...(remote?.values ?? []),...localRecords],from,through)
  const rows = day ? observations : observations.filter(row=>row.date >= start)
  const signals = calculation.western.relationship_signals ?? {}
  const incoming = signals['수신신호']?.band
  const outgoing = signals['발신적합']?.band
  const latest = rows[0]
  const next = hasRelationshipContext ? nextRelationshipQuestion(observations) : null
  const comparison = compareRecordedSignals(rows)
  return <section className="result-card contact-observation-reading" aria-label="연락운과 실제 기록">
    <h3>연락운과 실제 기록</h3>
    <p><strong>{day ? start : `${start} ~ ${end}`} 연락운</strong><br/>{incoming ? `연락을 받을 흐름은 ‘${incoming}’으로 계산됐어요.` : '연락을 받을 흐름은 계산 자료가 부족해요.'} {outgoing ? `내가 먼저 말을 걸 조건은 ‘${outgoing}’으로 계산됐어요.` : '내가 먼저 말을 걸 조건은 계산 자료가 부족해요.'}</p>
    <p>{contactRecordReading(rows, day ? start : undefined) || (!remote ? '저장된 연락 기록을 확인하고 있어요.' : remote.failed ? '이 기기에는 해당 기간 기록이 없어요. 클라우드 기록을 불러오지 못했어요.' : day ? '선택한 날짜까지 최근 31일 동안 저장한 연락 기록이 없어요.' : '선택한 기간에 저장한 연락 기록이 없어요.')}</p>
    {day && latest && recordedSignalReading(latest) && <p>{recordedSignalReading(latest)}</p>}
    {next && <section className="contact-next-question"><h4>{next.label}</h4><p>{next.text}</p></section>}
    {comparison && <p>{day ? `최근 31일 기록을 비교하면, ` : `선택한 기간을 비교하면, `}{comparison}</p>}
    {rows.length > (day ? 1 : 0) && <details><summary>{day ? '이전 연락 기록' : '날짜별 연락 기록'}</summary>
      <ul>{(day ? rows.slice(1) : rows).map(row=><li key={row.date}>
        <p>{contactRecordReading([row],row.date).replace(/^이날/,row.date)}</p>
        {recordedSignalReading(row) && <p>{recordedSignalReading(row)}</p>}
      </li>)}</ul></details>}
    {remote?.failed && rows.length > 0 && <small>클라우드 기록을 불러오지 못해 이 기기의 기록만 표시해요.</small>}
  </section>
}
