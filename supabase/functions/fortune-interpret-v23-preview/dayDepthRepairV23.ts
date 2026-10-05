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

function windowTopics(item: any) {
  return Array.isArray(item?.topics) ? item.topics.map(text).filter(Boolean) : []
}

function windowProse(item: any) {
  return [item?.label,item?.summary,item?.action,item?.avoid].map(text).filter(Boolean).join(' ')
}

function rowScore(item: any, row: any) {
  const id = text(row?.id)
  const refs = Array.isArray(item?.evidence_refs) ? item.evidence_refs.map(text) : []
  const topic = text(row?.topic)
  const topics = windowTopics(item)
  const prose = windowProse(item)
  let score = 0
  if (id && refs.includes(id)) score += 12
  if (topic && topics.includes(topic)) score += 7
  if (topic && prose.includes(topic)) score += 3
  if (text(item?.signal) && text(item?.signal) === signalOf(row)) score += 3
  const proseClock = clockWindow(prose)
  const rowClock = clockWindow(row?.window ?? row?.text)
  if (proseClock && rowClock && proseClock === rowClock) score += 4
  return score
}

function matchingWindow(item: any, windows: any[]) {
  const ranked = windows
    .map(row => ({ row, score: rowScore(item, row) }))
    .filter(entry => entry.score > 0)
    .sort((a,b) => b.score - a.score)
  return ranked[0]?.row ?? null
}

function compatibleDetails(ledger: any[], date: string, row: any) {
  const topic = text(row?.topic)
  const direction = text(row?.direction)
  return ledger
    .filter((item: any) => String(item?.id ?? '').startsWith(`W:detail:${date}:${topic}:`) && iso(item?.date) === date)
    .filter((item: any) => !direction || !text(item?.direction) || text(item?.direction) === direction)
    .map((item: any) => text(item?.id))
    .filter(Boolean)
    .slice(0, 2)
}

function groundWindow(item: any, row: any, ledger: any[], date: string) {
  if (!row) return item
  const windowRef = text(row?.id)
  if (!windowRef) return item
  const current = Array.isArray(item?.evidence_refs) ? item.evidence_refs.map(text).filter(Boolean) : []
  return {
    ...item,
    evidence_refs: uniq([...current, windowRef, ...compatibleDetails(ledger, date, row)]),
  }
}

function linkedLedgerWindow(item: any, byId: Map<string, any>) {
  const refs = Array.isArray(item?.evidence_refs) ? item.evidence_refs.map(text) : []
  return refs.map(ref => byId.get(ref)).find((row: any) => String(row?.id ?? '').startsWith('W:window:')) ?? null
}

function decisionTarget(decision: any, groundedWindows: any[], byId: Map<string, any>) {
  const timing = clockWindow(decision?.timing)
  if (timing) {
    const exact = groundedWindows.find(item => clockWindow(linkedLedgerWindow(item, byId)?.window ?? linkedLedgerWindow(item, byId)?.text) === timing)
    if (exact) return exact
  }
  const prose = [decision?.action,decision?.reason,decision?.watch,decision?.avoid].map(text).filter(Boolean).join(' ')
  const topical = groundedWindows.find(item => windowTopics(item).some(topic => prose.includes(topic)))
  return topical ?? groundedWindows[0] ?? null
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
  const detailRefs = compatibleDetails(ledger, date, preferred)
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
  const groundedWindows = existingWindows.map((item: any) => groundWindow(item, matchingWindow(item, windows), ledger, date))
  const byId = new Map(ledger.map((row: any) => [text(row?.id), row]))
  const authoredGrounded = groundedWindows.filter((item: any) => linkedLedgerWindow(item, byId))
  if (authoredGrounded.length) {
    core.key_windows = groundedWindows
  } else {
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

  const usableWindows = (Array.isArray(core?.key_windows) ? core.key_windows : []).filter((item: any) => linkedLedgerWindow(item, byId))
  const decisions = Array.isArray(core?.decisions) ? core.decisions : []
  if (decisions.length && usableWindows.length) {
    core.decisions = decisions.map((item: any) => {
      const target = decisionTarget(item, usableWindows, byId)
      if (!target) return item
      const targetRefs = Array.isArray(target?.evidence_refs) ? target.evidence_refs.map(text).filter(Boolean) : []
      const current = Array.isArray(item?.evidence_refs) ? item.evidence_refs.map(text).filter(Boolean) : []
      return { ...item, evidence_refs: uniq([...current, ...targetRefs]) }
    })
  } else if (!decisions.length) {
    core.decisions = [{
      action,
      timing: `${date} ${timing}`,
      reason: summary,
      watch,
      avoid,
      evidence_refs: evidenceRefs,
    }]
  }
  return core
}
