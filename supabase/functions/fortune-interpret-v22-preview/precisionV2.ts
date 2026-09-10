export const INTEGRATED_PRECISION_CONTRACT = 'integrated-precision-v2'
export type PrecisionMode = 'exact' | 'provisional'

const VALID_SOURCES = new Set(['official_record','family_memory','user_estimate','arbitrary_input','rectified','unknown'])
const VALID_CONFIDENCE = new Set(['exact','high','medium','low','unknown'])
const SENSITIVE_TARGETS = new Set(['Moon','ASC','MC'])

export type PrecisionReadiness = { ok:boolean; mode:PrecisionMode|'invalid'; reason:string }

export function precisionGateFromPayload(calculation:any): PrecisionReadiness {
  const p = calculation?.precision
  if (!p || typeof p !== 'object') return {ok:false,mode:'invalid',reason:'legacy_or_missing_precision_contract'}
  if (p.contract_version !== INTEGRATED_PRECISION_CONTRACT) return {ok:false,mode:'invalid',reason:'unsupported_precision_contract'}
  if (!VALID_SOURCES.has(String(p.time_source ?? '')) || !VALID_CONFIDENCE.has(String(p.time_confidence ?? ''))) return {ok:false,mode:'invalid',reason:'invalid_precision_provenance'}
  const policy = p.layer_policy
  const policyShape = (expected:'allow'|'exclude') => policy && typeof policy === 'object'
    && policy.natal_moon === expected && policy.angles_houses === expected && policy.house_ruler_bonus === expected
    && policy.intraday_timing === expected && policy.saju_ai === expected && policy.thai_ai === expected
  const exactProvenance = (p.time_source === 'official_record' || p.time_source === 'rectified') && p.time_confidence === 'exact'
  const exactShape = p.status === 'exact' && p.time_available === true && p.time_exact === true && exactProvenance && p.scoring_mode === 'full_exact'
    && p.allow_natal_moon_scoring === true && p.allow_angles_houses_scoring === true && p.allow_house_ruler_bonus === true
    && p.allow_intraday_timing === true && p.allow_saju_ai === true && p.allow_thai_ai === true && policyShape('allow')
  if (exactShape) return {ok:true,mode:'exact',reason:''}
  const provisionalShape = p.status === 'provisional' && p.time_available === true && p.time_exact === false && !exactProvenance && p.scoring_mode === 'planet_only_provisional'
    && p.allow_natal_moon_scoring === false && p.allow_angles_houses_scoring === false && p.allow_house_ruler_bonus === false
    && p.allow_intraday_timing === false && p.allow_saju_ai === false && p.allow_thai_ai === false && policyShape('exclude')
  if (provisionalShape) return {ok:true,mode:'provisional',reason:''}
  return {ok:false,mode:'invalid',reason:'internally_inconsistent_precision_contract'}
}

function cloneJson<T>(value:T):T { return JSON.parse(JSON.stringify(value)) as T }
function sanitizeEvidence(rows:any):any[] {
  if (!Array.isArray(rows)) return []
  return rows.filter((row:any)=>{
    if (!row || typeof row !== 'object' || row.kind === 'house') return false
    if (row.whole_house != null || row.quadrant_house != null || row.placidus_house != null || row.house_system != null) return false
    if (SENSITIVE_TARGETS.has(String(row.target ?? ''))) return false
    return true
  }).map((row:any)=>{ const out={...row}; delete out.sample_time; delete out.whole_house; delete out.quadrant_house; delete out.quadrant_system; delete out.placidus_house; delete out.house_system; return out })
}

export function sanitizeProvisionalCalculation(calculation:any) {
  const gate=precisionGateFromPayload(calculation)
  if (!gate.ok || gate.mode !== 'provisional') throw new Error('provisional precision contract required')
  const out=cloneJson(calculation)
  out.saju={ok:false,provisional_excluded_from_ai:true}
  out.thai={ok:false,provisional_excluded_from_ai:true}
  if (!out.western || typeof out.western !== 'object') out.western={}
  out.western.natal={asc:null,mc:null,house_system:null,precision_note:'provisional birth-time-sensitive layers excluded'}
  out.western.score_policy='provisional planet-only relative flow; birth-time-sensitive natal layers excluded'
  out.western.method='provisional planet-only period sampling; exact clock timing excluded'
  out.western.detail_days=[]
  out.western.key_dates=[]
  if (Array.isArray(out.western.daily_scores)) out.western.daily_scores=out.western.daily_scores.map((day:any)=>({...day,evidence:sanitizeEvidence(day?.evidence)}))
  if (Array.isArray(out.western.months)) out.western.months=out.western.months.map((m:any)=>({...m,detail_days:undefined,key_dates:undefined}))
  out.consensus_policy={western:'Western planet-only provisional evidence only; clock-specific timing excluded',saju:'excluded from AI',thai:'excluded from AI'}
  return out
}

function walk(value:any,path:string,visit:(value:any,path:string)=>void) {
  visit(value,path)
  if (Array.isArray(value)) value.forEach((v,i)=>walk(v,`${path}[${i}]`,visit))
  else if (value && typeof value === 'object') Object.entries(value).forEach(([k,v])=>walk(v,path?`${path}.${k}`:k,visit))
}

function isSafeWesternReference(value:string) {
  return /^W:(?:daily|date):\d{4}-\d{2}-\d{2}:[^:\s]+(?::(?:best|\d+))?$/.test(value)
}

export function auditProvisionalResidue(value:any) {
  const violations:string[]=[]
  walk(value,'',(node,path)=>{
    const leaf=path.split('.').pop() ?? ''
    if (['asc','mc','house_system','whole_house','placidus_house','quadrant_house','quadrant_system','sample_time'].includes(leaf) && node != null) violations.push(path)
    if (leaf === 'target' && SENSITIVE_TARGETS.has(String(node ?? ''))) violations.push(path)
    if (typeof node === 'string') {
      // These are opaque, date-scoped evidence IDs. In particular,
      // W:daily:2026-09-10:10 contains the substring "10:10", but no clock time.
      if (isSafeWesternReference(node)) return
      if (/\b(?:Whole Sign|Placidus|Porphyry)\b/i.test(node)) violations.push(path)
      if (/\b(?:ASC|MC)\b/.test(node)) violations.push(path)
      if (/\b\d{1,2}H\b/.test(node)) violations.push(path)
      if (/\b\d{1,2}:\d{2}\b/.test(node)) violations.push(path)
      if (/→\s*(?:Moon|ASC|MC)\b/.test(node)) violations.push(path)
    }
  })
  return {ok:violations.length===0,violations:[...new Set(violations)].slice(0,50)}
}

export function attachPrecisionPacketMetadata(packet:any, calculation:any) {
  const gate=precisionGateFromPayload(calculation)
  if (!gate.ok) throw new Error(gate.reason)
  const out=cloneJson(packet)
  out.integrated_precision_contract=INTEGRATED_PRECISION_CONTRACT
  out.precision_mode=gate.mode
  out.precision=cloneJson(calculation.precision)
  if (gate.mode === 'provisional') {
    out.saju=null; out.thai=null
    if (out.systems && typeof out.systems === 'object') { out.systems.saju=null; out.systems.thai=null }
    if (Array.isArray(out.cross_system_refs)) out.cross_system_refs=[]
    if (Array.isArray(out.evidence_ledger)) out.evidence_ledger=out.evidence_ledger.filter((row:any)=>{
      const ref=String(row?.ref ?? row?.id ?? '')
      const text=JSON.stringify(row ?? {})
      return !/^W:(?:window|detail)/i.test(ref) && !/(?:saju|thai)/i.test(ref) && !/(?:Whole Sign|Placidus|Porphyry|\bASC\b|\bMC\b|\b\d{1,2}H\b|\b\d{1,2}:\d{2}\b)/i.test(text)
    })
  }
  return out
}

function stripSensitiveText(text:unknown) { return String(text ?? '').split(/(?<=[.!?])\s+|\n+/).filter((s)=>!/(?:사주|Thai|태국|Whole Sign|Placidus|Porphyry|\bASC\b|\bMC\b|\b\d{1,2}:\d{2}\b)/i.test(s)).join(' ').trim() }

export function sanitizeProvisionalInterpretationOutput(data:any) {
  const out=cloneJson(data ?? {})
  if (out.overall && typeof out.overall==='object') {
    out.overall.summary=stripSensitiveText(out.overall.summary); out.overall.dominant_pattern=stripSensitiveText(out.overall.dominant_pattern)
    out.overall.best_phase=stripSensitiveText(out.overall.best_phase); out.overall.caution_phase=stripSensitiveText(out.overall.caution_phase)
  }
  if (!out.systems || typeof out.systems!=='object') out.systems={}
  out.systems.western=stripSensitiveText(out.systems.western || 'Western planet-only provisional interpretation'); out.systems.saju=''; out.systems.thai=''
  if (Array.isArray(out.cross_checks)) out.cross_checks=out.cross_checks.map((x:any)=>({...x,mode:'Western단독',saju:'',thai:'',synthesis:stripSensitiveText(x?.synthesis)}))
  if (Array.isArray(out.key_windows)) out.key_windows=[]
  if (Array.isArray(out.year_phases)) out.year_phases=out.year_phases.map((x:any)=>({...x,theme:stripSensitiveText(x?.theme),change:stripSensitiveText(x?.change)}))
  if (out.relationship_reading && typeof out.relationship_reading==='object') for (const k of ['context','flow','focus_timing','watch','avoid']) out.relationship_reading[k]=stripSensitiveText(out.relationship_reading[k])
  if (out.contact_flow && typeof out.contact_flow==='object') for (const k of Object.keys(out.contact_flow)) out.contact_flow[k]=stripSensitiveText(out.contact_flow[k])
  out.limits='출생시간이 검증되지 않아 시간민감 출생 요소와 교차체계 해석을 제외한 잠정 해설이야.'
  return out
}

export function buildProvisionalExternalPrompt(calculation:any) {
  const safe=sanitizeProvisionalCalculation(calculation)
  const audit=auditProvisionalResidue(safe)
  if (!audit.ok) throw new Error(`provisional residue: ${audit.violations.join(',')}`)
  return ['[별빛의 운명 · integrated-precision-v2 provisional]','Western planet-only 근거만 사용해. 출생시간에 민감한 출생 Moon, ASC/MC, 하우스, 하우스 룰러 보너스와 정확한 HH:MM 시기를 복원하거나 추정하지 마.','사주와 Thai 자료를 요청하거나 재구성하지 마. 점수는 사건 확률이 아니라 상대적 활성도야.','','[CALCULATED_DATA]',JSON.stringify(safe,null,2)].join('\n')
}
