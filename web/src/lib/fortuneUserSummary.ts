import type { AiInterpretationResponse, AiTopicInterpretation, FortuneDailyEvidence, FortuneStat, IntegratedApiResponse, PeriodKey } from '../appTypes'

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
  kind?: 'favorable' | 'caution' | 'mixed'
  semantic?: 'reconnection'
}

export type FortuneFlowCard = { topic: string; score: number; band: string; meaning: string }

export type FortuneUserRelationship = {
  summary: string
  incoming?: string
  outgoing?: string
  reconnection?: string
  incomingBand?: string
  outgoingBand?: string
  incomingTiming?: string
  outgoingTiming?: string
  reconnectionBand?: string
  reconnectionTiming?: string
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
  favorableCards: FortuneFlowCard[]
  cautionCards: FortuneFlowCard[]
  focusTopics: FortuneUserTopic[]
  referenceTopics: Array<{ topic: string; band: string; summary: string }>
  importantWindows: FortuneUserWindow[]
  relationship?: FortuneUserRelationship
}

export type FortuneUserSummaryContext = {
  focusTopics?: string[]
  verifiedNarrative?: boolean
  allowIntraday?: boolean
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

const FLOW_COPY: Record<string, [string, string]> = {
  금전: ['수입·지출 계획을 정리하기 좋음', '예상 밖 지출에 여유를 둘 것'],
  학업: ['집중해서 진도 내기 좋음', '새 진도보다 복습부터'],
  시험: ['배운 것을 꺼내 쓰기 수월함', '실수하기 쉬운 부분부터 점검'],
  직장: ['업무 요청과 협의에 힘이 실림', '일정과 책임 범위를 분명히'],
  이직: ['조건 검토와 대화에 유리', '조건이 불분명하면 결정 보류'],
  대인관계: ['대화와 조율에 힘이 실림', '의견 차이를 급히 결론 내지 말 것'],
  연애: ['호감과 만남을 이어가기 수월함', '관계 진전을 서두르지 말 것'],
  연락: ['안부·질문·약속을 먼저 꺼내보기', '먼저 연락한다면 짧고 구체적으로'],
  재회: ['대화 재개의 움직임에 주목', '추억과 지금 행동을 구분할 것'],
  소식: ['새 소식과 제안을 살펴볼 때', '전해 들은 말은 원문부터'],
  컨디션: ['일정에 힘을 쓰기 좋은 편', '일정 사이에 쉴 틈을 둘 것'],
  투자심리: ['관심이 커질 때, 매수 근거는 별도', '불안 때문에 판단을 바꾸지 말 것'],
  수익실현: ['청산 조건을 검토할 때, 수익 보장 아님', '목표와 손실 한도를 먼저 점검'],
  신규진입: ['진입 조건을 검토할 때, 매수 권유 아님', '급한 진입보다 조건 점검'],
  투자주의: ['뚜렷한 경계가 적어도 안전 보장 아님', '위험 노출과 손실 한도를 점검'],
}

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
        conclusion: low ? `${when} 대화를 시작하거나 이어가는 데 힘이 덜 실려 있어. 먼저 연락한다면 안부나 질문 한 가지부터 짧게 꺼내봐.` : high ? `${when} 안부를 묻거나 질문하고 약속을 잡는 대화에 힘이 실려 있어. 새 사람에게 첫 인사를 하거나 지인에게 소개를 부탁하는 것도 포함해.` : `${when} 연락은 평소 속도로 주고받는 정도가 좋아. 연락하고 싶은 일이 있다면 가벼운 안부나 질문으로 시작해.`,
        practice: '만나고 싶은 사람에게는 가능한 날짜를, 소개가 필요하면 지인에게 소개 의사를 물어봐. 업무 문의라면 궁금한 점 한 가지를 적어. 지금 연락할 일이 없다면 넘겨도 돼.',
        observe: '대화 중이라면 답장 속도 하나보다 질문에 답하는지, 다음 대화나 약속으로 이어지는지를 봐.',
        caution: '점수만으로 특정인의 연락이나 연애 감정을 예측하지 않아. 공식 결과 발표 여부는 이 점수로 판단하지 않아.',
        reference: `${when} 연락은 안부, 첫 인사, 소개 부탁, 약속 잡기처럼 말을 주고받는 흐름이야. 특정인이 먼저 연락할지는 아래 수신 흐름과 별도로 읽어.`,
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

// The second sentence explains the scope of the existing band, not a new prediction.
function depthFor(topic: string, level: FlowLevel): string {
  const copy: Record<string, [string, string, string]> = {
    금전: ['들어올 돈을 미리 쓸 여유로 잡기보다, 이미 정해진 지출을 감당할 순서를 세워봐.', '돈을 늘릴 기회보다 현재 예산을 얼마나 편하게 운영하는지가 중심이야.', '새 수입을 보장하는 흐름은 아니지만, 미뤄둔 정산이나 예산 조정에 집중할 만해.'],
    학업: ['한꺼번에 이해하려고 붙들기보다 막힌 부분을 좁혀야 진척을 느끼기 쉬워.', '새로운 공부법을 찾기보다 익숙한 방식으로 끝낼 분량을 만드는 데 의미가 있어.', '공부량을 무작정 늘리기보다, 어려워서 미뤄둔 단원 하나를 풀어내는 데 이 힘을 써봐.'],
    시험: ['아는 내용도 급하게 꺼내면 놓칠 수 있으니, 정확도를 먼저 챙겨.', '실전 감각은 풀이 속도와 정답을 함께 보면서 다듬는 편이 좋아.', '합격을 예고하는 점수는 아니야. 배운 내용을 시간 안에 꺼내 쓰는 연습에 활용해.'],
    직장: ['성과를 더 내려고 일을 늘리면 요청과 책임이 뒤섞일 수 있어.', '새 일을 벌이기보다 진행 중인 업무를 마무리하는 쪽에 무게를 둬.', '바로 성과가 확정된다는 뜻보다는, 필요한 협의와 다음 단계를 구체화할 여지가 있다는 쪽이야.'],
    이직: ['이동 자체보다 지금 제안에서 빠진 조건이 무엇인지 살피는 단계로 봐.', '이직 여부를 한 번에 결정하기보다 비교할 조건을 확보하는 데 초점을 둬.', '합격이나 이동 확정과는 달라. 관심이 실제 직무와 보상 이야기로 발전하는지 볼 때야.'],
    대인관계: ['의견이 다를 때는 상대의 의도보다 서로 이해한 내용부터 맞추는 게 중요해.', '많은 사람에게 맞추기보다 필요한 관계에 적당한 힘을 쓰는 쪽이야.', '누구와도 잘 맞는다는 뜻은 아니야. 서로 원하는 조건을 말로 꺼내고 접점을 찾는 데 활용해.'],
    연애: ['감정이 없다는 결론보다는, 호감이 관계를 바꾸는 행동까지 이어지는지 더 천천히 볼 때야.', '관계의 이름을 정하기보다 서로 편안한 만남의 속도를 알아가는 쪽에 가까워.', '표현할 여지가 커져도 상대의 마음까지 확정되지는 않아. 함께 시간을 쓰려는 의지가 중요한 구분점이야.'],
    연락: ['연락하고 싶다면 안부나 질문 한 가지로 시작해. 약속을 잡으려면 가능한 날짜를 함께 말해.', '연락의 활성도만으로 보낼 사람이나 메시지 종류가 정해지지는 않아.', '내가 먼저 보내는 흐름과 다른 쪽에서 오는 흐름은 다를 수 있어. 두 방향을 나눠 읽어.'],
    재회: ['지난 감정이 남아 있는 것과 다시 관계를 책임질 준비가 된 것은 달라.', '다시 닿는 계기가 생겨도 이전 문제가 달라졌는지는 별도로 봐야 해.', '재접촉의 계기와 관계 회복은 다른 단계야. 이번에는 무엇을 다르게 할 수 있는지가 중요해.'],
    소식: ['기다리는 일이 전부 멈췄다는 뜻은 아니야. 답을 받을 기한과 다음 절차를 나눠서 봐.', '확정된 정보와 아직 검토 중인 말을 구분해두면 기다림에 덜 흔들릴 수 있어.', '좋은 결과를 보장하기보다, 새로운 정보가 들어왔을 때 다음 판단을 준비하는 흐름으로 봐.'],
    컨디션: ['건강 상태를 진단하는 해석은 아니야. 실제 몸이 보내는 피로 신호에 맞춰 일정의 강도를 낮춰.', '처음부터 끝까지 같은 속도를 내기보다 집중과 휴식을 번갈아 배치해.', '해야 할 일을 모두 몰아넣기보다는 가장 힘이 드는 일에 체력을 먼저 배분해.'],
    투자심리: ['관심이 식거나 불안해지는 감정과 실제 보유 조건의 변화를 분리해서 봐.', '매매 욕구보다 기존 판단이 유지되는지를 살필 때야.', '관심이 커지는 흐름이지 가격 상승을 뜻하지 않아. 마음이 급해질수록 선택 근거는 따로 적어둬.'],
    신규진입: ['기회를 놓친다는 생각보다 진입 조건을 충족했는지가 먼저야.', '진입 여부는 이 해설이 아니라 실제 조건과 감당할 손실로 결정해야 해.', '새 기회에 눈이 가는 때로 읽되, 종목이나 가격의 유리함을 보장하지는 않아.'],
    수익실현: ['정리하고 싶은 마음과 실제 청산 조건을 나눠 살펴봐.', '수익 여부와 청산 결정의 적절함을 같은 뜻으로 읽지 마.', '청산을 검토할 주제가 두드러질 뿐, 수익이 난다거나 팔아야 한다는 신호는 아니야.'],
    투자주의: ['경계 표시가 약해도 시장 위험이 줄었다고 볼 수는 없어.', '손익 기대보다 위험을 얼마나 감당할 수 있는지 돌아보는 쪽이야.', '가격 하락을 예고하는 해석은 아니야. 불확실한 조건과 감정적인 결정에 더 여유를 둘 때로 봐.'],
  }
  return copy[topic]?.[level === 'low' ? 0 : level === 'high' ? 2 : 1] ?? ''
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
  // Explain the strongest existing signals once per direction, not one repeated
  // template per planet. Keep conflicting directions separate and leave raw data intact.
  const signals = linked.map(({ evidence }) => {
    const names = unique([planetName(evidence.transit), planetName(evidence.target)].filter(Boolean), 2)
    if (!names.length) return null
    const subject = names.length === 2 ? `${names[0]}${particle(names[0], '과', '와')} ${names[1]}` : names[0]
    const aspect = evidence.aspect ? ASPECT_WORDING[evidence.aspect] : undefined
    const source = aspect && names.length === 2 ? `${subject}${particle(subject, '이', '가')} ${aspect}` : `${subject}의 움직임`
    const value = evidence.contribution
    // contribution is unsigned activation; polarity alone carries direction.
    const signed = typeof evidence.polarity === 'number' && Number.isFinite(evidence.polarity) ? Math.sign(evidence.polarity) : null
    return { source, signed, strength: typeof value === 'number' && Number.isFinite(value) ? Math.abs(value) : 0 }
  }).filter((s): s is NonNullable<typeof s> => s !== null).sort((a, b) => b.strength - a.strength)
  const meaning: Record<string, string> = { 학업: '새 내용을 이해하고 집중하는 데', 시험: '배운 것을 꺼내 쓰는 데', 직장: '업무를 협의하고 처리하는 데', 이직: '변화를 검토하고 조건을 조율하는 데', 대인관계: '서로 의견을 주고받는 데', 연애: '호감을 나누고 거리를 좁히는 데', 연락: '말을 꺼내고 대화를 이어가는 데', 재회: '끊겼던 대화의 접점을 찾는 데', 컨디션: '힘을 쓰고 회복하는 데', 금전: '돈의 흐름을 정리하는 데', 소식: '새 정보를 받아 판단하는 데' }
  const area = meaning[topic] ?? `${topic}을 판단하는 데`
  const readable: string[] = []
  for (const sign of Array.from(new Set(signals.map(s => s.signed))).slice(0, 2)) {
    const sources = unique(signals.filter(s => s.signed === sign).map(s => s.source), 2)
    const source = sources.length > 1 ? `${sources[0]}와 ${sources[1]}가 선택 기간에 관찰돼` : `${sources[0]} 때문에`
    readable.push(sign === 1 ? `${source} ${area} 힘이 실려.`
      : sign === -1 ? `${source} ${area} 마찰이나 부담이 생기기 쉬워.`
      : `${sources.join(', ')} 신호는 보이지만, 이 신호만으로 유리하거나 불리하다고 단정하기는 어려워.`)
  }
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
  const signs = new Set(signals.map(s=>s.signed))
  if(signs.has(1)&&signs.has(-1)) readable.push(`선택 기간에는 ${topic}에 힘을 보태는 움직임과 제동을 거는 움직임이 모두 있어. 수월해지는 부분이 있어도 곧바로 결과까지 이어진다고 읽지 않고, 진행 중 어디서 조건을 맞춰야 하는지 구분하는 게 중요해.`)
  const depth = evidenceDepth(linked.map(row => row.evidence), topic)
  return [...readable, depth].filter(Boolean).join(' ')
}
function relationshipSummary(context: FortuneUserSummaryContext, important: Set<string>, kind: PeriodKind): FortuneUserRelationship | undefined {
  if (!important.has('연락') && !important.has('재회')) return undefined
  const stats = context.calculation.western.relationship_signals ?? {}
  const incoming = Number.isFinite(stats['수신신호']?.average) ? stats['수신신호'] : undefined
  const outgoing = Number.isFinite(stats['발신적합']?.average) ? stats['발신적합'] : undefined
  const incomingLevel = flowLevel(incoming)
  const outgoingLevel = flowLevel(outgoing)
  const band = (stat: FortuneStat | null | undefined) => !stat ? '정보 부족' : flowLevel(stat) === 'low' ? '약함' : flowLevel(stat) === 'high' ? '강함' : '보통'
  const timing = (stat: FortuneStat | null | undefined) => {
    if (!stat || kind === 'day' || !stat.spread) return undefined
    const point = flowLevel(stat) === 'low' ? stat.caution_days?.[0] : stat.best_days?.[0]
    return point && point.date >= context.calculation.period.start && point.date <= context.calculation.period.end ? point.date : undefined
  }
  return {
    summary: '수신은 다른 쪽에서 오는 연락, 발신은 내가 먼저 말을 꺼내는 흐름이야. 특정 상대가 있다는 뜻은 아니며, 공식 발표 여부와도 구분해.',
    incomingBand: band(incoming), outgoingBand: band(outgoing),
    reconnectionBand: band(stats['과거인연접점']), reconnectionTiming: timing(stats['과거인연접점']),
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
    const weighted = (row: typeof a) => strength(row)
      + (2 - importance(row.interpretation.importance)) * 3
      + Math.min(row.support, 4)
    return weighted(b) - weighted(a) || b.support - a.support || a.priority - b.priority || a.topic.localeCompare(b.topic, 'ko')
  }
  const primary = normalized.filter(row => importance(row.interpretation.importance) < 2)
  // Positive and weak signals are independent lists. A neutral score is not invented into a favorable signal.
  const eligible = normalized.filter(row => importance(row.interpretation.importance) < 2 || row.support > 0)
  const bestCandidates = eligible.filter(row => row.favorable !== null && row.favorable >= 55 && row.topic !== '투자주의').sort(rank('best'))
  const cautionCandidates = eligible.filter(row => row.favorable !== null && row.favorable <= 45).sort(rank('caution'))
  const best = bestCandidates.slice(0, 2)
  const caution = cautionCandidates.slice(0, 2)
  const selected = context.focusTopics ? normalized.filter(r=>context.focusTopics!.includes(r.topic)).sort((a,b)=>context.focusTopics!.indexOf(a.topic)-context.focusTopics!.indexOf(b.topic)) : [...eligible].sort(rank('salience')).slice(0, 3)
  const bestFlow = best.map(row => row.topic)
  const cautionFlow = caution.map(row => row.topic)
  const when = frame.when
  const headline = best.length && caution.length
    ? `${when}${particle(when, '은', '는')} ${joinTopics(bestFlow)}에 힘을 쓰기 괜찮지만, ${joinTopics(cautionFlow)} 쪽은 속도를 낮추는 편이 좋아.`
    : best.length ? `${when}${particle(when, '은', '는')} ${joinTopics(bestFlow)}에 힘을 쓰기 좋은 편이야. 이쪽부터 계획을 잡아봐.`
    : caution.length ? `${when}${particle(when, '은', '는')} ${joinTopics(cautionFlow)} 쪽의 기대를 낮추는 편이 좋아. 그 밖에 크게 밀어줄 분야는 뚜렷하지 않아.`
    : `${when}${particle(when, '은', '는')} 좋거나 조심할 분야가 뚜렷하게 갈리지 않아. 평소 계획을 유지하면서 변화를 지켜봐.`
  const directions = relationshipSummary(context, new Set(normalized.map(row => row.topic)), frame.kind)
  const focusTopics = selected.map(({ topic, interpretation, level, score }) => {
    const copy = topicCopy(topic, level, when)
    const narrative = context.verifiedNarrative && interpretation.evidence_refs?.length ? interpretation : undefined
    const clean = (value?: string) => value && value.trim().length >= 12 && !/\b[WST]:|\borb\b|evidence_refs|CALCULATED_DATA/.test(value) ? value.trim() : undefined
    return { topic, conclusion: score === null ? `${topic}은 계산 정보가 부족해 방향을 정하기 어려워.` : topic === '연락' && directions ? contactReading(directions) : clean(narrative?.verdict) ?? `${copy.conclusion} ${depthFor(topic, level)}`, reason: clean(narrative?.reason) ?? reasonFor(data, context, topic, interpretation, level),
      timing: periodProgression(context.calculation, topic, frame.kind) ?? topicTiming(context, topic, level, frame.kind), action: topic === '연락' && directions ? (directions.outgoingBand === '강함' ? '먼저 전할 말이 있다면 용건과 질문을 분명히 해봐. 기다리는 연락이라면 수신 흐름을 기준으로 읽어.' : directions.outgoingBand === '약함' ? '답을 재촉하거나 여러 번 보내기보다 필요한 말만 정리해. 기다리는 동안의 무응답을 관계의 최종 결론으로 단정하지는 마.' : '기다리는 연락과 내가 보낼 연락을 나눠 생각해. 먼저 보낼 필요가 있을 때만 짧고 명확하게 전해.') : clean(narrative?.action) ?? copy.practice, observe: realLifeDepth(topic) || copy.observe,
      caution: clean(narrative?.avoid) ?? (interpretation.avoid ? copy.caution : undefined) }
  })
  const referenceTopics = normalized.filter(row => !selected.some(selectedRow => selectedRow.topic === row.topic))
    .sort(rank('salience')).map(({ topic, level, interpretation }) => ({
      topic, band: topicStat(context, topic)?.band ?? '정보 부족',
      summary: importance(interpretation.importance) === 2 && !normalized.find(row => row.topic === topic)?.support
        ? topic === '투자주의' ? '뚜렷한 신호가 적어도 안전을 보장하진 않아.' : '별도로 참고할 신호가 뚜렷하지 않아.'
        : (FLOW_COPY[topic]?.[level === 'low' ? 1 : 0] ?? '평소 계획 유지'),
    }))
  const windowTopics = [...new Map([...selected, ...best, ...caution].map(row => [row.topic, row])).values()]
  const importantWindows: FortuneUserWindow[] = frame.kind === 'day' ? context.allowIntraday ? (context.calculation.western.detail_days ?? [])
    .filter(day => day.date === context.calculation.period.start)
    .flatMap(day => windowTopics.flatMap(row => {
      const detail = day.topics[row.topic]
      return (['favorable', 'caution'] as const).flatMap(kind => {
        const inverse = row.topic === '투자주의'
        const point = (kind === 'caution') !== inverse ? detail?.caution_window : detail?.best_window
        if (!point || !/^\d{2}:\d{2}$/.test(point.start) || !/^\d{2}:\d{2}$/.test(point.end) || point.start >= point.end) return []
        if (kind === 'favorable' && inverse) return []
        return [{ date: `${point.start}–${point.end}`, kind, semantic: row.topic === '재회' ? 'reconnection' as const : undefined, guidance: `${row.topic} · ${FLOW_COPY[row.topic]?.[kind === 'caution' ? 1 : 0] ?? '흐름 살펴보기'}` }]
      })
    })).slice(0, 8) : [] : (data.key_windows ?? [])
    .filter(window => window.signal !== '배경' && window.start >= context.calculation.period.start && (window.end || window.start) <= context.calculation.period.end && window.topics?.length)
    .map(window => ({ date: !window.end || window.start === window.end ? window.start : `${window.start}~${window.end}`, kind: window.signal === '활용' ? 'favorable' as const : window.signal === '주의' ? 'caution' as const : 'mixed' as const, semantic: window.topics.length === 1 && window.topics[0] === '재회' ? 'reconnection' as const : undefined, guidance: naturalWindowGuidance(window.signal, window.topics) })).slice(0, 6)
  return {
    periodKind: frame.kind, when, headline, summary: (frame.kind === 'day' ? '하루 안의 선택에 초점을 맞춰 읽어봐. 다른 날까지 같은 흐름으로 이어진다고 보지는 않아.' : frame.kind === 'week' ? '주간의 큰 방향부터 잡고, 아래 시기에 맞춰 중요한 일을 나눠 배치해봐.' : frame.kind === 'month' ? '한 달을 같은 속도로 보내기보다, 힘을 쓸 때와 여유를 둘 때를 나눠서 읽어봐.' : '올해 전체의 방향과 개별 시기는 구분해봐. 큰 계획은 유지하되 구간마다 힘을 조절하는 쪽이야.'),
    doTitle: '가장 좋은 흐름', cautionTitle: '가장 조심할 흐름', focusTitle: '중요 분야',
    bestFlow, cautionFlow,
    favorableCards: bestCandidates.map(row => ({ topic: row.topic, score: row.score!, band: topicStat(context, row.topic)?.band ?? '보통', meaning: FLOW_COPY[row.topic]?.[0] ?? '흐름에 맞춰 계획을 진행해' })),
    cautionCards: cautionCandidates.map(row => ({ topic: row.topic, score: row.score!, band: row.topic === '투자주의' ? '주의' : topicStat(context, row.topic)?.band ?? '약함', meaning: FLOW_COPY[row.topic]?.[1] ?? '속도를 낮추는 편이 좋아' })),
    doItems: best.map(row => topicCopy(row.topic, row.level, when).conclusion),
    cautionItems: caution.map(row => topicCopy(row.topic, row.level, when).conclusion),
    focusTopics, referenceTopics, importantWindows,
    relationship: relationshipSummary(context, new Set([...primary, ...selected, ...best, ...caution].map(row => row.topic)), frame.kind),
  }
}

// These are translations of linked symbols, never new evidence or score inputs.
const SYMBOLS: Record<string, [string, string]> = {
  Sun: ['태양','내가 중요하게 여기는 목표와 주도권'], Moon: ['달','순간의 감정 반응과 편안함'],
  Mercury: ['수성','생각을 정리하고 말을 주고받는 방식'], Venus: ['금성','호감과 조화를 표현하는 방식'],
  Mars: ['화성','먼저 행동하는 추진력과 부딪히는 지점'], Jupiter: ['목성','선택의 폭과 기대를 넓히는 힘'],
  Saturn: ['토성','지켜야 할 약속과 현실적인 부담'], Uranus: ['천왕성','익숙한 방식에서 벗어나는 변화'],
  Neptune: ['해왕성','기대와 상상이 실제 상황에 겹치는 지점'], Pluto: ['명왕성','몰입과 주도권을 둘러싼 긴장'],
  'True Node': ['교점','관계와 선택이 맞물리는 지점'], 'North Node': ['교점','관계와 선택이 맞물리는 지점'],
}
const LIFE: Record<string, [string,string]> = {
  금전:['실제로 들어올 돈과 이미 정해진 지출을 나눠 볼 수 있어.','기분이 놓인다는 이유로 아직 받지 않은 돈까지 예산에 넣지는 마.'],
  학업:['같은 시간을 써도 이해가 이어지는 단원과 자꾸 막히는 단원이 갈리는지 살펴봐.','집중이 잘되는 느낌과 문제를 혼자 풀 수 있는지는 별개야.'],
  시험:['알던 내용을 제한 시간 안에 꺼내 쓰는 과정에서 이 흐름을 살펴볼 수 있어.','익숙한 문제라는 느낌만으로 조건을 건너뛰면 실수가 남을 수 있어.'],
  직장:['업무 요청이 구체적인지, 책임과 마감에 서로 동의하는지에서 차이가 드러날 수 있어.','대화가 원만했다는 것과 업무 부담을 공평하게 나눴다는 것은 달라.'],
  이직:['관심 있는 자리의 역할과 조건을 묻고 답하는 과정에 대입해서 읽어봐.','대화가 이어져도 채용이나 이동이 확정됐다고 보지는 않아.'],
  대인관계:['여럿을 만나는 횟수보다 의견 차이를 좁히고 다음 약속을 정하는 과정에 대입해 봐.','친절한 반응을 합의나 신뢰가 완성됐다는 뜻으로 확대하지는 마.'],
  연애:['호감 표현 뒤에 구체적인 만남이나 서로를 위한 시간이 이어지는지가 현실의 단서야.','끌림을 느끼는 것과 관계를 진전시키기로 합의하는 것은 다른 단계야.'],
  연락:['실제 연락이 있다면 필요한 정보를 주고받았는지가 중요해. 아직 연락할 일이 없다면 관찰할 메시지가 있다고 가정하지 않아.','내가 연락하기 수월하다는 신호가 특정인의 감정이나 공식 결과 통보를 대신하지는 않아.'],
  재회:['실제 재접촉이 생기면 이전에 멈췄던 문제를 다른 방식으로 이야기할 수 있는지를 살펴봐.','다시 말을 시작하는 것만으로 관계가 회복됐다고 판단하지는 마.'],
  소식:['전해 들은 말이 공식 안내나 구체적인 다음 절차로 이어지는지를 살펴봐.','소식이 많다는 것과 원하는 결과가 확정됐다는 것은 달라.'],
  컨디션:['잠을 잔 뒤 회복되는지, 같은 일정에도 피로가 빨리 쌓이는지 실제 몸 상태와 함께 읽어봐.','이 점수로 건강 상태를 진단하거나 통증을 가볍게 넘기지는 마.'],
  투자심리:['매수하고 싶은 마음이 커지는 때에는 처음 정한 판단 기준과 지금 판단을 비교해 봐.','자신감이 높아져도 수익 가능성이 높아졌다는 뜻은 아니야.'],
  수익실현:['미리 정한 목표와 실제 수익, 주문 가능한 조건을 비교하는 데 활용해.','익절을 생각하기 좋은 흐름과 가격이 목표에 도달하는 것은 별개야.'],
  신규진입:['관심이 생겨도 진입 조건과 감당할 손실을 먼저 문장으로 정리해.','새 기회처럼 보여도 이 점수만으로 매수를 결정하지는 마.'],
  투자주의:['손실을 감당할 범위와 포지션이 한쪽에 몰려 있는지를 먼저 점검해.','주의 점수가 낮아도 손실 위험이 사라지는 것은 아니야.'],
}
export function evidenceDepth(evidence: FortuneDailyEvidence[], topic: string): string {
  const ordered = [...evidence].sort((a,b)=>Math.abs(b.contribution ?? 0)-Math.abs(a.contribution ?? 0))
  const keys = [...new Set(ordered.flatMap(e=>[e.transit,e.target]).filter((key):key is string=>Boolean(key && (SYMBOLS[key] || Object.values(SYMBOLS).some(([ko])=>ko===key)))))].slice(0,2)
  const meanings=keys.map(key=>SYMBOLS[key] ?? Object.values(SYMBOLS).find(([ko])=>ko===key)!)
  if(!meanings.length) return ''
  const translation=meanings.map(([name,meaning])=>`${name}${particle(name, '은', '는')} ${meaning}`).join(', ')
  return `${translation}을 읽는 단서야. ${LIFE[topic]?.[1] ?? '이 신호만으로 실제 사건이나 결과를 확정하지는 않아.'}`
}
export function realLifeDepth(topic:string):string { return LIFE[topic]?.[0] ?? '' }

// Group only existing scores for presentation. Never mutate them or fill missing dates.
export function periodProgression(calculation:Pick<IntegratedApiResponse, 'period' | 'western'>, topic:string, kind:PeriodKind):string | undefined {
  if(kind==='day') return undefined
  const polarity=topic==='투자주의'?-1:1
  if(kind==='year') {
    const months=(calculation.western.months ?? []).filter(m=>m.start>=calculation.period.start && m.end<=calculation.period.end && Number.isFinite(m.topics?.[topic]?.average))
    if(months.length<2) return undefined
    const sorted=[...months].sort((a,b)=>polarity*(b.topics[topic]!.average-a.topics[topic]!.average))
    if(Math.abs(sorted[0].topics[topic]!.average-sorted.at(-1)!.topics[topic]!.average)<5) return `${topic}은 확인된 월별 흐름에서 큰 강약 차이가 없어. 특정 달에 몰기보다 연중 유지할 계획을 세우는 쪽으로 읽어.`
    return `올해는 ${sorted[0].start}~${sorted[0].end}의 ${topic} 흐름이 상대적으로 수월하고, ${sorted.at(-1)!.start}~${sorted.at(-1)!.end}에는 속도를 조절하는 구성이야. 한 해의 평균보다 이 월별 차이를 장기 일정에 반영해.`
  }
  const start=Date.parse(calculation.period.start+'T00:00:00Z'), end=Date.parse(calculation.period.end+'T00:00:00Z')
  const days=Math.round((end-start)/86400000)+1
  if(!Number.isFinite(days)||days<2) return undefined
  const rows=[...new Map((calculation.western.daily_scores??[]).filter(d=>d.date>=calculation.period.start && d.date<=calculation.period.end && Number.isFinite(d.scores?.[topic])).map(d=>[d.date,d])).values()].sort((a,b)=>a.date.localeCompare(b.date))
  if(rows.length<Math.ceil(days*.6)) return undefined
  const groups=new Map<number,typeof rows>()
  for(const row of rows){const offset=Math.round((Date.parse(row.date+'T00:00:00Z')-start)/86400000);const index=kind==='week'?Math.min(2,Math.floor(offset*3/days)):Math.floor(offset/7);groups.set(index,[...(groups.get(index)??[]),row])}
  const phases=[...groups].filter(([,rs])=>rs.length>=2).map(([index,rs])=>({index,start:rs[0].date,end:rs.at(-1)!.date,score:rs.reduce((n,r)=>n+r.scores[topic]!,0)/rs.length}))
  if(phases.length<2) return undefined
  const best=[...phases].sort((a,b)=>polarity*(b.score-a.score))[0], weak=[...phases].sort((a,b)=>polarity*(a.score-b.score))[0]
  if(Math.abs(best.score-weak.score)<5) return `${topic}은 ${kind==='week'?'주 초부터 후반까지':'확인된 주별 구간 사이에'} 큰 강약 차이가 없어. 하루의 작은 변화보다 꾸준히 이어가는 쪽에 무게를 둬.`
  if(kind==='week') return `${topic}은 이번 주 ${['초반','중반','후반'][best.index]}(${best.start}~${best.end})이 비교적 수월하고, ${['초반','중반','후반'][weak.index]}(${weak.start}~${weak.end})에는 속도를 조절할 필요가 있어.`
  return `${topic}은 이번 달 ${best.start}~${best.end} 구간에 힘이 실리고 ${weak.start}~${weak.end}에는 상대적으로 힘이 덜 실려. 한 달 내내 같은 속도로 밀기보다 주별로 일정 강도를 나눠.`
}

/** A directional conclusion; an overall contact score cannot answer both questions. */
export function contactReading(value: FortuneUserRelationship): string {
  const incoming = value.incomingBand, outgoing = value.outgoingBand
  const receive = incoming === '강함' ? '연락을 받는 쪽의 신호가 상대적으로 두드러져.' : incoming === '약함' ? '기다리는 연락이 먼저 들어오는 쪽의 신호는 약한 편이야.' : incoming === '보통' ? '연락을 받는 쪽은 뚜렷한 강세나 약세가 없어.' : '먼저 연락이 올 흐름은 독립 계산 정보가 부족해.'
  const send = outgoing === '강함' ? '내가 먼저 말을 꺼내는 흐름은 비교적 수월하게 잡혀 있어.' : outgoing === '약함' ? '내가 먼저 대화를 밀어붙이는 흐름도 강하지 않아.' : outgoing === '보통' ? '내가 먼저 말을 꺼내는 쪽은 중간 흐름이야.' : '내가 먼저 보내기 좋은지도 계산 정보가 부족해.'
  const contrast = incoming === '약함' && outgoing === '강함' ? '즉, 내가 연락하기 괜찮다는 말이 상대에게서 연락이 온다는 뜻은 아니야.' : incoming === '강함' && outgoing === '약함' ? '오는 연락을 살피는 흐름과 내가 먼저 재촉하는 흐름이 서로 달라.' : '이 흐름은 특정인의 연락 여부나 속마음을 확정하지 않아.'
  return `${receive} ${send} ${contrast}`
}
