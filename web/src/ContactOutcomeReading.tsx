import { useEffect, useState } from 'react'
import type { IntegratedApiResponse } from './appTypes'
import type { FortuneField } from './lib/fortuneFields'
import { listLocalArchive, readCloudContactOutcomes } from './lib/archive'
import { compareRecordedSignals, contactRecordReading, observedContactRows } from './lib/contactOutcomeReading'

type Props = {
  calculation: IntegratedApiResponse
  localRecords: unknown[]
  field?: FortuneField
  westernOnly?: boolean
}

export function ContactOutcomeReading({ calculation, localRecords, field, westernOnly }: Props) {
  const visible = !westernOnly && ['love', 'contact', 'social'].includes(field?.id ?? '')
  const {start,end} = calculation.period
  const day = start === end
  const from = day ? new Date(Date.parse(start + 'T00:00:00Z') - 30 * 86400000).toISOString().slice(0,10) : start
  const [cloud,setCloud] = useState<{from:string;end:string;values:unknown[];failed:boolean} | null>(null)
  useEffect(()=>{
    if (!visible) return
    let active = true
    setCloud(null)
    readCloudContactOutcomes(from,end).then(values=>{
      if (active) setCloud({from,end,values,failed:false})
    }).catch(()=>{
      if (active) setCloud({from,end,values:[],failed:true})
    })
    return ()=>{active = false}
  },[from,end,visible,localRecords])
  if (!visible) return null
  const remote = cloud?.from === from && cloud.end === end ? cloud : null
  const archived = listLocalArchive().filter(row=>row.kind === 'outcome').map(row=>row.result)
  const rows = observedContactRows([...archived,...(remote?.values ?? []),...localRecords],from,end)
  const signals = calculation.western.relationship_signals ?? {}
  const incoming = signals['수신신호']?.band
  const outgoing = signals['발신적합']?.band
  const latest = rows[0]
  const comparison = compareRecordedSignals(rows)
  return <section className="result-card contact-observation-reading" aria-label="연락운과 실제 기록">
    <h3>연락운과 실제 기록</h3>
    <p>{incoming ? `연락을 받을 흐름은 ‘${incoming}’으로 계산됐어요.` : '연락을 받을 흐름은 계산 자료가 부족해요.'} {outgoing ? `내가 먼저 말을 걸 조건은 ‘${outgoing}’으로 계산됐어요.` : '내가 먼저 말을 걸 조건은 계산 자료가 부족해요.'}</p>
    <p>{contactRecordReading(rows, day ? start : undefined) || (!remote ? '저장된 연락 기록을 확인하고 있어요.' : remote.failed ? '이 기기에는 해당 기간 기록이 없어요. 클라우드 기록을 불러오지 못했어요.' : day ? '선택한 날짜까지 최근 31일 동안 저장한 연락 기록이 없어요.' : '선택한 기간에 저장한 연락 기록이 없어요.')}</p>
    {day && latest && <div>{latest.note && <p>그날의 메모 · {latest.note}</p>}
      {latest.date === start && latest.event === 'none' && incoming && <p>계산에서 수신 흐름이 보였더라도 이날 실제 연락으로 이어지지는 않았어요.</p>}
    </div>}
    {comparison && <p>{day ? `최근 31일 기록을 비교하면, ` : `선택한 기간을 비교하면, `}{comparison}</p>}
    {!day && rows.length > 0 && <details><summary>날짜별 연락 기록</summary><ul>{rows.map(row=><li key={row.date}>{contactRecordReading([row],row.date).replace(/^이날/,row.date)}{row.note && ` · ${row.note}`}</li>)}</ul></details>}
    {remote?.failed && rows.length > 0 && <small>클라우드 기록을 불러오지 못해 이 기기의 기록만 표시해요.</small>}
  </section>
}
