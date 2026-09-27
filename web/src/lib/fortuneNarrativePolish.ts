import type { FortuneUserSummary, FortuneUserTopic } from './fortuneUserSummary'

const ABSTRACT_WORDS = ['흐름','신호','구조','자극','배경','접점','활성도','맥락']

function collapseSpaces(value: string) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

export function polishKoreanSentence(value: string) {
  let text = collapseSpaces(value)
  if (!text) return ''

  text = text
    .replace(/오늘 전체 흐름에서 가장 먼저 볼 건 ([^.!?]+)이야\.?/g, '오늘은 $1부터 봐.')
    .replace(/말로만 오가던 요청을 담당자·마감·완료 기준까지 구체화하기 좋은 날이야\.?/g, '말로만 오가던 요청은 담당자를 정하고, 마감일과 완료 기준까지 분명하게 정리하는 게 좋아.')
    .replace(/변화 욕구를 직무·보상·일정 비교로 바꾸는 것/g, '이직을 생각한다면 직무·보상·시작 일정을 실제 조건으로 비교하는 것')
    .replace(/전해 들은 말보다 확정된 답과 다음 절차를 확인하는 것/g, '전해 들은 말보다 확정된 답과 다음 절차를 직접 확인하는 것')
    .replace(/이 흐름은 아직 강해지는 중이라 첫 반응 하나보다 실제 변화가 이어지는지를 봐\.?/g, '')
    .replace(/오늘은 이 흐름의 영향이 이어지는 구간이야\.?/g, '')
    .replace(/오늘은 이 주제가 가장 또렷하게 드러나는 구간이야\.?/g, '오늘 특히 눈여겨볼 장면이야.')
    .replace(/점수 순위보다 위 한줄과 아래 실제 상황 설명을 먼저 봐\.?/g, '')
    .replace(/아래에서 왜 그런지와 현실에서 뭘 확인할지 이어서 봐\.?/g, '')
    .replace(/아래에서 어떤 장면을 특히 확인해야 하는지 이어서 봐\.?/g, '')
    .replace(/아래 실제 장면을 기준으로 읽어봐\.?/g, '')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/\.\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim()

  return text
}

export function narrativeClaimFamily(value: string) {
  const text = polishKoreanSentence(value)
  if (!text) return ''
  if (/확률|보장|단정|확정|뜻은 아니|뜻이 아니|예측하지|미리 결론/.test(text)) return 'non-determinism'
  if (/첫 반응|한 번의 반응|답장 속도|말투 하나|표정 하나/.test(text)) return 'single-reaction'
  if (/실제 변화|행동이 이어|약속.*이어|약속.*잡|다음 약속|대화.*이어|만남.*이어|지속 행동/.test(text)) return 'follow-through'
  if (/담당자|마감일|완료 기준|책임 범위/.test(text)) return 'work-terms'
  if (/직무|보상|시작 일정|제안 조건/.test(text)) return 'job-conditions'
  if (/원문|확정된 답|다음 절차|공식 안내/.test(text)) return 'verified-info'
  if (/예산|지출|결제|정산/.test(text)) return 'money-plan'
  if (/집중|과제|진도|복습/.test(text)) return 'study-focus'
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
    if (kept.some(previous => previous === text || narrativeSimilarity(previous, text) >= 0.72)) continue
    kept.push(text)
    if (family) families.add(family)
    if (kept.length >= max) break
  }
  return kept
}

function polishTopic(topic: FortuneUserTopic): FortuneUserTopic {
  const [conclusion, action, observe, caution] = distinctNarrativeParts([
    topic.conclusion,
    topic.action,
    topic.observe,
    topic.caution,
  ], 4)
  return {
    ...topic,
    conclusion: conclusion || polishKoreanSentence(topic.conclusion),
    action: action || polishKoreanSentence(topic.action),
    observe,
    caution,
    reason: polishKoreanSentence(topic.reason),
    timing: topic.timing ? polishKoreanSentence(topic.timing) : undefined,
  }
}

export function polishFortuneSummary(summary: FortuneUserSummary): FortuneUserSummary {
  const headline = polishKoreanSentence(summary.headline)
  const summaryText = polishKoreanSentence(summary.summary)
  const headlineFamily = narrativeClaimFamily(headline)
  const summaryFamily = narrativeClaimFamily(summaryText)
  const summaryDuplicate = Boolean(
    summaryText && (
      summaryText === headline ||
      narrativeSimilarity(headline, summaryText) >= 0.72 ||
      (headlineFamily && headlineFamily === summaryFamily)
    )
  )

  return {
    ...summary,
    headline,
    summary: summaryDuplicate ? '' : summaryText,
    doItems: distinctNarrativeParts(summary.doItems),
    cautionItems: distinctNarrativeParts(summary.cautionItems),
    focusTopics: summary.focusTopics.map(polishTopic),
    referenceTopics: summary.referenceTopics.map(item => ({
      ...item,
      summary: polishKoreanSentence(item.summary),
      detail: item.detail ? polishTopic(item.detail) : item.detail,
    })),
    importantWindows: summary.importantWindows.map(item => ({ ...item, guidance: polishKoreanSentence(item.guidance) })),
    relationship: summary.relationship ? {
      ...summary.relationship,
      summary: polishKoreanSentence(summary.relationship.summary),
      incoming: summary.relationship.incoming ? polishKoreanSentence(summary.relationship.incoming) : undefined,
      outgoing: summary.relationship.outgoing ? polishKoreanSentence(summary.relationship.outgoing) : undefined,
      reconnection: summary.relationship.reconnection ? polishKoreanSentence(summary.relationship.reconnection) : undefined,
    } : undefined,
  }
}

export function inspectKoreanNarrative(values: string[]) {
  const issues: string[] = []
  const texts = values.map(polishKoreanSentence).filter(Boolean)
  const familyCount = new Map<string, number>()
  for (const text of texts) {
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean)
    for (const sentence of sentences) {
      if (sentence.length > 105) issues.push(`긴 문장: ${sentence.slice(0, 48)}…`)
      const abstractCount = ABSTRACT_WORDS.filter(word => sentence.includes(word)).length
      if (abstractCount >= 4) issues.push(`추상명사 과다: ${sentence.slice(0, 48)}…`)
      if (/변화 욕구를 .*비교로 바꾸/.test(sentence)) issues.push(`의미 호응 오류: ${sentence}`)
      if (/시기가 .*이어/.test(sentence)) issues.push(`의미 호응 오류: ${sentence}`)
      if (/근거를 (?:낮|높)게 읽/.test(sentence)) issues.push(`의미 호응 오류: ${sentence}`)
    }
    const family = narrativeClaimFamily(text)
    if (family) familyCount.set(family, (familyCount.get(family) ?? 0) + 1)
  }
  for (const [family, count] of familyCount) if (count >= 3) issues.push(`동일 의미 반복: ${family} ${count}회`)
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    if (narrativeSimilarity(texts[i], texts[j]) >= 0.8) issues.push(`유사 문장 반복: ${texts[i].slice(0, 36)}… / ${texts[j].slice(0, 36)}…`)
  }
  return [...new Set(issues)]
}
