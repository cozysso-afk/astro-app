import type { FortuneStat } from '../appTypes'

// Display existing scores and bands; never derive a new activation threshold.
export function westernRankCopy(rows: Array<[string, FortuneStat]>, when: string) {
  const valid = rows.filter(([name, stat]) => name !== '투자주의' && typeof stat?.average === 'number' && Number.isFinite(stat.average))
  if (!valid.length) return `${when} 비교할 수 있는 서양점성술 분야 점수가 없어.`
  const sorted = [...valid].sort((a, b) => b[1].average - a[1].average)
  const top = sorted.filter(([, stat]) => stat.average === sorted[0][1].average)
  const scope = valid.map(([name]) => name).join('·')
  const names = top.map(([name]) => name).join('·')
  const rank = valid.length === 1 ? `${scope}만 계산되어 다른 분야와 순위를 비교하지 않아.`
    : top.length === valid.length ? `${scope}의 점수가 모두 같아.`
    : `${scope} 중 ${names}의 점수가 ${top.length > 1 ? '공동으로 ' : ''}가장 높아.`
  const bands = top.map(([name, stat]) => `${name} 활성도는 ‘${stat.band || '등급 정보 없음'}’`).join(', ')
  const low = top.every(([, stat]) => /약|낮/.test(stat.band ?? ''))
  return `${when} ${rank} ${low && valid.length > top.length ? '다른 분야보다 높더라도 ' : ''}${bands}이야. ${low ? '낮은 활성도는 실패나 불리한 사건을 뜻하지 않아. ' : ''}분야 간 순위와 활성도는 사건 발생 확률이 아니야.`
}
