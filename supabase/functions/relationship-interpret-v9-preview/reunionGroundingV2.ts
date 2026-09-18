type QuestionKey = 'why_reconnect' | 'initiative' | 'timing' | 'rebuild' | 'repeat_risks'

type RepairResult = {
  ok: boolean
  repaired: boolean
  data: any
  reason?: string
}

const arr = (v: unknown): any[] => Array.isArray(v) ? v : []
const text = (v: unknown) => String(v ?? '').trim()
const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))]

function validSet(payload: any) {
  return new Set(arr(payload?.reunion_evidence_v2?.evidence).map((x: any) => text(x?.id)).filter(Boolean))
}

function fallbackRefs(payload: any, q: QuestionKey, valid: Set<string>) {
  const fromQuestion = arr(payload?.reunion_evidence_v2?.questions?.[q]?.evidence_refs).map(text).filter(x => valid.has(x))
  return uniq(fromQuestion)
}

function normalizeRefs(current: unknown, fallback: string[], valid: Set<string>, min = 1) {
  const kept = uniq(arr(current).map(text).filter(x => valid.has(x)))
  if (kept.length >= min) return kept.slice(0, 12)
  return uniq([...kept, ...fallback]).slice(0, Math.max(min, 3))
}

function hasCoreText(v: any) {
  return text(v?.conclusion).length >= 24 && text(v?.interpretation).length >= 36
}

function composeSummary(v2: any) {
  const parts = uniq([
    text(v2?.summary),
    text(v2?.why_reconnect?.conclusion),
    text(v2?.initiative?.conclusion),
    text(v2?.timing?.conclusion),
    text(v2?.rebuild?.conclusion),
    text(v2?.repeat_risks?.conclusion),
    text(v2?.why_reconnect?.interpretation),
  ])
  return parts.join(' ').slice(0, 3200)
}

export function repairReunionGroundingV2(data: any, payload: any): RepairResult {
  const source = data?.reunion_synthesis_v2
  if (!source || typeof source !== 'object') return { ok: false, repaired: false, data, reason: 'missing_reunion_synthesis_v2' }

  const valid = validSet(payload)
  if (!valid.size) return { ok: false, repaired: false, data, reason: 'missing_evidence_matrix' }

  if (!hasCoreText(source?.why_reconnect) || !hasCoreText(source?.initiative)) {
    return { ok: false, repaired: false, data, reason: 'missing_core_section_text' }
  }
  if (text(source?.timing?.conclusion).length < 24 || text(source?.rebuild?.conclusion).length < 24 || text(source?.repeat_risks?.conclusion).length < 24) {
    return { ok: false, repaired: false, data, reason: 'missing_core_conclusion' }
  }

  const fallbacks: Record<QuestionKey, string[]> = {
    why_reconnect: fallbackRefs(payload, 'why_reconnect', valid),
    initiative: fallbackRefs(payload, 'initiative', valid),
    timing: fallbackRefs(payload, 'timing', valid),
    rebuild: fallbackRefs(payload, 'rebuild', valid),
    repeat_risks: fallbackRefs(payload, 'repeat_risks', valid),
  }

  const before = JSON.stringify(source)
  const v2: any = {
    ...source,
    why_reconnect: { ...source.why_reconnect, evidence_refs: normalizeRefs(source?.why_reconnect?.evidence_refs, fallbacks.why_reconnect, valid) },
    initiative: { ...source.initiative, evidence_refs: normalizeRefs(source?.initiative?.evidence_refs, fallbacks.initiative, valid) },
    timing: {
      ...source.timing,
      evidence_refs: normalizeRefs(source?.timing?.evidence_refs, fallbacks.timing, valid),
      windows: arr(source?.timing?.windows).slice(0, 4).map((w: any) => ({
        ...w,
        evidence_refs: normalizeRefs(w?.evidence_refs, fallbacks.timing, valid),
      })),
    },
    rebuild: { ...source.rebuild, evidence_refs: normalizeRefs(source?.rebuild?.evidence_refs, fallbacks.rebuild, valid) },
    repeat_risks: { ...source.repeat_risks, evidence_refs: normalizeRefs(source?.repeat_risks?.evidence_refs, fallbacks.repeat_risks, valid) },
    convergence: arr(source?.convergence).slice(0, 5).map((x: any) => ({
      ...x,
      evidence_refs: normalizeRefs(x?.evidence_refs, [], valid, 0),
    })).filter((x: any) => x.evidence_refs.length >= 2),
  }

  if (text(v2.summary).length < 180) v2.summary = composeSummary(v2)

  const allRefs = uniq([
    ...arr(v2?.why_reconnect?.evidence_refs),
    ...arr(v2?.initiative?.evidence_refs),
    ...arr(v2?.timing?.evidence_refs),
    ...arr(v2?.rebuild?.evidence_refs),
    ...arr(v2?.repeat_risks?.evidence_refs),
  ].map(text).filter(x => valid.has(x)))

  if (text(v2.summary).length < 120 || allRefs.length < 3) {
    return { ok: false, repaired: false, data, reason: 'insufficient_grounded_content' }
  }

  const next = { ...data, reunion_synthesis_v2: v2 }
  return { ok: true, repaired: before !== JSON.stringify(v2), data: next }
}
