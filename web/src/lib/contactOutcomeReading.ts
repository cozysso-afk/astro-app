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

// Earlier records could only keep a call and the subsequent meeting in one memo.
// Accept complete affirmative statements; questions, plans and negations stay unknown.
const legacyMeeting = /^(?:(?:저녁에 |오전에 |오후에 |밤에 )?전화가 (?:먼저 )?와서 )?직접 만남(?:\s*\([^()]{1,20}\))?[.!]?$/u

export function meetingRecorded(row: DailyOutcomeRecord) {
  if (!row.event || row.event === 'none') return false
  if (row.channel === 'in_person') return true
  return row.met_in_person ?? legacyMeeting.test((row.note || '').trim())
}

export function nextRelationshipQuestion(rows: DailyOutcomeRecord[]) {
  // No person identifier is stored. Describe one dated observation only.
  const row = rows.find(record=>record.past_connection && record.event && record.event !== 'none')
  if (!row) return null
  if (meetingRecorded(row)) return {
    label:'만난 뒤 관계는 어떻게 이어질까?',
    text:`${row.date}에는 과거 인연과 직접 만났어요. 다음으로 살펴볼 건 헤어진 뒤에도 그 사람과 대화를 이어갔는지, 다시 보기로 했다면 두 사람이 그 약속을 실제로 지켰는지예요.`,
  }
  if (row.event === 'sent') return {
    label:'내가 건넨 말에 답이 돌아왔을까?',
    text:`${row.date}에는 내가 과거 인연에게 먼저 연락했어요. 이 기록만으로는 상대의 답을 알 수 없어요. 답이 왔다면 안부만 주고받았는지, 상대도 질문을 건네 대화가 이어졌는지 돌아봐요.`,
  }
  return {
    label:'연락이 닿은 뒤 무엇이 달라졌을까?',
    text:`${row.date}에는 과거 인연과 연락이 닿았어요. 그날 이후에도 연락을 이어가고 싶은지, 만나자는 이야기가 나왔다면 날짜까지 정했는지가 다음 질문이에요.`,
  }
}

export function recordedSignalReading(row: DailyOutcomeRecord) {
  const signal = row.event === 'sent' ? '발신적합' : '수신신호'
  const score = row.scores?.[signal]
  if (typeof score !== 'number' || !Number.isFinite(score)) return ''
  const label = signal === '발신적합' ? '먼저 연락할 조건' : '연락을 받을 흐름'
  const strong = score >= 60
  const weak = score < 50
  const interpretation = {
    received: weak ? '수신 지표가 낮았는데도 실제로 연락을 받았어요.' : strong ? '수신 지표가 높았던 날에 실제로 연락을 받았어요.' : '수신 지표가 중간이었던 날에 실제로 연락을 받았어요.',
    both: weak ? '수신 지표가 낮았는데도 실제로는 서로 연락을 주고받았어요.' : '실제로 서로 연락을 주고받아, 연락을 받았다는 기록이 있어요.',
    sent: '그날 먼저 말을 건 선택을 기록했어요. 이 점수는 먼저 말 걸기 편한지를 뜻해서, 상대의 답장 여부와는 별개예요.',
    none: strong ? '수신 지표가 높았어도 이날은 실제 연락이 없었어요.' : weak ? '수신 지표가 낮았고 이날은 실제 연락도 없었어요.' : '수신 지표가 중간이었고 이날은 실제 연락이 없었어요.',
    '': '',
  }[row.event]
  const reconnection = row.scores?.['재접점'] ?? row.scores?.['과거인연접점'] ?? row.scores?.['과거인연재접점']
  const past = row.past_connection && row.event && row.event !== 'none'
  const reunion = past && typeof reconnection === 'number' && Number.isFinite(reconnection)
    ? ` 과거 인연과 다시 연락할 지표는 ${reconnection.toFixed(1)}점이었어요. 이날 과거 인연과 관련된 연락이 기록됐어요.` : ''
  return `${row.date}에 저장한 ‘${label}’은 ${score.toFixed(1)}점이에요. ${interpretation}${reunion}`
}

export function contactRecordReading(rows: DailyOutcomeRecord[], day?: string) {
  if (!rows.length) return ''
  if (day) {
    const row = rows[0]
    const when = row.date === day ? '이날' : `최근 기록인 ${row.date}에`
    const eventText = {
      none: '연락을 주고받지 않았어요.',
      received: '연락을 받았어요.',
      sent: '내가 먼저 연락했어요.',
      both: row.note?.trim() ? '서로 연락을 주고받았어요.' : '서로 연락을 주고받았어요. 먼저 연락한 사람은 기록되지 않았어요.',
    } as const
    const note = row.note?.trim()
    const time = { dawn: '새벽', morning: '오전', afternoon: '오후', evening: '저녁', night: '밤', '': '' }[row.event_time_bucket]
    const channel = { message: '문자·메신저', dm: 'DM·SNS', call: '전화', in_person: '직접 만남', other: '', '': '' }[row.channel]
    const context = row.event === 'none' ? '' : [time, channel, row.past_connection && '과거 인연'].filter(Boolean).join(' · ')
    return [`${when} ${row.event ? eventText[row.event] : ''}`,
      context && `기록한 상황은 ‘${context}’예요.`,
      note && `당시 상황은 “${note}”라고 남겼어요.`].filter(Boolean).join(' ')

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
