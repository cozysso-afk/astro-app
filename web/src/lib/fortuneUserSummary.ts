import type { AiInterpretationResponse, AiTopicInterpretation, FortuneStat, IntegratedApiResponse, PeriodKey } from '../appTypes'

type InterpretationData = NonNullable<AiInterpretationResponse['data']>
type FlowLevel = 'low' | 'steady' | 'high'
type PeriodKind = 'day' | 'week' | 'month' | 'year'

export type FortuneUserTopic = {
  topic: string
  conclusion: string
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

const RELATIONSHIP_TOPICS = new Set(['대인관계', '연애', '연락', '재회'])
const WORK_STUDY_TOPICS = new Set(['학업', '시험', '직장', '이직'])
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
        conclusion: low ? `${when}은 지출을 늘리기보다 꼭 필요한 돈부터 챙기는 편이 좋아.` : high ? `${when}은 예산을 정리하고 필요한 돈 문제를 처리하기 좋은 편이야.` : `${when} 금전 흐름은 무난한 편이니 계획한 범위 안에서 움직여.`,
        practice: '결제 전에 예산과 우선순위를 한 번 더 정리해.',
        observe: '예상하지 못한 지출이 생기는지, 들어오고 나가는 돈의 순서가 꼬이지 않는지 봐.',
        caution: '기분 전환용 소비나 급한 금전 결정은 미뤄.',
        reference: `${when}은 돈 문제를 크게 벌이기보다 평소 계획을 지키면 충분해.`,
      }
    case '학업':
      return {
        conclusion: low ? `${when}은 집중이 쉽게 흐트러질 수 있으니 목표를 작게 잡는 편이 좋아.` : high ? `${when}은 공부와 과제를 정리해서 진도를 내기 좋은 편이야.` : `${when}은 공부할 순서를 정해 차근차근 따라가면 무난해.`,
        practice: high ? '가장 중요한 과제부터 정하고 한 가지를 끝까지 마쳐.' : '공부할 분량을 작게 나눠 한 번에 하나씩 처리해.',
        observe: '앉아 있는 시간보다 실제로 끝낸 분량이 늘어나는지를 봐.',
        caution: '계획만 크게 세우고 여러 과제를 동시에 벌이지 마.',
        reference: `${when} 학업은 무리하게 진도를 늘리기보다 정한 분량을 지키는 쪽이 좋아.`,
      }
    case '시험':
      return {
        conclusion: low ? `${when}은 새로운 내용을 늘리기보다 아는 문제의 실수를 줄이는 편이 좋아.` : high ? `${when}은 문제를 풀고 부족한 부분을 점검하기 좋은 편이야.` : `${when} 시험 준비는 익숙한 범위를 다시 다지는 쪽이 무난해.`,
        practice: '틀린 문제와 헷갈리는 부분부터 짧게 다시 봐.',
        observe: '시간 안에 문제를 끝내는지, 같은 실수를 반복하는지를 살펴봐.',
        caution: '불안하다고 공부 범위를 갑자기 넓히진 마.',
        reference: `${when} 시험 준비는 새 계획보다 복습과 실수 정리에 무게를 둬.`,
      }
    case '직장':
      return {
        conclusion: low ? `${when}은 일이 뜻대로 빨리 풀리지 않을 수 있으니 요청과 마감을 먼저 정리해.` : high ? `${when}은 업무를 정리하고 필요한 협의를 진행하기 좋은 편이야.` : `${when} 업무는 맡은 일의 순서를 분명히 하면 무난하게 풀 수 있어.`,
        practice: '요청받은 일과 마감 순서를 적고 중요한 것부터 처리해.',
        observe: '말로 끝난 협의가 담당자와 일정까지 구체적으로 정해지는지를 봐.',
        caution: '책임 범위가 애매한 일을 바로 떠안지는 마.',
        reference: `${when} 직장에서는 새 일을 늘리기보다 현재 일정과 책임을 정리하는 게 좋아.`,
      }
    case '이직':
      return {
        conclusion: low ? `${when}은 이직 결론을 서두르기보다 조건을 비교하는 데 집중하는 편이 좋아.` : high ? `${when}은 이직 조건을 살피거나 필요한 대화를 시작해 볼 만해.` : `${when} 이직 문제는 가능성을 열어 두고 현실 조건부터 비교해.`,
        practice: '직무, 보상, 일정처럼 바꿀 수 없는 조건부터 적어봐.',
        observe: '관심 표현이 실제 제안과 구체적인 일정으로 이어지는지를 봐.',
        caution: '답답한 기분만으로 현재 자리를 급하게 정리하지 마.',
        reference: `${when} 이직은 결론보다 조건을 비교하는 정도로 참고해.`,
      }
    case '대인관계':
      return {
        conclusion: low ? `${when}은 말이 엇갈리기 쉬우니 상대 반응을 섣불리 단정하지 않는 편이 좋아.` : high ? `${when}은 필요한 사람과 대화를 풀어가기 좋은 편이야.` : `${when} 사람 관계는 무리하게 맞추기보다 적당한 거리를 지키면 무난해.`,
        practice: '중요한 말은 돌려 말하지 말고 짧고 분명하게 전해.',
        observe: '말투 하나보다 이후 태도와 약속을 지키는지를 봐.',
        caution: '한 번의 서운한 반응을 관계 전체의 결론으로 키우지 마.',
        reference: `${when} 대인관계는 필요한 말만 분명히 하고 반응을 천천히 보는 게 좋아.`,
      }
    case '연애':
      return {
        conclusion: low ? `${when} 연애는 서두르지 않는 편이 좋아.` : high ? `${when}은 마음을 표현하거나 만남을 구체화해 보기 좋은 편이야.` : `${when} 연애는 부담을 주지 않는 선에서 자연스럽게 반응을 주고받아.`,
        practice: '만나고 싶다면 막연하게 떠보지 말고 가벼운 약속을 제안해.',
        observe: '상대의 말보다 약속을 실제로 잡고 만남을 이어가는지를 봐.',
        caution: '호감 표현 하나만 보고 관계가 진전됐다고 단정하지 마.',
        reference: `${when} 연애는 큰 의미를 붙이기보다 상대의 꾸준한 행동을 보는 정도가 좋아.`,
      }
    case '연락':
      return {
        conclusion: low ? `${when} 연락은 한 번 가볍게 시작하되 반응이 애매하면 더 밀지 않는 편이 좋아.` : high ? `${when}은 먼저 연락하거나 대화를 이어가기 좋은 편이야.` : `${when} 연락은 짧고 편하게 시작해 상대의 속도에 맞춰가면 돼.`,
        practice: '먼저 연락한다면 용건을 짧고 분명하게 보내.',
        observe: '답장이 구체적인지, 대화가 이어지는지, 다음 연락이나 약속이 잡히는지를 봐.',
        caution: '답장이 늦거나 짧다고 바로 관계의 의미까지 확대해서 보진 마.',
        reference: `${when} 연락은 횟수보다 답장의 내용과 대화가 이어지는지를 보는 게 좋아.`,
      }
    case '재회':
      return {
        conclusion: low ? `${when}은 과거 감정보다 지금 실제로 다시 대화가 시작되는지를 보는 편이 좋아.` : high ? `${when}은 과거 인연과 대화를 다시 시작할 계기가 있는지 지켜볼 만해.` : `${when} 재회 문제는 추억보다 현재의 연락과 태도를 기준으로 봐.`,
        practice: '연락할 이유가 분명하다면 감정 확인보다 안부처럼 가볍게 시작해.',
        observe: '실제 재접촉이 있는지, 대화가 이어지는지, 이전 문제를 다르게 다루는지를 봐.',
        caution: '그리운 마음만으로 상대도 다시 시작할 준비가 됐다고 생각하진 마.',
        reference: `${when} 재회는 과거 감정보다 현재 연락과 행동이 생기는지를 기준으로 봐.`,
      }
    case '소식':
      return {
        conclusion: low ? `${when}은 기다리는 답이 늦어질 수 있으니 한 번에 결론 내리지 않는 편이 좋아.` : high ? `${when}은 기다리던 답이나 필요한 정보를 받아보기 좋은 편이야.` : `${when} 소식은 서두르지 말고 정해진 연락 순서를 기다려.`,
        practice: '기한이 지난 일만 짧게 다시 물어봐.',
        observe: '막연한 말이 아니라 날짜와 다음 단계가 구체적으로 오는지를 봐.',
        caution: '답이 늦다는 이유만으로 나쁜 결과를 먼저 단정하지 마.',
        reference: `${when} 소식은 확정된 답이 올 때까지 차분히 기다리는 편이 좋아.`,
      }
    case '컨디션':
      return {
        conclusion: low ? `${when}은 쉽게 지칠 수 있으니 일정을 너무 빡빡하게 잡지 않는 게 좋아.` : high ? `${when}은 몸 상태가 비교적 받쳐주니 중요한 일을 앞쪽에 두기 좋아.` : `${when} 컨디션은 무난하지만 쉬는 시간을 빼놓진 마.`,
        practice: low ? '중요한 일정 사이에 쉬는 시간을 두고 잠을 조금 더 챙겨.' : '몸이 가벼운 시간에 중요한 일을 먼저 끝내.',
        observe: '수면 뒤에도 피로가 남는지, 집중력이 평소보다 빨리 떨어지는지를 살펴봐.',
        caution: '피곤한 상태에서 일정을 빽빽하게 잡거나 무리해서 버티지 마.',
        reference: `${when} 컨디션은 수면과 피로 정도를 보면서 일정 강도를 조절해.`,
      }
    case '투자심리':
      return {
        conclusion: high ? `${when}은 매매하고 싶은 마음이 커질 수 있으니 느낌보다 계획을 먼저 봐.` : low ? `${when}은 시장 분위기에 휩쓸리기보다 차분하게 보기 쉬운 편이야.` : `${when} 투자 판단은 감정보다 미리 정한 기준을 따르는 게 좋아.`,
        practice: '매매 이유와 감당할 손실 범위를 먼저 적어.',
        observe: '계획보다 조급함이나 만회 심리가 결정을 끌고 가는지를 살펴봐.',
        caution: '분위기에 휩쓸려 계획에 없던 매매를 만들지 마.',
        reference: `${when}은 투자 심리를 따로 해석할 만큼 뚜렷한 신호가 없어.`,
      }
    case '수익실현':
      return {
        conclusion: high ? `${when}은 보유한 것을 정리할지 검토해 볼 만하지만 목표와 이유를 먼저 정해.` : low ? `${when}은 수익 실현을 서두르기보다 기존 계획을 지키는 편이 좋아.` : `${when} 수익 실현은 가격보다 처음 세운 기준에 맞는지부터 봐.`,
        practice: '목표 가격과 나눠서 정리할 기준을 미리 적어둬.',
        observe: '처음 세운 목표에 닿았는지, 보유 이유가 여전히 남아 있는지를 봐.',
        caution: '짧은 움직임만 보고 전부 정리하거나 더 욕심내지 마.',
        reference: `${when}은 수익 실현 시점을 따로 강조할 만한 신호가 뚜렷하지 않아.`,
      }
    case '신규진입':
      return {
        conclusion: high ? `${when}은 새로 들어갈 생각이 커질 수 있지만 조건이 맞는지부터 따져봐.` : low ? `${when}은 새로 들어가기보다 기다리면서 조건을 더 살피는 편이 좋아.` : `${when} 신규 진입은 가격과 손실 기준이 모두 맞을 때만 검토해.`,
        practice: '들어갈 가격과 틀렸을 때 나올 기준을 함께 정해.',
        observe: '가격만 끌리는지, 정한 조건과 위험 범위까지 맞는지를 봐.',
        caution: '놓칠까 봐 계획 없이 따라 들어가진 마.',
        reference: `${when}은 새로 들어갈 시점을 따로 잡을 만한 신호가 뚜렷하지 않아.`,
      }
    case '투자주의':
      return {
        conclusion: high ? `${when} 투자 쪽은 평소보다 더 보수적으로 보는 게 좋아.` : low ? `${when}은 별도 경계 신호가 두드러지지 않지만 안전하다는 뜻은 아니야.` : `${when} 투자에서는 기대 수익보다 감당할 손실을 먼저 봐.`,
        practice: '결정 전에 손실 한도와 중단 기준을 먼저 정해.',
        observe: '변동이 커지는지, 세운 원칙을 감정 때문에 바꾸는지를 살펴봐.',
        caution: '손실을 빨리 만회하려고 규모를 키우지 마.',
        reference: `${when}은 투자 위험을 특별히 더 경계할 신호가 뚜렷하진 않지만 안전을 보장하진 않아.`,
      }
    default:
      return {
        conclusion: `${when} ${topic}은 결과를 서두르지 말고 실제 변화가 생기는지를 지켜봐.`,
        practice: '할 일을 한 가지로 줄여 차근차근 진행해.',
        observe: '말보다 다음 행동이 구체적으로 이어지는지를 봐.',
        caution: '한 번의 반응으로 전체 결과를 단정하지 마.',
        reference: `${when}은 ${topic}을 따로 강조할 만한 흐름이 뚜렷하지 않아.`,
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
  if (labels.length === 2) return `${labels[0]}와 ${labels[1]}`
  return `${labels[0]}, ${labels[1]}와 ${labels[2]}`
}

function naturalWindowGuidance(signal: string, topics: string[]) {
  const focus = joinTopics(topics)
  if (!focus) return ''
  if (signal === '활용') return `${focus}에 힘을 써보기 좋아.`
  if (signal === '주의') return `${focus}를 서두르지 않는 편이 좋아.`
  return `${focus}의 반응을 보면서 속도를 조절해.`
}

function periodHeadline(
  frame: ReturnType<typeof frameFor>,
  focus: Array<{ topic: string; level: FlowLevel }>,
) {
  const relationship = focus.filter((row) => RELATIONSHIP_TOPICS.has(row.topic))
  const workStudy = focus.filter((row) => WORK_STUDY_TOPICS.has(row.topic))
  const relationWeak = relationship.some((row) => row.level === 'low')
  const workStudyStrong = workStudy.some((row) => row.level === 'high')
  const conditionWeak = focus.some((row) => row.topic === '컨디션' && row.level === 'low')
  const investmentRisk = focus.some((row) => row.topic === '투자주의' && row.level === 'high')

  if (frame.kind === 'day') {
    if (relationWeak) return '오늘은 관계에서 기대를 크게 하기보다 실제 연락과 약속이 이어지는지를 보는 편이 좋아.'
    if (workStudyStrong && relationship.length) return '오늘은 해야 할 일에 집중하고, 관계는 상대 반응을 보면서 천천히 움직이는 편이 좋아.'
    if (workStudyStrong) return '오늘은 공부나 업무를 먼저 정리하고 한 가지씩 끝내기 좋은 날이야.'
    if (conditionWeak) return '오늘은 무리해서 많이 해내기보다 일정의 강도를 낮추고 회복할 시간을 두는 게 좋아.'
    if (investmentRisk) return '오늘은 투자 결정을 서두르지 말고 위험부터 살피는 편이 좋아.'
  }
  if (frame.kind === 'week') {
    if (workStudyStrong && relationship.length) return '이번 주는 공부와 일정 정리가 우선이고, 관계는 상대 반응을 보면서 서두르지 않는 편이 좋아.'
    if (relationWeak) return '이번 주는 관계를 빨리 정하려 하기보다 연락과 약속이 실제로 이어지는지 지켜보는 편이 좋아.'
    if (workStudyStrong) return '이번 주는 공부와 업무의 순서를 정해서 밀고 나가기 좋은 편이야.'
    if (conditionWeak) return '이번 주는 일정을 빽빽하게 잡기보다 쉬는 시간을 남겨두는 편이 좋아.'
    if (investmentRisk) return '이번 주는 투자 기회를 좇기보다 손실 위험을 먼저 살피는 편이 좋아.'
  }
  if (frame.kind === 'month') {
    if (workStudyStrong && relationship.length) return '이번 달은 해야 할 일을 먼저 정리하고, 관계는 말보다 이어지는 행동을 보면서 천천히 판단해.'
    if (relationWeak) return '이번 달은 관계의 결론을 서두르기보다 연락과 만남이 꾸준히 이어지는지를 보는 편이 좋아.'
    if (workStudyStrong) return '이번 달은 공부와 업무 계획을 구체적으로 세워 진도를 내기 좋은 편이야.'
    if (conditionWeak) return '이번 달은 성과를 늘리기보다 생활 리듬과 회복 시간을 먼저 챙기는 게 좋아.'
    if (investmentRisk) return '이번 달은 투자 결정을 보수적으로 잡고 손실 기준을 먼저 세우는 편이 좋아.'
  }
  if (frame.kind === 'year') {
    if (workStudyStrong && relationship.length) return '올해는 해야 할 일의 기반을 다지는 데 힘을 쓰고, 관계는 실제 행동이 이어지는지를 천천히 봐.'
    if (relationWeak) return '올해 관계는 빠른 결론보다 꾸준한 연락과 행동이 이어지는지를 보는 편이 좋아.'
    if (workStudyStrong) return '올해는 공부와 업무의 목표를 구체적으로 세워 꾸준히 밀고 나가기 좋아.'
    if (conditionWeak) return '올해는 성과만 좇기보다 생활 리듬과 회복을 함께 챙겨야 해.'
    if (investmentRisk) return '올해 투자에서는 기회보다 위험 관리 원칙을 먼저 세우는 게 좋아.'
  }
  return focus[0] ? topicCopy(focus[0].topic, focus[0].level, frame.when).conclusion : `${frame.when}은 해야 할 일을 줄여 차근차근 움직이는 편이 좋아.`
}

function supportingSummary(focus: Array<{ topic: string; level: FlowLevel }>) {
  const relationshipWeak = focus.some((row) => RELATIONSHIP_TOPICS.has(row.topic) && row.level === 'low')
  if (relationshipWeak) return '호감 표현보다 답장의 내용과 약속이 실제 행동으로 이어지는지가 더 중요해.'
  if (focus.some((row) => WORK_STUDY_TOPICS.has(row.topic) && row.level === 'high')) return '해야 할 일을 먼저 정리하고, 한 가지씩 끝내는 데 힘을 써.'
  if (focus.some((row) => row.topic === '컨디션' && row.level === 'low')) return '몸이 처지면 계획을 줄이고 쉬는 시간을 먼저 챙겨.'
  if (focus.some((row) => INVESTMENT_TOPICS.has(row.topic))) return '투자 판단은 분위기보다 미리 정한 기준과 손실 범위를 따라가.'
  return focus[0] ? topicCopy(focus[0].topic, focus[0].level, '').observe.replace(/^\s+/, '') : '말보다 실제로 이어지는 행동을 기준으로 판단해.'
}

function relationshipSummary(
  data: InterpretationData,
  context: FortuneUserSummaryContext,
  focusNames: Set<string>,
): FortuneUserRelationship | undefined {
  if (!data.relationship_reading || !['연애', '연락', '재회'].some((topic) => focusNames.has(topic))) return undefined
  const stats = context.calculation.western.relationship_signals ?? {}
  const incomingLevel = flowLevel(stats['수신신호'])
  const outgoingLevel = flowLevel(stats['발신적합'])
  const reconnectionLevel = flowLevel(stats['과거인연접점'])
  const levels = new Set([incomingLevel, outgoingLevel, reconnectionLevel])
  const distinctDirections = levels.size > 1
  const summary = outgoingLevel === 'high' && incomingLevel !== 'high'
    ? '내가 먼저 연락하기 좋은 편이라고 해서 상대도 같은 마음이라는 뜻은 아니야.'
    : incomingLevel === 'low' || outgoingLevel === 'low'
      ? '관계 쪽은 말보다 실제 답장과 약속이 이어지는지를 보는 게 중요해.'
      : '관계 쪽은 대화를 이어가되 상대가 실제 행동으로 화답하는지까지 보는 게 좋아.'
  if (!distinctDirections) return { summary }
  return {
    summary,
    incoming: incomingLevel === 'high'
      ? '상대의 반응이 비교적 분명하게 돌아오는 편이야.'
      : incomingLevel === 'low'
        ? '상대 반응은 늦거나 애매할 수 있으니 답을 재촉하지 마.'
        : '상대 반응은 말투 하나보다 답장의 내용과 다음 행동을 함께 봐.',
    outgoing: outgoingLevel === 'high'
      ? '내가 먼저 가볍게 말을 꺼내기에는 괜찮은 편이야.'
      : outgoingLevel === 'low'
        ? '내가 먼저 움직여도 대화가 길게 이어지지 않을 수 있어.'
        : '먼저 연락한다면 짧고 분명하게 시작하는 편이 좋아.',
    reconnection: focusNames.has('재회') || reconnectionLevel !== 'steady'
      ? reconnectionLevel === 'high'
        ? '과거 인연은 실제 재접촉과 대화 재개가 생기는지를 지켜봐.'
        : reconnectionLevel === 'low'
          ? '과거 감정이 떠올라도 현재 연락이 없으면 재회 신호로 보진 마.'
          : '과거의 감정과 지금 상대가 보이는 행동을 나눠서 봐.'
      : undefined,
  }
}

export function buildFortuneUserSummary(data: InterpretationData, context: FortuneUserSummaryContext): FortuneUserSummary {
  const frame = frameFor(context.period, context.calculation.period.day_count)
  const priorityText = (data.priorities ?? []).join(' ')
  const normalized = context.topicEntries
    .map(([topic, interpretation], index) => ({ topic, interpretation, index, level: flowLevel(topicStat(context, topic)) }))
    .sort((a, b) => {
      const importance = (value: AiTopicInterpretation['importance']) => value === '핵심' ? 0 : value === '주목' ? 1 : 2
      const rank = importance(a.interpretation.importance) - importance(b.interpretation.importance)
      if (rank) return rank
      const aPriority = priorityText.includes(a.topic) ? 0 : 1
      const bPriority = priorityText.includes(b.topic) ? 0 : 1
      return aPriority - bPriority || a.index - b.index
    })
  const primaryRows = normalized.filter(({ interpretation }) => interpretation.importance === '핵심' || interpretation.importance === '주목')
  const selectedRows = (primaryRows.length ? primaryRows : normalized).slice(0, 3)
  const focusCopies = selectedRows.map((row) => ({ ...row, copy: topicCopy(row.topic, row.level, frame.when) }))
  const doItems = unique(focusCopies
    .filter(({ interpretation, level }) => Boolean(interpretation.action) || level !== 'steady')
    .map(({ copy }) => copy.practice), 2)
  const cautionItems = unique(focusCopies
    .filter(({ interpretation, level, topic }) => Boolean(interpretation.avoid) || level !== 'steady' || INVESTMENT_TOPICS.has(topic))
    .map(({ copy }) => copy.caution), 2)
  const usedCautions = new Set(cautionItems)
  const focusTopics = focusCopies.map(({ topic, interpretation, copy }) => ({
    topic,
    conclusion: copy.conclusion,
    observe: interpretation.reason || interpretation.evidence_refs?.length ? copy.observe : undefined,
    caution: !usedCautions.has(copy.caution) && interpretation.avoid ? copy.caution : undefined,
  }))
  const referenceTopics = normalized
    .filter(({ interpretation }) => interpretation.importance === '참고')
    .map(({ topic, level, interpretation }) => {
      const copy = topicCopy(topic, level, frame.when)
      const lowEvidence = !interpretation.evidence_refs?.length || interpretation.confidence === '낮음'
      return { topic, summary: lowEvidence ? copy.reference : copy.conclusion }
    })
  const importantWindows = frame.kind === 'day' ? [] : (data.key_windows ?? [])
    .filter((window) => window.signal !== '배경' && Boolean(window.start) && Boolean(window.topics?.length))
    .map((window) => ({
      date: !window.end || window.start === window.end ? window.start : `${window.start}~${window.end}`,
      guidance: naturalWindowGuidance(window.signal, window.topics),
    }))
    .filter((window) => window.guidance)
    .slice(0, 3)
  const focusForHeadline = focusCopies.map(({ topic, level }) => ({ topic, level }))
  const focusNames = new Set(selectedRows.map(({ topic }) => topic))

  return {
    periodKind: frame.kind,
    when: frame.when,
    headline: periodHeadline(frame, focusForHeadline),
    summary: supportingSummary(focusForHeadline),
    doTitle: frame.doTitle,
    cautionTitle: frame.cautionTitle,
    focusTitle: frame.focusTitle,
    doItems: doItems.length ? doItems : ['해야 할 일을 한두 가지로 줄여 순서대로 처리해.'],
    cautionItems: cautionItems.length ? cautionItems : ['반응이 애매한데도 결론을 서두르지 마.'],
    focusTopics,
    referenceTopics,
    importantWindows,
    relationship: relationshipSummary(data, context, focusNames),
  }
}
