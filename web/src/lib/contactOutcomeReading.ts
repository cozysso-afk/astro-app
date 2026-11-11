import type { AuthoredReadingDocument } from './authoredReadingDocument'
import { browserLocalDateIso } from './readingDateSemantics.ts'
import { weeklyTimingValues } from './weeklyQuestionEvidence.ts'
import { monthlyTopicPhases } from './monthlyReadingCore.ts'
import type { IntegratedApiResponse } from '../appTypes'
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

const contactFollowUps = {
  meeting: {
    today: '만난 뒤 건네고 싶은 말이 있다면 그날 나눈 이야기 하나를 이어 보세요. 답장이 온다면 인사로 끝나는지, 상대도 궁금한 것을 물으며 대화를 이어가는지 살펴보세요.',
    week: '이번 주에는 만난 뒤 대화를 누가 다시 꺼내는지 살펴보세요. 다음 만남 얘기가 나오면 상대도 가능한 날짜를 제안하는지, 시간이 안 맞을 때 다른 날을 잡는지가 단서예요.',
    month: '이달에는 만남 직후 며칠과 그 뒤의 연락을 나눠 보세요. 반갑다고 한 말이 다음 약속으로 이어졌는지, 한쪽이 먼저 나서지 않아도 두 사람 모두 관계를 이어가려 했는지 돌아볼 수 있어요.',
  },
  sent: {
    today: '먼저 말을 건 단계까지 확인됐어요. 답이 왔다면 내 질문에 답하는 데서 끝났는지, 상대도 새 질문을 덧붙였는지 살펴보세요.',
    week: '이번 주에는 내가 보낸 말에 답이 있었는지부터 살펴보세요. 한 번 답을 주고받은 뒤 다른 날에도 상대가 대화를 다시 꺼냈다면, 대화를 이어가는 방식이 달라진 거예요.',
    month: '이달에는 먼저 연락한 날과 실제로 답을 주고받은 날을 나눠 보세요. 내가 매번 대화를 시작했는지, 시간이 지나며 상대도 먼저 안부를 물었는지에 따라 다음 선택이 달라져요.',
  },
  contacted: {
    today: '이미 닿은 연락에서 어떤 이야기가 오갔는지 살펴보세요. 만나자는 말이 있었다면 가능한 날을 물어보는 게 오늘 확인할 수 있는 다음 단계예요.',
    week: '이번 주에는 안부를 주고받은 뒤 대화가 다른 날에도 이어지는지 살펴보세요. 만나자는 이야기가 나왔다면 두 사람이 시간을 실제로 맞췄는지까지 구분해 보세요.',
    month: '이달에는 다시 연락이 닿은 시점과 만남 약속이 구체화된 시점을 나눠 보세요. 대화는 이어졌지만 날짜를 잡지 못했다면 연락이 이어진 데까지가 지금 확인된 변화예요.',
  },
} as const

// These records identify an event on one date, not a person across dates.
export function weeklyRecordedQuestions(doc:AuthoredReadingDocument, rows:DailyOutcomeRecord[], calculation:IntegratedApiResponse) {
  const {start,end,day_count}=calculation.period
  if (doc.state==='unverified' || day_count!==7 || Date.parse(end)-Date.parse(start)!==6*86400000 ||
      doc.date!==`${start} → ${end}` || !rows.length) return doc
  const today=browserLocalDateIso()
  const from=new Date(Date.parse(start)-30*86400000).toISOString().slice(0,10)
  const eligible=observedContactRows(rows,from,end<today?end:today)
  const past=eligible.find(row=>row.past_connection && row.event!=='none')
  const sections=doc.sections.map(section=>{
    if (section.state!=='insufficient') return section
    let answer=''
    if (section.id==='question:재회:stage_progression' && past) {
      const followUp=meetingRecorded(past)
        ? '다시 얼굴을 본 단계까지 확인돼요. 관계를 다시 시작하기로 했는지는 그날 두 사람이 어떤 이야기를 나눴는지에 달려 있어요.'
        : past.event==='sent' ? '먼저 안부를 건넨 단계예요. 상대가 답했는지는 이 기록에 없어요. 답이 왔다면 안부에서 끝났는지 다음 약속 이야기도 나왔는지 살펴보세요.'
        : '연락이 다시 닿은 단계까지 확인돼요. 만나자는 말이 있었다면 두 사람이 날짜를 잡고 실제로 만났는지가 그다음 단계예요.'
      const fact=observedRelationshipPassage([past],calculation,'week','love')?.fact
      if (fact) answer=(past.date<start?'이번 주가 시작되기 전인 ':'')+fact+' '+followUp
    } else if (section.id==='question:연락:continuity') {
      const exchange=eligible.find(row=>
        row.event==='both' || (row.event==='received' && meetingRecorded(row) &&
          (row.channel==='call' || (legacyMeeting.test(row.note?.trim() || '') && /전화가 (?:먼저 )?와서/.test(row.note)))))
      if (exchange) {
        const onDate=exchange.event==='both' ? '서로 연락을 주고받았어요.' : '상대에게서 전화가 왔고 그날 직접 만났어요.'
        answer=`${exchange.date<start?'이번 주가 시작되기 전인 ':''}${exchange.date}에는 ${onDate} 이날의 연락이 다른 날까지 이어졌는지는 이 한 건으로 알기 어려워요. 같은 사람과 이어간 대화가 있다면 누가 다시 말을 꺼냈고 어떤 이야기를 이어갔는지가 단서예요.`
      }
    }
    if (!answer) return section
    return {...section,state:'ready' as const,label:section.label+' · 기록으로 본 부분',blocks:[{id:section.id+':record',label:'날짜가 확인된 기록',text:answer}]}
  })
  return {...doc,sections}
}

export function observedRelationshipPassage(rows: DailyOutcomeRecord[], calculation: IntegratedApiResponse, period: string, scope: string) {
  if (period !== 'today' && period !== 'week' && period !== 'month') return null
  if (scope !== 'love' && scope !== 'contact') return null
  const row = rows.find(item => item.event && item.event !== 'none' && (scope === 'contact' || item.past_connection))
  if (!row) return null
  const met = meetingRecorded(row)
  const who = row.past_connection ? '과거 인연' : '상대'
  const memo = (row.note || '').trim()
  const legacyIncomingCall = legacyMeeting.test(memo) && /전화가 (?:먼저 )?와서/.test(memo)
  const receivedCall = row.event === 'received' && (row.channel === 'call' || (row.channel === 'in_person' && legacyIncomingCall))
  const callerConfirmed = receivedCall && legacyIncomingCall && /전화가 먼저 와서/.test(memo)
  const fact = met ? receivedCall
    ? `${row.date}에는 ${who}에게서${callerConfirmed ? ' 먼저' : ''} 전화가 왔고, 두 사람은 직접 만났어요.`
    : `${row.date}에는 ${who}와 직접 만났어요.`
    : row.event === 'sent' ? `${row.date}에는 내가 ${who}에게 먼저 연락했어요.`
    : row.event === 'both' ? `${row.date}에는 ${who}와 서로 연락을 주고받았어요.`
    : `${row.date}에는 ${who}에게서 ${receivedCall ? '전화가 왔어요' : '연락을 받았어요'}.`
  const stage = met ? 'meeting' : row.event === 'sent' ? 'sent' : 'contacted'
  const monthly = period === 'month' ? monthlyTopicPhases(calculation,'연락') : undefined
  const weekly = period === 'week' ? weeklyTimingValues('연락',calculation) : ''
  const timing = weekly ? `이번 주 연락 지표는 ${weekly}이에요.`
    : monthly ? `${monthly.sample} 연락 지표의 평균은 ${monthly.scores}이에요.` : ''
  const followUp = [contactFollowUps[stage][period],timing].filter(Boolean).join(' ')
  const signals=calculation.western.relationship_signals
  const stat=scope==='love' ? (period==='today' ? signals?.['과거인연접점'] ?? signals?.['과거인연재접점'] ?? calculation.western.overall?.['재회'] : calculation.western.overall?.['재회']) : undefined
  const frame = period==='today' ? '이날' : period==='week' ? '이번 주' : '이달'
  const indicator = stat?.band && Number.isFinite(stat.average) ? `${frame} ${period==='today' && (signals?.['과거인연접점'] || signals?.['과거인연재접점']) ? '과거 인연 접점' : '재회'} 지표는 ${stat.average}점(${stat.band})이에요. 이 점수로 상대의 다음 행동을 알 수는 없어요.` : ''
  const question = met ? '만남 뒤, 다음 약속도 함께 잡을까?' : row.event==='sent' ? '내가 먼저 건넨 말에 답이 이어질까?' : '다시 닿은 연락이 만남으로 이어질까?'
  return {fact,followUp,question,indicator}
}

type ObservedPassage = NonNullable<ReturnType<typeof observedRelationshipPassage>>
export function observedContactCore(passage: ObservedPassage, headline: string, blocks: Array<{id:string;label:string;text:string}>) {
  return [
    {id:'record:contact-follow-up',label:passage.question,text:passage.followUp},
    ...(headline ? [{id:'source:contact-headline',label:'이 기간에 계산한 연락운',text:headline}] : []),
    ...blocks,
  ]
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
