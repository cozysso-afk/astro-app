import { CheckCircle2, Sparkles } from 'lucide-react'
import type { IntegratedApiResponse, PeriodKey } from './appTypes'
import type { FortuneField } from './lib/fortuneFields'
import { buildBasicFortuneReading } from './lib/basicFortuneReading'

export function BasicFortuneReading({ calculation, period, field }: { calculation: IntegratedApiResponse; period: PeriodKey; field?: FortuneField }) {
  const reading = buildBasicFortuneReading(calculation, period, field)
  const rows = [...reading.favorable, ...reading.steady, ...reading.caution]
  return <section className="basic-fortune-reading">
    <div className="basic-fortune-head">
      <span className="basic-fortune-orb"><CheckCircle2 size={18}/></span>
      <div><span className="basic-fortune-kicker">앱 기본 해설</span><h3>{reading.headline}</h3><p>{reading.summary}</p></div>
    </div>
    {rows.length > 0 && <div className="basic-fortune-grid">
      {rows.slice(0,4).map((row)=><article className={`basic-fortune-row is-${row.tone}`} key={row.topic}>
        <div className="basic-fortune-row-head"><strong>{row.topic}</strong><span>{row.band} · {row.score.toFixed(0)}</span></div>
        <p className="basic-fortune-conclusion">{row.meaning} {row.nuance}</p>
        <div className="basic-fortune-block is-reason"><span>왜 이렇게 보냐면</span><p>{row.why}</p></div>
        <div className="basic-fortune-block is-practice"><span>현실에서는</span><p>{row.practice}</p></div>
        <div className="basic-fortune-block is-caution"><span>주의할 점</span><p>{row.caution}</p></div>
        {row.timing ? <small className="basic-fortune-timing"><Sparkles size={12}/>시기 · {row.timing}</small> : null}
      </article>)}
    </div>}
  </section>
}
