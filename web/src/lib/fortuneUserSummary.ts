import type { AiInterpretationResponse, AiTopicInterpretation, FortuneStat, IntegratedApiResponse, PeriodKey } from '../appTypes'

type InterpretationData = NonNullable<AiInterpretationResponse['data']>
type FlowLevel = 'low' | 'steady' | 'high'
type PeriodKind = 'day' | 'week' | 'month' | 'year'

export type FortuneUserTopic = {
  topic: string
  conclusion: string
  reason: string
  timing?: string
  action: string
  observe?: string
  caution?: string
}

export type FortuneUserWindow = {
  date: string
  guidance: string
}

export type FortuneUserRelationship = {
  summary: string
  incoming?: string
  outgoing?: string
  reconnection?: string
  incomingBand?: string
  outgoingBand?: string
  incomingTiming?: string
  outgoingTiming?: string
}

export type FortuneUserSummary = {
  periodKind: PeriodKind
  when: string
  headline: string
  summary: string
  doTitle: string
  cautionTitle: string
  focusTitle: string
  doItems: string[]
  cautionItems: string[]
  bestFlow: string[]
  cautionFlow: string[]
  focusTopics: FortuneUserTopic[]
  referenceTopics: Array<{ topic: string; summary: string }>
  importantWindows: FortuneUserWindow[]
  relationship?: FortuneUserRelationship
}

export type FortuneUserSummaryContext = {
  period: PeriodKey
  calculation: Pick<IntegratedApiResponse, 'period' | 'western'>
  topicEntries: Array<[topic: string, interpretation: AiTopicInterpretation]>
}

type TopicCopy = {
  conclusion: string
  practice: string
  observe: string
  caution: string
  reference: string
}

const INVESTMENT_TOPICS = new Set(['투자심리', '수익실현', '신규진입', '투자주의'])

function frameFor(period: PeriodKey, dayCount: number) {
  const kind: PeriodKind = period === 'today' || dayCount <= 1
    ? 'day'
    : period === 'week' || dayCount <= 9
      ? 'week'
      : period === 'month' || dayCount <= 45
        ? 'month'
        : 'year'
  if (kind === 'day') return { kind, when: '오늘', doTitle: '오늘 이렇게', cautionTitle: '오늘 조심', focusTitle: '중요하게 볼 분야' }
  if (kind === 'week') return { kind, when: '이번 주', doTitle: '좋은 흐름', cautionTitle: '조심할 흐름', focusTitle: '중요 분야' }
  if (kind === 'month') return { kind, when: '이번 달', doTitle: '좋은 흐름', cautionTitle: '조심할 흐름', focusTitle: '중요 분야' }
  return { kind, when: '올해', doTitle: '좋은 흐름', cautionTitle: '조심할 흐름', focusTitle: '중요 분야' }
}

function flowLevel(stat: FortuneStat | null | undefined): FlowLevel {
  const band = String(stat?.band ?? '')
  if (/약|낮/.test(band)) return 'low'
  if (/강|높/.test(band)) return 'high'
  const score = Number(stat?.average)
  if (Number.isFinite(score)) {
    if (score < 40) return 'low'
    if (score >= 60) return 'high'
  }
  return 'steady'
}

function topicStat(context: FortuneUserSummaryContext, topic: string) {
  return context.calculation.western.overall?.[topic] ?? null
}

function topicCopy(topic: string, level: FlowLevel, when: string): TopicCopy {
  const low = level === 'low'
  const high = level === 'high'
  switch (topic) {
    case '금전':
      return {
        conclusion: low ? `${when}${particle(when, '은', '는')} 지출을 늘리기보다 꼭 필요한 돈부터 챙기는 편이 좋아.` : high ? `${when}${particle(when, '은', '는')} 예산을 정리하고 필요한 돈 문제를 처리하기 좋은 편이야.` : `${when} 금전 흐름은 무난한 편이니 계획한 범위 안에서 움직여.`,
        practice: '결제 전에 예산과 우선순위를 한 번 더 정리해.',
        observe: '예상하지 못한 지출이 생기는지, 들어오고 나가는 돈의 순서가 꼬이지 않는지 봐.',
        caution: '기분 전환용 소비나 급한 금전 결정은 미뤄.',
        reference: `${when}${particle(when, '은', '는')} 돈 문제를 크게 벌이기보다 평소 계획을 지키면 충분해.`,
      }
    case '학업':
      return {
        conclusion: low ? `${when}${particle(when, '은', '는')} 집중이 쉽게 흐트러질 수 있으니 목표를 작게 잡는 편이 좋아.` : high ? `${when}${particle(when, '은', '는')} 공부와 과제를 정리해서 진도를 내기 좋은 편이야.` : `${when}${particle(when, '은', '는')} 공부할 순서를 정해 차근차근 따라가면 무난해.`,
        practice: high ? '가장 중요한 과제부터 정하고 한 가지를 끝까지 마쳐.' : '공부할 분량을 작게 나눠 한 번에 하나씩 처리해.',
        observe: '앉아 있는 시간보다 실제로 끝낸 분량이 늘어나는지를 봐.',
        caution: '계획만 크게 세우고 여러 과제를 동시에 벌이지 마.',
        reference: `${when} 학업은 무리하게 진도를 늘리기보다 정한 분량을 지키는 쪽이 좋아.`,
      }
    case '시험':
      return {
        conclusion: low ? `${when}${particle(when, '은', '는')} 새로운 내용을 늘리기보다 아는 문제의 실수를 줄이는 편이 좋아.` : high ? `${when}${particle(when, '은', '는')} 문제를 풀고 부족한 부분을 점검하기 좋은 편이야.` : `${when} 시험 준비는 익숙한 범위를 다시 다지는 쪽이 무난해.`,
        practice: '틀린 문제와 헷갈리는 부분부터 짧게 다시 봐.',
        observe: '시간 안에 문제를 끝내는지, 같은 실수를 반복하는지를 살펴봐.',
        caution: '불안하다고 공부 범위를 갑자기 넓히진 마.',
        reference: `${when} 시험 준비는 새 계획보다 복습과 실수 정리에 무게를 둬.`,
      }
    case '직장':
      return {
        conclusion: low ? `${when}${particle(when, '은', '는')} 일이 뜻대로 빨리 풀리지 않을 수 있으니 요청과 마감을 먼저 정리해.` : high ? `${when}${particle(when, '은', '는')} 업무를 정리하고 필요한 협의를 진행하기 좋은 편이야.` : `${when} 업무는 맡은 일의 순서를 분명히 하면 무난하게 풀 수 있어.`,
        practice: '요청받은 일과 마감 순서를 적고 중요한 것부터 처리해.',
        observe: '말로 끝난 협의가 담당자와 일정까지 구체적으로 정해지는지를 봐.',
        caution: '책임 범위가 애매한 일을 바로 떠안지는 마.',
        reference: `${when} 직장에서는 새 일을 늘리기보다 현재 일정과 책임을 정리하는 게 좋아.`,
      }
    case '이직':
      return {
        conclusion: low ? `${when}${particle(when, '은', '는')} 이직 결론을 서두르기보다 조건을 비교하는 데 집중하는 편이 좋아.` : high ? `${when}${particle(when, '은', '는')} 이직 조건을 살피거나 필요한 대화를 시작해 볼 만해.` : `${when} 이직 문제는 가능성을 열어 두고 현실 조건부터 비교해.`,
        practice: '직무, 보상, 일정처럼 바꿀 수 없는 조건부터 적어봐.',
        observe: '관심 표현이 실제 제안과 구체적인 일정으로 이어지는지를 봐.',
        caution: '답답한 기분만으로 현재 자리를 급하게 정리하지 마.',
        reference: `${when} 이직은 결론보다 조건을 비교하는 정도로 참고해.`,
      }
    case '대인관계':
      return {
        conclusion: low ? `${when}${particle(when, '은', '는')} 말이 엇갈리기 쉬우니 상대 반응을 섣불리 단정하지 않는 편이 좋아.` : high ? `${when}${particle(when, '은', '는')} 필요한 사람과 대화를 풀어가기 좋은 편이야.` : `${when} 사람 관계는 무리하게 맞추기보다 적당한 거리를 지키면 무난해.`,
        practice: '중요한 말은 돌려 말하지 말고 짧고 분명하게 전해.',
        observe: '말투 하나보다 이후 태도와 약속을 지키는지를 봐.',
        caution: '한 번의 서운한 반응을 관계 전체의 결론으로 키우지 마.',
        reference: `${when} 대인관계는 필요한 말만 분명히 하고 반응을 천천히 보는 게 좋아.`,
      }
    case '연애':
      return {
        conclusion: low ? `${when} 연애는 서두르지 않는 편이 좋아.` : high ? `${when}${particle(when, '은', '는')} 마음을 표현하거나 만남을 구체화해 보기 좋은 편이야.` : `${when} 연애는 부담을 주지 않는 선에서 자연스럽게 반응을 주고받아.`,
        practice: '만나고 싶다면 막연하게 떠보지 말고 가벼운 약속을 제안해.',
        observe: '상대의 말보다 약속을 실제로 잡고 만남을 이어가는지를 봐.',
        caution: '호감 표현 하나만 보고 관계가 진전됐다고 단정하지 마.',
        reference: `${when} 연애는 큰 의미를 붙이기보다 상대의 꾸준한 행동을 보는 정도가 좋아.`,
      }
    case '연락':
      return {
        conclusion: low ? `${when} 연락은 한 번 가볍게 시작하되 반응이 애매하면 더 밀지 않는 편이 좋아.` : high ? `${when}${particle(when, '은', '는')} 먼저 연락하거나 대화를 이어가기 좋은 편이야.` : `${when} 연락은 짧고 편하게 시작해 상대의 속도에 맞춰가면 돼.`,
        practice: '먼저 연락한다면 용건을 짧고 분명하게 보내.',
        observe: '답장이 구체적인지, 대화가 이어지는지, 다음 연락이나 약속이 잡히는지를 봐.',
        caution: '답장이 늦거나 짧다고 바로 관계의 의미까지 확대해서 보진 마.',
        reference: `${when} 연락은 횟수보다 답장의 내용과 대화가 이어지는지를 보는 게 좋아.`,
      }
    case '재회':
      return {
        conclusion: low ? `${when}${particle(when, '은', '는')} 과거 감정보다 지금 실제로 다시 대화가 시작되는지를 보는 편이 좋아.` : high ? `${when}${particle(when, '은', '는')} 과거 인연과 대화를 다시 시작할 계기가 있는지 지켜볼 만해.` : `${when} 재회 문제는 추억보다 현재의 연락과 태도를 기준으로 봐.`,
        practice: '연락할 이유가 분명하다면 감정 확인보다 안부처럼 가볍게 시작해.',
        observe: '실제 재접촉이 있는지, 대화가 이어지는지, 이전 문제를 다르게 다루는지를 봐.',
        caution: '그리운 마음만으로 상대도 다시 시작할 준비가 됐다고 생각하진 마.',
        reference: `${when} 재회는 과거 감정보다 현재 연락과 행동이 생기는지를 기준으로 봐.`,
      }
    case '소식':
      return {
        conclusion: low ? `${when}${particle(when, '은', '는')} 기다리는 답이 늦어질 수 있으니 한 번에 결론 내리지 않는 편이 좋아.` : high ? `${when}${particle(when, '은', '는')} 기다리던 답이나 필요한 정보를 받아보기 좋은 편이야.` : `${when} 소식은 서두르지 말고 정해진 연락 순서를 기다려.`,
        practice: '기한이 지난 일만 짧게 다시 물어봐.',
        observe: '막연한 말이 아니라 날짜와 다음 단계가 구체적으로 오는지를 봐.',
        caution: '답이 늦다는 이유만으로 나쁜 결과를 먼저 단정하지 마.',
        reference: `${when} 소식은 확정된 답이 올 때까지 차분히 기다리는 편이 좋아.`,
      }
    case '컨디션':
      return {
        conclusion: low ? `${when}${particle(when, '은', '는')} 쉽게 지칠 수 있으니 일정을 너무 빡빡하게 잡지 않는 게 좋아.` : high ? `${when}${particle(when, '은', '는')} 몸 상태가 비교적 받쳐주니 중요한 일을 앞쪽에 두기 좋아.` : `${when} 컨디션은 무난하지만 쉬는 시간을 빼놓진 마.`,
        practice: low ? '중요한 일정 사이에 쉬는 시간을 두고 잠을 조금 더 챙겨.' : '몸이 가벼운 시간에 중요한 일을 먼저 끝내.',
        observe: '수면 뒤에도 피로가 남는지, 집중력이 평소보다 빨리 떨어지는지를 살펴봐.',
        caution: '피곤한 상태에서 일정을 빽빽하게 잡거나 무리해서 버티지 마.',
        reference: `${when} 컨디션은 수면과 피로 정도를 보면서 일정 강도를 조절해.`,
      }
    case '투자심리':
      return {
        conclusion: high ? `${when}${particle(when, '은', '는')} 매매하고 싶은 마음이 커질 수 있으니 느낌보다 계획을 먼저 봐.` : low ? `${when}${particle(when, '은', '는')} 시장 분위기에 휩쓸리기보다 차분하게 보기 쉬운 편이야.` : `${when} 투자 판단은 감정보다 미리 정한 기준을 따르는 게 좋아.`,
        practice: '매매 이유와 감당할 손실 범위를 먼저 적어.',
        observe: '계획보다 조급함이나 만회 심리가 결정을 끌고 가는지를 살펴봐.',
        caution: '분위기에 휩쓸려 계획에 없던 매매를 만들지 마.',
        reference: `${when}${particle(when, '은', '는')} 투자 심리를 따로 해석할 만큼 뚜렷한 신호가 없어.`,
      }
    case '수익실현':
      return {
        conclusion: high ? `${when}${particle(when, '은', '는')} 보유한 것을 정리할지 검토해 볼 만하지만 목표와 이유를 먼저 정해.` : low ? `${when}${particle(when, '은', '는')} 수익 실현을 서두르기보다 기존 계획을 지키는 편이 좋아.` : `${when} 수익 실현은 가격보다 처음 세운 기준에 맞는지부터 봐.`,
        practice: '목표 가격과 나눠서 정리할 기준을 미리 적어둬.',
        observe: '처음 세운 목표에 닿았는지, 보유 이유가 여전히 남아 있는지를 봐.',
        caution: '짧은 움직임만 보고 전부 정리하거나 더 욕심내지 마.',
        reference: `${when}${particle(when, '은', '는')} 수익 실현 시점을 따로 강조할 만한 신호가 뚜렷하지 않아.`,
      }
    case '신규진입':
      return {
        conclusion: high ? `${when}${particle(when, '은', '는')} 새로 들어갈 생각이 커질 수 있지만 조건이 맞는지부터 따져봐.` : low ? `${when}${particle(when, '은', '는')} 새로 들어가기보다 기다리면서 조건을 더 살피는 편이 좋아.` : `${when} 신규 진입은 가격과 손실 기준이 모두 맞을 때만 검토해.`,
        practice: '들어갈 가격과 틀렸을 때 나올 기준을 함께 정해.',
        observe: '가격만 끌리는지, 정한 조건과 위험 범위까지 맞는지를 봐.',
        caution: '놓칠까 봐 계획 없이 따라 들어가진 마.',
        reference: `${when}${particle(when, '은', '는')} 새로 들어갈 시점을 따로 잡을 만한 신호가 뚜렷하지 않아.`,
      }
    case '투자주의':
      return {
        conclusion: high ? `${when} 투자 쪽은 평소보다 더 보수적으로 보는 게 좋아.` : low ? `${when}${particle(when, '은', '는')} 별도 경계 신호가 두드러지지 않지만 안전하다는 뜻은 아니야.` : `${when} 투자에서는 기대 수익보다 감당할 손실을 먼저 봐.`,
        practice: '결정 전에 손실 한도와 중단 기준을 먼저 정해.',
        observe: '변동이 커지는지, 세운 원칙을 감정 때문에 바꾸는지를 살펴봐.',
        caution: '손실을 빨리 만회하려고 규모를 키우지 마.',
        reference: `${when}${particle(when, '은', '는')} 투자 위험을 특별히 더 경계할 신호가 뚜렷하진 않지만 안전을 보장하진 않아.`,
      }
    default:
      return {
        conclusion: `${when} ${topic}은 결과를 서두르지 말고 실제 변화가 생기는지를 지켜봐.`,
        practice: '할 일을 한 가지로 줄여 차근차근 진행해.',
        observe: '말보다 다음 행동이 구체적으로 이어지는지를 봐.',
        caution: '한 번의 반응으로 전체 결과를 단정하지 마.',
        reference: `${when}${particle(when, '은', '는')} ${topic}을 따로 강조할 만한 흐름이 뚜렷하지 않아.`,
      }
  }
}

function unique(items: string[], limit: number) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const clean = item.trim()
    if (!clean || seen.has(clean)) return false
    seen.add(clean)
    return true
  }).slice(0, limit)
}

function topicPhrase(topic: string) {
  const labels: Record<string, string> = {
    금전: '돈 관리', 학업: '공부', 시험: '시험 준비', 직장: '업무', 이직: '이직 조건', 대인관계: '사람 관계',
    연애: '연애', 연락: '연락', 재회: '재회 문제', 소식: '기다리는 소식', 컨디션: '몸 상태', 투자심리: '투자 판단',
    수익실현: '수익 실현', 신규진입: '신규 진입', 투자주의: '투자 위험',
  }
  return labels[topic] ?? topic
}

function joinTopics(topics: string[]) {
  const labels = unique(topics.map(topicPhrase), 3)
  if (labels.length <= 1) return labels[0] ?? ''
  if (labels.length === 2) return `${labels[0]}${particle(labels[0], '과', '와')} ${labels[1]}`
  return `${labels[0]}, ${labels[1]}${particle(labels[1], '과', '와')} ${labels[2]}`
}

function particle(text: string, closed: string, open: string) {
  const code = text.charCodeAt(text.length - 1) - 0xac00
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? closed : open
}

function naturalWindowGuidance(signal: string, topics: string[]) {
  const focus = joinTopics(topics)
  if (!focus) return ''
  if (signal === '활용') return `${focus}에 힘을 써보기 좋아.`
  if (signal === '주의') return `${focus}${particle(focus, '을', '를')} 서두르지 않는 편이 좋아.`
  return `${focus}의 반응을 보면서 속도를 조절해.`
}

const PLANETS: Record<string, string> = {
  Sun: '태양', Moon: '달', Mercury: '수성', Venus: '금성', Mars: '화성',
  Jupiter: '목성', Saturn: '토성', Uranus: '천왕성', Neptune: '해왕성', Pluto: '명왕성',
}
const ASPECT_WORDING: Record<string, string> = {
  삼분위: '매끄럽게 연결되는 배치', trine: '매끄럽게 연결되는 배치',
  육십분위: '서로 보완하는 배치', sextile: '서로 보완하는 배치',
  사분위: '서로 긴장을 만드는 배치', square: '서로 긴장을 만드는 배치',
  충: '서로 마주 보는 배치', opposition: '서로 마주 보는 배치',
  합: '한곳에 모이는 배치', conjunction: '한곳에 모이는 배치',
}
function planetName(value?: string) {
  if (!value) return ''
  return PLANETS[value] ?? (Object.values(PLANETS).includes(value) ? value : '')
}
function linkedEvidence(context: FortuneUserSummaryContext, topic: string) {
  const period = context.calculation.period
  return (context.calculation.western.daily_scores ?? []).filter(day => day.date >= period.start && day.date <= period.end)
    .flatMap(day => (day.evidence ?? []).filter(e => e.source_topics?.includes(topic)).map(e => ({ date: day.date, evidence: e })))
}
function topicTiming(context: FortuneUserSummaryContext, topic: string, level: FlowLevel, kind: PeriodKind) {
  if (kind === 'day') return undefined
  const period = context.calculation.period
  if (kind === 'year' || kind === 'month') {
    const phases = (context.calculation.western.months ?? [])
      .filter(month => month.start >= period.start && month.end <= period.end && Number.isFinite(month.topics?.[topic]?.average))
      .map(month => ({ start: month.start, end: month.end, score: month.topics[topic]!.average }))
      .sort((a, b) => topic === '투자주의' ? a.score - b.score : b.score - a.score)
    const strongest = phases[0], weakest = phases.at(-1)
    if (strongest && weakest && strongest.score !== weakest.score) {
      return `${kind === 'year' ? '올해' : '이번 달'}는 ${strongest.start}~${strongest.end}에 힘을 쓰고, ${weakest.start}~${weakest.end}에는 부담을 줄이는 편이 좋아.`
    }
  }
  const stat = topicStat(context, topic)
  if (!stat || !Number.isFinite(stat.spread) || stat.spread <= 0) return undefined
  const best = topic === '투자주의' ? stat.caution_days?.[0] : stat.best_days?.[0]
  const caution = topic === '투자주의' ? stat.best_days?.[0] : stat.caution_days?.[0]
  const valid = (date?: string) => Boolean(date && date >= context.calculation.period.start && date <= context.calculation.period.end)
  if (best && caution && valid(best.date) && valid(caution.date) && best.date !== caution.date && best.score !== caution.score) {
    const frame = kind === 'week' ? '이번 주 안에서도' : kind === 'month' ? '이번 달에는' : '올해 주요 시기를 나눠 보면'
    return `${frame} ${best.date} 쪽이 더 수월하고, ${caution.date}에는 속도를 낮추는 편이 좋아.`
  }
  const point = level === 'low' ? caution : best
  return point && valid(point.date) ? `${point.date}에 ${level === 'low' ? '부담이 더 두드러져' : '이 분야의 움직임이 더 두드러져'}.` : undefined
}
function reasonFor(data: InterpretationData, context: FortuneUserSummaryContext, topic: string, row: AiTopicInterpretation, level: FlowLevel) {
  const linked = linkedEvidence(context, topic)
  const readable = unique(linked.map(({ evidence }) => {
    const names = unique([planetName(evidence.transit), planetName(evidence.target)].filter(Boolean), 2)
    if (!names.length) return ''
    const subject = names.length === 2 ? `${names[0]}${particle(names[0], '과', '와')} ${names[1]}` : names[0]
    const aspect = evidence.aspect ? ASPECT_WORDING[evidence.aspect] : undefined
    const source = aspect && names.length === 2 ? `${subject}이 ${aspect}` : `${subject}의 움직임`
    const contribution = evidence.contribution
    const direction = typeof contribution === 'number' && Number.isFinite(contribution)
      ? contribution > 0 ? '힘을 보태는 쪽으로' : contribution < 0 ? '부담을 더하는 쪽으로' : '뚜렷한 가감 없이'
      : ''
    return direction ? `${source}${particle(source, '이', '가')} ${topic}에 ${direction} 반영됐어.` : `${source}${particle(source, '이', '가')} ${topic} 계산에 연결돼 있어.`
  }).filter(Boolean), 2)
  // A shared reference is required: never attach a whole-period system statement to an unrelated topic.
  const refs = new Set(row.evidence_refs ?? [])
  const cross = (data.cross_checks ?? []).find(check => check.evidence_refs?.some(ref => refs.has(ref)) && check.western && (check.saju || check.thai))
  if (cross) {
    const systems = [cross.saju ? '사주' : '', cross.thai ? '태국점성 보조 흐름' : ''].filter(Boolean).join('와 ')
    readable.push(cross.mode === '상반맥락'
      ? `같은 시기의 ${systems}은 서양점성의 흐름과 엇갈려서 한쪽만 보고 결론 내리기 어려워.`
      : `같은 시기의 ${systems}도 함께 참고할 수 있어. 여러 체계가 보인다는 이유만으로 같은 결론이라고 보진 않아.`)
  }
  if (!readable.length) {
    if (!topicStat(context, topic)) return '이 분야의 계산 방향을 읽을 정보가 부족해서 구체적인 이유는 덧붙이지 않을게.'
    return level === 'low' ? `${topic} 계산은 약한 쪽에 놓여 있어. 다만 어떤 행성의 영향인지 풀어 쓸 세부 정보는 부족해.`
      : level === 'high' ? `${topic} 계산은 강한 쪽에 놓여 있어. 다만 특정 사건이나 행성의 영향까지 단정할 세부 정보는 부족해.`
        : `${topic} 계산은 중간 수준이야. 어느 쪽으로 움직일지 뚜렷하지 않아 큰 기대나 경계를 더하지 않을게.`
  }
  return readable.join(' ')
}
function relationshipSummary(context: FortuneUserSummaryContext, important: Set<string>, kind: PeriodKind): FortuneUserRelationship | undefined {
  if (!important.has('연락')) return undefined
  const stats = context.calculation.western.relationship_signals ?? {}
  const incoming = stats['수신신호']
  const outgoing = stats['발신적합']
  const incomingLevel = flowLevel(incoming)
  const outgoingLevel = flowLevel(outgoing)
  const band = (stat: FortuneStat | null | undefined) => !stat ? '정보 부족' : flowLevel(stat) === 'low' ? '약함' : flowLevel(stat) === 'high' ? '강함' : '보통'
  const timing = (stat: FortuneStat | null | undefined) => {
    if (!stat || kind === 'day' || !stat.spread) return undefined
    const point = flowLevel(stat) === 'low' ? stat.caution_days?.[0] : stat.best_days?.[0]
    return point && point.date >= context.calculation.period.start && point.date <= context.calculation.period.end ? point.date : undefined
  }
  return {
    summary: '먼저 연락이 오는 흐름과 내가 말을 꺼내는 흐름은 나눠서 봐.',
    incomingBand: band(incoming), outgoingBand: band(outgoing),
    incomingTiming: timing(incoming), outgoingTiming: timing(outgoing),
    incoming: !incoming ? '상대가 먼저 연락할 흐름을 판단할 계산 정보가 없어.'
      : incomingLevel === 'high' ? '먼저 연락이 오는 쪽에 힘이 실려 있어. 연락이 오면 내용과 다음 약속이 구체적인지 봐.'
      : incomingLevel === 'low' ? '먼저 연락이 오길 크게 기대하기보다는, 연락이 와도 내용이 구체적인지를 보는 편이 좋아.'
      : '먼저 연락이 올지는 열어 두고, 답이 왔을 때 대화가 이어지는지를 봐.',
    outgoing: !outgoing ? '내가 먼저 연락하기 좋은지 판단할 계산 정보가 없어.'
      : outgoingLevel === 'high' ? '내가 먼저 가볍게 말을 꺼내보기 좋은 흐름이야. 다만 상대도 같은 마음이라는 뜻은 아니야.'
      : outgoingLevel === 'low' ? '먼저 연락을 밀어붙이기보다 꼭 할 말만 짧게 전하고 기다리는 편이 좋아.'
      : '가볍게 먼저 말을 걸어볼 수는 있지만 반응이 애매하면 더 밀지 않는 게 좋아.',
    reconnection: important.has('재회') && stats['과거인연접점']
      ? `과거 인연 재접촉은 ${band(stats['과거인연접점'])}으로 잡혀 있어. 추억보다 실제 대화가 다시 시작되는지를 봐.`
      : undefined,
  }
}

export function buildFortuneUserSummary(data: InterpretationData, context: FortuneUserSummaryContext): FortuneUserSummary {
  const frame = frameFor(context.period, context.calculation.period.day_count)
  const importance = (value: AiTopicInterpretation['importance']) => value === '핵심' ? 0 : value === '주목' ? 1 : 2
  const normalized = context.topicEntries.map(([topic, interpretation]) => {
    const stat = topicStat(context, topic)
    const score = stat && Number.isFinite(stat.average) ? stat.average : null
    const position = (data.priorities ?? []).findIndex(text => text.includes(topic))
    // Risk intensity is not a favorable score. This changes polarity, never domain priority.
    const favorable = score === null ? null : topic === '투자주의' ? 100 - score : score
    return { topic, interpretation, score, favorable, level: flowLevel(stat), support: linkedEvidence(context, topic).length + (interpretation.evidence_refs?.length ?? 0), priority: position < 0 ? Infinity : position }
  })
  const rank = (mode: 'best' | 'caution' | 'salience') => (a: typeof normalized[number], b: typeof normalized[number]) => {
    const strength = (row: typeof a) => row.favorable === null ? -Infinity : mode === 'best' ? row.favorable - 50 : mode === 'caution' ? 50 - row.favorable : Math.abs(row.favorable - 50)
    return importance(a.interpretation.importance) - importance(b.interpretation.importance)
      || strength(b) - strength(a) || b.support - a.support || a.priority - b.priority || a.topic.localeCompare(b.topic, 'ko')
  }
  const primary = normalized.filter(row => importance(row.interpretation.importance) < 2)
  // Positive and weak signals are independent lists. A neutral score is not invented into a favorable signal.
  const best = primary.filter(row => row.favorable !== null && row.favorable > 50 && row.topic !== '투자주의').sort(rank('best')).slice(0, 2)
  const caution = primary.filter(row => row.favorable !== null && row.favorable < 50).sort(rank('caution')).slice(0, 2)
  const selected = [...primary].sort(rank('salience')).slice(0, 3)
  const bestFlow = best.map(row => row.topic)
  const cautionFlow = caution.map(row => row.topic)
  const when = frame.when
  const headline = best.length && caution.length
    ? `${when}${particle(when, '은', '는')} ${joinTopics(bestFlow)}에 힘을 쓰기 괜찮지만, ${joinTopics(cautionFlow)} 쪽은 속도를 낮추는 편이 좋아.`
    : best.length ? `${when}${particle(when, '은', '는')} ${joinTopics(bestFlow)}에 힘을 쓰기 좋은 편이야. 이쪽부터 계획을 잡아봐.`
    : caution.length ? `${when}${particle(when, '은', '는')} ${joinTopics(cautionFlow)} 쪽의 기대를 낮추는 편이 좋아. 그 밖에 크게 밀어줄 분야는 뚜렷하지 않아.`
    : `${when}${particle(when, '은', '는')} 좋거나 조심할 분야가 뚜렷하게 갈리지 않아. 평소 계획을 유지하면서 변화를 지켜봐.`
  const focusTopics = selected.map(({ topic, interpretation, level, score }) => {
    const copy = topicCopy(topic, level, when)
    return { topic, conclusion: score === null ? `${topic}은 계산 정보가 부족해 방향을 정하기 어려워.` : copy.conclusion, reason: reasonFor(data, context, topic, interpretation, level),
      timing: topicTiming(context, topic, level, frame.kind), action: copy.practice, observe: copy.observe,
      caution: interpretation.avoid ? copy.caution : undefined }
  })
  const referenceTopics = normalized.filter(row => !selected.some(selectedRow => selectedRow.topic === row.topic))
    .sort(rank('salience')).map(({ topic, level, interpretation }) => ({
      topic, summary: importance(interpretation.importance) === 2 ? topicCopy(topic, level, when).reference : topicCopy(topic, level, when).conclusion,
    }))
  const importantWindows = frame.kind === 'day' ? [] : (data.key_windows ?? [])
    .filter(window => window.signal !== '배경' && window.start >= context.calculation.period.start && (window.end || window.start) <= context.calculation.period.end && window.topics?.length)
    .map(window => ({ date: !window.end || window.start === window.end ? window.start : `${window.start}~${window.end}`, guidance: naturalWindowGuidance(window.signal, window.topics) })).slice(0, 3)
  return {
    periodKind: frame.kind, when, headline, summary: '',
    doTitle: '가장 좋은 흐름', cautionTitle: '가장 조심할 흐름', focusTitle: '중요 분야',
    bestFlow, cautionFlow,
    doItems: best.map(row => topicCopy(row.topic, row.level, when).conclusion),
    cautionItems: caution.map(row => topicCopy(row.topic, row.level, when).conclusion),
    focusTopics, referenceTopics, importantWindows,
    relationship: relationshipSummary(context, new Set(primary.map(row => row.topic)), frame.kind),
  }
}
