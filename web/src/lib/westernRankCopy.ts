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


const LOVE_AXIS:Record<string,string> = {연애:'만났을 때 호감을 나누는 흐름', 연락:'연락을 주고받는 흐름', 재회:'지난 인연과 다시 접촉하는 흐름'}
export function westernLoveHeadline(rows:Array<[string,FortuneStat]>) {
  const sorted = rows.filter(([name,stat])=>LOVE_AXIS[name] && Number.isFinite(stat.average)).sort((a,b)=>b[1].average-a[1].average)
  if (!sorted.length) return '이 기간에 비교할 애정 점수가 없어.'
  const [high,low] = [sorted[0],sorted[sorted.length-1]]
  if (sorted.length === 1) return `${LOVE_AXIS[high[0]]}에 대해 계산된 강도는 ${high[1].band || '등급 미제공'}이야.`
  if (high[1].average === low[1].average) return `${sorted.map(([name])=>name).join('·')}의 강도가 같아. 어느 한쪽이 먼저 움직일 흐름으로 읽기는 어려워.`
  if (high[0]==='연애' && low[0]==='연락') return '만났을 때 호감을 나누는 흐름이 연락을 주고받는 흐름보다 높아. 대화가 편했던 날에도 다음 연락은 더디게 느껴질 수 있어.'
  if (high[0]==='연락' && low[0]==='재회') return '연락을 주고받는 흐름이 지난 관계를 다시 잇는 흐름보다 높아. 안부가 와도 다시 만나자는 뜻인지는 그다음 대화에서 드러나.'
  if (high[0]==='재회') return `지난 인연과 다시 접촉하는 흐름이 ${LOVE_AXIS[low[0]]}보다 높아. 연락이 닿으면 예전 문제가 지금도 남아 있는지부터 얘기해 봐.`
  return `${LOVE_AXIS[high[0]]}이 ${LOVE_AXIS[low[0]]}보다 높아. ${high[0]==='연락' ? '메시지가 오간 뒤 만나자는 제안까지 이어지는지 살펴봐.' : '함께 있을 때의 반응과 관계를 다시 시작할 여건을 따로 살펴봐.'}`
}
