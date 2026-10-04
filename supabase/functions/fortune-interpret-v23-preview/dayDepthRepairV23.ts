function text(value: unknown) { return String(value ?? '').trim() }
function iso(value: unknown) { return text(value).match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] ?? '' }
function clockWindow(value: unknown) {
  const matches = [...text(value).matchAll(/(?:[01]\d|2[0-3]):[0-5]\d/g)].map(m => m[0])
  return matches.length >= 2 ? `${matches[0]}~${matches[1]}` : ''
}
function uniq<T>(values: T[]) { return [...new Set(values)] }

function periodKind(payload: any) {
  const raw = text(payload?.period_kind ?? payload?.period?.kind).toLowerCase()
  if (['day','today','daily'].includes(raw)) return 'day'
  const start = iso(payload?.period?.start), end = iso(payload?.period?.end)
  return start && start === end ? 'day' : raw
}

function editorialSection(data: any, topic: string) {
  const clusters = data?.clusters ?? {}
  const map: Record<string, any> = {
    '학업': clusters?.work_study?.study,
    '시험': clusters?.work_study?.exam,
    '직장': clusters?.work_study?.work,
    '이직': clusters?.work_study?.career_change,
    '금전': clusters?.money_news?.money,
    '소식': clusters?.money_news?.news,
    '컨디션': clusters?.condition?.condition,
    '대인관계': clusters?.relationship?.summary,
    '연애': clusters?.relationship?.love_general,
    '연락': clusters?.relationship?.contact_activation,
    '재회': clusters?.relationship?.love_reunion_interest,
  }
  return map[topic] ?? null
}

function signalOf(row: any) {
  if (row?.direction === 'supportive') return '활용'
  if (row?.direction === 'caution') return '주의'
  return '혼합'
}

export function ensureDayDepthGuides(core: any, payload: any) {
  if (periodKind(payload) !== 'day' || !core || typeof core !== 'object') return core
  const date = iso(payload?.period?.start)
  if (!date) return core
  const ledger = Array.isArray(payload?.evidence_ledger) ? payload.evidence_ledger : []
  const windows = ledger.filter((row: any) =>
    (String(row?.id ?? '').startsWith('W:window:') || row?.scope === 'intraday_window')
    && iso(row?.date) === date
    && clockWindow(row?.window ?? row?.text)
  )
  if (!windows.length) return core

  const preferredClock = clockWindow(core?.overall?.best_phase) || clockWindow(core?.overall?.caution_phase)
  const preferred = windows.find((row: any) => clockWindow(row?.window ?? row?.text) === preferredClock)
    ?? windows.find((row: any) => row?.direction === 'supportive')
    ?? windows[0]
  const windowRef = text(preferred?.id)
  const topic = text(preferred?.topic) || '핵심 흐름'
  const timing = clockWindow(preferred?.window ?? preferred?.text)
  const detailRefs = ledger
    .filter((row: any) => String(row?.id ?? '').startsWith(`W:detail:${date}:${topic}:`) && iso(row?.date) === date)
    .map((row: any) => text(row?.id))
    .filter(Boolean)
    .slice(0, 2)
  const evidenceRefs = uniq([windowRef, ...detailRefs].filter(Boolean))
  if (!windowRef || !timing || !detailRefs.length) return core

  const section = editorialSection(core, topic)
  const topicRow = core?.topic_analysis?.[topic] ?? {}
  const action = text(section?.action) || text(topicRow?.action) || `${topic} 관련 핵심 일은 이 시간대에 한 가지씩 처리해.`
  const scene = text(section?.real_scene) || text(topicRow?.reason) || text(preferred?.text)
  const watch = text(section?.change_condition) || `${topic} 관련 실제 반응이 달라지는지 확인해.`
  const avoid = text(topicRow?.avoid) || `이 시간대의 한 장면만으로 오늘 전체 결과를 단정하지 마.`
  const summary = [text(preferred?.text), scene].filter(Boolean).join(' ')

  const existingWindows = Array.isArray(core?.key_windows) ? core.key_windows : []
  const hasLinkedWindow = existingWindows.some((item: any) => (item?.evidence_refs ?? []).map(String).includes(windowRef))
  if (!hasLinkedWindow) {
    core.key_windows = [{
      label: `${date} ${topic} ${signalOf(preferred)} 시간대`,
      start: date,
      end: date,
      signal: signalOf(preferred),
      topics: [topic],
      summary,
      action,
      avoid,
      evidence_refs: evidenceRefs,
    }, ...existingWindows]
  }

  const decisions = Array.isArray(core?.decisions) ? core.decisions : []
  const hasTimedDecision = decisions.some((item: any) => clockWindow(item?.timing) === timing
    && (item?.evidence_refs ?? []).map(String).includes(windowRef))
  if (!hasTimedDecision) {
    core.decisions = [{
      action,
      timing: `${date} ${timing}`,
      reason: summary,
      watch,
      avoid,
      evidence_refs: evidenceRefs,
    }, ...decisions]
  }
  return core
}
