import type { FortuneStat } from '../appTypes'

export function westernPeriodFact(stat: FortuneStat, start: string, end: string) {
  if (start === end) return `${start} 기준 ${stat.average}점`
  const point = (rows: FortuneStat['best_days'], high: boolean) => (rows ?? [])
    .filter(p => p.date >= start && p.date <= end && Number.isFinite(p.score))
    .sort((a,b) => high ? b.score - a.score : a.score - b.score)[0]
  const high = point(stat.best_days, true)
  const low = point(stat.caution_days, false)
  const base = `${start}~${end} 평균 ${stat.average}점`
  if (!high || !low || high.date === low.date || high.score <= low.score) return base
  return `${base} · 높은 날 ${high.date}(${high.score}점), 낮은 날 ${low.date}(${low.score}점)`
}

export function periodFrame(start: string, end: string, days: number, today: string) {
  if (start === end) return start === today ? '오늘' : start
  if (days > 9 && days <= 45 && start.slice(0,7) === end.slice(0,7)) {
    const [year,month] = start.split('-')
    return `${year}년 ${Number(month)}월`
  }
  return `${start}~${end}`
}
