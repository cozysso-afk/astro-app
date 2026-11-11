import type { IntegratedApiResponse } from './appTypes'
import type { FortuneField } from './lib/fortuneFields'
import { ContactObservationScope, useContactObservations } from './ContactObservationScope'
import { nextRelationshipQuestion, compareRecordedSignals, contactRecordReading, recordedSignalReading } from './lib/contactOutcomeReading'

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
function ContactOutcomeSummary({calculation,field}:Props) {
  const shared = useContactObservations()
  if (!shared) return null
  const {observations,remote} = shared
  const {start,end} = calculation.period
  const day = start === end
  const hasRelationshipContext = field?.id === 'love' || field?.id === 'contact'
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
