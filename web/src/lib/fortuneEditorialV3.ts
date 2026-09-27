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
    summary: sections.get('대인관계') || clean(base?.verdict) || clean(data.clusters?.relationship) || '사람 사이의 협력, 거리 조절, 부탁과 거절, 의견 차이를 중심으로 읽어.',
    action: clean(base?.action) || '연락 횟수보다 실제 약속, 역할, 경계를 분명히 하는 쪽을 먼저 봐.',
    watch: clean(base?.avoid) || '한 번의 말투나 답장만으로 관계 전체를 결론 내리지 마.',
  }
}

function fieldHero(data: InterpretationData, base: FortuneUserSummary, field: FortuneField | undefined, sections: Map<string,string>) {
  if (!field) {
    return {
      headline: clean(data.headline) || base.headline,
      summary: clean(data.overall?.summary) || base.summary,
    }
  }
  if (field.id === 'love') return {
    headline: `${base.when} 애정운은 관계 상태별로 나눠 읽어.` ,
    summary: sections.get('애정 공통') || clean(topic(data, '연애')?.reason) || '솔로, 짝사랑, 썸, 애매한 관계, 연애 중, 재회 관심은 같은 계산을 서로 다른 현실 질문으로 읽어야 해.',
  }
  if (field.id === 'social') return {
    headline: `${base.when} 대인관계는 연락보다 사람 사이의 역할과 거리를 먼저 봐.`,
    summary: sections.get('대인관계') || clean(topic(data, '대인관계')?.reason) || clean(data.clusters?.relationship) || base.summary,
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
  const hero = fieldHero(data, base, field, sections)
  return {
    heroHeadline: hero.headline,
    heroSummary: hero.summary,
    interpersonal: field?.id === 'social' ? interpersonalEditorial(data, sections) : undefined,
    contact: field?.id === 'contact' ? contactEditorial(data, calculation, sections) : undefined,
    loveContexts: field?.id === 'love' ? loveContexts(data) : undefined,
    loveGeneral: field?.id === 'love' ? (sections.get('애정 공통') || clean(data.clusters?.relationship)) : undefined,
  }
}
