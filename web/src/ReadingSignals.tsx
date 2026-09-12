import { ArrowDownLeft, ArrowUpRight, RotateCcw, Link2, Layers3, ShieldAlert, Sparkles } from 'lucide-react'

export type ReadingSignal = 'incoming' | 'outgoing' | 'reconnection' | 'rebuilding' | 'mixed' | 'caution' | 'favorable'
const SIGNALS = {
  incoming: [ArrowDownLeft, '상대 → 나'], outgoing: [ArrowUpRight, '나 → 상대'],
  reconnection: [RotateCcw, '재접점'], rebuilding: [Link2, '유지력'],
  mixed: [Layers3, '혼합'], caution: [ShieldAlert, '주의'], favorable: [Sparkles, '활용'],
} as const

export function ReadingBadge({ kind, label }: { kind: ReadingSignal; label?: string }) {
  const [Icon, title] = SIGNALS[kind]
  return <span className={`reading-badge signal-${kind}`}><Icon size={13} aria-hidden="true"/>{label ?? title}</span>
}

export type DirectionRow = { kind: 'incoming'|'outgoing'|'reconnection'; label: string; band?: string; text?: string; timing?: string }
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
export function ReadingTimeline({ events }: { events: ReadingEvent[] }) {
  const distinct=[...new Map(events.map(e=>[`${e.date}:${e.kind}:${e.label}:${e.status}`,e])).values()]
  const dates=[...new Set(distinct.map(e=>e.date))].sort()
  const group=(date:string)=><li key={date}><time>{date}</time><div className="reading-event-lines">{distinct.filter(e=>e.date===date).map((e,i)=><div className={`reading-event signal-${e.kind}`} key={`${e.kind}-${i}`}>
    <div className="reading-event-heading"><ReadingBadge kind={e.kind}/>{e.status&&<span className={`reading-state ${e.status==='주의'?'is-caution':''}`}>{e.status}</span>}</div>
    <p>{e.label}</p>{e.detail&&<details><summary>이 시기를 읽는 이유</summary><p>{e.detail}</p></details>}
  </div>)}</div></li>
  return <div className="reading-event-list"><ol>{dates.slice(0,2).map(group)}</ol>{dates.length>2&&<details className="reading-more"><summary>시기 {dates.length-2}개 더 보기</summary><ol>{dates.slice(2).map(group)}</ol></details>}</div>
}
