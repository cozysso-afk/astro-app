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
      <div><span className="basic-fortune-kicker">기본 해설 · 추가 AI 호출 없음</span><h3>{reading.headline}</h3><p>{reading.summary}</p></div>
    </div>
    {rows.length > 0 && <div className="basic-fortune-grid">
      {rows.slice(0,4).map((row)=><article className={`basic-fortune-row is-${row.tone}`} key={row.topic}>
        <div><strong>{row.topic}</strong><span>{row.band} · {row.score.toFixed(0)}</span></div>
        <p>{row.meaning}</p>
        {row.date && calculation.period.day_count > 1 ? <small><Sparkles size={12}/>{row.tone === 'good' ? '눈여겨볼 날짜' : '조심해서 볼 날짜'} · {row.date}</small> : null}
      </article>)}
    </div>}
  </section>
}
