import type { AiInterpretationResponse, IntegratedApiResponse } from '../appTypes'
import type { FortuneField } from './fortuneFields'
import type { FortuneUserSummary } from './fortuneUserSummary'

type InterpretationData = NonNullable<AiInterpretationResponse['data']>

export type LoveContextKey = 'single' | 'crush' | 'flirting' | 'ambiguous' | 'couple' | 'reunion_interest'
export type LoveContextReading = { key: LoveContextKey; label: string; text: string }
export type InterpersonalContextKey = 'friends' | 'coworkers' | 'family' | 'new_people' | 'boundaries'
export type InterpersonalContextReading = { key: InterpersonalContextKey; label: string; text: string }
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
  interpersonalContexts?: InterpersonalContextReading[]
  contact?: EditorialContact
  loveContexts?: LoveContextReading[]
  loveGeneral?: string
  topicEditorial: Record<string, string>
}

const LOVE_CONTEXTS: Array<{ key: LoveContextKey; label: string; field: string }> = [
  { key: 'single', label: '솔로 · 새 인연', field: 'love_single' },
  { key: 'crush', label: '짝사랑 · 마음 가는 사람', field: 'love_crush' },
  { key: 'flirting', label: '썸 · 알아가는 중', field: 'love_flirting' },
  { key: 'ambiguous', label: '관계가 애매한 사이', field: 'love_ambiguous' },
  { key: 'couple', label: '연애 중', field: 'love_couple' },
  { key: 'reunion_interest', label: '재회를 생각하는 경우', field: 'love_reunion_interest' },
]

const INTERPERSONAL_CONTEXTS: Array<{ key: InterpersonalContextKey; label: string; field: string }> = [
  { key: 'friends', label: '친구 · 지인', field: 'friends' },
  { key: 'coworkers', label: '직장동료 · 협업 상대', field: 'coworkers' },
  { key: 'family', label: '가족 · 가까운 사람', field: 'family' },
  { key: 'new_people', label: '새 인맥 · 모임', field: 'new_people' },
  { key: 'boundaries', label: '갈등 · 경계', field: 'boundaries' },
]

const TECHNICAL_RE = /(?:태양|수성|금성|화성|목성|토성|천왕성|해왕성|명왕성|노드|하우스|트랜짓|프로그레스|컴포지트|시너스트리|삼분|사분|육합|육파|오브|\d+도각|사주\s*(?:일지|월지|시주)|[甲乙丙丁戊己庚辛壬癸寅卯辰巳午未申酉戌亥子丑])/i

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

function readerFacing(value: string) {
  const text = clean(value)
  if (!text || text.length < 10) return false
  if (TECHNICAL_RE.test(text)) return false
  if (/계산\s*(?:엔진|로직|threshold|오브)|(?:상대|절대)\s*확률/i.test(text)) return false
  return true
}

function firstSentence(value: string) {
  const text = clean(value)
  const match = text.match(/^(.+?[.!?])(?:\s|$)/)
  return clean(match?.[1] ?? text)
}

export function sectionCopy(value: any) {
  if (!value || typeof value !== 'object') return ''
  return [value.conclusion, value.real_scene, value.action, value.change_condition].map(clean).filter(Boolean).join(' ')
}

export function editorialGroupCopy(value:any) {
  if (!value || typeof value !== 'object') return ''
  return Object.values(value).map(sectionCopy).filter(Boolean).join('\n\n')
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

function topicEditorial(data: InterpretationData) {
  const relationship = data.clusters?.relationship
  const workStudy = data.clusters?.work_study
  const moneyNews = data.clusters?.money_news
  const investment = data.clusters?.investment
  const condition = data.clusters?.condition
  const candidates: Record<string, string | undefined> = {
    '대인관계': sectionCopy(relationship?.summary), '연애': sectionCopy(relationship?.love_general),
    '연락': sectionCopy(relationship?.contact_activation), '재회': sectionCopy(relationship?.love_reunion_interest),
    '직장': sectionCopy(workStudy?.work), '이직': sectionCopy(workStudy?.career_change),
    '시험': sectionCopy(workStudy?.exam), '학업': sectionCopy(workStudy?.study),
    '컨디션': sectionCopy(condition?.condition), '금전': sectionCopy(moneyNews?.money),
    '소식': sectionCopy(moneyNews?.news), '투자심리': sectionCopy(investment?.psychology),
    '수익실현': sectionCopy(investment?.realization), '신규진입': sectionCopy(investment?.entry),
  }
  return Object.fromEntries(Object.entries(candidates)
    .map(([key, value]) => [key, clean(value)])
    .filter(([, value]) => readerFacing(value))) as Record<string, string>
}

function fallbackLoveText(key: LoveContextKey, data: InterpretationData) {
  const love = clean(topic(data, '연애')?.verdict) || sectionCopy(data.clusters?.relationship?.love_general)
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
  const sections:any = data.clusters?.relationship ?? {}
  return LOVE_CONTEXTS.map(item => ({
    key: item.key,
    label: item.label,
    text: sectionCopy(sections[item.field]) || fallbackLoveText(item.key, data),
  }))
}

function interpersonalContexts(data: InterpretationData) {
  const sections:any = data.clusters?.relationship ?? {}
  const general = sectionCopy(sections.summary)
  return INTERPERSONAL_CONTEXTS.map(item => {
    const specific = sectionCopy(sections[item.field])
    return {
      key: item.key,
      label: item.label,
      text: specific || (general ? `${general} 이 범주에 해당하는 실제 약속·역할·거리 변화를 기준으로 읽어.` : '이 관계 범주를 따로 해석할 AI 원고가 아직 없어.'),
    }
  })
}

function directionSummary(calculation: IntegratedApiResponse) {
  const rel = calculation.western.relationship_signals ?? {}
  const incoming = rel['수신신호']?.average
  const outgoing = rel['발신적합']?.average
  if (!Number.isFinite(incoming) || !Number.isFinite(outgoing)) return '선연락 방향은 비교할 계산 정보가 충분하지 않아.'
  const a = Number(incoming)
  const b = Number(outgoing)
  const diff = a - b
  const roundedA = Math.round(a)
  const roundedB = Math.round(b)
  if (diff === 0) return `상대 → 나 ${roundedA}, 나 → 상대 ${roundedB}. 계산상 같은 값이라 선연락 주체는 구분되지 않아.`
  if (Math.abs(diff) < 5) {
    const micro = diff > 0 ? '상대 → 나' : '나 → 상대'
    return `${micro}가 ${Math.abs(roundedA - roundedB)}점 높지만 판정상 동률권이야. 상대 → 나 ${roundedA}, 나 → 상대 ${roundedB}라 어느 쪽이 실제로 먼저 연락한다고 밀어 읽을 정도는 아니야.`
  }
  return diff > 0
    ? `상대 → 나 ${roundedA}, 나 → 상대 ${roundedB}. 이번 범위에서는 상대 → 나 방향이 더 두드러져.`
    : `상대 → 나 ${roundedA}, 나 → 상대 ${roundedB}. 이번 범위에서는 나 → 상대 방향이 더 두드러져.`
}

function contactEditorial(data: InterpretationData, calculation: IntegratedApiResponse, sections:any): EditorialContact {
  const contactScore = score(calculation, '연락')
  const activation = sectionCopy(sections?.contact_activation)
    || clean(topic(data, '연락')?.verdict)
    || (contactScore == null ? '연락 전체 활성도를 판단할 정보가 부족해.' : `직접 연락·대화의 전체 활성도는 ${bandLabel(calculation, '연락')} 쪽이야.`)
  const continuity = sectionCopy(sections?.contact_continuity)
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

function interpersonalEditorial(data: InterpretationData, sections:any) {
  const base = topic(data, '대인관계')
  return {
    summary: sectionCopy(sections?.summary) || clean(base?.verdict) || '친구·지인, 직장동료, 가족·가까운 사람처럼 관계 종류별로 나눠 읽어.',
    action: clean(base?.action) || '누구와 무엇을 조율해야 하는지 관계별 실제 장면을 먼저 봐.',
    watch: clean(base?.avoid) || '한 관계에서 생긴 일을 모든 인간관계의 결론으로 확대하지 마.',
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
    ? `${base.when}은 ${good} 쪽은 비교적 받쳐주고, ${watch} 쪽은 한 번 더 확인하면서 움직이는 흐름이야.`
    : good ? `${base.when}은 ${good} 쪽이 상대적으로 받쳐줘. 다른 분야까지 무리하게 확대하지 말고 이 강점을 필요한 곳에 써.`
      : watch ? `${base.when}은 ${watch} 쪽에서 서두르지 않는 게 중요해. 나머지는 평소 계획을 유지해.`
        : `${base.when}은 한 분야가 압도하기보다 전반적인 균형이 중요해. 실제 일정과 반응에 맞춰 우선순위를 조정해.`
  const summary = good && watch
    ? `${good}에서는 계획을 진행할 여지가 있고 ${watch}에서는 확인 절차를 더 두는 편이 안전해. 기간 전체로는 잘 되는 분야에 힘을 몰아주되, 약한 분야의 결정을 성급하게 확정하지 않는 게 핵심이야.`
    : good ? `${good}의 상대적 강점을 활용하되 다른 분야까지 같은 강도로 좋다고 확대하지 마. 기간 전체에서는 우선순위를 좁혀 실제로 끝낼 일을 만드는 쪽에 무게를 둬.`
      : watch ? `${watch}의 부담을 줄이는 게 기간 전체 운영의 핵심이야. 중요한 결정은 확인 단계를 하나 더 두고, 나머지 분야는 평소 리듬을 유지해.`
        : `전 섹터가 크게 벌어지지 않아 특정 분야 하나로 기간 전체를 정의하기 어렵다. 해야 할 일의 우선순위와 실제 체감 변화를 기준으로 속도를 조절해.`
  return { headline, summary }
}

function fieldHero(data: InterpretationData, calculation: IntegratedApiResponse, base: FortuneUserSummary, field: FortuneField | undefined, sections:any, editorialTopics: Record<string,string>) {
  if (!field) {
    const copies = singleSectorCopies(data, base)
    const aiHeadline = clean(data.headline)
    const aiSummary = clean(data.overall?.summary)
    const fallback = integratedFallback(base, calculation)
    return {
      headline: readerFacing(aiHeadline) && !isSingleSectorCopy(aiHeadline, copies) ? aiHeadline : fallback.headline,
      summary: readerFacing(aiSummary) && !isSingleSectorCopy(aiSummary, copies) ? aiSummary : fallback.summary,
    }
  }
  if (field.id === 'love') return {
    headline: `${base.when} 애정운은 관계 상태별로 나눠 읽어.`,
    summary: sectionCopy(sections?.love_general) || clean(topic(data, '연애')?.reason) || '솔로, 짝사랑, 썸, 애매한 관계, 연애 중, 재회 관심은 같은 계산을 서로 다른 현실 질문으로 읽어야 해.',
  }
  if (field.id === 'social') return {
    headline: `${base.when} 대인관계는 관계 종류별로 나눠 봐야 해.`,
    summary: sectionCopy(sections?.summary) || clean(topic(data, '대인관계')?.reason) || base.summary,
  }
  if (field.id === 'contact') return {
    headline: `${base.when} 연락은 전체 활성도와 선연락 방향을 따로 봐.`,
    summary: sectionCopy(sections?.contact_activation) || clean(topic(data, '연락')?.reason) || base.summary,
  }
  const firstTopic = field.topics[0]
  const row = topic(data, firstTopic)
  const aiTopic = clean(editorialTopics[firstTopic])
  return {
    headline: aiTopic ? firstSentence(aiTopic) : clean(row?.verdict) || base.headline,
    summary: aiTopic || clean(row?.reason) || clean(data.overall?.summary) || base.summary,
  }
}

export function buildFortuneEditorialV3(data: InterpretationData, calculation: IntegratedApiResponse, base: FortuneUserSummary, field?: FortuneField): FortuneEditorialV3 {
  const sections = data.clusters?.relationship ?? {}
  const editorialTopics = topicEditorial(data)
  const hero = fieldHero(data, calculation, base, field, sections, editorialTopics)
  return {
    heroHeadline: hero.headline,
    heroSummary: hero.summary,
    interpersonal: field?.id === 'social' ? interpersonalEditorial(data, sections) : undefined,
    interpersonalContexts: field?.id === 'social' ? interpersonalContexts(data) : undefined,
    contact: field?.id === 'contact' ? contactEditorial(data, calculation, sections) : undefined,
    loveContexts: field?.id === 'love' ? loveContexts(data) : undefined,
    loveGeneral: field?.id === 'love' ? sectionCopy(sections?.love_general) : undefined,
    topicEditorial: editorialTopics,
  }
}
