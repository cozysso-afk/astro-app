import { ArrowDownLeft, ArrowUpRight, RotateCcw, Link2, Layers3, ShieldAlert, Sparkles } from 'lucide-react'
import { orderTimelineDates, timelineWindowState, timelinePresentation, type TimelineContext } from './lib/timelineTime'

export type ReadingSignal = 'incoming' | 'outgoing' | 'reconnection' | 'rebuilding' | 'mixed' | 'caution' | 'favorable'
const SIGNALS = {
  incoming: [ArrowDownLeft, '외부 연락 반응'], outgoing: [ArrowUpRight, '내 연락 실행'],
  reconnection: [RotateCcw, '재접점'], rebuilding: [Link2, '유지력'],
  mixed: [Layers3, '혼합'], caution: [ShieldAlert, '주의'], favorable: [Sparkles, '활용'],
} as const


export function ReadingBadge({ kind, label }: { kind: ReadingSignal; label?: string }) {
  const [Icon, title] = SIGNALS[kind]
  return <span className={`reading-badge signal-${kind}`}><Icon size={13} aria-hidden="true"/>{label ?? title}</span>
}

export type DirectionRow = { kind: 'incoming'|'outgoing'|'reconnection'; label: string; score?: number; band?: string; text?: string; timing?: string }
export function ReadingDirections({ rows }: { rows: DirectionRow[] }) {
  return <div className="reading-direction-panel">{rows.map(row=>{
    const text=row.text ?? '이 방향을 판단할 계산 정보가 없어.'
    const split=text.indexOf('. '), first=split<0?text:text.slice(0,split+1), rest=split<0?'':text.slice(split+2)
    return <article className={`reading-direction signal-${row.kind}`} key={row.kind}>
      <div className="reading-direction-heading"><ReadingBadge kind={row.kind} label={row.label}/><span className="reading-state">{row.band ?? '정보 부족'}</span></div>
      <p>{first}</p>{row.timing&&<time>주목 날짜 · {row.timing}</time>}
      {rest&&<details className="reading-direction-more"><summary>현실에서 구분할 것</summary><p>{rest}</p></details>}
    </article>
  })}</div>
}

export type ReadingEvent = { date: string; kind: ReadingSignal; label: string; status?: string; detail?: string }
export function ReadingTimeline({ events, context = {} }: { events: ReadingEvent[]; context?: TimelineContext }) {
  const distinct=[...new Map(events.map(e=>[`${e.date}:${e.kind}:${e.label}:${e.status}`,e])).values()]
  const now=context.now ?? new Date()
  const dates=orderTimelineDates([...new Set(distinct.map(e=>e.date))],now)
  const group=(date:string)=><li key={date}><time>{timelineWindowState(date,{...context,now}) === 'past' ? `지난 · ${date}` : date}</time><div className="reading-event-lines">{distinct.filter(e=>e.date===date).map((e,i)=>{
    const temporal=timelinePresentation(e.date,e.kind,{...context,now})
    const badgeLabel=temporal.label
    return <div className={`reading-event signal-${e.kind}`} key={`${e.kind}-${i}`}>
      <div className="reading-event-heading"><ReadingBadge kind={e.kind} label={badgeLabel}/>{temporal.state !== 'past' && e.status && e.status!==badgeLabel&&<span className={`reading-state ${/확인 필요|주의/.test(e.status)?'is-caution':''}`}>{e.status}</span>}</div>
      {temporal.state === 'past' ? <><p>{e.label}</p><small className="reading-event-past-note">이미 지난 구간이야. 당시 실제 경험과 비교하는 참고 정보로만 봐.</small>{e.detail&&<details><summary>{temporal.detailLabel}</summary><p>{e.detail}</p></details>}</> : <><p>{e.label}</p>{e.detail&&<details><summary>{temporal.detailLabel}</summary><p>{e.detail}</p></details>}</>}
    </div>
  })}</div></li>
  return <div className="reading-event-list"><ol>{dates.slice(0,2).map(group)}</ol>{dates.length>2&&<details className="reading-more"><summary>시기 {dates.length-2}개 더 보기</summary><ol>{dates.slice(2).map(group)}</ol></details>}</div>
}
