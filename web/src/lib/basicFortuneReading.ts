import type { FortuneStat, IntegratedApiResponse, PeriodKey } from '../appTypes'
import type { FortuneField } from './fortuneFields'

export type BasicFortuneTone = 'good' | 'steady' | 'caution'
export type BasicFortuneRow = {
  topic: string
  score: number
  band: string
  tone: BasicFortuneTone
  meaning: string
  date?: string
}
export type BasicFortuneReading = {
  when: string
  headline: string
  summary: string
  favorable: BasicFortuneRow[]
  caution: BasicFortuneRow[]
  steady: BasicFortuneRow[]
}

const TOPIC_ORDER = ['금전','학업','시험','직장','이직','대인관계','연애','연락','재회','소식','컨디션','투자심리','수익실현','신규진입','투자주의']

const ACTION_COPY: Record<string, [string, string, string]> = {
  금전: ['예산과 수입·지출 계획을 정리하기 좋아.', '계획한 범위 안에서 돈을 쓰고 우선순위를 확인해.', '예상 밖 지출에 여유를 두고 큰 결제는 한 번 더 확인해.'],
  학업: ['중요한 진도를 먼저 밀어보기 좋아.', '공부할 순서를 정해 한 가지씩 끝내.', '새 진도보다 복습과 실수 정리에 무게를 둬.'],
  시험: ['문제를 풀고 약점을 점검하기 좋아.', '익숙한 범위를 다시 확인하면 무난해.', '범위를 넓히기보다 틀린 문제와 헷갈리는 부분부터 봐.'],
  직장: ['업무 정리와 필요한 협의를 진행하기 좋아.', '맡은 일의 순서와 마감을 분명히 해.', '책임 범위가 애매한 요청은 조건부터 확인해.'],
  이직: ['조건을 비교하거나 필요한 대화를 시작해볼 만해.', '가능성을 열어두고 현실 조건부터 비교해.', '결론을 서두르기보다 직무·보상·일정을 먼저 확인해.'],
  대인관계: ['필요한 사람과 대화를 풀어가기 좋아.', '무리하게 맞추기보다 필요한 말만 분명히 해.', '한 번의 반응으로 관계 전체를 단정하지 마.'],
  연애: ['호감 표현이나 가벼운 만남을 이어가기 좋아.', '부담을 주지 않는 선에서 자연스럽게 반응을 봐.', '관계 진전을 서두르기보다 실제 약속과 태도를 확인해.'],
  연락: ['안부·질문·약속처럼 구체적인 연락을 꺼내보기 좋아.', '연락한다면 짧고 분명하게 전해.', '답을 재촉하거나 한 번의 반응에 의미를 크게 붙이지 마.'],
  재회: ['과거 인연의 재접점은 실제 연락과 태도로 확인해볼 만해.', '추억과 지금의 행동을 구분해서 봐.', '흐름이 약하면 먼저 관계 회복을 전제로 움직이지 마.'],
  소식: ['새 소식이나 제안을 확인하기 좋아.', '전해 들은 말보다 원문과 공식 안내를 먼저 봐.', '확인되지 않은 소식으로 결론을 서두르지 마.'],
  컨디션: ['일정에 힘을 쓰기 비교적 좋은 편이야.', '무리하지 않는 선에서 평소 리듬을 유지해.', '일정 사이에 쉴 틈을 두고 회복을 우선해.'],
  투자심리: ['관심이 커져도 매수 근거는 별도로 점검해.', '기분보다 원래 정한 기준을 따라가.', '불안이나 조급함 때문에 판단 기준을 바꾸지 마.'],
  수익실현: ['청산 조건을 점검하기 좋은 시기지만 수익 보장은 아니야.', '목표가와 손실 한도를 다시 확인해.', '흐름만 보고 실제 가격·거래량 확인 없이 결정하지 마.'],
  신규진입: ['진입 조건을 비교하기 좋은 편이지만 매수 권유는 아니야.', '급히 들어가기보다 조건이 맞는지 확인해.', '조급한 신규 진입보다 위험 한도부터 정해.'],
  투자주의: ['경계 신호가 낮아도 안전을 뜻하진 않아.', '위험 노출과 손실 한도를 평소 기준대로 확인해.', '주의 지수가 높을수록 포지션 확대보다 위험 관리에 무게를 둬.'],
}

function periodWord(period: PeriodKey, dayCount: number) {
  if (period === 'today' || dayCount <= 1) return '오늘'
  if (period === 'week' || dayCount <= 9) return '이번 주'
  if (period === 'month' || dayCount <= 45) return '이번 달'
  return '올해'
}

function statFor(calculation: IntegratedApiResponse, topic: string): FortuneStat | null {
  return calculation.western.overall?.[topic] ?? calculation.western.relationship_signals?.[topic] ?? null
}

function toneFor(topic: string, score: number): BasicFortuneTone {
  if (topic === '투자주의') return score >= 55 ? 'caution' : score < 40 ? 'good' : 'steady'
  if (score >= 60) return 'good'
  if (score < 40) return 'caution'
  return 'steady'
}

function meaningFor(topic: string, tone: BasicFortuneTone) {
  const copy = ACTION_COPY[topic] ?? ['활용할 부분을 구체적으로 확인해.', '평소 계획을 유지하면서 변화를 봐.', '큰 결정보다 확인과 점검을 먼저 해.']
  return tone === 'good' ? copy[0] : tone === 'caution' ? copy[2] : copy[1]
}

function rowFor(calculation: IntegratedApiResponse, topic: string): BasicFortuneRow | null {
  const stat = statFor(calculation, topic)
  if (!stat || !Number.isFinite(stat.average)) return null
  const tone = toneFor(topic, stat.average)
  const date = tone === 'good' ? stat.best_days?.[0]?.date : tone === 'caution' ? stat.caution_days?.[0]?.date : undefined
  return { topic, score: stat.average, band: stat.band, tone, meaning: meaningFor(topic, tone), date }
}

function topicList(calculation: IntegratedApiResponse, field?: FortuneField) {
  const source = field?.topics?.length ? field.topics : TOPIC_ORDER
  return source.map((topic)=>rowFor(calculation, topic)).filter((row): row is BasicFortuneRow => Boolean(row))
}

export function buildBasicFortuneReading(calculation: IntegratedApiResponse, period: PeriodKey, field?: FortuneField): BasicFortuneReading {
  const when = periodWord(period, calculation.period.day_count)
  const rows = topicList(calculation, field)
  const favorable = rows.filter((row)=>row.tone === 'good').sort((a,b)=>b.score-a.score).slice(0,2)
  const caution = rows.filter((row)=>row.tone === 'caution').sort((a,b)=>a.topic === '투자주의' ? -1 : b.topic === '투자주의' ? 1 : a.score-b.score).slice(0,2)
  const steady = rows.filter((row)=>row.tone === 'steady').sort((a,b)=>b.score-a.score).slice(0,2)
  const best = favorable[0]
  const watch = caution[0]
  const scope = field?.label ? `${field.label}에서 ` : ''
  let headline = `${when}은 크게 치우친 흐름보다 평소 계획을 지키는 쪽이 좋아.`
  if (best && watch) headline = `${when}은 ${best.topic} 쪽은 활용할 만하고, ${watch.topic} 쪽은 속도를 낮추는 편이 좋아.`
  else if (best) headline = `${when}은 ${scope}${best.topic} 쪽 흐름이 상대적으로 좋아. 계획한 일을 구체적으로 진행해봐.`
  else if (watch) headline = `${when}은 ${scope}${watch.topic} 쪽을 무리하지 않는 게 좋아. 확인과 점검을 먼저 해.`
  else if (field?.label) headline = `${when} ${field.label}은 크게 밀어붙이기보다 계획한 범위 안에서 움직이면 무난해.`
  const summary = field?.label
    ? `${field.label}의 계산 점수를 생활 언어로 바로 풀었어. 별도 AI 호출 없이 항상 볼 수 있는 기본 해설이야.`
    : '계산된 분야 점수를 생활 언어로 바로 풀었어. 별도 AI 호출 없이 항상 볼 수 있는 기본 해설이야.'
  return { when, headline, summary, favorable, caution, steady }
}
