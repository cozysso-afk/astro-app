import type { AiDomainAnswer, AiInterpretationResponse, IntegratedApiResponse } from '../appTypes'
import type { FortuneField } from './fortuneFields'
import type { FortuneUserSummary } from './fortuneUserSummary'

type InterpretationData = NonNullable<AiInterpretationResponse['data']>
type EditorialApplicability = 'direct' | 'conditional' | 'insufficient'

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
export type DomainAnswerReading = { topic:string; questionKey:string; label:string; answer:string; status:'direct'|'partial' }
export type FortuneEditorialV3 = {
  heroHeadline: string
  heroSummary: string
  interpersonal?: { summary: string; action: string; watch: string }
  interpersonalContexts?: InterpersonalContextReading[]
  contact?: EditorialContact
  loveContexts?: LoveContextReading[]
  loveGeneral?: string
  topicEditorial: Record<string, string>
  domainAnswers: Record<string, DomainAnswerReading[]>
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
const RELATIONSHIP_META_RE = /(?:AI\s*원고|원고가 아직|별도\s*계산값|계산\s*(?:값|정보|근거|엔진|로직)|계산상|상대지수|활성도|판정상|threshold|스키마|클러스터|evidence_refs|applicability|출력\s*형식)/i
const CHANGE_TRIGGER_RE = /(?:(?:하|되|오|가|있|없|나|잡히|이어지|끊기|바뀌|달라지|변하|생기|발생하|나오|도착하|제안하|응답하|반응하|줄|늘|없어지|나타나|정해지|확정되|확인되)(?:으면|면)|(?:이라면|라면|이면|다면))(?=\s|[,.!?]|$)|(?:경우|때|순간|뒤|후|전)(?=\s|[,.!?]|$)/i
const VAGUE_CHANGE_RE = /^(?:상황|흐름|분위기)(?:이|가|을|를)?\s*(?:바뀌|달라지|변하|보|살피)/i

function clean(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function sectionApplicability(value: any): EditorialApplicability {
  const applicability = clean(value?.applicability)
  if (applicability === 'direct' || applicability === 'conditional' || applicability === 'insufficient') return applicability
  // Older cached structured objects may not carry this field. Keep them visible,
  // but treat them as conditional rather than silently upgrading them to direct.
  return 'conditional'
}

function editorialSectionUsable(value: any) {
  return Boolean(value) && typeof value === 'object' && sectionApplicability(value) !== 'insufficient'
}

export function editorialSectionComplete(value: any) {
  if (!editorialSectionUsable(value)) return false
  return [value.conclusion, value.real_scene, value.action, value.change_condition]
    .map(clean)
    .every(Boolean)
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

function nearDuplicate(a: string, b: string) {
  const left = fingerprint(a)
  const right = fingerprint(b)
  if (!left || !right) return false
  if (left === right) return true
  if (Math.min(left.length, right.length) >= 16 && (left.includes(right) || right.includes(left))) return true
  const leftTokens = new Set(clean(a).replace(/[^0-9a-z가-힣]+/gi, ' ').split(' ').filter(token => token.length >= 2))
  const rightTokens = new Set(clean(b).replace(/[^0-9a-z가-힣]+/gi, ' ').split(' ').filter(token => token.length >= 2))
  if (Math.min(leftTokens.size, rightTokens.size) < 4) return false
  return overlapRatio(a, b) >= 0.82
}

function observableChangeCondition(value: unknown) {
  const text = clean(value)
  if (text.length < 10 || VAGUE_CHANGE_RE.test(text)) return false
  return CHANGE_TRIGGER_RE.test(text)
}

export function editorialSectionReady(value: any) {
  if (!editorialSectionComplete(value)) return false
  const parts = [value.conclusion, value.real_scene, value.action, value.change_condition].map(clean)
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      if (nearDuplicate(parts[i], parts[j])) return false
    }
  }
  return observableChangeCondition(value.change_condition)
}


export function editorialTopicCoreReady(value: any) {
  if (!editorialSectionUsable(value)) return false
  const parts = [value.conclusion, value.real_scene, value.action].map(clean)
  if (!parts.every(Boolean)) return false
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      if (nearDuplicate(parts[i], parts[j])) return false
    }
  }
  return true
}

export function topicSectionCopy(value: any) {
  if (!editorialTopicCoreReady(value)) return ''
  const parts = [value.conclusion, value.real_scene, value.action].map(clean)
  const change = clean(value.change_condition)
  if (change && observableChangeCondition(change) && parts.every(part => !nearDuplicate(part, change))) {
    parts.push(change)
  }
  return parts.join(' ')
}

function readerFacing(value: string) {
  const text = clean(value)
  if (!text || text.length < 10) return false
  // Technical evidence belongs in the explanation layer, but its presence must not
  // discard the entire authored conclusion/scene/action block. Meta/system copy is still rejected.
  if (/계산\s*(?:엔진|로직|threshold|오브)|(?:상대|절대)\s*확률/i.test(text)) return false
  return true
}

function relationshipPartUsable(value: unknown) {
  const text = clean(value)
  return Boolean(text) && !TECHNICAL_RE.test(text) && !RELATIONSHIP_META_RE.test(text)
}

function firstSentence(value: string) {
  const text = clean(value)
  const match = text.match(/^(.+?[.!?])(?:\s|$)/)
  return clean(match?.[1] ?? text)
}

export function sectionCopy(value: any) {
  if (!editorialSectionReady(value)) return ''
  return [value.conclusion, value.real_scene, value.action, value.change_condition].map(clean).join(' ')
}

export function relationshipSectionCopy(value: any) {
  if (!editorialSectionUsable(value)) return ''
  return [value.conclusion, value.real_scene, value.action, value.change_condition]
    .map(clean)
    .filter(part => relationshipPartUsable(part))
    .join(' ')
}

export function editorialGroupCopy(value:any) {
  if (typeof value === 'string') return clean(value)
  if (!value || typeof value !== 'object') return ''
  return Object.values(value).map(sectionCopy).filter(Boolean).join('\n\n')
}

function topic(data: InterpretationData, name: string) {
  return data.topic_analysis?.[name]
}

function domainAnswers(data: InterpretationData) {
  const rows=(Array.isArray(data.domain_answers)?data.domain_answers:[]) as AiDomainAnswer[]
  const grouped:Record<string,DomainAnswerReading[]>={}
  for(const row of rows){
    if(!row || (row.status!=='direct' && row.status!=='partial')) continue
    const answer=clean(row.answer)
    if(!answer || !readerFacing(answer) || !row.evidence_refs?.some(ref => typeof ref === 'string' && ref.trim())) continue
    const item:DomainAnswerReading={topic:clean(row.topic),questionKey:clean(row.question_key),label:clean(row.label),answer,status:row.status}
    if(!item.topic||!item.questionKey||!item.label) continue
    grouped[item.topic] ??= []
    if(!grouped[item.topic].some(existing=>existing.questionKey===item.questionKey)) grouped[item.topic].push(item)
  }
  return grouped
}

function topicEditorial(data: InterpretationData) {
  const relationship = data.clusters?.relationship
  const workStudy = data.clusters?.work_study
  const moneyNews = data.clusters?.money_news
  const investment = data.clusters?.investment
  const condition = data.clusters?.condition
  const candidates: Record<string, any> = {
    '대인관계': relationship?.summary, '연애': relationship?.love_general,
    '연락': relationship?.contact_activation, '재회': relationship?.love_reunion_interest,
    '직장': workStudy?.work, '이직': workStudy?.career_change,
    '시험': workStudy?.exam, '학업': workStudy?.study,
    '컨디션': condition?.condition, '금전': moneyNews?.money,
    '소식': moneyNews?.news, '투자심리': investment?.psychology,
    '수익실현': investment?.realization, '신규진입': investment?.entry,
  }
  return Object.fromEntries(Object.entries(candidates).flatMap(([key, section]) => {
    const value = clean(topicSectionCopy(section))
    if (!readerFacing(value)) return []
    return [[key, value]]
  })) as Record<string, string>
}

function loveContexts(data: InterpretationData) {
  const sections:any = data.clusters?.relationship ?? {}
  return LOVE_CONTEXTS.flatMap(item => {
    const text = relationshipSectionCopy(sections[item.field])
    return text ? [{ key: item.key, label: item.label, text }] : []
  })
}

function interpersonalContexts(data: InterpretationData) {
  const sections:any = data.clusters?.relationship ?? {}
  return INTERPERSONAL_CONTEXTS.flatMap(item => {
    const specific = relationshipSectionCopy(sections[item.field])
    return specific ? [{ key: item.key, label: item.label, text: specific }] : []
  })
}

function contactEditorial(data: InterpretationData, _calculation: IntegratedApiResponse, sections:any): EditorialContact | undefined {
  const topicVerdict = clean(topic(data, '연락')?.verdict)
  const topicAction = clean(topic(data, '연락')?.action)
  const incoming = clean(data.contact_flow?.incoming)
  const outgoing = clean(data.contact_flow?.outgoing)
  const timing = clean(topic(data, '연락')?.timing)
  const activation = relationshipSectionCopy(sections?.contact_activation)
    || (relationshipPartUsable(topicVerdict) ? topicVerdict : '')
  const contactContinuity = relationshipSectionCopy(sections?.contact_continuity)
    || (relationshipPartUsable(topicAction) ? topicAction : '')
  const continuity = contactContinuity
  const safeIncoming = relationshipPartUsable(incoming) && !/(상대\s*→\s*나|수신|먼저\s*(?:오|연락))/.test(incoming)
    ? incoming
    : ''
  const safeOutgoing = relationshipPartUsable(outgoing) && !/(나\s*→\s*상대|발신|선연락\s*주체)/.test(outgoing)
    ? outgoing
    : ''
  if (!activation && !continuity && !safeIncoming && !safeOutgoing) return undefined
  return {
    activation,
    continuity,
    incoming: safeIncoming,
    outgoing: safeOutgoing,
    directionSummary: '',
    timing: relationshipPartUsable(timing) ? timing : undefined,
  }
}

function interpersonalEditorial(data: InterpretationData, sections:any) {
  const base = topic(data, '대인관계')
  const action = clean(base?.action)
  const watch = clean(base?.avoid)
  const summary = relationshipSectionCopy(sections?.summary) || (relationshipPartUsable(base?.verdict) ? clean(base?.verdict) : '')
  if (!summary) return undefined
  return { summary, action: relationshipPartUsable(action) ? action : '', watch: relationshipPartUsable(watch) ? watch : '' }
}

function singleSectorCopies(data: InterpretationData, base: FortuneUserSummary) {
  const topicCopies = Object.values(data.topic_analysis ?? {}).flatMap(row => [row?.verdict, row?.reason, row?.action].map(clean).filter(Boolean))
  const viewCopies = base.focusTopics.flatMap(row => [row.conclusion, row.action, row.observe].map(clean).filter(Boolean))
  const cardCopies = [...base.favorableCards, ...base.cautionCards].map(row => clean(row.meaning)).filter(Boolean)
  const relationshipCopies = base.relationship
    ? [base.relationship.incoming, base.relationship.outgoing, base.relationship.reconnection].map(clean).filter(Boolean)
    : []
  return [...topicCopies, ...viewCopies, ...cardCopies, ...relationshipCopies]
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

function isSectorStitch(value: string, copies: string[]) {
  const sentences = clean(value).match(/[^.!?]+[.!?]?/g)?.map(clean).filter(sentence => sentence.length >= 10) ?? []
  if (sentences.length < 2) return false
  const matched = sentences.filter(sentence => isSingleSectorCopy(sentence, copies))
  return matched.length >= 2
}

function fieldHero(data: InterpretationData, calculation: IntegratedApiResponse, base: FortuneUserSummary, field: FortuneField | undefined, sections:any, editorialTopics: Record<string,string>) {
  if (!field) {
    const copies = singleSectorCopies(data, base)
    const aiHeadline = clean(data.headline)
    const aiSummary = clean(data.overall?.summary)
    return {
      headline: readerFacing(aiHeadline) && !isSingleSectorCopy(aiHeadline, copies) && !isSectorStitch(aiHeadline, copies) ? aiHeadline : '',
      summary: readerFacing(aiSummary) && !isSingleSectorCopy(aiSummary, copies) && !isSectorStitch(aiSummary, copies) ? aiSummary : '',
    }
  }
  if (field.id === 'love' || field.id === 'social' || field.id === 'contact') {
    const name = field.id === 'love' ? '연애' : field.id === 'social' ? '대인관계' : '연락'
    const cluster = field.id === 'love' ? sections?.love_general
      : field.id === 'social' ? sections?.summary : sections?.contact_activation
    const clusterText = relationshipSectionCopy(cluster)
    const authored = clean(topic(data, name)?.verdict)
    const chosen = [firstSentence(clusterText), authored]
      .find(part => readerFacing(clean(part)) && relationshipPartUsable(part)) ?? ''
    const relatedSummary = clean(topic(data, name)?.reason)
    return {
      headline: chosen,
      summary: clusterText || relatedSummary,
    }
  }
  const firstTopic = field.topics[0]
  const row = topic(data, firstTopic)
  const aiTopic = clean(editorialTopics[firstTopic])
  return {
    headline: aiTopic ? firstSentence(aiTopic) : clean(row?.verdict),
    summary: aiTopic || clean(row?.reason) || clean(data.overall?.summary),
  }
}

export function buildFortuneEditorialV3(data: InterpretationData, calculation: IntegratedApiResponse, base: FortuneUserSummary, field?: FortuneField): FortuneEditorialV3 {
  const sections = data.clusters?.relationship ?? {}
  const editorialTopics = topicEditorial(data)
  const hero = fieldHero(data, calculation, base, field, sections, editorialTopics)
  const loveRows = field?.id === 'love' ? loveContexts(data) : []
  const interpersonalRows = field?.id === 'social' ? interpersonalContexts(data) : []
  return {
    heroHeadline: hero.headline,
    heroSummary: hero.summary,
    interpersonal: field?.id === 'social' ? interpersonalEditorial(data, sections) : undefined,
    interpersonalContexts: interpersonalRows.length ? interpersonalRows : undefined,
    contact: field?.id === 'contact' ? contactEditorial(data, calculation, sections) : undefined,
    loveContexts: loveRows.length ? loveRows : undefined,
    loveGeneral: field?.id === 'love' ? relationshipSectionCopy(sections?.love_general) : undefined,
    topicEditorial: editorialTopics,
    domainAnswers: domainAnswers(data),
  }
}


/**
 * V23.9 Gemini ownership boundary.
 * This renderer may select or omit authored sections, but must never synthesize
 * interpretive sentences from scores, defaults or UI fallback dictionaries.
 * Legacy deterministic presentations continue through buildFortuneEditorialV3.
 */
export function buildGeminiAuthoredEditorialV23(data: InterpretationData, field?: FortuneField): FortuneEditorialV3 {
  const relationship: any = data.clusters?.relationship ?? {}
  const allClusters: any = data.clusters ?? {}
  const direct = (value: unknown) => clean(value)
  const section = (value: unknown) => relationshipSectionCopy(value)
  const authoredTopics = topicEditorial(data)
  // Undo the older presentation-only conditional prefix: Gemini is the author.
  const topics = Object.fromEntries(Object.entries(authoredTopics).map(([key]) => {
    const candidate: any = {
      '대인관계': relationship.summary, '연애': relationship.love_general,
      '연락': relationship.contact_activation, '재회': relationship.love_reunion_interest,
      '직장': allClusters.work_study?.work, '이직': allClusters.work_study?.career_change,
      '시험': allClusters.work_study?.exam, '학업': allClusters.work_study?.study,
      '컨디션': allClusters.condition?.condition, '금전': allClusters.money_news?.money,
      '소식': allClusters.money_news?.news, '투자심리': allClusters.investment?.psychology,
      '수익실현': allClusters.investment?.realization, '신규진입': allClusters.investment?.entry,
    }[key]
    const copy = topicSectionCopy(candidate)
    return [key, copy]
  }).filter(([, value]) => readerFacing(value))) as Record<string,string>
  const first = field?.topics?.[0] ?? ''
  const fieldSections: Record<string, any> = {
    love: relationship.love_general, social: relationship.summary,
    contact: relationship.contact_activation,
  }
  const fieldSection = field ? fieldSections[field.id] : undefined
  const heroHeadline = !field
    ? direct(data.headline)
    : (direct(fieldSection?.conclusion) || direct(topic(data, first)?.verdict))
  const heroSummary = !field
    ? direct(data.overall?.summary)
    : (section(fieldSection) || topics[first] || direct(topic(data, first)?.reason))
  const loveContextsAuthored = LOVE_CONTEXTS
    .map(item => ({ key: item.key, label: item.label, text: section(relationship[item.field]) }))
    .filter(row => Boolean(row.text))
  const socialContextsAuthored = INTERPERSONAL_CONTEXTS
    .map(item => ({ key: item.key, label: item.label, text: section(relationship[item.field]) }))
    .filter(row => Boolean(row.text))
  const contactActivation = section(relationship.contact_activation)
  const contactContinuity = section(relationship.contact_continuity)
  const incoming = direct(data.contact_flow?.incoming)
  const outgoing = direct(data.contact_flow?.outgoing)
  return {
    heroHeadline,
    heroSummary,
    interpersonal: field?.id === 'social' && section(relationship.summary)
      ? { summary: section(relationship.summary), action: direct(topic(data, '대인관계')?.action), watch: direct(topic(data, '대인관계')?.avoid) }
      : undefined,
    interpersonalContexts: field?.id === 'social' ? socialContextsAuthored : undefined,
    contact: field?.id === 'contact' && (contactActivation || contactContinuity)
      ? { activation: contactActivation, continuity: contactContinuity, incoming, outgoing, directionSummary: '', timing: direct(topic(data, '연락')?.timing) || undefined }
      : undefined,
    loveContexts: field?.id === 'love' ? loveContextsAuthored : undefined,
    loveGeneral: field?.id === 'love' ? section(relationship.love_general) : undefined,
    topicEditorial: topics,
    domainAnswers: domainAnswers(data),
  }
}
