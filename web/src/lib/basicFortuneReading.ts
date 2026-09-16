import type { FortuneDailyEvidence, FortuneStat, IntegratedApiResponse, PeriodKey } from '../appTypes'
import type { FortuneField } from './fortuneFields'
import { topicOrder } from './fortuneTopics'

export type BasicFortuneTone = 'good' | 'steady' | 'caution'
export type BasicFortuneRow = {
  topic: string
  score: number
  band: string
  tone: BasicFortuneTone
  meaning: string
  nuance: string
  why: string
  practice: string
  caution: string
  timing?: string
}
export type BasicFortuneReading = {
  when: string
  headline: string
  summary: string
  favorable: BasicFortuneRow[]
  caution: BasicFortuneRow[]
  steady: BasicFortuneRow[]
}

type TopicGuide = { nuance: string; practice: string; caution: string }

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

const TOPIC_GUIDE: Record<string, TopicGuide> = {
  금전: { nuance:'돈이 들어오거나 나간다는 사건 예측보다, 지금 가진 예산을 얼마나 안정적으로 운영할 수 있는지를 보는 해설이야.', practice:'이번 기간에 예정된 결제와 고정지출을 먼저 적고, 남는 돈 안에서 선택지를 정해.', caution:'새 수입을 미리 확정된 돈처럼 잡거나 기분 전환용 소비를 크게 늘리지는 마.' },
  학업: { nuance:'집중력이 좋다는 말보다 실제로 끝낸 분량이 늘어나는지가 더 중요해. 막힌 부분을 좁혀서 처리하는 쪽이 효율적이야.', practice:'가장 중요한 단원이나 과제 하나를 먼저 끝내고 다음으로 넘어가.', caution:'계획을 크게 늘리거나 여러 과목을 동시에 벌여서 실제 진도가 흐려지지 않게 해.' },
  시험: { nuance:'합격 여부를 점치는 값이 아니라, 알고 있는 내용을 안정적으로 꺼내 쓰고 실수를 줄이는 데 어느 정도 힘이 실리는지를 보는 거야.', practice:'오답과 헷갈리는 개념을 먼저 확인하고 시간 안에 풀어내는 연습을 붙여.', caution:'불안하다고 시험 범위를 갑자기 넓히거나 새 교재를 벌이는 건 피하는 편이 좋아.' },
  직장: { nuance:'성과 자체보다 요청, 책임, 마감이 얼마나 정리되느냐가 핵심이야. 새 일을 늘리는 것과 진행 중인 일을 끝내는 건 따로 봐야 해.', practice:'담당자·마감·완료 기준이 모호한 일부터 구체적으로 정리해.', caution:'책임 범위가 불분명한 요청을 바로 떠안거나 말로만 합의하고 넘어가지는 마.' },
  이직: { nuance:'이직 확정이나 합격을 뜻하지 않아. 관심이 실제 직무, 보상, 일정 같은 구체적인 조건으로 발전하는지를 확인하는 흐름이야.', practice:'바꿀 수 없는 조건과 협상 가능한 조건을 나눠 적고 제안이 들어오면 그 기준으로 비교해.', caution:'현재 상황이 답답하다는 이유만으로 퇴사나 이동 결론을 먼저 내리지는 마.' },
  대인관계: { nuance:'사람의 마음을 단정하기보다 대화가 실제 합의와 행동으로 이어지는지를 보는 쪽이 좋아.', practice:'중요한 말은 돌려 말하기보다 짧고 분명하게 전하고, 서로 이해한 내용이 같은지 확인해.', caution:'한 번의 말투나 반응을 관계 전체의 결론처럼 키워 해석하지 마.' },
  연애: { nuance:'호감과 관계 확정은 같은 단계가 아니야. 표현이 있더라도 만남과 약속을 실제로 이어가려는 행동이 붙는지를 같이 봐.', practice:'보고 싶다면 떠보기보다 가벼운 만남을 구체적으로 제안하고 상대의 실제 반응을 확인해.', caution:'한 번의 호감 표현만으로 상대 마음이나 관계 진전을 확정하지 마.' },
  연락: { nuance:'연락 흐름이 높아도 누가 먼저 연락하는지, 어떤 내용이 오는지까지 자동으로 정해지지는 않아. 수신과 발신은 따로 볼 필요가 있어.', practice:'먼저 연락한다면 안부나 질문 하나처럼 답하기 쉬운 내용으로 짧게 보내.', caution:'답이 늦다는 이유만으로 의미를 크게 붙이거나 연속해서 재촉하지 마.' },
  재회: { nuance:'다시 닿는 계기와 관계 회복은 다른 단계야. 과거 감정이 남아 있는 것과 지금 다시 관계를 책임질 준비가 된 것도 구분해야 해.', practice:'실제 연락이 생긴다면 과거 감정보다 지금 달라진 행동과 관계 조건부터 확인해.', caution:'추억이나 우연한 접점 하나만으로 재결합이 시작됐다고 해석하지 마.' },
  소식: { nuance:'좋은 결과를 보장하는 해설이 아니라, 새로운 정보가 들어왔을 때 확인하고 다음 판단으로 이어가기 쉬운지를 보는 흐름이야.', practice:'기다리는 일이 있다면 답변 기한과 다음 절차를 따로 정리하고 공식 원문을 확인해.', caution:'전해 들은 말이나 중간 정보만으로 결과를 확정해서 움직이지 마.' },
  컨디션: { nuance:'건강 상태를 진단하는 해석은 아니야. 일정에 쓸 수 있는 체력과 생활 리듬을 어떻게 배분할지 참고하는 값이야.', practice:'집중이 필요한 일을 먼저 배치하고 중간에 회복 시간을 일부러 남겨둬.', caution:'피곤한데도 일정 전체를 같은 강도로 밀어붙이거나 몸의 신호를 무시하지 마.' },
  투자심리: { nuance:'투자에 관심이 커지는 것과 실제 매수 조건이 좋아지는 것은 전혀 다른 문제야. 감정과 보유 근거를 분리해서 봐.', practice:'사고 싶거나 팔고 싶은 이유를 가격·실적·수급 같은 실제 근거와 따로 적어봐.', caution:'불안, 조급함, 놓칠 것 같은 기분만으로 기존 원칙을 바꾸지 마.' },
  수익실현: { nuance:'정리하고 싶은 욕구가 두드러지는 것과 실제로 수익이 난다는 뜻은 달라. 청산 조건을 점검하는 참고 흐름으로 봐.', practice:'목표가, 손실 한도, 보유 이유가 아직 유효한지 실제 시장 데이터와 함께 확인해.', caution:'운세 점수만으로 매도 시점이나 수익 가능성을 판단하지 마.' },
  신규진입: { nuance:'새 기회가 눈에 들어오는 흐름과 종목의 실제 기대수익은 구분해야 해. 이 값은 매수 권유가 아니야.', practice:'진입 전에 가격 조건, 손실 한도, 진입 이유가 모두 적혀 있는지 확인해.', caution:'기회를 놓친다는 조급함 때문에 원래 기준보다 높은 위험을 감수하지 마.' },
  투자주의: { nuance:'주의 점수가 낮아도 안전하다는 뜻은 아니고, 높다고 반드시 하락한다는 뜻도 아니야. 위험을 얼마나 감당할 수 있는지 점검하는 지표야.', practice:'포지션 크기와 최대 손실 범위를 먼저 확인하고 시장 데이터가 달라지면 그 기준을 우선해.', caution:'운세의 위험 신호를 실제 가격 전망처럼 받아들이거나 포지션을 과하게 늘리지 마.' },
}

const PLANETS: Record<string,string> = { Sun:'태양', Moon:'달', Mercury:'수성', Venus:'금성', Mars:'화성', Jupiter:'목성', Saturn:'토성', Uranus:'천왕성', Neptune:'해왕성', Pluto:'명왕성' }
const ASPECTS: Record<string,string> = { trine:'삼분위', sextile:'육십분위', square:'사분위', opposition:'충', conjunction:'합' }

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

function strongestEvidence(calculation: IntegratedApiResponse, topic: string): FortuneDailyEvidence | undefined {
  const rows = (calculation.western.daily_scores ?? [])
    .filter((day)=>day.date >= calculation.period.start && day.date <= calculation.period.end)
    .flatMap((day)=>day.evidence ?? [])
    .filter((evidence)=>evidence.source_topics?.includes(topic))
    .sort((a,b)=>Math.abs(Number(b.contribution ?? 0))-Math.abs(Number(a.contribution ?? 0)))
  return rows[0]
}

function evidenceReason(calculation: IntegratedApiResponse, topic: string, stat: FortuneStat) {
  const evidence = strongestEvidence(calculation, topic)
  const scoreSentence = `선택 기간의 ${topic} 평균은 ${stat.average.toFixed(0)}점, 판정은 ${stat.band}으로 잡혔어. 이 점수는 사건이 일어날 확률이 아니라 같은 기간 안에서 이 분야가 상대적으로 얼마나 활성화되는지를 비교한 값이야.`
  if (!evidence?.transit || !evidence?.target || !evidence?.aspect) return scoreSentence
  const transit = PLANETS[evidence.transit] ?? evidence.transit
  const target = PLANETS[evidence.target] ?? evidence.target
  const aspect = ASPECTS[evidence.aspect] ?? evidence.aspect
  return `${scoreSentence} 가장 크게 반영된 근거 중 하나는 운행 중인 ${transit}와 출생 차트의 ${target} 사이의 ${aspect} 계산이야. 이 한 가지 배치만으로 결과를 단정하지 않고 다른 계산값과 함께 반영했어.`
}

function timingFor(calculation: IntegratedApiResponse, topic: string, stat: FortuneStat) {
  if (calculation.period.day_count <= 1) return undefined
  const good = topic === '투자주의' ? stat.caution_days?.[0] : stat.best_days?.[0]
  const caution = topic === '투자주의' ? stat.best_days?.[0] : stat.caution_days?.[0]
  const valid = (date?:string)=>Boolean(date && date >= calculation.period.start && date <= calculation.period.end)
  if (good && caution && valid(good.date) && valid(caution.date) && good.date !== caution.date) return `${good.date} 쪽은 상대적으로 활용하기 쉽고, ${caution.date}에는 같은 문제를 서두르지 않는 편이 좋아.`
  const point = good && valid(good.date) ? good : caution && valid(caution.date) ? caution : undefined
  return point ? `${point.date}의 변화가 기간 평균과 얼마나 다른지 한 번 더 확인해봐.` : undefined
}

function rowFor(calculation: IntegratedApiResponse, topic: string): BasicFortuneRow | null {
  const stat = statFor(calculation, topic)
  if (!stat || !Number.isFinite(stat.average)) return null
  const tone = toneFor(topic, stat.average)
  const guide = TOPIC_GUIDE[topic] ?? { nuance:'이 분야는 점수 하나보다 실제 상황과 함께 읽어야 해.', practice:'지금 할 수 있는 행동을 하나 정해서 구체적으로 확인해.', caution:'한 번의 신호만으로 결과를 확정하지 마.' }
  return {
    topic,
    score: stat.average,
    band: stat.band,
    tone,
    meaning: meaningFor(topic, tone),
    nuance: guide.nuance,
    why: evidenceReason(calculation, topic, stat),
    practice: guide.practice,
    caution: guide.caution,
    timing: timingFor(calculation, topic, stat),
  }
}

function topicList(calculation: IntegratedApiResponse, field?: FortuneField) {
  const source = field?.topics?.length ? field.topics : topicOrder
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
    ? `${field.label} 계산값을 바로 생활 언어로 풀었어. 아래에서 결론뿐 아니라 이유, 현실에서의 활용법, 주의할 점과 시기까지 이어서 볼 수 있어.`
    : '계산된 분야별 흐름을 바로 생활 언어로 풀었어. 아래에서 결론뿐 아니라 이유, 현실에서의 활용법, 주의할 점과 시기까지 이어서 볼 수 있어.'
  return { when, headline, summary, favorable, caution, steady }
}
