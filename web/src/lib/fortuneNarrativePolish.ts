import type { FortuneFlowCard, FortuneUserSummary, FortuneUserTopic } from './fortuneUserSummary'

const ABSTRACT_WORDS = ['흐름','신호','구조','자극','배경','접점','활성도','맥락']
const VAGUE_DECISION_RE = /(?:무난(?:한|하게|해|하지만)|평소 계획|이미 정한 일정과 기준|전반적인 균형|한 분야가 압도|특정 분야 하나|속도를 조절|한 번 더 확인하면서|지켜보는 흐름)/

function collapseSpaces(value: string) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function ensureSentence(value: string) {
  const text = collapseSpaces(value)
  if (!text) return ''
  return /[.!?]$/.test(text) ? text : `${text}.`
}

function firstSentences(value: string, limit = 2) {
  const text = collapseSpaces(value)
  if (!text) return ''
  const parts = text.match(/[^.!?]+[.!?]?/g)?.map(part => part.trim()).filter(Boolean) ?? [text]
  return parts.slice(0, limit).map(ensureSentence).join(' ')
}

export function polishKoreanSentence(value: string) {
  let text = collapseSpaces(value)
  if (!text) return ''

  text = text
    .replace(/오늘 전체 흐름에서 가장 먼저 볼 건 ([^.!?]+)이야\.?/g, '오늘은 $1부터 확인해.')
    .replace(/말로만 오가던 요청을 담당자·마감·완료 기준까지 구체화하기 좋은 날이야\.?/g, '말로만 오가던 요청은 담당자를 정하고, 마감일과 완료 기준까지 분명하게 정리해.')
    .replace(/변화 욕구를 직무·보상·일정 비교로 바꾸는 것/g, '이직을 생각한다면 직무·보상·시작 일정을 실제 조건으로 비교하는 것')
    .replace(/전해 들은 말보다 확정된 답과 다음 절차를 확인하는 것/g, '전해 들은 말보다 확정된 답과 다음 절차를 직접 확인하는 것')
    .replace(/집중이 쉽게 흐트러질 수 있으니 목표를 작게 잡는 편이 좋아\.?/g, '집중이 쉽게 흩어질 수 있어. 목표를 넓히기보다 끝낼 단위를 하나로 좁혀.')
    .replace(/새로운 내용을 늘리기보다 아는 문제의 실수를 줄이는 편이 좋아\.?/g, '새 범위를 늘리기보다 아는 문제에서 반복되는 실수부터 줄여.')
    .replace(/이직 결론을 서두르기보다 조건을 비교하는 데 집중하는 편이 좋아\.?/g, '이직 결론은 미루고 직무·보상·일정 조건부터 비교해.')
    .replace(/말이 엇갈리기 쉬우니 상대 반응을 섣불리 단정하지 않는 편이 좋아\.?/g, '말이 엇갈리기 쉬워. 한 번의 반응보다 이후 행동과 약속을 봐.')
    .replace(/연애는 서두르지 않는 편이 좋아\.?/g, '연애는 관계의 이름을 앞서 정하지 마.')
    .replace(/기다리는 답이 늦어질 수 있으니 한 번에 결론 내리지 않는 편이 좋아\.?/g, '기다리는 답이 늦어질 수 있어. 지연 자체를 결과로 해석하지 마.')
    .replace(/시장 분위기에 휩쓸리기보다 차분하게 보기 쉬운 편이야\.?/g, '시장 분위기보다 기존 판단 기준을 유지하기 쉬운 구간이야.')
    .replace(/수익 실현을 서두르기보다 기존 계획을 지키는 편이 좋아\.?/g, '수익 실현은 서두르지 말고 기존 청산 기준을 지켜.')
    .replace(/새로 들어가기보다 기다리면서 조건을 더 살피는 편이 좋아\.?/g, '신규 진입은 미루고 가격·손실 한도·진입 이유가 모두 맞는지 확인해.')
    .replace(/답장 속도 하나를 마음의 결론처럼 확대해석하지 않는 편이 좋아\.?/g, '답장 속도를 마음의 결론으로 해석하지 마. 내용과 다음 행동을 봐.')
    .replace(/한 번의 말투나 답장만으로 관계 전체를 결론 내리지 않는 편이 좋아\.?/g, '한 번의 말투나 답장으로 관계 전체를 결론 내리지 마.')
    .replace(/피곤한데도 하루 전체를 같은 강도로 밀어붙이지 않는 편이 좋아\.?/g, '피곤하면 하루 전체를 같은 강도로 밀어붙이지 마.')
    .replace(/중간 정보만 듣고 결과를 미리 확정하지 않는 편이 좋아\.?/g, '중간 정보만으로 결과를 미리 확정하지 마.')
    .replace(/조급함이나 놓칠 것 같은 기분 때문에 원래 기준을 바꾸지 않는 편이 좋아\.?/g, '조급함이나 놓칠 것 같은 기분 때문에 원래 기준을 바꾸지 마.')
    .replace(/정리하고 싶은 기분만으로 매도 시점을 결정하지 않는 편이 좋아\.?/g, '정리하고 싶은 기분만으로 매도 시점을 결정하지 마.')
    .replace(/기회를 놓칠 것 같은 마음 때문에 위험 한도를 넓히지 않는 편이 좋아\.?/g, '기회를 놓칠 것 같은 마음 때문에 위험 한도를 넓히지 마.')
    .replace(/주의 신호가 약해 보여도 안전하다고 가정하지 않는 편이 좋아\.?/g, '주의 신호가 약해 보여도 안전하다고 가정하지 마.')
    .replace(/먼저 연락이 오길 크게 기대하기보다는, 연락이 와도 내용이 구체적인지를 보는 편이 좋아\.?/g, '먼저 연락을 기대하기보다, 실제 연락이 오면 내용과 다음 행동이 구체적인지 봐.')
    .replace(/먼저 연락을 밀어붙이기보다 꼭 할 말만 짧게 전하고 기다리는 편이 좋아\.?/g, '먼저 연락을 밀어붙이지 마. 꼭 할 말만 짧게 전하고 기다려.')
    .replace(/금전 흐름은 무난한 편이니 계획한 범위 안에서 움직여\.?/g, '금전은 새 지출을 늘리기보다 정한 예산 안에서 처리해.')
    .replace(/공부할 순서를 정해 차근차근 따라가면 무난해\.?/g, '공부할 분량을 먼저 정하고 한 번에 하나씩 끝내.')
    .replace(/업무는 맡은 일의 순서를 분명히 하면 무난하게 풀 수 있어\.?/g, '업무는 요청받은 일과 마감 순서를 먼저 정리해.')
    .replace(/사람 관계는 무리하게 맞추기보다 적당한 거리를 지키면 무난해\.?/g, '사람 관계는 필요한 말만 분명히 하고, 상대 반응은 이후 행동으로 판단해.')
    .replace(/소식은 서두르지 말고 정해진 연락 순서를 기다려\.?/g, '소식은 기한 전이면 기다리고, 기한이 지났다면 한 번만 짧게 확인해.')
    .replace(/컨디션은 무난하지만 쉬는 시간을 빼놓진 마\.?/g, '컨디션은 중요한 일 사이에 쉬는 시간을 먼저 잡아.')
    .replace(/평소 계획을 유지해\.?/g, '이미 정한 일정과 기준을 그대로 지켜.')
    .replace(/이 흐름은 아직 강해지는 중이라 첫 반응 하나보다 실제 변화가 이어지는지를 봐\.?/g, '')
    .replace(/오늘은 이 흐름의 영향이 이어지는 구간이야\.?/g, '')
    .replace(/오늘은 이 주제가 가장 또렷하게 드러나는 구간이야\.?/g, '')
    .replace(/점수 순위보다 위 한줄과 아래 실제 상황 설명을 먼저 봐\.?/g, '')
    .replace(/아래에서 왜 그런지와 현실에서 뭘 확인할지 이어서 봐\.?/g, '')
    .replace(/아래에서 어떤 장면을 특히 확인해야 하는지 이어서 봐\.?/g, '')
    .replace(/아래 실제 장면을 기준으로 읽어봐\.?/g, '')
    .replace(/오늘은 ([^.!?]+)에서 움직일 장면과 ([^.!?]+)에서 한 번 더 확인할 장면이 갈려\.?/g, '')
    .replace(/오늘은 ([^.!?]+) 쪽 장면이 가장 또렷해\.?/g, '')
    .replace(/오늘은 ([^.!?]+) 쪽에서 무리하지 않는 게 핵심이야\.?/g, '')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/\.\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim()

  return text
}

export function narrativeClaimFamily(value: string) {
  const text = polishKoreanSentence(value)
  if (!text) return ''
  if (/첫 반응|한 번의 반응|답장 속도|말투 하나|표정 하나/.test(text)) return 'single-reaction'
  if (/실제 변화|행동이 이어|약속.*이어|약속.*잡|다음 약속|대화.*이어|만남.*이어|지속 행동/.test(text)) return 'follow-through'
  if (/확률|보장|확정|뜻은 아니|뜻이 아니|예측하지|미리 결론|단정/.test(text)) return 'non-determinism'
  if (/담당자|마감일|완료 기준|책임 범위/.test(text)) return 'work-terms'
  if (/직무|보상|시작 일정|제안 조건/.test(text)) return 'job-conditions'
  if (/원문|확정된 답|다음 절차|공식 안내/.test(text)) return 'verified-info'
  if (/예산|지출|결제|정산/.test(text)) return 'money-plan'
  if (/집중|과제|진도|복습/.test(text)) return 'study-focus'
  if (/휴식|쉬|피로|체력|컨디션/.test(text)) return 'condition-pace'
  if (/호감|만남|연애|관계의 의미/.test(text)) return 'love-relation'
  return ''
}

function tokenKey(value: string) {
  return polishKoreanSentence(value)
    .replace(/[.,!?·~→]/g, ' ')
    .replace(/(?:오늘|이번 주|이번 달|올해|이 흐름|이 주제|쪽|편이야|좋아|봐|해)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function narrativeSimilarity(a: string, b: string) {
  const left = new Set(tokenKey(a).split(' ').filter(token => token.length >= 2))
  const right = new Set(tokenKey(b).split(' ').filter(token => token.length >= 2))
  if (!left.size || !right.size) return 0
  const overlap = [...left].filter(token => right.has(token)).length
  return overlap / Math.min(left.size, right.size)
}

export function distinctNarrativeParts(parts: Array<string | undefined>, max = parts.length) {
  const kept: string[] = []
  const families = new Set<string>()
  for (const raw of parts) {
    const text = polishKoreanSentence(raw ?? '')
    if (!text) continue
    const family = narrativeClaimFamily(text)
    if (family && families.has(family)) continue
    if (kept.some(previous => previous === text || narrativeSimilarity(previous, text) >= 0.68)) continue
    kept.push(text)
    if (family) families.add(family)
    if (kept.length >= max) break
  }
  return kept
}

function polishTopic(topic: FortuneUserTopic): FortuneUserTopic {
  const [conclusion, action, observe, caution] = distinctNarrativeParts([
    firstSentences(topic.conclusion, 2),
    firstSentences(topic.action, 1),
    firstSentences(topic.observe ?? '', 1),
    firstSentences(topic.caution ?? '', 1),
  ], 4)
  return {
    ...topic,
    conclusion: conclusion || firstSentences(polishKoreanSentence(topic.conclusion), 2),
    action: action || firstSentences(polishKoreanSentence(topic.action), 1),
    observe,
    caution,
    reason: firstSentences(polishKoreanSentence(topic.reason), 2),
    timing: topic.timing ? firstSentences(polishKoreanSentence(topic.timing), 2) : undefined,
  }
}

function concreteCardText(card: FortuneFlowCard | undefined) {
  return card ? firstSentences(polishKoreanSentence(card.meaning), 1) : ''
}

function topicHeadline(summary: FortuneUserSummary, topic: string | undefined) {
  if (!topic) return ''
  const focus = summary.focusTopics.find(item => item.topic === topic)
  if (focus) return firstSentences(polishKoreanSentence(focus.conclusion), 1)
  const reference = summary.referenceTopics.find(item => item.topic === topic)?.detail
  return reference ? firstSentences(polishKoreanSentence(reference.conclusion), 1) : ''
}

function referenceScene(summary: FortuneUserSummary) {
  const reference = summary.referenceTopics.find(item => item.topic !== '투자주의' && !/(?:약|낮|정보 부족)/.test(item.band) && item.detail)
  if (!reference?.detail) return ''
  const observed = firstSentences(polishKoreanSentence(reference.detail.observe ?? ''), 1)
  const conclusion = firstSentences(polishKoreanSentence(reference.detail.conclusion), 1)
  return observed || conclusion
}

function directTopicHeadline(summary: FortuneUserSummary, limit = 2) {
  const rows = summary.focusTopics
    .slice(0, limit)
    .map(topic => firstSentences(polishKoreanSentence(topic.conclusion), 1))
    .filter(Boolean)
  return distinctNarrativeParts(rows, limit).join(' ')
}

function directTopicSupport(summary: FortuneUserSummary) {
  const rows = summary.focusTopics.slice(0, 2).flatMap(topic => [
    firstSentences(polishKoreanSentence(topic.action), 1),
    firstSentences(polishKoreanSentence(topic.observe ?? ''), 1),
  ]).filter(Boolean)
  return distinctNarrativeParts(rows, 2).join(' ')
}

function dailyHero(summary: FortuneUserSummary) {
  const bestTopic = summary.favorableCards[0]?.topic
  const cautionTopic = summary.cautionCards[0]?.topic
  const best = topicHeadline(summary, bestTopic) || concreteCardText(summary.favorableCards[0]) || referenceScene(summary)
  const caution = topicHeadline(summary, cautionTopic) || concreteCardText(summary.cautionCards[0])
  const balanced = distinctNarrativeParts([best, caution], 2)
  if (balanced.length >= 2) return balanced.map(ensureSentence).join(' ')

  const raw = firstSentences(polishKoreanSentence(summary.headline), 2)
  if (raw && !VAGUE_DECISION_RE.test(raw)) return raw
  if (balanced.length) return balanced.map(ensureSentence).join(' ')

  const direct = directTopicHeadline(summary, 2)
  if (direct) return direct
  return raw
}

function dedupeTopicDetails(topics: FortuneUserTopic[]): FortuneUserTopic[] {
  const seen: string[] = []
  return topics.map(raw => {
    const topic = polishTopic(raw)
    const keep = (value?: string, required = false) => {
      const text = polishKoreanSentence(value ?? '')
      if (!text) return undefined
      if (!required && seen.some(previous => narrativeSimilarity(previous, text) >= 0.68 || (narrativeClaimFamily(previous) && narrativeClaimFamily(previous) === narrativeClaimFamily(text)))) return undefined
      seen.push(text)
      return text
    }
    return {
      ...topic,
      conclusion: keep(topic.conclusion, true) ?? topic.conclusion,
      action: keep(topic.action) ?? '',
      observe: keep(topic.observe),
      caution: keep(topic.caution),
    }
  })
}

function referenceDetail(topic: FortuneUserTopic) {
  const polished = polishTopic(topic)
  const observed = firstSentences(polishKoreanSentence(polished.observe ?? ''), 1)
  return observed ? { ...polished, conclusion: observed } : polished
}

function quietHourWindowGuidance(item: FortuneUserSummary['importantWindows'][number]) {
  const guidance = firstSentences(polishKoreanSentence(item.guidance), 1)
  const match = item.date.match(/^(\d{2}):(\d{2})[–-]/)
  if (!match) return guidance
  const hour = Number(match[1])
  if (!Number.isFinite(hour) || (hour >= 8 && hour < 22)) return guidance
  const topic = guidance.split('·')[0]?.trim() || ''
  const communication = /(?:연락|연애|재회|대인관계|소식)/.test(topic)
  if (communication) {
    return item.kind === 'caution'
      ? `${topic} · 답을 재촉하거나 바로 결론 내리지 말고, 보낼 말과 확인할 질문만 정리해. 실제 발송은 상대 생활시간대를 고려해.`
      : `${topic} · 지금 바로 연락하기보다 보낼 말·질문·가능한 시간을 정리해. 실제 발송은 상대 생활시간대를 고려해.`
  }
  return `${topic || '이 시간대'} · 바로 실행하기보다 필요한 준비와 확인부터 해.`
}

export function polishFortuneSummary(summary: FortuneUserSummary): FortuneUserSummary {
  const rawHeadline = firstSentences(polishKoreanSentence(summary.headline), 2)
  const directHeadline = directTopicHeadline(summary, 2)
  const headline = summary.periodKind === 'day'
    ? dailyHero(summary)
    : (!rawHeadline || VAGUE_DECISION_RE.test(rawHeadline)) && directHeadline
      ? directHeadline
      : rawHeadline
  const rawSummary = summary.periodKind === 'day' ? '' : firstSentences(polishKoreanSentence(summary.summary), 2)
  const directSupport = summary.periodKind === 'day' ? '' : directTopicSupport(summary)
  const summaryText = rawSummary && !VAGUE_DECISION_RE.test(rawSummary) ? rawSummary : directSupport || rawSummary
  const directSupportUsed = Boolean(directSupport && summaryText === directSupport)
  const headlineFamily = narrativeClaimFamily(headline)
  const summaryFamily = narrativeClaimFamily(summaryText)
  const summaryDuplicate = Boolean(
    summaryText && (
      summaryText === headline ||
      narrativeSimilarity(headline, summaryText) >= 0.68 ||
      (!directSupportUsed && headlineFamily && headlineFamily === summaryFamily)
    )
  )

  return {
    ...summary,
    headline,
    summary: summaryDuplicate ? '' : summaryText,
    doItems: distinctNarrativeParts(summary.doItems),
    cautionItems: distinctNarrativeParts(summary.cautionItems),
    focusTopics: dedupeTopicDetails(summary.focusTopics),
    referenceTopics: summary.referenceTopics.map(item => ({
      ...item,
      summary: firstSentences(polishKoreanSentence(item.summary), 1),
      detail: item.detail ? referenceDetail(item.detail) : item.detail,
    })),
    importantWindows: summary.importantWindows.map(item => ({ ...item, guidance: quietHourWindowGuidance(item) })),
    relationship: summary.relationship ? {
      ...summary.relationship,
      summary: firstSentences(polishKoreanSentence(summary.relationship.summary), 2),
      incoming: summary.relationship.incoming ? firstSentences(polishKoreanSentence(summary.relationship.incoming), 2) : undefined,
      outgoing: summary.relationship.outgoing ? firstSentences(polishKoreanSentence(summary.relationship.outgoing), 2) : undefined,
      reconnection: summary.relationship.reconnection ? firstSentences(polishKoreanSentence(summary.relationship.reconnection), 2) : undefined,
    } : undefined,
  }
}

export function inspectKoreanNarrative(values: string[]) {
  const issues: string[] = []
  const rawTexts = values.map(collapseSpaces).filter(Boolean)
  for (const text of rawTexts) {
    for (const sentence of text.split(/(?<=[.!?])\s+/).filter(Boolean)) {
      if (/변화 욕구를 .*비교로 바꾸/.test(sentence)) issues.push(`의미 호응 오류: ${sentence}`)
      if (/시기가 .*이어/.test(sentence)) issues.push(`의미 호응 오류: ${sentence}`)
      if (/근거를 (?:낮|높)게 읽/.test(sentence)) issues.push(`의미 호응 오류: ${sentence}`)
      if (/움직일 장면/.test(sentence)) issues.push(`추상 표현: ${sentence}`)
    }
  }

  const texts = rawTexts.map(polishKoreanSentence).filter(Boolean)
  const familyCount = new Map<string, number>()
  for (const text of texts) {
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean)
    for (const sentence of sentences) {
      if (sentence.length > 95) issues.push(`긴 문장: ${sentence.slice(0, 48)}…`)
      const abstractCount = ABSTRACT_WORDS.filter(word => sentence.includes(word)).length
      if (abstractCount >= 3) issues.push(`추상명사 과다: ${sentence.slice(0, 48)}…`)
    }
    const family = narrativeClaimFamily(text)
    if (family) familyCount.set(family, (familyCount.get(family) ?? 0) + 1)
  }
  for (const [family, count] of familyCount) if (count >= 3) issues.push(`동일 의미 반복: ${family} ${count}회`)
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    if (narrativeSimilarity(texts[i], texts[j]) >= 0.76) issues.push(`유사 문장 반복: ${texts[i].slice(0, 36)}… / ${texts[j].slice(0, 36)}…`)
  }
  return [...new Set(issues)]
}