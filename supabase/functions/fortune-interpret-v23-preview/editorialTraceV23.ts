export const EDITORIAL_TRACE_VERSION = 'fortune-editorial-trace-v1'

const PROSE_KEYS = new Set([
  'headline','summary','dominant_pattern','best_phase','caution_phase','label','theme','change',
  'conclusion','real_scene','action','change_condition','reason','timing','watch','avoid',
  'western','saju','thai','synthesis','context','flow','focus_timing','incoming','outgoing',
  'reconnection','psychology','realization','entry','limits',
])

const MAX_INITIAL_FIELDS = 180
const MAX_CHANGES_PER_TRANSITION = 90
const SAMPLE_LIMIT = 140

type TraceValue = { sig: string; len: number; sample: string }
export type EditorialTraceStage = { stage: string; fields: Record<string, TraceValue> }

type ChangeKind = 'added' | 'deleted' | 'overwritten'
type TraceChange = {
  path: string
  kind: ChangeKind
  before?: TraceValue
  after?: TraceValue
}

function clean(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function signature(value: string) {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function traceValue(value: unknown): TraceValue | null {
  const text = clean(value)
  if (!text) return null
  return { sig: signature(text), len: text.length, sample: text.slice(0, SAMPLE_LIMIT) }
}

function add(out: Record<string, TraceValue>, path: string, value: unknown) {
  const traced = traceValue(value)
  if (traced) out[path] = traced
}

function collectObjectStrings(out: Record<string, TraceValue>, prefix: string, value: any) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string' && PROSE_KEYS.has(key)) add(out, `${prefix}.${key}`, item)
  }
}

function collectClusters(out: Record<string, TraceValue>, clusters: any) {
  if (Array.isArray(clusters)) {
    for (const section of clusters) {
      const key = clean(section?.key)
      if (!key) continue
      for (const field of ['conclusion','real_scene','action','change_condition']) add(out, `clusters.${key}.${field}`, section?.[field])
    }
    return
  }
  if (!clusters || typeof clusters !== 'object') return
  for (const [group, sections] of Object.entries(clusters)) {
    if (!sections || typeof sections !== 'object' || Array.isArray(sections)) continue
    for (const [sectionKey, section] of Object.entries(sections as Record<string, any>)) {
      for (const field of ['conclusion','real_scene','action','change_condition']) add(out, `clusters.${group}.${sectionKey}.${field}`, section?.[field])
    }
  }
}

function collectTopics(out: Record<string, TraceValue>, topics: any) {
  if (!topics || typeof topics !== 'object' || Array.isArray(topics)) return
  for (const [topic, row] of Object.entries(topics as Record<string, any>)) {
    for (const field of ['verdict','reason','timing','action','avoid','confidence_reason']) add(out, `topic_analysis.${topic}.${field}`, row?.[field])
  }
}

function collectIndexed(out: Record<string, TraceValue>, prefix: string, rows: any, fields: string[]) {
  if (!Array.isArray(rows)) return
  rows.slice(0, 12).forEach((row, index) => {
    for (const field of fields) add(out, `${prefix}[${index}].${field}`, row?.[field])
  })
}

export function captureEditorialStage(stage: string, data: any): EditorialTraceStage {
  const fields: Record<string, TraceValue> = {}
  add(fields, 'headline', data?.headline)
  for (const field of ['summary','dominant_pattern','best_phase','caution_phase']) add(fields, `overall.${field}`, data?.overall?.[field])
  collectClusters(fields, data?.clusters)
  collectTopics(fields, data?.topic_analysis)
  collectObjectStrings(fields, 'relationship_reading', data?.relationship_reading)
  collectObjectStrings(fields, 'contact_flow', data?.contact_flow)
  collectObjectStrings(fields, 'investment_reading', data?.investment_reading)
  collectObjectStrings(fields, 'systems', data?.systems)
  add(fields, 'limits', data?.limits)
  collectIndexed(fields, 'key_windows', data?.key_windows, ['label','summary','action','avoid'])
  collectIndexed(fields, 'decisions', data?.decisions, ['action','timing','reason','watch','avoid'])
  collectIndexed(fields, 'cross_checks', data?.cross_checks, ['label','western','saju','thai','synthesis'])
  collectIndexed(fields, 'year_phases', data?.year_phases, ['label','theme','change'])
  return { stage, fields }
}

function prefixOf(path: string) {
  const first = path.split('.')[0]
  if (first.startsWith('key_windows')) return 'key_windows'
  if (first.startsWith('decisions')) return 'decisions'
  if (first.startsWith('cross_checks')) return 'cross_checks'
  if (first.startsWith('year_phases')) return 'year_phases'
  return first
}

function transition(before: EditorialTraceStage, after: EditorialTraceStage) {
  const keys = [...new Set([...Object.keys(before.fields), ...Object.keys(after.fields)])].sort()
  const changes: TraceChange[] = []
  let preserved = 0
  const countsByPrefix: Record<string, { added: number; deleted: number; overwritten: number; preserved: number }> = {}
  const count = (path: string, kind: keyof (typeof countsByPrefix)[string]) => {
    const prefix = prefixOf(path)
    countsByPrefix[prefix] ??= { added: 0, deleted: 0, overwritten: 0, preserved: 0 }
    countsByPrefix[prefix][kind] += 1
  }
  for (const path of keys) {
    const left = before.fields[path]
    const right = after.fields[path]
    if (left && right && left.sig === right.sig) { preserved += 1; count(path, 'preserved'); continue }
    if (!left && right) { count(path, 'added'); if (changes.length < MAX_CHANGES_PER_TRANSITION) changes.push({ path, kind: 'added', after: right }); continue }
    if (left && !right) { count(path, 'deleted'); if (changes.length < MAX_CHANGES_PER_TRANSITION) changes.push({ path, kind: 'deleted', before: left }); continue }
    if (left && right) { count(path, 'overwritten'); if (changes.length < MAX_CHANGES_PER_TRANSITION) changes.push({ path, kind: 'overwritten', before: left, after: right }) }
  }
  const totalChanges = keys.length - preserved
  return {
    from: before.stage,
    to: after.stage,
    field_count_before: Object.keys(before.fields).length,
    field_count_after: Object.keys(after.fields).length,
    preserved,
    total_changes: totalChanges,
    omitted_change_count: Math.max(0, totalChanges - changes.length),
    counts_by_prefix: countsByPrefix,
    changes,
  }
}

export function buildEditorialTrace(stages: EditorialTraceStage[], meta: Record<string, unknown> = {}) {
  const usable = stages.filter(stage => stage && stage.stage)
  const initial = usable[0]
  const final = usable[usable.length - 1]
  return {
    version: EDITORIAL_TRACE_VERSION,
    ...meta,
    initial: initial ? {
      stage: initial.stage,
      field_count: Object.keys(initial.fields).length,
      fields: Object.fromEntries(Object.entries(initial.fields).slice(0, MAX_INITIAL_FIELDS)),
      omitted_field_count: Math.max(0, Object.keys(initial.fields).length - MAX_INITIAL_FIELDS),
    } : null,
    transitions: usable.slice(1).map((stage, index) => transition(usable[index], stage)),
    final: final ? { stage: final.stage, field_count: Object.keys(final.fields).length } : null,
  }
}
