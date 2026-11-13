import type { IntegratedApiResponse } from './appTypes'
import type { FortuneField } from './lib/fortuneFields'
import { ContactObservationScope, useContactObservations } from './ContactObservationScope'
import { compareRecordedSignals, contactRecordReading } from './lib/contactOutcomeReading'

type Props = {
  calculation: IntegratedApiResponse
  localRecords: unknown[]
  field?: FortuneField
  westernOnly?: boolean
}

export function ContactOutcomeReading(props: Props) {
  const shared = useContactObservations()
  if (props.westernOnly || !['love','contact','social'].includes(props.field?.id ?? '')) return null
  if (!shared) return <ContactObservationScope {...props}><ContactOutcomeSummary {...props}/></ContactObservationScope>
  return <ContactOutcomeSummary {...props}/>
}
function ContactOutcomeSummary({calculation}:Props) {
  const shared = useContactObservations()
  if (!shared) return null
  const {observations,remote} = shared
  const {start,end} = calculation.period
  const day = start === end
  const rows = day ? observations : observations.filter(row=>row.date >= start)
  const comparison = compareRecordedSignals(rows)
  return <section className="result-card contact-observation-reading" aria-label="연락운과 실제 기록">
    <h3>내가 기록한 연락</h3>
    <p>{contactRecordReading(rows, day ? start : undefined) || (!remote ? '저장된 연락 기록을 확인하고 있어요.' : remote.failed ? '이 기기에는 해당 기간 기록이 없어요. 클라우드 기록을 불러오지 못했어요.' : day ? '선택한 날짜까지 최근 31일 동안 저장한 연락 기록이 없어요.' : '선택한 기간에 저장한 연락 기록이 없어요.')}</p>
    {comparison && <p>{day ? `최근 31일 기록을 비교하면, ` : `선택한 기간을 비교하면, `}{comparison}</p>}
    {rows.length > (day ? 1 : 0) && <details><summary>{day ? '이전 연락 기록' : '날짜별 연락 기록'}</summary>
      <ul>{(day ? rows.slice(1) : rows).map(row=><li key={row.date}><p>{contactRecordReading([row],row.date).replace(/^이날/,row.date)}</p></li>)}</ul></details>}
    {remote?.failed && rows.length > 0 && <small>클라우드 기록을 불러오지 못해 이 기기의 기록만 표시해요.</small>}
  </section>
}
