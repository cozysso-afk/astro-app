/**
 * Reader-facing audit. Each rule comes from a defect a reader actually saw on
 * the phone (2026-11-17 review): empty fields, definitions instead of readings,
 * a year explained by one Moon contact, a month explained by one day pillar,
 * internal wording ("표본", "근거가 부족"), polite endings mixed into 반말,
 * the same anchor repeated in every field. Issues carry codes and paths only,
 * never the generated prose.
 */
export const READER_AUDIT_VERSION = 'reader-facing-audit-v1'

const FIELD_TOPICS = ['연애', '대인관계', '학업', '직장', '금전', '컨디션']
const SLOW = /목성|토성|천왕성|해왕성|명왕성/
const FAST = /(?<![가-힣])달(?:이|과|의|은|을|과의)|수성|금성|화성|태양/
const INTERNAL = /표본|근거가 부족|근거 부족|데이터|계산되지|보장하지 않|독립 근거|evidence|근거\s?ID|활성화 수치|움직임 수치|not_calculated|insufficient/i
const JARGON = /마크스 차트|데이비슨|컴포짓|오브\s?\d|\borb\b|synastry|transit|트랜짓|시너스트리/i
const POLITE = /(?:요|니다|세요)[.!?]?\s*$/
const DEFINITION = /(?:을|를|은|는)?\s*(?:뜻해|뜻이야|뜻을 지녀|뜻을 나타내|상징해|나타내|의미해|의미를 지녀|맡아|가리켜|담당해)\s*[.!]?\s*$/

function text(value) { return typeof value === 'string' ? value.trim() : '' }
function sentences(value) { return text(value).split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean) }
export function isDefinitionOnly(value) {
  const parts = sentences(value)
  return parts.length < 2 || parts.every(part => DEFINITION.test(part))
}

// Every prose string a reader can see, with a stable path.
export function readerProse(data) {
  const out = []
  const push = (path, value) => { const t = text(value); if (t) out.push({ path, text: t }) }
  if (!data || typeof data !== 'object') return out
  push('headline', data.headline)
  for (const key of ['summary', 'dominant_pattern', 'best_phase', 'caution_phase']) push(`overall.${key}`, data.overall?.[key])
  push('limits', data.limits)
  for (const [key, value] of Object.entries(data.systems ?? {})) push(`systems.${key}`, value)
  for (const [group, sections] of Object.entries(data.clusters ?? {})) {
    for (const [key, section] of Object.entries(sections ?? {})) {
      for (const field of ['conclusion', 'applies_when', 'evidence_meaning', 'action', 'change_condition'])
        push(`clusters.${group}.${key}.${field}`, section?.[field])
    }
  }
  ;(data.system_field_readings ?? []).forEach((row, i) => push(`system_field_readings[${i}]`, row?.reading))
  ;(data.domain_answers ?? []).forEach((row, i) => push(`domain_answers[${i}]`, row?.answer))
  ;(data.year_phases ?? []).forEach((row, i) => { push(`year_phases[${i}].theme`, row?.theme); push(`year_phases[${i}].change`, row?.change) })
  for (const [key, value] of Object.entries(data.investment_reading ?? {})) push(`investment_reading.${key}`, value)
  for (const [key, value] of Object.entries(data.relationship_reading ?? {})) if (key !== 'evidence_refs') push(`relationship_reading.${key}`, value)
  return out
}

export function auditReaderFacing(data, { kind } = {}) {
  const issues = []
  const add = (code, severity, details = {}) => issues.push({ code, severity, ...details })
  if (!data || typeof data !== 'object') return issues
  const prose = readerProse(data)

  for (const row of prose) {
    if (INTERNAL.test(row.text)) add('READER_INTERNAL_WORDING', 'error', { path: row.path })
    if (JARGON.test(row.text)) add('READER_JARGON', 'error', { path: row.path })
    if (sentences(row.text).some(s => POLITE.test(s))) add('READER_POLITE_ENDING', 'error', { path: row.path })
  }

  // Each system screen needs a reading in every field.
  const fields = Array.isArray(data.system_field_readings) ? data.system_field_readings : []
  for (const system of ['saju', 'thai']) {
    const own = fields.filter(row => row?.system === system)
    const missing = FIELD_TOPICS.filter(topic => !own.some(row => row?.topic === topic && text(row?.reading)))
    // A single day's Thai reading has one active place (the weekday taksa);
    // the screen says so for the other fields.
    const dayThai = kind === 'day' && system === 'thai'
    if (dayThai ? !own.length : missing.length) add('SYSTEM_FIELD_MISSING', 'error', { system, topics: missing })
    own.forEach(row => { if (isDefinitionOnly(row.reading)) add('SYSTEM_FIELD_DEFINITION_ONLY', 'error', { system, topic: row.topic }) })
    if ((kind === 'month' || kind === 'annual') && own.some(row => (row?.evidence_refs ?? []).some(ref => /^S:daily:/.test(ref))))
      add('LONG_PERIOD_FROM_ONE_DAY_PILLAR', 'error', { system })
  }

  // The period and its evidence must be the same size.
  if (kind === 'annual') {
    const reasons = [data.systems?.western, data.overall?.dominant_pattern,
      ...Object.values(data.clusters ?? {}).flatMap(group => Object.values(group ?? {}).map(section => section?.evidence_meaning))].map(text).filter(Boolean)
    if (reasons.some(reason => FAST.test(reason) && !SLOW.test(reason))) add('ANNUAL_FROM_FAST_PLANET', 'error')
    if (!Array.isArray(data.year_phases) || data.year_phases.length < 2) add('ANNUAL_WITHOUT_PHASES', 'error')
  }
  if (kind === 'month' && /(?:일진|경진|기묘|임오|갑신)\s*일진/.test(text(data.systems?.saju))) add('MONTH_FROM_ONE_DAY_PILLAR', 'error')

  // Unanswered questions are hidden from the reader. What matters is that each
  // reader field gets at least one answered question in a month or a year.
  const answers = Array.isArray(data.domain_answers) ? data.domain_answers : []
  if ((kind === 'month' || kind === 'annual') && answers.length) {
    const answered = new Set(answers.filter(row => row?.status !== 'not_calculated' && text(row?.answer)).map(row => row.topic))
    const empty = FIELD_TOPICS.filter(topic => answers.some(row => row?.topic === topic) && !answered.has(topic))
    if (empty.length) add('FIELD_QUESTIONS_UNANSWERED', 'error', { topics: empty })
  }
  const investment = data.investment_reading
  if (investment && typeof investment === 'object' && !Object.values(investment).some(text)) add('INVESTMENT_EMPTY', 'warning')

  // One anchor repeated across most fields reads as the same sentence.
  for (const system of ['saju', 'thai']) {
    const openers = fields.filter(row => row?.system === system).map(row => sentences(row.reading)[0]).filter(Boolean)
    const counts = new Map()
    for (const opener of openers) counts.set(opener, (counts.get(opener) ?? 0) + 1)
    if ([...counts.values()].some(count => count >= 3)) add('SYSTEM_FIELD_SAME_OPENER', 'warning', { system })
  }

  // Exact duplicates anywhere on screen.
  const seen = new Map()
  for (const row of prose) {
    const key = row.text.replace(/\s+/g, ' ')
    if (key.length < 25) continue
    if (seen.has(key)) add('READER_DUPLICATE_TEXT', 'error', { paths: [seen.get(key), row.path] })
    else seen.set(key, row.path)
  }
  return issues
}
