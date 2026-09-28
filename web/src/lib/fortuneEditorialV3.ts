import type { AiInterpretationResponse, IntegratedApiResponse } from '../appTypes'
import type { FortuneField } from './fortuneFields'
import type { FortuneUserSummary } from './fortuneUserSummary'

type InterpretationData = NonNullable<AiInterpretationResponse['data']>

export type LoveContextKey = 'single' | 'crush' | 'flirting' | 'ambiguous' | 'couple' | 'reunion_interest'
export type LoveContextReading = { key: LoveContextKey; label: string; text: string }
export type EditorialContact = {
  activation: string
  continuity: string
  incoming: string
  outgoing: string
  directionSummary: string
  timing?: string
}
export type FortuneEditorialV3 = {
  heroHeadline: string
  heroSummary: string
  interpersonal?: { summary: string; action: string; watch: string }
  contact?: EditorialContact
  loveContexts?: LoveContextReading[]
  loveGeneral?: string
}

const LOVE_CONTEXTS: Array<{ key: LoveContextKey; label: string; tag: string }> = [
  { key: 'single', label: '솔로 · 새 인연', tag: '애정·솔로' },
  { key: 'crush', label: '짝사랑 · 마음 가는 사람', tag: '애정·짝사랑' },
  { key: 'flirting', label: '썸 · 알아가는 중', tag: '애정·썸' },
  { key: 'ambiguous', label: '관계가 애매한 사이', tag: '애정·관계 미정' },
  { key: 'couple', label: '연애 중', tag: '애정·연애 중' },
  { key: 'reunion_interest', label: '재회를 생각하는 경우', tag: '애정·재회 관심' },
]

function clean(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function fingerprint(value: unknown) {
  return clean(value).replace(/[\s.,!?·~→:;()\[\]-]+/g, '').replace(/(?:오늘|이번주|이번달|올해)/g, '')
}

function overlapRatio(a: string, b: string) {
  const left = new Set(clean(a).replace(/[^0-9a-z가-힣]+/gi, ' ').split(' ').filter(token => token.length >= 2))
  const right = new Set(clean(b).replace(/[^0-9a-z가-힣]+/gi, ' ').split(' ').filter(token => token.length >= 2))
  if (!left.size || !right.size) return 0
  const overlap = [...left].filter(token => right.has(token)).length
  return overlap / Math.min(left.size, right.size)
}

export function parseEditorialSections(value: string | undefined) {
  const raw = String(value ?? '').trim()
  const out = new Map<string, string>()
  if (!raw) return out
  const re = /\[([^\]]+)\]/g
  const hits = [...raw.matchAll(re)]
  if (!hits.length) return out
  for (let i = 0; i < hits.length; i++) {
    const key = clean(hits[i][1])
    const start = (hits[i].index ?? 0) + hits[i][0].length
    const end = i + 1 < hits.length ? (hits[i + 1].index ?? raw.length) : raw.length
    const text = clean(raw.slice(start, end))
    if (key && text) out.set(key, text)
  }
  return out
}

function topic(data: InterpretationData, name: string) {
  return data.topic_analysis?.[name]
}

function score(calculation: IntegratedApiResponse, name: string) {
  const value = calculation.western.overall?.[name]?.average
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function bandLabel(calculation: IntegratedApiResponse, name: string) {
  return clean(calculation.western.overall?.[name]?.band) || '정보 부족'
}

function fallbackLoveText(key: LoveContextKey, data: InterpretationData) {
  const love = clean(topic(data, '연애')?.verdict) || clean(data.clusters?.relationship)
  const contact = clean(topic(data, '연락')?.verdict)
  switch (key) {
    case 'single': return `${love} 특정 상대가 없다면 새 사람을 만날 접점과 실제 만남을 받아들일 여유를 중심으로 읽어.`
    case 'crush': return `${love} 마음 가는 사람이 있다면 호감 표현 하나보다 서로 질문하고 다음 약속을 잡는 반응이 있는지 확인해.`
    case 'flirting': return `${love} 알아가는 중이라면 대화가 실제 만남과 관계 기대 확인으로 이어지는지가 중요해.`
    case 'ambiguous': return `${love} 관계가 애매하다면 친밀감보다 서로 원하는 관계와 만남 전후의 일관성을 따로 확인해.`
    case 'couple': return `${love} 연애 중이라면 ${contact || '연락 횟수'}보다 함께 보내는 시간, 갈등 뒤 회복, 생활 리듬을 중심으로 읽어.`
    case 'reunion_interest': return `${love} 재회를 생각한다면 과거가 떠오르는 것과 실제 재접촉·만남·관계 재구축은 서로 다른 단계로 봐.`
  }
}

function loveContexts(data: InterpretationData) {
  const sections = parseEditorialSections(data.clusters?.relationship)
  return LOVE_CONTEXTS.map(item => ({
    key: item.key,
    label: item.label,
    text: sections.get(item.tag) || fallbackLoveText(item.key, data),
  }))
}

function directionSummary(calculation: IntegratedApiResponse) {
  const rel = calculation.western.relationship_signals ?? {}
  const incoming = rel['수신신호']?.average
  const outgoing = rel['발신적합']?.average
  if (!Number.isFinite(incoming) || !Number.isFinite(outgoing)) return '선연락 방향은 비교할 계산 정보가 충분하지 않아.'
  const diff = Number(incoming) - Number(outgoing)
  if (Math.abs(diff) < 5) return '선연락 방향은 두 쪽이 비슷해서 뚜렷한 우세가 없어.'
  return diff > 0
    ? '선연락 방향은 상대 → 나 쪽이 상대적으로 더 두드러져.'
    : '선연락 방향은 나 → 상대 쪽이 상대적으로 더 두드러져.'
}

function contactEditorial(data: InterpretationData, calculation: IntegratedApiResponse, sections: Map<string,string>): EditorialContact {
  const contactScore = score(calculation, '연락')
  const activation = sections.get('연락 전체')
    || clean(topic(data, '연락')?.verdict)
    || (contactScore == null ? '연락 전체 활성도를 판단할 정보가 부족해.' : `직접 연락·대화의 전체 활성도는 ${bandLabel(calculation, '연락')} 쪽이야.`)
  const continuity = sections.get('연락 지속')
    || clean(topic(data, '연락')?.action)
    || '연락이 생기면 한 번의 답장보다 질문과 답이 이어지고 실제 약속이 구체화되는지를 봐.'
  return {
    activation,
    continuity,
    incoming: clean(data.contact_flow?.incoming) || '상대 → 나 방향은 별도 계산값을 기준으로 봐.',
    outgoing: clean(data.contact_flow?.outgoing) || '나 → 상대 방향은 별도 계산값을 기준으로 봐.',
    directionSummary: directionSummary(calculation),
    timing: clean(topic(data, '연락')?.timing) || undefined,
  }
}

function interpersonalEditorial(data: InterpretationData, sections: Map<string,string>) {
  const base = topic(data, '대인관계')
  return {
    summary: sections.get('대인관계') || clean(base?.verdict) || '사람 사이의 협력, 거리 조절, 부탁과 거절, 의견 차이를 중심으로 읽어.',
    action: clean(base?.action) || '연락 횟수보다 실제 약속, 역할, 경계를 분명히 하는 쪽을 먼저 봐.',
    watch: clean(base?.avoid) || '한 번의 말투나 답장만으로 관계 전체를 결론 내리지 마.',
  }
}

function singleSectorCopies(data: InterpretationData, base: FortuneUserSummary) {
  const topicCopies = Object.values(data.topic_analysis ?? {}).flatMap(row => [row?.verdict, row?.reason, row?.action].map(clean).filter(Boolean))
  const viewCopies = base.focusTopics.flatMap(row => [row.conclusion, row.action, row.observe].map(clean).filter(Boolean))
  const cardCopies = [...base.favorableCards, ...base.cautionCards].map(row => clean(row.meaning)).filter(Boolean)
  return [...topicCopies, ...viewCopies, ...cardCopies]
}

function isSingleSectorCopy(value: string, copies: string[]) {
  const key = fingerprint(value)
  if (!key) return false
  return copies.some(copy => {
    const other = fingerprint(copy)
    if (!other) return false
    return key === other || (Math.min(key.length, other.length) >= 18 && (key.includes(other) || other.includes(key))) || overlapRatio(value, copy) >= 0.82
  })
}

function listTopics(values: string[]) {
  const unique = [...new Set(values)].slice(0, 2)
  if (!unique.length) return ''
  return unique.length === 1 ? unique[0] : `${unique[0]}·${unique[1]}`
}

function integratedFallback(base: FortuneUserSummary, calculation: IntegratedApiResponse) {
  const positive = base.bestFlow.length ? base.bestFlow : Object.entries(calculation.western.overall ?? {})
    .filter(([,stat]) => Number.isFinite(stat?.average) && Number(stat?.average) >= 52)
    .sort((a,b) => Number(b[1]?.average) - Number(a[1]?.average)).map(([name]) => name).slice(0,2)
  const caution = base.cautionFlow.length ? base.cautionFlow : Object.entries(calculation.western.overall ?? {})
    .filter(([name,stat]) => name !== '투자주의' && Number.isFinite(stat?.average) && Number(stat?.average) <= 40)
    .sort((a,b) => Number(a[1]?.average) - Number(b[1]?.average)).map(([name]) => name).slice(0,2)
  const good = listTopics(positive)
  const watch = listTopics(caution.filter(name => !positive.includes(name)))
  const headline = good && watch
    ? `${base.when}은 ${good} 쪽은 비교적 받쳐주고, ${watch} 쪽은 한 번 더 확인하면서 움직이는 날이야.`
    : good ? `${base.when}은 ${good} 쪽이 상대적으로 받쳐줘. 다른 분야까지 무리하게 확대하지 말고 이 강점을 필요한 곳에 써.`
      : watch ? `${base.when}은 ${watch} 쪽에서 서두르지 않는 게 중요해. 나머지는 평소 계획을 유지해.`
        : `${base.when}은 한 분야가 압도하기보다 전반적인 균형이 중요해. 실제 일정과 반응에 맞춰 우선순위를 조정해.`
  const summary = good && watch
    ? `${good}에서는 계획을 진행할 여지가 있고 ${watch}에서는 확인 절차를 더 두는 편이 안전해. 하루 전체로는 잘 되는 분야에 힘을 몰아주되, 약한 분야의 결정을 성급하게 확정하지 않는 게 핵심이야.`
    : good ? `${good}의 상대적 강점을 활용하되 다른 분야까지 같은 강도로 좋다고 확대하지 마. 전체 일정에서는 우선순위를 좁혀 실제로 끝낼 일을 만드는 쪽에 무게를 둬.`
      : watch ? `${watch}의 부담을 줄이는 게 전체 운영의 핵심이야. 중요한 결정은 확인 단계를 하나 더 두고, 나머지 분야는 평소 리듬을 유지해.`
        : `전 섹터가 크게 벌어지지 않아 특정 분야 하나로 하루를 정의하기 어렵다. 해야 할 일의 우선순위와 실제 체감 변화를 기준으로 속도를 조절해.`
  return { headline, summary }
}

function fieldHero(data: InterpretationData, calculation: IntegratedApiResponse, base: FortuneUserSummary, field: FortuneField | undefined, sections: Map<string,string>) {
  if (!field) {
    const copies = singleSectorCopies(data, base)
    const aiHeadline = clean(data.headline)
    const aiSummary = clean(data.overall?.summary)
    const fallback = integratedFallback(base, calculation)
    return {
      headline: aiHeadline && !isSingleSectorCopy(aiHeadline, copies) ? aiHeadline : fallback.headline,
      summary: aiSummary && !isSingleSectorCopy(aiSummary, copies) ? aiSummary : fallback.summary,
    }
  }
  if (field.id === 'love') return {
    headline: `${base.when} 애정운은 관계 상태별로 나눠 읽어.`,
    summary: sections.get('애정 공통') || clean(topic(data, '연애')?.reason) || '솔로, 짝사랑, 썸, 애매한 관계, 연애 중, 재회 관심은 같은 계산을 서로 다른 현실 질문으로 읽어야 해.',
  }
  if (field.id === 'social') return {
    headline: `${base.when} 대인관계는 연락보다 사람 사이의 역할과 거리를 먼저 봐.`,
    summary: sections.get('대인관계') || clean(topic(data, '대인관계')?.reason) || base.summary,
  }
  if (field.id === 'contact') return {
    headline: `${base.when} 연락은 전체 활성도와 선연락 방향을 따로 봐.`,
    summary: sections.get('연락 전체') || clean(topic(data, '연락')?.reason) || base.summary,
  }
  const firstTopic = field.topics[0]
  const row = topic(data, firstTopic)
  return {
    headline: clean(row?.verdict) || base.headline,
    summary: clean(row?.reason) || clean(data.overall?.summary) || base.summary,
  }
}

export function buildFortuneEditorialV3(data: InterpretationData, calculation: IntegratedApiResponse, base: FortuneUserSummary, field?: FortuneField): FortuneEditorialV3 {
  const sections = parseEditorialSections(data.clusters?.relationship)
  const hero = fieldHero(data, calculation, base, field, sections)
  return {
    heroHeadline: hero.headline,
    heroSummary: hero.summary,
    interpersonal: field?.id === 'social' ? interpersonalEditorial(data, sections) : undefined,
    contact: field?.id === 'contact' ? contactEditorial(data, calculation, sections) : undefined,
    loveContexts: field?.id === 'love' ? loveContexts(data) : undefined,
    loveGeneral: field?.id === 'love' ? (sections.get('애정 공통') || clean(data.clusters?.relationship)) : undefined,
  }
}
