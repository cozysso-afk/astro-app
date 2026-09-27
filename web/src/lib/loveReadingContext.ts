import type { FortuneStat, IntegratedApiResponse } from '../appTypes'
import type { FortuneUserSummary } from './fortuneUserSummary'

export type LoveStatus = 'single' | 'flirting' | 'intimate_uncommitted' | 'couple'

export function lovePromptContext(status: LoveStatus) {
  return `LOVE_STATUS=${status}\n${status === 'single'
    ? '특정 상대가 없는 싱글의 애정운이다. 현재 연인이 있다고 전제하지 말고, 연락을 기본 소재로 삼지 않는다. 새 인연을 만날 환경, 호감 형성, 첫 만남 뒤 다시 보고 싶은지, 관계를 시작할 준비를 중심으로 읽는다. 새 인연·썸·친밀하지만 관계 미정·과거 인연처럼 여러 상황이 동시에 있을 수 있으며 실제 소개·만남이 있다는 근거가 없으면 사건을 만들지 않는다. 과거 인연은 과거인연접점 계산이 있을 때만 별도 항목으로 다룬다.'
    : status === 'flirting'
      ? '썸·알아가는 상대가 있는 애정운이다. 호감의 크기를 단정하지 말고 서로 질문을 주고받는지, 다음 약속이 구체화되는지, 관계 기대를 확인하는 대화가 가능한지를 중심으로 읽는다.'
      : status === 'intimate_uncommitted'
        ? '신체적 친밀감은 있으나 연인 관계로 합의하지 않은 상황이다. 친밀감과 애정 약속을 분리하고, 만남의 일관성, 동의와 경계, 서로 원하는 관계의 차이를 중심으로 읽는다.'
        : '현재 연인이 있는 애정운이다. 연락 빈도보다 함께 보내는 시간, 애정 표현, 갈등 뒤 회복, 일정과 거리 조율을 중심으로 읽는다.'} 연애 섹터와 연락 섹터를 합치지 않는다. 개인 차트의 활성도를 상대의 속마음이나 두 사람의 합의로 바꾸지 않는다.\n`
}

function scoreLevel(stat?: FortuneStat | null) {
  const score = stat?.average
  const band = stat?.band ?? ''
  if (/약|낮/.test(band) || (Number.isFinite(score) && score! < 40)) return 'low' as const
  if (/강|높/.test(band) || (Number.isFinite(score) && score! >= 60)) return 'high' as const
  return Number.isFinite(score) ? 'steady' as const : 'unknown' as const
}

function loveCopy(status: LoveStatus, stat?: FortuneStat | null) {
  const level = scoreLevel(stat)
  if (status === 'single') {
    const conclusion = level === 'low'
      ? '새 인연을 억지로 만들기보다 내가 편하게 사람을 만날 수 있는 자리와 방식을 먼저 정리하는 편이 좋아.'
      : level === 'high'
        ? '사람을 만나거나 호감을 표현해 볼 여지는 있어. 첫인상보다 다시 보고 싶은 마음이 드는지 확인해.'
        : level === 'unknown'
          ? '새 인연의 강약을 판단할 계산 정보가 부족해. 실제 만남이 생기면 그때의 대화와 내 반응을 기준으로 봐.'
          : '새 사람을 만날 기회가 생기면 첫인상보다 대화가 자연스럽게 이어지는지 봐.'
    return {
      title: '새 인연과 관계 탐색',
      conclusion,
      action: '사람을 만나고 싶다면 소개를 부탁하거나 부담 없는 모임에 시간을 낼지 정해. 소개팅 제의나 실제 만남 제안이 있다면 일정과 만남 방식이 편안한지부터 확인해.',
      observe: '첫 만남 뒤에도 서로 다시 볼 이유와 의지가 생기는지, 내가 그 관계를 더 알아가고 싶은지 봐.',
      caution: '누군가 반드시 나타난다는 뜻으로 읽지는 마. 호감이 생겨도 첫인상 하나로 관계를 미리 정하지 않는 게 좋아.',
    }
  }
  if (status === 'flirting') {
    const conclusion = level === 'low'
      ? '썸 단계라면 호감의 크기보다 질문과 다음 약속이 실제로 이어지는지 확인하는 편이 좋아.'
      : level === 'high'
        ? '썸이 이어지는 동안 서로를 더 알아가려는 움직임이 살아 있어. 다음 약속과 관계 기대가 같은 방향인지 확인해.'
        : level === 'unknown'
          ? '썸의 강약을 판단할 계산 정보가 부족해. 실제 대화와 약속이 이어지는지를 기준으로 봐.'
          : '썸에서 대화가 이어지는 것과 연인으로 합의하는 것은 별개야. 다음 약속과 서로의 기대를 같이 확인해.'
    return {
      title: '썸과 관계 확인',
      conclusion,
      action: '서로 질문을 주고받는지, 다음 만남을 실제 일정으로 잡는지 봐. 관계를 확인하고 싶다면 내가 원하는 방향을 먼저 분명히 말해.',
      observe: '호감 표현보다 만남이 반복되고 약속을 지키는지가 더 중요해.',
      caution: '친절이나 잦은 대화를 곧바로 교제 의사로 확정하지 마.',
    }
  }
  if (status === 'intimate_uncommitted') {
    const conclusion = level === 'low'
      ? '신체적 친밀감의 강도보다 서로 원하는 관계와 경계가 맞는지부터 확인하는 편이 좋아.'
      : level === 'high'
        ? '신체적 친밀감과 가까워지는 움직임은 있어도 관계의 이름과 기대는 따로 맞춰야 해.'
        : level === 'unknown'
          ? '신체적 친밀감과 관계의 강약을 판단할 계산 정보가 부족해. 합의와 경계를 기준으로 봐.'
          : '신체적 친밀감이 있다는 것과 같은 관계를 원한다는 것은 별개야. 만남의 방식과 기대를 분명히 확인해.'
    return {
      title: '친밀감과 관계 기준',
      conclusion,
      action: '연애를 원하는지, 부담 없는 만남을 원하는지, 지금 방식이 서로 편안한지 말로 맞춰봐.',
      observe: '만남 전후의 태도와 약속이 일관되는지, 불편한 경계를 서로 존중하는지 봐.',
      caution: '신체적 친밀감을 사랑이나 독점적 관계의 증거로 삼지 마.',
    }
  }
  const conclusion = level === 'low'
    ? '현재 관계에서는 애정 확인을 재촉하기보다 서로의 일정과 피로, 필요한 거리를 맞추는 편이 좋아.'
    : level === 'high'
      ? '현재 연인과 함께 시간을 보내고 애정을 표현하기 좋은 편이야. 서로 원하는 방식이 같은지도 확인해.'
      : level === 'unknown'
        ? '현재 관계의 강약을 판단할 계산 정보가 부족해. 실제 대화와 생활 리듬을 기준으로 봐.'
        : '현재 연인과는 큰 결론보다 함께 보내는 시간과 대화 방식이 편안한지 살펴보는 게 좋아.'
  return {
    title: '현재 관계',
    conclusion,
    action: '함께 보낼 시간과 각자 쉴 시간을 구체적으로 맞춰. 최근 서운했던 일이 있다면 무엇이 달랐는지 한 가지씩 확인해.',
    observe: '애정 표현의 크기보다 약속을 지키는지, 갈등 뒤에 대화가 다시 이어지는지를 봐.',
    caution: '한 번의 답장이나 표정으로 관계 전체를 판단하지 마.',
  }
}

function periodLead(periodKind: FortuneUserSummary['periodKind']) {
  if (periodKind === 'day') return '오늘은'
  if (periodKind === 'week') return '이번 주에는'
  if (periodKind === 'month') return '이번 달에는'
  return '올해는'
}

function periodAction(periodKind: FortuneUserSummary['periodKind'], status: LoveStatus) {
  const period = periodLead(periodKind)
  if (status === 'single') return `${period} 사람을 만날 기회를 억지로 만들기보다, 실제 제안이나 만남이 생겼을 때 내 관심이 이어지는지를 보는 쪽이 좋아.`
  if (status === 'flirting') return `${period} 한 번의 대화보다 다음 약속과 질문이 반복해서 이어지는지를 봐.`
  if (status === 'intimate_uncommitted') return `${period} 신체적 친밀감보다 서로 원하는 관계와 경계가 일관되게 존중되는지를 봐.`
  return `${period} 연락 빈도보다 함께 보내는 시간, 약속, 갈등 뒤 회복을 중심으로 봐.`
}

function loveCardMeaning(status: LoveStatus, caution: boolean) {
  if (status === 'single') return caution ? '호감 하나로 관계를 미리 정하지 마.' : '첫인상보다 다시 만나고 싶은지가 더 중요해.'
  if (status === 'flirting') return caution ? '대화가 잦아도 교제 의사로 확정하지 마.' : '질문과 다음 약속이 이어지는지를 봐.'
  if (status === 'intimate_uncommitted') return caution ? '신체적 친밀감을 관계 약속으로 바꾸지 마.' : '만남과 경계가 일관되게 존중되는지를 봐.'
  return caution ? '답장 하나로 관계 전체를 판단하지 마.' : '함께 보내는 시간과 회복 과정을 봐.'
}

function pastEvidenceAvailable(calculation: IntegratedApiResponse) {
  return Number.isFinite(calculation.western.relationship_signals?.['과거인연접점']?.average)
}

// Keep the calculation/evidence contract intact for system views and copied prompts. The final
// boolean selects the user-visible love lens, where 연락 is deliberately not promoted as 애정.
export function applyLoveContext(summary: FortuneUserSummary, calculation: IntegratedApiResponse, status: LoveStatus, visibleOnly = false): FortuneUserSummary {
  const single = status === 'single'
  const love = loveCopy(status, calculation.western.overall['연애'])
  const contextLabel = status === 'single' ? '새 인연과 관계 탐색' : status === 'flirting' ? '썸과 관계 확인' : status === 'intimate_uncommitted' ? '친밀감과 관계 기준' : '현재 관계'
  const includeReunion = single && pastEvidenceAvailable(calculation)
  const sourceFocus = summary.focusTopics.filter(topic => ['연애','연락','재회'].includes(topic.topic))
  let focusTopics = sourceFocus.map(topic => topic.topic === '연애'
    ? {...topic, conclusion: love.conclusion, action: love.action, observe: love.observe, caution: love.caution}
    : topic)
  if (!focusTopics.some(topic => topic.topic === '연애')) {
    const referenceLove = summary.referenceTopics.find(topic => topic.topic === '연애')?.detail
    if (referenceLove) focusTopics = [{...referenceLove, conclusion: love.conclusion, action: love.action, observe: love.observe, caution: love.caution}, ...focusTopics]
  }

  let relationship = summary.relationship ? {...summary.relationship} : undefined
  if (relationship && !includeReunion) {
    relationship.reconnection = undefined
    relationship.reconnectionBand = undefined
    relationship.reconnectionTiming = undefined
  }

  const cards = (rows: FortuneUserSummary['favorableCards'], caution: boolean) => rows
    .filter(row => ['연애','연락',...(includeReunion ? ['재회'] : [])].includes(row.topic))
    .map(row => row.topic === '연애'
      ? {...row, meaning: loveCardMeaning(status, caution)}
      : row.topic === '재회'
        ? {...row, meaning: '재접촉과 관계 회복을 구분해'}
        : {...row, meaning: '받는 연락과 먼저 보내는 연락을 나눠 읽어'})

  let referenceTopics = summary.referenceTopics.filter(topic => ['연애','연락',...(includeReunion ? ['재회'] : [])].includes(topic.topic))
  if (visibleOnly) {
    const visibleTopics = new Set(['연애', ...(includeReunion ? ['재회'] : [])])
    focusTopics = focusTopics.filter(topic => visibleTopics.has(topic.topic))
    const focusNames = new Set(focusTopics.map(topic => topic.topic))
    referenceTopics = referenceTopics.filter(topic => visibleTopics.has(topic.topic) && !focusNames.has(topic.topic))
    relationship = undefined
  }

  return {
    ...summary,
    headline: `${summary.when} 애정운 · ${contextLabel}`,
    summary: `${love.conclusion} ${periodAction(summary.periodKind, status)}`,
    doItems: [love.action],
    cautionItems: [love.caution],
    favorableCards: visibleOnly ? cards(summary.favorableCards, false).filter(row => row.topic !== '연락') : cards(summary.favorableCards, false),
    cautionCards: visibleOnly ? cards(summary.cautionCards, true).filter(row => row.topic !== '연락') : cards(summary.cautionCards, true),
    relationship,
    focusTopics,
    referenceTopics,
    importantWindows: visibleOnly
      ? summary.importantWindows.filter(window => !window.semantic || (window.semantic === 'reconnection' && includeReunion))
      : summary.importantWindows,
  }
}

// These are simultaneous reading contexts, not additional event forecasts or scores.
export function singleLoveScenarios(calculation: IntegratedApiResponse) {
  const past = calculation.western.relationship_signals?.['과거인연접점']
  const validPast = Number.isFinite(past?.average)
  return [
    {title:'새 인연·소개팅', text:'아직 만날 사람이 없다면 소개를 부탁하거나 모임에 참여할지 살펴봐. 실제 제안이 있다면 일정과 만남 방식이 편안한지부터 확인해.'},
    {title:'썸·알아가는 사이', text:'알아가는 사람이 있다면 서로 질문을 주고받는지, 다음 만남을 구체적으로 잡는지 봐. 대화가 편안하다는 것과 교제 의사는 구분해.'},
    {title:'친밀하지만 관계는 미정', text:'신체적으로 가까워진 사이라면 만남 전후의 태도와 약속이 일관되는지, 서로 원하는 관계와 경계가 맞는지 살펴.'},
    {title:'과거 인연·다시 이어질 가능성', text:validPast ? '과거 인연은 별도 재접점 계산을 함께 읽어. 연락이 다시 닿는 것과 관계 회복은 다른 단계야.' : '현재 결과에는 과거 인연의 재접점 방향이나 시기를 판단할 독립 계산 정보가 부족해.'},
  ]
}
