function text(value: unknown) { return String(value ?? "").trim() }
function isoDate(value: unknown) { return text(value).match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] ?? "" }
function clockWindow(value: unknown) {
  const matches = [...text(value).matchAll(/(?:[01]\d|2[0-3]):[0-5]\d/g)].map(match => match[0])
  return matches.length >= 2 ? `${matches[0]}~${matches[1]}` : ""
}
function unique(values: string[]) { return [...new Set(values.filter(Boolean))] }

function periodKind(payload: any) {
  const raw = text(payload?.period_kind ?? payload?.period?.kind).toLowerCase()
  if (["day", "today", "daily"].includes(raw)) return "day"
  const start = isoDate(payload?.period?.start), end = isoDate(payload?.period?.end)
  return start && start === end ? "day" : raw
}

function sameTopicDetails(ledger: any[], date: string, windowRow: any) {
  const topic = text(windowRow?.topic)
  const direction = text(windowRow?.direction)
  return ledger
    .filter(row => text(row?.id).startsWith(`W:detail:${date}:${topic}:`))
    .filter(row => isoDate(row?.date) === date)
    .filter(row => !direction || !text(row?.direction) || text(row?.direction) === direction)
    .map(row => text(row?.id))
    .slice(0, 2)
}

function uniqueExactWindow(decision: any, windows: any[], byId: Map<string, any>) {
  const timing = clockWindow(decision?.timing)
  if (!timing) return null
  const exact = windows.filter(row => clockWindow(row?.window ?? row?.text) === timing)
  if (exact.length === 1) return exact[0]

  const refs = Array.isArray(decision?.evidence_refs) ? decision.evidence_refs.map(text) : []
  const linkedTopics = new Set(refs.map(ref => text(byId.get(ref)?.topic)).filter(Boolean))
  const linked = exact.filter(row => refs.includes(text(row?.id)) || linkedTopics.has(text(row?.topic)))
  if (linked.length === 1) return linked[0]

  const prose = [decision?.action, decision?.reason, decision?.watch, decision?.avoid].map(text).join(" ")
  const topical = exact.filter(row => text(row?.topic) && prose.includes(text(row?.topic)))
  return topical.length === 1 ? topical[0] : null
}

// Preserve every Gemini-authored word. This only attaches deterministic ledger IDs
// when the authored HH:MM~HH:MM has one unambiguous calculated window.
export function attachAuthoredDayTimingEvidence(data: any, payload: any) {
  if (periodKind(payload) !== "day" || !data || typeof data !== "object") return data
  const date = isoDate(payload?.period?.start)
  const ledger = Array.isArray(payload?.evidence_ledger) ? payload.evidence_ledger : []
  if (!date || !ledger.length || !Array.isArray(data?.decisions)) return data

  const windows = ledger.filter(row =>
    (text(row?.id).startsWith("W:window:") || row?.scope === "intraday_window")
    && isoDate(row?.date) === date
    && clockWindow(row?.window ?? row?.text)
  )
  if (!windows.length) return data
  const byId = new Map(ledger.map(row => [text(row?.id), row]))

  data.decisions = data.decisions.map((decision: any) => {
    const windowRow = uniqueExactWindow(decision, windows, byId)
    if (!windowRow) return decision
    const refs = Array.isArray(decision?.evidence_refs) ? decision.evidence_refs.map(text) : []
    const grounded = [text(windowRow?.id), ...sameTopicDetails(ledger, date, windowRow)]
    if (!grounded[0] || grounded.length < 2) return decision
    return { ...decision, evidence_refs: unique([...refs, ...grounded]) }
  })
  return data
}
