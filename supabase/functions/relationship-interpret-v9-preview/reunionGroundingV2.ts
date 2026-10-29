type QuestionKey = 'why_reconnect' | 'initiative' | 'timing' | 'rebuild' | 'repeat_risks'

export type ReunionGroundingResult = { ok: boolean; data: any; reason?: string }

const arr = (value: unknown): any[] => Array.isArray(value) ? value : []
const text = (value: unknown) => String(value ?? '').trim()
const uniq = (values: string[]) => [...new Set(values.filter(Boolean))]

function splitSentences(value: unknown) {
  const source = text(value)
  return source ? source.replace(/([.!?])\s+/g, '$1\n').split('\n').map(item => item.trim()).filter(Boolean) : []
}

function hasUnsupportedInitiativeDirection(value: unknown) {
  const blocked = /(?:누가\s*먼저|선연락|상대가\s*(?:먼저\s*)?(?:연락|메시지)|내가\s*(?:먼저\s*)?(?:연락|메시지)|상대측\s*활성|내측\s*활성|수신\s*신호|발신\s*적합|시작\s*압력|(?:내|나|상대)(?:\s*쪽|\s*방향|\s*측)?[^.!?]{0,32}(?:먼저|앞서|우세)|(?:먼저|앞서|우세)[^.!?]{0,32}(?:내|나|상대)(?:\s*쪽|\s*방향|\s*측)?)/
  const uncertainty = /(?:정하기|판단하기|확정하기|예측하기)\s*(?:어려|힘들)|(?:알|확정할|예측할)\s*수\s*없/
  return splitSentences(value).some(sentence => blocked.test(sentence) && !uncertainty.test(sentence))
}

function validEvidence(payload: any) {
  return new Set(arr(payload?.reunion_evidence_v2?.evidence).map(item => text(item?.id)).filter(Boolean))
}

function refs(value: unknown) { return uniq(arr(value).map(text)) }

function requiredQuestionRefs(payload: any, question: QuestionKey) {
  return new Set(refs(payload?.reunion_evidence_v2?.questions?.[question]?.evidence_refs))
}

function validateRefs(value: unknown, valid: Set<string>, minimum = 1) {
  const values = refs(value)
  return values.length >= minimum && values.every(item => valid.has(item))
}

function validateQuestionRefs(value: unknown, payload: any, question: QuestionKey) {
  const allowed = requiredQuestionRefs(payload, question)
  const values = refs(value)
  return values.length > 0 && values.every(item => allowed.has(item))
}

function allowedTimingDateGate(payload: any) {
  const present = Boolean(payload?.reunion_timing_windows && Array.isArray(payload?.reunion_timing_windows?.windows))
  const asOf = text(payload?.reunion_hierarchy?.as_of_date)
  const windows = arr(payload?.reunion_timing_windows?.windows)
  const dates = new Set(windows.flatMap((item: any) => [text(item?.date), text(item?.start), text(item?.end)])
    .filter((item: string) => /^\d{4}-\d{2}-\d{2}$/.test(item) && (!asOf || item >= asOf)))
  const ranges = windows.map((item: any) => ({start: text(item?.start ?? item?.date), end: text(item?.end ?? item?.date)}))
  return {present, dates, ranges, strict: Boolean(payload?.reunion_hierarchy)}
}

function timingWindowAllowed(window: any, gate: ReturnType<typeof allowedTimingDateGate>) {
  if (!gate.present) return true
  const found = text(window?.period).match(/\d{4}-\d{2}-\d{2}/g) ?? []
  return (found.length > 0 || !gate.strict) && found.every(date => gate.dates.has(date)) &&
    (!gate.strict || found.length < 2 || gate.ranges.some(range => found.every(date => date >= range.start && date <= range.end)))
}

function hasCoreText(value: any) {
  return text(value?.conclusion).length >= 12 && text(value?.interpretation).length >= 24
}

/** Validation-only boundary. It never composes, translates, trims, filters, or repairs Gemini output. */
export function validateReunionGroundingV2(data: any, payload: any): ReunionGroundingResult {
  const source = data?.reunion_synthesis_v2
  if (!source || typeof source !== 'object') return {ok: false, data, reason: 'missing_reunion_synthesis_v2'}
  const valid = validEvidence(payload)
  if (!valid.size) return {ok: false, data, reason: 'missing_evidence_matrix'}
  if (!hasCoreText(source?.why_reconnect) || !hasCoreText(source?.initiative)) return {ok: false, data, reason: 'missing_core_section_text'}
  if (text(source?.timing?.conclusion).length < 12 || text(source?.rebuild?.conclusion).length < 12 || text(source?.repeat_risks?.conclusion).length < 12) return {ok: false, data, reason: 'missing_core_conclusion'}

  const consultation = source?.consultation_answer
  if (!consultation || typeof consultation !== 'object') return {ok: false, data, reason: 'missing_direct_consultation'}
  const requiredConsultation = ['current_stage','contact_type_if_any','initiative','continuity','meeting_gate','rebuild_gate','behavior_change_evidence']
  if (requiredConsultation.some(key => text(consultation?.[key]).length < 12) || arr(consultation?.next_stage_up_conditions).length < 1 || arr(consultation?.down_conditions).length < 1 || arr(consultation?.repeat_risks).length < 1) return {ok: false, data, reason: 'incomplete_direct_consultation'}

  const questionSections: Array<[QuestionKey, unknown]> = [
    ['why_reconnect', source?.why_reconnect?.evidence_refs], ['initiative', source?.initiative?.evidence_refs],
    ['timing', source?.timing?.evidence_refs], ['rebuild', source?.rebuild?.evidence_refs], ['repeat_risks', source?.repeat_risks?.evidence_refs],
  ]
  if (questionSections.some(([question, value]) => !validateQuestionRefs(value, payload, question))) return {ok: false, data, reason: 'invalid_question_evidence_refs'}
  if (!validateRefs(consultation?.evidence_refs, valid, 3)) return {ok: false, data, reason: 'invalid_consultation_evidence_refs'}
  const timingGate = allowedTimingDateGate(payload)
  for (const window of arr(source?.timing?.windows)) {
    if (!validateQuestionRefs(window?.evidence_refs, payload, 'timing')) return {ok: false, data, reason: 'invalid_timing_evidence_refs'}
    if (!timingWindowAllowed(window, timingGate)) return {ok: false, data, reason: 'unsupported_timing_window'}
  }
  for (const convergence of arr(source?.convergence)) if (!validateRefs(convergence?.evidence_refs, valid, 2)) return {ok: false, data, reason: 'invalid_convergence_evidence_refs'}

  if (payload?.reunion_evidence_v2?.initiative_gate?.available !== true) {
    const directional = [source?.summary, source?.initiative?.conclusion, source?.initiative?.interpretation, consultation?.initiative].map(text).join(' ')
    if (hasUnsupportedInitiativeDirection(directional)) return {ok: false, data, reason: 'unsupported_initiative_direction'}
  }
  if (text(source?.summary).length < 120) return {ok: false, data, reason: 'insufficient_grounded_content'}
  if (/끊어지지 않는 인연|끊을 수 없는 인연|카르마적 인연|운명적 인연|운명적으로 다시 만난다|천생연분|서로를 지울 수 없다|반드시 연락한다|상대가 아직 사랑한다|(?:연락|만남|재회)\s*확률\s*\d+(?:\.\d+)?\s*%/.test(JSON.stringify(data))) return {ok: false, data, reason: 'unsupported_deterministic_claim'}
  return {ok: true, data}
}
