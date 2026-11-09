import type { DailyOutcomeRecord } from '../DailyOutcomeCard'

const events = {
  none: '연락 없음', received: '연락 받음', sent: '내가 먼저 보냄', both: '서로 주고받음',
} as const

export function observedContactRows(values: unknown[], start: string, end: string) {
  const latest = new Map<string, DailyOutcomeRecord>()
  for (const value of values) {
    if (!value || typeof value !== 'object') continue
    const row = value as DailyOutcomeRecord
    if (typeof row.date !== 'string' || row.date < start || row.date > end || !Object.hasOwn(events, row.event)) continue
    const previous = latest.get(row.date)
    if (!previous || (row.saved_at || '') >= (previous.saved_at || '')) latest.set(row.date, {
      ...row, note: typeof row.note === 'string' ? row.note : '', past_connection: row.past_connection === true,
    })
  }
  return [...latest.values()].sort((a,b) => b.date.localeCompare(a.date))
}

export function contactRecordReading(rows: DailyOutcomeRecord[], day?: string) {
  if (!rows.length) return ''
  if (day) {
    const row = rows[0]
    const when = row.date === day ? '이날' : `최근 기록인 ${row.date}에`
    const eventText = {
      none: '연락을 주고받지 않았어요.',
      received: '연락을 받았어요. 누가 대화를 시작했는지는 이 기록만으로 알 수 없어요.',
      sent: '내가 먼저 연락했어요. 답장이 왔는지는 별도 기록이 필요해요.',
      both: '서로 연락을 주고받았어요. 먼저 연락한 사람은 기록되지 않았어요.',
    } as const
    return `${when} ${row.event ? eventText[row.event] : ''}${row.past_connection && row.event !== 'none' ? ' 과거 인연과의 연락으로 표시한 날이에요.' : ''}`
  }
  const counts = Object.entries(events).map(([event,label]) =>
    [label, rows.filter(row => row.event === event).length] as const)
  const summary = counts.filter(([,count])=>count).map(([label,count])=>`${label} ${count}일`).join(', ')
  const past = rows.filter(row=>row.past_connection && row.event !== 'none').length
  return `이 기간에 기록한 ${rows.length}일은 ${summary}이에요.${past ? ` 이 중 과거 인연과 연락한 날은 ${past}일이에요.` : ''} 기록하지 않은 날은 집계에서 제외했어요.`
}

export function compareRecordedSignals(rows: DailyOutcomeRecord[]) {
  const usable = rows.filter(row => Number.isFinite(row.scores?.['수신신호']))
  const received = usable.filter(row => row.event === 'received' || row.event === 'both')
  const none = usable.filter(row => row.event === 'none')
  if (!received.length || !none.length) return ''
  const mean = (group: DailyOutcomeRecord[]) => group.reduce((sum,row)=>sum+Number(row.scores['수신신호']),0)/group.length
  const a = mean(received), b = mean(none)
  const comparison = Math.round(a*10) === Math.round(b*10) ? '두 평균이 같았어요.' :
    a > b ? '기록상 연락을 받은 날의 수신 점수가 더 높았어요.' : '이 기록에서는 연락이 없던 날의 수신 점수가 더 높았어요.'
  return `연락을 받은 ${received.length}일의 수신 평균은 ${a.toFixed(1)}점, 연락이 없던 ${none.length}일은 ${b.toFixed(1)}점이에요. ${comparison}`
}
