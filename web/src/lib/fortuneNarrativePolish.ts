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
  // Presentation cleanup only. User-facing fortune prose must remain exactly
  // Gemini-authored; the client may normalize whitespace but cannot rewrite it.
  return collapseSpaces(value)
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
  return firstSentences(polishKoreanSentence(item.guidance), 1)
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
