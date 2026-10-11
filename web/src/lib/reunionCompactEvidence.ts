type Row = Record<string, any>

const list = (x: unknown): Row[] => Array.isArray(x) ? x.filter(v => v && typeof v === 'object') : []
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const pick = (x: Row | undefined, keys: string[]) => Object.fromEntries(keys.flatMap(k => {
  const v = x?.[k]
  return v !== undefined && v !== null && (finite(v) || typeof v === 'boolean' || (typeof v === 'string' && v.length <= 240 && !/\b[WST]:/.test(v))) ? [[k, v]] : []
}))

function hierarchyWindow(x: Row | null | undefined) {
  if (!x) return null
  return {
    ...pick(x,['date','start','end','stage','label','final','temporal_status']),
    components:pick(x.components,['long_term','mid_term','event_trigger','cross_system','convergence_bonus']),
  }
}

export function compactReunionHierarchyForExternal(h: Row | null | undefined, level: number) {
  if(!h) return null
  const limit=level===0?3:level===1?2:1
  const stages=Object.fromEntries(Object.entries(h.stages ?? {}).map(([key,value])=>[key,pick(value as Row,['label','activation','candidate_count','gate_pass_count','hierarchy_pass_count'])]))
  const coverage=Object.fromEntries(Object.entries(h.coverage ?? {}).filter(([,value])=>typeof value==='boolean'))
  return {
    ...pick(h,['version','as_of_date','score_meaning']),
    validation:h.validation ? {status:h.validation.status,checks:list(h.validation.checks).slice(0,3).map(row=>pick(row,['name','status','detail']))} : undefined,
    stages,
    top_periods:list(h.top_periods).slice(0,limit).map(hierarchyWindow).filter(Boolean),
    nearest_window:hierarchyWindow(h.nearest_window),
    past_windows:list(h.past_windows).slice(0,limit).map(hierarchyWindow).filter(Boolean),
    current_windows:list(h.current_windows).slice(0,limit).map(hierarchyWindow).filter(Boolean),
    initiative:h.initiative ? pick(h.initiative,['available','verdict','reason']) : undefined,
    coverage,
    limitations:(Array.isArray(h.limitations)?h.limitations:[]).filter((s:unknown)=>typeof s==='string'&&s.length<=240).slice(0,3),
    temporal_policy:'past_windows=지난 활성 구간·사후 비교용, current_windows=현재 활성 구간, top_periods/nearest_window=미래 후보. 과거를 미래 후보로 승격하지 않는다.',
  }
}

export function compactReunionTimingForExternal(x: Row | null | undefined, level: number) {
  if(!x) return null
  return {
    windows:list(x.windows).slice(0,level>=2?1:3).map(row=>pick(row,['date','start','end','stage','label','score'])),
    policy:typeof x.policy==='string' ? x.policy.slice(0,240) : undefined,
  }
}
