const text = value => String(value ?? '').trim()
const walkStrings = (value, out = []) => {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach(item => walkStrings(item, out))
  else if (value && typeof value === 'object') Object.values(value).forEach(item => walkStrings(item, out))
  return out
}
const dates = value => new Set(walkStrings(value).flatMap(value => value.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? []))
const words = value => new Set(text(value).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(word => word.length > 1))
const similarity = (a, b) => {
  const left = words(a), right = words(b)
  if (!left.size || !right.size) return 0
  const intersection = [...left].filter(word => right.has(word)).length
  return intersection / (left.size + right.size - intersection)
}
const stage = (id, issues) => ({ id, passed: issues.length === 0, issues })

function providerStage(result) {
  const usage = result?.usage ?? {}
  const trace = Array.isArray(usage.call_trace) ? usage.call_trace : []
  const success = trace.some(row => row?.outcome === 'success' && Number(row?.http_status) >= 200 && Number(row?.http_status) < 300 && row?.finish_reason === 'STOP')
  const issues = []
  if (result?.origin !== 'gemini' || result?.provenance_verified !== true) issues.push('GEMINI_PROVENANCE_UNVERIFIED')
  if (!/^relationship-v(?:12\.0|14\.0)-gemini-single-author$/.test(text(result?.interpreter_version))) issues.push('GENERATION_VERSION_INVALID')
  if (usage.generation_version !== result?.interpreter_version) issues.push('STORED_VERSION_MISMATCH')
  if (!success) issues.push('SUCCESSFUL_CALL_TRACE_MISSING')
  return stage(1, issues)
}

function shapeStage(purpose, data) {
  const issues = []
  if (!data || !text(data.headline) || !text(data.overview)) issues.push('RESULT_MISSING')
  if (purpose === 'compatibility') for (const key of ['chemistry','emotional_dynamic','communication','conflict_pattern','power_boundaries','long_term']) if (text(data?.[key]).length < 80) issues.push('SECTION_MISSING_' + key.toUpperCase())
  if (purpose === 'reunion' && !data?.reunion_synthesis_v2) issues.push('REUNION_SYNTHESIS_MISSING')
  if (purpose.startsWith('marriage_') && !data?.marriage_reading) issues.push('MARRIAGE_READING_MISSING')
  return stage(2, issues)
}

function safetyStage(data, calculation) {
  const output = walkStrings(data).join(' '), source = JSON.stringify(calculation ?? {})
  const issues = []
  if (/끊어지지 않는 인연|끊을 수 없는 인연|카르마적 인연|운명적 인연|반드시 연락한다|상대가 아직 사랑한다|(?:연락|만남|재회)\s*확률\s*\d+(?:\.\d+)?\s*%/.test(output)) issues.push('UNSUPPORTED_DETERMINISTIC_CLAIM')
  for (const term of ['갑기합','을경합','병신합','정임합','무계합','신강','신약','용신','희신','기신','배우자성','합혼점수']) if (output.includes(term) && !source.includes(term)) issues.push('UNSUPPORTED_TERM_' + term)
  return stage(3, [...new Set(issues)])
}

function dateStage(data, calculation) {
  const allowed = dates(calculation), used = dates(data)
  return stage(4, [...used].filter(date => !allowed.has(date)).map(() => 'DATE_NOT_IN_CALCULATION'))
}

function repetitionStage(purpose, data) {
  const values = purpose === 'compatibility'
    ? ['chemistry','emotional_dynamic','communication','conflict_pattern','power_boundaries','long_term'].map(key => text(data?.[key])).filter(Boolean)
    : purpose === 'reunion'
      ? ['why_reconnect','initiative','timing','rebuild','repeat_risks'].map(key => text(data?.reunion_synthesis_v2?.[key]?.conclusion)).filter(Boolean)
      : Object.values(data?.marriage_reading ?? {}).map(text).filter(value => value.length > 40)
  const issues = []
  for (let left = 0; left < values.length; left++) for (let right = left + 1; right < values.length; right++) if (similarity(values[left], values[right]) >= 0.86) issues.push('SECTION_REPETITION')
  return stage(5, [...new Set(issues)])
}

function modeStage(purpose, data) {
  const issues = []
  if (purpose === 'compatibility' && (!Array.isArray(data?.felt_scenarios) || data.felt_scenarios.length < 2)) issues.push('COMPATIBILITY_SCENARIOS_MISSING')
  if (purpose === 'reunion') {
    const value = data?.reunion_synthesis_v2 ?? {}, consultation = value?.consultation_answer ?? {}
    const required = ['current_stage','contact_type_if_any','initiative','continuity','meeting_gate','rebuild_gate','behavior_change_evidence']
    if (required.some(key => text(consultation[key]).length < 12)) issues.push('DIRECT_CONSULTATION_INCOMPLETE')
    const refs = ['consultation_answer','why_reconnect','initiative','timing','rebuild','repeat_risks'].flatMap(key => value?.[key]?.evidence_refs ?? [])
    if (new Set(refs.map(text).filter(Boolean)).size < 3) issues.push('EVIDENCE_TRACE_INSUFFICIENT')
  }
  if (walkStrings(data).some(value => /검증 실패 부분 안전 보정본|추가 Gemini 호출 없이 계산근거만으로 보정/.test(value))) issues.push('LOCAL_FALLBACK_COPY_PRESENT')
  return stage(6, issues)
}

export function evaluateRelationshipCase(row) {
  const result = row?.result ?? {}, data = result?.data
  const stages = [providerStage(result), shapeStage(row.purpose, data), safetyStage(data, row.calculation), dateStage(data, row.calculation), repetitionStage(row.purpose, data), modeStage(row.purpose, data)]
  const issues = [...new Set([...(row.runner_error_code ? [row.runner_error_code] : []), ...stages.flatMap(item => item.issues)])]
  return { id: row.id, purpose: row.purpose, passed: issues.length === 0, origin_verified: stages[0].passed, stages, issues, provider: { model: text(result?.model), generation_version: text(result?.usage?.generation_version), attempt_count: Number(result?.usage?.attempt_count ?? 0), successful_calls: (result?.usage?.call_trace ?? []).filter(call => call?.outcome === 'success').length } }
}

export function evaluateRelationshipCases(rows, mode = 'fixture') {
  const cases = rows.map(evaluateRelationshipCase)
  return { mode, fixture_only: mode !== 'live', live_gemini_cases: mode === 'live' ? cases.filter(row => row.origin_verified).length : 0, summary: { total: cases.length, passed: cases.filter(row => row.passed).length, failed: cases.filter(row => !row.passed).length }, purpose_coverage: Object.fromEntries(['compatibility','reunion','marriage_unmarried','marriage_married'].map(purpose => [purpose, cases.filter(row => row.purpose === purpose && row.passed).length])), cases }
}

export function renderRelationshipHtml(report) {
  const title = report.fixture_only ? 'RELATIONSHIP QA FIXTURE — NO LIVE GEMINI RESPONSES' : report.live_gemini_cases ? 'VERIFIED LIVE GEMINI RELATIONSHIP AUDIT' : 'LIVE AUDIT — NO VERIFIED GEMINI RESULT'
  return `<!doctype html><meta charset="utf-8"><title>${title}</title><h1>${title}</h1><pre>${JSON.stringify(report, null, 2).replace(/[&<>]/g, value => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[value]))}</pre>`
}
