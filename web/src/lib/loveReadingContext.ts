import type { FortuneStat, IntegratedApiResponse } from '../appTypes'
import type { FortuneUserSummary } from './fortuneUserSummary'

export type LoveStatus = 'single' | 'flirting' | 'intimate_uncommitted' | 'couple'

export const LOVE_STATUS_OPTIONS: Array<{ value: LoveStatus; label: string }> = [
  { value: 'single', label: '싱글 · 새 인연' },
  { value: 'flirting', label: '썸 · 알아가는 중' },
  { value: 'intimate_uncommitted', label: '친밀하지만 관계 미정' },
  { value: 'couple', label: '커플 · 현재 관계' },
]

export function lovePromptContext(status: LoveStatus) {
  const context = status === 'single'
    ? '싱글의 연애운이다. 현재 연인이 있다고 전제하지 말고, 연애를 연락운으로 축약하지 않는다. 싱글 안에서도 새 만남을 원하거나 원하지 않는 등 여러 상황을 전제한다. 새 사람을 만날 여지, 호감이 생겼을 때의 속도, 소개·모임·첫 만남, 내가 관계를 받아들일 준비를 중심으로 읽는다. 특정 상대의 존재나 감정을 만들지 않는다. 과거 인연은 독립 재접점 근거가 있을 때만 별도로 다룬다.'
    : status === 'flirting'
      ? '썸·알아가는 상대가 있는 연애운이다. 연락 빈도만 반복하지 말고 상호 질문, 다음 약속, 실제 만남, 관계 기대가 맞는지를 중심으로 읽는다. 친절이나 대화를 교제 합의로 단정하지 않는다.'
      : status === 'intimate_uncommitted'
        ? '신체적 친밀감은 있으나 연인 관계로 합의하지 않은 상황의 연애운이다. 친밀감과 관계 약속을 분리하고, 원하는 관계, 만남 전후의 일관성, 동의와 경계, 생활 리듬을 중심으로 읽는다. 친밀감을 사랑이나 독점적 관계의 증거로 삼지 않는다.'
        : '현재 연인이 있는 커플의 연애운이다. 연락 여부를 주제로 고정하지 말고 함께 보내는 시간, 애정 표현, 갈등과 회복, 일정과 생활 리듬, 서로 필요한 거리를 중심으로 읽는다. 새 연애상대를 예측하지 않는다.'
  return `LOVE_STATUS=${status}\n${context} 수신·발신 연락은 필요할 때만 별도 연락 섹터로 분리한다. 개인 차트 활성도를 상대의 속마음이나 두 사람의 궁합으로 바꾸지 않는다.\n`
}

function levelOf(stat?: FortuneStat | null) {
  const score = stat?.average
  const band = stat?.band ?? ''
  if (!Number.isFinite(score)) return 'unknown' as const
  if (/약|낮/.test(band) || score! < 40) return 'low' as const
  if (/강|높/.test(band) || score! >= 60) return 'high' as const
  return 'steady' as const
}

function statusLabel(status: LoveStatus) {
  return LOVE_STATUS_OPTIONS.find(item => item.value === status)?.label ?? '연애'
}

function loveCopy(status: LoveStatus, topic: '연애' | '연락', stat?: FortuneStat | null) {
  const level = levelOf(stat)
  const strong = level === 'high'
  const weak = level === 'low'

  if (topic === '연락') {
    if (status === 'single') return {
      conclusion: weak
        ? '오늘은 연락 자체를 만들려고 애쓰기보다, 실제로 대화할 사람이 생겼을 때 자연스럽게 이어지는지를 보는 편이 좋아.'
        : strong
          ? '새 사람과 첫 인사를 나누거나 소개·약속처럼 구체적인 말을 꺼내기에는 비교적 힘이 실리는 편이야.'
          : '연락은 평소 속도로 두고, 필요한 말이 있을 때 짧고 분명하게 시작하는 정도가 좋아.',
      action: '소개를 부탁하거나 첫 인사를 건넬 일이 있다면 목적을 한 문장으로 분명하게 전해.',
      caution: '답장 속도나 첫 반응만으로 호감이나 관계 가능성을 결론 내리지는 마.',
    }
    if (status === 'flirting') return {
      conclusion: weak
        ? '썸 단계에서는 연락 횟수를 늘리기보다, 질문과 답이 실제 대화와 다음 약속으로 이어지는지를 보는 편이 좋아.'
        : strong
          ? '알아가는 상대와는 대화를 이어가고 다음 약속을 구체화하기에 비교적 수월한 편이야.'
          : '연락 빈도보다 서로 질문을 주고받고 다음 약속을 잡는지가 더 중요해.',
      action: '궁금한 점을 하나 묻거나 가능한 날짜를 구체적으로 제안해.',
      caution: '대화가 잘된다는 이유만으로 교제 의사까지 같다고 단정하지 마.',
    }
    if (status === 'intimate_uncommitted') return {
      conclusion: weak
        ? '연락이 뜸하다면 친밀했던 순간의 의미를 추측하기보다, 만남 전후의 약속과 연락 방식이 내가 원하는 관계와 맞는지부터 봐.'
        : strong
          ? '연락과 만남을 이어갈 여지는 있지만, 친밀감과 관계 합의는 따로 확인해야 해.'
          : '만남 전후의 연락이 꾸준한지와 서로 원하는 관계가 같은지를 함께 보는 게 좋아.',
      action: '연락 빈도, 다음 만남, 원하는 관계 중 불분명한 한 가지를 구체적으로 확인해.',
      caution: '친밀한 만남이 있었다는 사실을 애정이나 독점적 관계의 약속으로 바꾸지 마.',
    }
    return {
      conclusion: weak
        ? '연인과의 연락이 매끄럽지 않다면 답장 횟수보다 일정과 상황을 먼저 확인하는 편이 좋아.'
        : strong
          ? '연인과 필요한 대화를 나누고 일정이나 약속을 맞추기에는 비교적 수월한 편이야.'
          : '연락은 평소 리듬을 유지하되 서로 필요한 시간과 일정이 맞는지 확인해.',
      action: '연락 빈도보다 함께 정해야 할 일정이나 약속을 구체적으로 맞춰.',
      caution: '답장이 늦다는 이유만으로 애정의 크기나 관계 전체를 판단하지 마.',
    }
  }

  if (status === 'single') return {
    conclusion: weak
      ? '오늘은 새 인연을 억지로 만들기보다 내가 어떤 만남을 편안하게 느끼는지 정리하는 편이 좋아.'
      : strong
        ? '새 사람을 만나거나 소개·모임 같은 접점을 열어 두기에는 비교적 수월한 편이야.'
        : '새 인연을 서두르기보다 실제 만남이 생겼을 때 편안하게 알아갈 수 있는지 보는 정도가 좋아.',
    action: '만남을 원한다면 소개팅 제의나 모임처럼 실제 만남으로 이어질 수 있는 접점 하나를 구체적으로 정해.',
    caution: '새 인연이 반드시 생긴다는 뜻은 아니고, 첫인상만으로 관계의 가능성을 확정하지도 마.',
  }
  if (status === 'flirting') return {
    conclusion: weak
      ? '썸 단계에서는 마음을 확인받으려 서두르기보다 서로의 관심이 질문과 다음 약속으로 이어지는지를 보는 편이 좋아.'
      : strong
        ? '알아가는 상대와 호감을 표현하고 다음 만남을 구체화하기에는 비교적 수월한 편이야.'
        : '썸의 분위기보다 서로 질문을 주고받고 다음 약속을 실제로 잡는지가 더 중요해.',
    action: '다음에 무엇을 할지, 언제 만날지처럼 확인 가능한 한 가지를 구체적으로 제안해.',
    caution: '친절이나 호감 표현 하나를 교제 합의로 확대해서 읽지 마.',
  }
  if (status === 'intimate_uncommitted') return {
    conclusion: weak
      ? '친밀감은 있어도 원하는 관계가 다를 수 있으니, 만남의 강도보다 서로 기대하는 관계를 확인하는 편이 좋아.'
      : strong
        ? '가까움을 이어갈 여지는 있지만, 관계의 이름과 기대를 말로 맞추는 과정이 함께 필요해.'
        : '친밀감과 연애 약속을 구분하고, 지금 방식이 서로에게 편안한지를 확인하는 게 중요해.',
    action: '연애를 원하는지, 현재 방식이 편안한지, 배타적 관계를 원하는지 중 필요한 한 가지를 분명하게 말해.',
    caution: '신체적 친밀감만으로 사랑이나 관계 발전이 합의됐다고 여기지 마.',
  }
  return {
    conclusion: weak
      ? '연애 중이라면 감정 확인을 반복하기보다 함께 보내는 시간과 생활 리듬에서 생기는 부담을 조정하는 편이 좋아.'
      : strong
        ? '연인과 애정을 표현하거나 데이트·생활 일정을 맞추기에는 비교적 수월한 편이야.'
        : '현재 관계에서는 연락 횟수보다 함께 보내는 시간, 각자 쉴 시간, 약속을 지키는 방식이 더 중요해.',
    action: '함께 보낼 시간과 각자 필요한 시간을 구체적으로 맞추고, 최근 불편했던 한 가지를 생활 장면으로 이야기해.',
    caution: '한 번의 말투나 답장으로 관계 전체를 판단하지 말고 반복되는 행동을 기준으로 봐.',
  }
}

// A presentation lens over existing scores/evidence. No additional calculation or event forecast.
export function applyLoveContext(summary: FortuneUserSummary, calculation: IntegratedApiResponse, status: LoveStatus): FortuneUserSummary {
  const single = status === 'single'
  const label = statusLabel(status)
  const love = loveCopy(status, '연애', calculation.western.overall['연애'])
  const contact = loveCopy(status, '연락', calculation.western.overall['연락'])
  const periodSummary = status === 'single'
    ? '특정 상대의 연락을 전제하지 않고, 새 만남을 받아들일 여지와 실제 접점이 생겼을 때의 속도를 나눠서 봐.'
    : status === 'flirting'
      ? '썸의 분위기와 관계 진전은 같은 뜻이 아니야. 상호 질문, 다음 약속, 관계 기대를 따로 확인해.'
      : status === 'intimate_uncommitted'
        ? '친밀감과 관계 약속을 분리해서 봐. 만남 전후의 일관성과 서로 원하는 관계가 맞는지가 핵심이야.'
        : '현재 연인과의 관계는 연락 횟수보다 함께 보내는 시간, 애정 표현, 갈등 뒤 회복과 생활 리듬을 중심으로 봐.'

  const allowedTopics = ['연애', '연락', ...(single ? ['재회'] : [])]
  const cards = (rows: FortuneUserSummary['favorableCards'], caution: boolean) => rows
    .filter(row => allowedTopics.includes(row.topic))
    .map(row => ({
      ...row,
      meaning: row.topic === '재회'
        ? '과거 인연의 재접촉과 관계 회복을 나눠 봐'
        : row.topic === '연애'
          ? caution ? '관계의 속도와 기대 차이를 확인해' : '내 관계 상태에 맞는 만남과 교류를 봐'
          : '연락 자체보다 대화가 실제 다음 장면으로 이어지는지 봐',
    }))

  const relationship = summary.relationship ? {
    ...summary.relationship,
    summary: status === 'single'
      ? '특정 상대가 이미 있다고 가정하지 않아. 실제 대화 상대가 생겼을 때 수신과 발신을 나눠 참고해.'
      : status === 'flirting'
        ? '알아가는 상대와의 연락 방향을 보되, 연락 흐름을 교제 합의와 같은 뜻으로 읽지 않아.'
        : status === 'intimate_uncommitted'
          ? '친밀한 상대와의 연락 방향을 보되, 연락을 애정이나 관계 약속의 증거로 바꾸지 않아.'
          : '현재 연인과 주고받는 연락의 두 방향을 구분해. 상대의 속마음을 확정하는 값은 아니야.',
    ...(single && Number.isFinite(calculation.western.relationship_signals?.['과거인연접점']?.average)
      ? {}
      : { reconnection: undefined, reconnectionBand: undefined, reconnectionTiming: undefined }),
  } : undefined

  return {
    ...summary,
    headline: `${summary.when} · ${label}`,
    summary: periodSummary,
    doItems: [love.action],
    cautionItems: [love.caution],
    favorableCards: cards(summary.favorableCards, false),
    cautionCards: cards(summary.cautionCards, true),
    relationship,
    focusTopics: summary.focusTopics
      .filter(item => allowedTopics.includes(item.topic))
      .map(item => {
        if (item.topic === '재회') return item
        const contextual = item.topic === '연애' ? love : contact
        return {
          ...item,
          conclusion: contextual.conclusion,
          action: contextual.action,
          caution: contextual.caution,
        }
      }),
    referenceTopics: summary.referenceTopics
      .filter(item => allowedTopics.includes(item.topic))
      .map(item => item.topic === '재회' ? item : ({
        ...item,
        summary: item.topic === '연애' ? love.conclusion : contact.conclusion,
        detail: item.detail ? {
          ...item.detail,
          conclusion: item.topic === '연애' ? love.conclusion : contact.conclusion,
          action: item.topic === '연애' ? love.action : contact.action,
          caution: item.topic === '연애' ? love.caution : contact.caution,
        } : item.detail,
      })),
  }
}

// These are simultaneous reading contexts, not additional event forecasts or scores.
export function singleLoveScenarios(calculation: IntegratedApiResponse) {
  const past = calculation.western.relationship_signals?.['과거인연접점']
  const validPast = Number.isFinite(past?.average)
  return [
    { title: '새 인연·소개팅', text: '아직 특정 상대가 없다면 사람을 만날 경로와 시간을 먼저 봐. 소개나 모임이 실제로 생겼을 때 일정과 만남 방식이 편안한지도 확인해.' },
    { title: '썸·알아가는 사이', text: '알아가는 사람이 있다면 연락 횟수보다 서로 질문을 주고받는지, 다음 만남을 구체적으로 잡는지 봐. 대화의 편안함과 교제 합의는 따로 확인해.' },
    { title: '친밀하지만 관계는 미정', text: '신체적으로 가까워진 사이라면 만남 전후의 일관성, 원하는 관계, 동의와 경계를 따로 봐. 친밀감만으로 애정이나 독점적 관계를 전제하지 않아.' },
    { title: '과거 인연', text: validPast
      ? '과거 인연은 별도 재접점 계산을 함께 읽어. 연락이 다시 닿는 것과 실제 만남, 관계 회복은 서로 다른 단계야.'
      : '과거 인연도 궁금할 수 있지만, 현재 결과에는 재접점의 방향이나 시기를 판단할 독립 계산 정보가 부족해.' },
  ]
}
