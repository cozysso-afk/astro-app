import type { FortuneStat } from '../appTypes'

// Display existing scores and bands; never derive a new activation threshold.
export function westernRankCopy(rows: Array<[string, FortuneStat]>, when: string) {
  const valid = rows.filter(([name, stat]) => name !== '투자주의' && typeof stat?.average === 'number' && Number.isFinite(stat.average))
  if (!valid.length) return `${when} 비교할 수 있는 서양점성술 분야 점수가 없어.`
  const sorted = [...valid].sort((a, b) => b[1].average - a[1].average)
  const top = sorted.filter(([, stat]) => stat.average === sorted[0][1].average)
  const visibleTop = top.slice(0, 2)
  const names = visibleTop.map(([name]) => name).join('·')
  const rank = valid.length === 1
    ? `${names} 흐름을 먼저 확인해.`
    : top.length === valid.length
      ? '분야별 차이가 크지 않아 한 가지를 핵심으로 고르기 어려워.'
      : `${names}${top.length > visibleTop.length ? ' 등' : ''} 흐름이 상대적으로 가장 두드러져.`
  const bands = [...new Set(visibleTop.map(([, stat]) => stat.band || '등급 정보 없음'))].join('·')
  const low = top.every(([, stat]) => /약|낮/.test(stat.band ?? ''))
  return `${when} ${rank} 활성도는 ${bands} 수준이야.${low ? ' 낮은 활성도는 실패나 불리한 사건을 뜻하지 않아.' : ''}`
}
