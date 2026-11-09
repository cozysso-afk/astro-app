type QuestionKey = 'why_reconnect' | 'initiative' | 'timing' | 'rebuild' | 'repeat_risks'

export type ReunionGroundingResult = { ok: boolean; data: any; reason?: string }

const arr = (value: unknown): any[] => Array.isArray(value) ? value : []
const text = (value: unknown) => String(value ?? '').trim()
const uniq = (values: string[]) => [...new Set(values.filter(Boolean))]

function splitSentences(value: unknown) {
  const source = text(value)
  return source ? source.replace(/([.!?])\s+/g, '$1\n').split('\n').map(item => item.trim()).filter(Boolean) : []
}

export function hasUnsupportedInitiativeDirection(value: unknown, observation?: any) {
  const blocked = /(?:누가\s*먼저|선연락|상대가\s*(?:먼저\s*)?(?:연락|메시지)|내가\s*(?:먼저\s*)?(?:연락|메시지)|상대측\s*활성|내측\s*활성|수신\s*신호|발신\s*적합|시작\s*압력|(?:내|나|상대)(?:\s*쪽|\s*방향|\s*측)?[^.!?]{0,32}(?:먼저|앞서|우세)|(?:먼저|앞서|우세)[^.!?]{0,32}(?:내|나|상대)(?:\s*쪽|\s*방향|\s*측)?)/
  const uncertainty = /(?:정하기|판단하기|확정하기|예측하기)\s*(?:어려|힘들)|(?:알|확정할|예측할|판단할|단정할|특정할|정할|가릴|구분할|확인할|계산할)\s*수\s*없|(?:판단|확정|예측|단정|특정|계산|확인)(?:은|이|하기가|하기는|하기)?\s*(?:불가|어려)|(?:선연락|먼저\s*연락|행동.{0,6}(?:주체|순서)).{0,20}(?:아니|의미하지|보여\s*주지|판정할 수 없)/
  const clauses = splitSentences(value).flatMap(line=>line.split(/(?:지만|다만|그러나|그렇지만|반면)[, ]*/))
  return clauses.some(sentence => {
    if (!blocked.test(sentence) || uncertainty.test(sentence)) return false
    // Relative chart activity alone describes a calculation, not an initiator.
    const signalOnly = /활성|수신\s*신호|발신\s*적합/.test(sentence) &&
      !/먼저|선연락|앞서|다가오|다가가|연락(?:해|하|할|이 오|을 보)|메시지를/.test(sentence)
    if (signalOnly) return false
    // A recorded past initiator does not establish who acts next.
    const counterpart = /상대(?:가|측|\s*쪽)[^.!?]{0,20}(?:먼저|연락|메시지)/.test(sentence)
    const user = /(?:내가|내\s*쪽|나(?:는|의))[^.!?]{0,20}(?:먼저|연락|메시지)/.test(sentence)
    const matchesRecordedInitiator = observation?.initiator === 'counterpart' ? counterpart && !user : observation?.initiator === 'user' ? user && !counterpart : observation?.initiator === 'mutual' && /서로|양쪽|둘 다/.test(sentence)
    const pastRecord = matchesRecordedInitiator && /입력|기록|알려준|관측/.test(sentence) && /했|왔|보냈|이었/.test(sentence) && !/앞으로|다음|예정|가능성|전망/.test(sentence)
    const conditionalCheck = /(?:연락|메시지)(?:을|를)?\s*(?:하면|한다면|했을 때|하는지 확인)/.test(sentence)
    return !pastRecord && !conditionalCheck
  })
}

function proseLeaves(value: any): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(proseLeaves)
  if (value && typeof value === 'object') return Object.entries(value).filter(([key]) => key !== 'evidence_refs').flatMap(([,item]) => proseLeaves(item))
  return []
}

function observedStageGate(data: any, payload: any) {
  // Only current-stage answer is the factual state claim; contextual branches are hypothetical.
  const current = text(data?.reunion_synthesis_v2?.consultation_answer?.current_stage)
  const observed = payload?.reunion_observation
  const state = text(observed?.state)
  const leadSentences = [data?.core_summary, data?.reunion_synthesis_v2?.summary, current].flatMap(splitSentences)
  if (state !== 'reunited' && leadSentences.some(sentence => /(?:이미|실제로)\s*(?:두 사람은?\s*)?(?:재회했|재결합했|다시 사귀고)/.test(sentence) && !/다면|경우|인지/.test(sentence))) return 'promoted_observed_stage'
  if (!state) return /(?:현실|실제|현재|관측|입력|관계).{0,24}(?:미확인|확인되지|확인할 수 없|알 수 없|입력되지|기록이 없|정보가 없|판단할 수 없)/.test(current) ? null : 'unobserved_current_stage'
  if (!/입력|기록|알려준|관측/.test(current)) return 'unattributed_observed_stage'
  const markers: Record<string, RegExp> = {
    disconnected: /단절|끊|중단|연락.{0,8}없/,
    recontacted: /연락|재접촉/,
    messaging: /연락|대화|메시지/,
    met: /만남|만났|만난/,
    intimate_undefined: /관계.{0,8}(?:미정|정의|모호|불분명)|친밀/,
    reunited: /재회|재결합|다시.{0,5}(?:사귀|만나)|관계.{0,5}재개/,
  }
  if (markers[state] && !markers[state].test(current)) return 'missing_observed_stage'
  return null
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
  const observationFailure = observedStageGate(data, payload)
  if (observationFailure) return {ok: false, data, reason: observationFailure}

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
    if (proseLeaves(data).some(value => hasUnsupportedInitiativeDirection(value, payload?.reunion_observation))) return {ok: false, data, reason: 'unsupported_initiative_direction'}
  }
  if (text(source?.summary).length < 120) return {ok: false, data, reason: 'insufficient_grounded_content'}
  if (/끊어지지 않는 인연|끊을 수 없는 인연|카르마적 인연|운명적 인연|운명적으로 다시 만난다|천생연분|서로를 지울 수 없다|반드시 연락한다|상대가 아직 사랑한다|(?:연락|만남|재회)\s*확률\s*\d+(?:\.\d+)?\s*%/.test(JSON.stringify(data))) return {ok: false, data, reason: 'unsupported_deterministic_claim'}
  return {ok: true, data}
}
