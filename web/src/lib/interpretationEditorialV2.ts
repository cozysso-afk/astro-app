import type { FortuneUserSummary, FortuneUserTopic } from './fortuneUserSummary'

const GENERIC_PHASE = '이 흐름은 아직 강해지는 중이라 첫 반응 하나보다 실제 변화가 이어지는지를 봐.'

const FOLLOW_THROUGH: Record<string, string> = {
  금전: '한 번의 결제보다 예산과 지출 순서가 계획대로 유지되는지를 봐.',
  학업: '공부를 시작한 것보다 실제로 끝낸 분량이 늘어나는지를 봐.',
  시험: '문제를 풀었다는 사실보다 같은 실수가 줄어드는지를 봐.',
  직장: '말로 합의한 내용이 담당자, 마감일, 완료 기준까지 구체화되는지를 봐.',
  이직: '관심이나 면담보다 직무, 보상, 근무 방식, 시작 일정이 실제 조건으로 구체화되는지를 봐.',
  대인관계: '한 번의 말투보다 이후 태도와 약속이 이어지는지를 봐.',
  연애: '호감 표현 하나보다 실제 만남과 관계 기준이 이어지는지를 봐.',
  연락: '답장 속도보다 대화가 다음 질문이나 약속으로 이어지는지를 봐.',
  재회: '안부 자체보다 대화가 반복되고 이전 문제를 다르게 다루는지가 중요해.',
  소식: '중간 전달보다 확정 답변과 다음 절차가 구체화되는지를 봐.',
  컨디션: '잠깐 괜찮은 느낌보다 일정 뒤 피로가 어떻게 남는지를 봐.',
  투자심리: '순간적인 확신보다 미리 정한 기준을 그대로 지키는지를 봐.',
  수익실현: '짧은 가격 움직임보다 처음 정한 목표와 보유 이유가 유지되는지를 봐.',
  신규진입: '관심이 커지는 것보다 진입 조건과 손실 한도가 실제로 지켜지는지를 봐.',
  투자주의: '안도감보다 위험 한도와 포지션 크기가 계획 안에 있는지를 봐.',
}

function hasBatchim(value: string) {
  const code = value.charCodeAt(value.length - 1)
  return code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 !== 0 : false
}

function objectParticle(value: string) {
  return hasBatchim(value) ? '을' : '를'
}

function compact(value: string | undefined) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function semanticKey(value: string | undefined) {
  return compact(value)
    .replace(/[.!?,·:;()→↔/\-]/g, '')
    .replace(/오늘|이번 주|이번 달|올해|이 흐름은|이 흐름|실제로|실제|쪽|편이 좋아|중요해|확인해|살펴봐|봐/g, '')
    .replace(/\s+/g, '')
}

function trigrams(value: string) {
  const key = semanticKey(value)
  if (key.length < 3) return new Set(key ? [key] : [])
  const grams = new Set<string>()
  for (let i = 0; i <= key.length - 3; i++) grams.add(key.slice(i, i + 3))
  return grams
}

export function semanticSimilarity(left: string | undefined, right: string | undefined) {
  const a = trigrams(left ?? '')
  const b = trigrams(right ?? '')
  if (!a.size || !b.size) return 0
  let intersection = 0
  for (const item of a) if (b.has(item)) intersection++
  return intersection / Math.max(a.size, b.size)
}

export function isNearDuplicate(left: string | undefined, right: string | undefined, threshold = 0.68) {
  const a = semanticKey(left)
  const b = semanticKey(right)
  if (!a || !b) return false
  if (a === b || a.includes(b) || b.includes(a)) return true
  return semanticSimilarity(left, right) >= threshold
}

function phaseFor(topic: string) {
  return FOLLOW_THROUGH[topic] ?? '첫 반응보다 그 뒤 행동이 같은 방향으로 이어지는지를 봐.'
}

function polishSentence(value: string | undefined, topic = '') {
  let text = compact(value)
  if (!text) return text
  if (text.includes(GENERIC_PHASE)) text = text.replace(GENERIC_PHASE, phaseFor(topic))
  text = text.replace(/^오늘 전체 흐름에서 가장 먼저 볼 건 ([^.!?]+?)이야\./, (_match, name: string) => `오늘은 ${name}${objectParticle(name)} 가장 먼저 봐.`)
  text = text.replace(/직무[·, ]+보상[·, ]+일정처럼 바꿀 수 없는 조건부터 적어봐\.?/, '직무, 보상, 근무 방식, 시작 일정을 실제 제안 조건으로 나눠 비교해.')
  text = text.replace(/말로 끝난 협의가 담당자와 일정까지 구체적으로 정해지는지를 봐\.?/, '말로만 오가던 요청은 담당자를 정하고, 마감일과 완료 기준까지 분명하게 정리되는지 봐.')
  text = text.replace(/담당자·마감·완료 기준/g, '담당자, 마감일, 완료 기준')
  return text
}

function polishTopic(topic: FortuneUserTopic): FortuneUserTopic {
  const conclusion = polishSentence(topic.conclusion, topic.topic)
  let action = polishSentence(topic.action, topic.topic)
  let observe = polishSentence(topic.observe, topic.topic)
  let caution = polishSentence(topic.caution, topic.topic)

  if (topic.topic === '직장' && /요청|마감|협의|책임/.test(`${action} ${observe}`)) {
    action = '말로만 오가던 요청은 담당자를 정하고, 마감일과 완료 기준까지 분명하게 정리해.'
    observe = '담당자와 마감일이 실제로 정해지고, 완료 기준까지 합의되는지 봐.'
  }
  if (topic.topic === '이직' && /직무|보상|조건|이직/.test(action)) {
    action = '이직을 고민한다면 직무, 보상, 근무 방식, 시작 일정을 실제 제안 조건으로 나눠 비교해.'
  }

  if (isNearDuplicate(observe, conclusion) || isNearDuplicate(observe, action)) observe = ''
  if (isNearDuplicate(caution, conclusion) || isNearDuplicate(caution, action) || isNearDuplicate(caution, observe)) caution = ''

  return {
    ...topic,
    conclusion,
    reason: polishSentence(topic.reason, topic.topic),
    action,
    observe: observe || undefined,
    caution: caution || undefined,
    timing: polishSentence(topic.timing, topic.topic) || undefined,
  }
}

function uniqueSentences(items: string[]) {
  const output: string[] = []
  for (const item of items.map(value => polishSentence(value)).filter(Boolean)) {
    if (output.some(existing => isNearDuplicate(existing, item))) continue
    output.push(item)
  }
  return output
}

export function polishFortuneUserSummary(summary: FortuneUserSummary): FortuneUserSummary {
  const loveView = /애정운\s*·/.test(summary.headline)
  const visibleTopic = (topic: string) => !loveView || topic !== '연락'
  const leadTopic = summary.focusTopics.find(topic => visibleTopic(topic.topic))?.topic ?? summary.favorableCards.find(card => visibleTopic(card.topic))?.topic ?? summary.cautionCards.find(card => visibleTopic(card.topic))?.topic ?? ''
  const focusTopics = summary.focusTopics.filter(topic => visibleTopic(topic.topic)).map(polishTopic)
  const focusNames = new Set(focusTopics.map(topic => topic.topic))
  const referenceTopics = summary.referenceTopics
    .filter(item => visibleTopic(item.topic) && !focusNames.has(item.topic))
    .map(item => ({
      ...item,
      summary: polishSentence(item.summary, item.topic),
      detail: item.detail ? polishTopic(item.detail) : item.detail,
    }))

  let headline = polishSentence(summary.headline, leadTopic)
  let summaryText = polishSentence(summary.summary, leadTopic)
  if (isNearDuplicate(headline, summaryText)) {
    const best = summary.favorableCards.find(card => visibleTopic(card.topic))?.topic
    const caution = summary.cautionCards.find(card => visibleTopic(card.topic))?.topic
    summaryText = best && caution
      ? `${best}${objectParticle(best)} 활용하되, ${caution}${objectParticle(caution)} 무리해서 밀어붙이지 않는 식으로 우선순위를 나눠.`
      : best
        ? `${best}${objectParticle(best)} 중심으로 실제로 끝낼 일 한 가지를 정해.`
        : caution
          ? `${caution}${objectParticle(caution)} 서두르지 말고 확인할 조건부터 챙겨.`
          : '한 가지 반응으로 하루 전체를 정하지 말고, 실제로 달라지는 장면만 골라 봐.'
  }

  const importantWindows = summary.importantWindows
    .filter(window => !loveView || window.semantic === 'reconnection' || !/(?:연락|답장|메시지)/.test(window.guidance))
    .map(window => ({...window, guidance: polishSentence(window.guidance)}))

  return {
    ...summary,
    headline,
    summary: summaryText,
    doItems: uniqueSentences(summary.doItems),
    cautionItems: uniqueSentences(summary.cautionItems),
    favorableCards: summary.favorableCards.filter(card => visibleTopic(card.topic)).map(card => ({...card, meaning: polishSentence(card.meaning, card.topic)})),
    cautionCards: summary.cautionCards.filter(card => visibleTopic(card.topic)).map(card => ({...card, meaning: polishSentence(card.meaning, card.topic)})),
    focusTopics,
    referenceTopics,
    importantWindows,
    relationship: loveView ? undefined : summary.relationship ? {
      ...summary.relationship,
      summary: polishSentence(summary.relationship.summary),
      incoming: polishSentence(summary.relationship.incoming) || undefined,
      outgoing: polishSentence(summary.relationship.outgoing) || undefined,
      reconnection: polishSentence(summary.relationship.reconnection) || undefined,
      incomingTiming: polishSentence(summary.relationship.incomingTiming) || undefined,
      outgoingTiming: polishSentence(summary.relationship.outgoingTiming) || undefined,
      reconnectionTiming: polishSentence(summary.relationship.reconnectionTiming) || undefined,
    } : undefined,
  }
}
