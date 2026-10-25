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

const PLANET_TERMS: Array<[string,string]> = [
  ['True Node','진북교점'], ['Mercury','수성'], ['Venus','금성'], ['Jupiter','목성'], ['Saturn','토성'],
  ['Uranus','천왕성'], ['Neptune','해왕성'], ['Pluto','명왕성'], ['Mars','화성'], ['Moon','달'], ['Sun','태양'],
  ['ASC','상승점'], ['DSC','하강점'], ['MC','중천점'], ['IC','천저점'],
]
const ASPECT_TERMS: Array<[string,string]> = [
  ['conjunction','합'], ['sextile','육십분위'], ['square','사각'], ['trine','삼각'], ['quincunx','퀸컨스'], ['opposition','대립'],
]

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeDegreePrecision(value: string) {
  return value.replace(/(\d+\.\d{2,})\s*°/g, (_m, raw) => {
    const n = Number(raw)
    if (!Number.isFinite(n)) return `${raw}°`
    if (n >= 0 && n < 0.005) return '0.01° 미만'
    return `${n.toFixed(2)}°`
  })
}

export function polishReunionNarrativeText(value: unknown, provisional = false) {
  let out = text(value)
  if (!out) return ''

  out = out
    .replace(/용수자리/g, '진북교점')
    .replace(/감정 활성(?:화)?/g, '과거 관계를 다시 의식하는 흐름')
    .replace(/연락·재접촉 단계/g, '연락이나 대화가 다시 이어질 수 있는 흐름')
    .replace(/관계 재구축 단계/g, '관계를 다시 이어 가는 흐름')
    .replace(/현재 열림/g, '현재 관련 신호가 있음')
    .replace(/후보 창/g, '시기')
    .replace(/후보 구간/g, '시기')
    .replace(/\bSecondary\s+Progression(?:\(2차 진행\))?/gi, '2차 진행')
    .replace(/\bDaily\s+transit(?:\(트랜짓·현재 행성 이동\))?/gi, '일일 트랜짓')
    .replace(/\bprogressed\s+synastry(?:\(시너스트리·궁합차트\))?/gi, '진행 시너스트리')
    .replace(/\bprogressed\s+composite\b/gi, '진행 컴포지트')
    .replace(/\bsynastry(?:\(시너스트리·궁합차트\))?/gi, '시너스트리')
    .replace(/\btransit(?:\(트랜짓·현재 행성 이동\))?/gi, '트랜짓')
    .replace(/\bDavison(?:\(데이비슨\))?/g, '데이비슨')
    .replace(/\bMarks(?:\(마크스\))?/g, '마크스')
    .replace(/\bprovisional(?:\(잠정\))?/gi, '잠정')

  for (const [en, ko] of PLANET_TERMS) {
    const e = escapeRegExp(en), k = escapeRegExp(ko)
    out = out.replace(new RegExp(`\\bProgressed\\s+${e}(?:\\(${k}\\))?`, 'gi'), `진행 ${ko}`)
    out = out.replace(new RegExp(`\\b${e}(?:\\(${k}\\))?`, 'g'), ko)
  }
  for (const [en, ko] of ASPECT_TERMS) {
    const e = escapeRegExp(en), k = escapeRegExp(ko)
    out = out.replace(new RegExp(`\\b${e}(?:\\(${k}(?:·150도각)?\\))?`, 'gi'), ko)
  }

  out = out
    .replace(/\bProgressed\b/gi, '진행')
    .replace(/\borb\b/gi, '오브')
    .replace(/\bincoming\b/gi, '상대측 활성')
    .replace(/\boutgoing\b/gi, '내측 활성')
    .replace(/\breconnection\b/gi, '재접점')
    .replace(/\bsecondary\b/gi, '보조')

  out = normalizeDegreePrecision(out)
  out = out
    .replace(/(?:오차|오브)\s*0\.01° 미만(?:\s*수준)?의?\s*(?:극도로\s*)?정밀한/g, '오브 0.01° 미만으로 매우 가까운')
    .replace(/극도로\s*정밀한/g, '매우 가까운')

  if (provisional) {
    out = out
      .replace(/정확한\s+(합|육십분위|사각|삼각|퀸컨스|대립)/g, '가까운 $1')
      .replace(/정밀한\s+(합|육십분위|사각|삼각|퀸컨스|대립)/g, '가까운 $1')
  }

  return out
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function splitSentences(value: string) {
  const t = text(value)
  if (!t) return []
  return t.replace(/([.!?])\s+/g, '$1\n').split('\n').map(x => x.trim()).filter(Boolean)
}

function safeInitiativeDetail(value: unknown, provisional: boolean) {
  const polished = polishReunionNarrativeText(value, provisional)
  const blocked = /(?:누가\s*먼저|선연락|상대가\s*(?:먼저\s*)?(?:연락|메시지)|내가\s*(?:먼저\s*)?(?:연락|메시지)|상대측\s*활성|내측\s*활성|수신\s*신호|발신\s*적합|시작\s*압력|(?:내|나|상대)(?:\s*쪽|\s*방향|\s*측)?[^.!?]{0,32}(?:먼저|앞서|우세)|(?:먼저|앞서|우세)[^.!?]{0,32}(?:내|나|상대)(?:\s*쪽|\s*방향|\s*측)?)/
  return splitSentences(polished).filter(sentence => !blocked.test(sentence)).join(' ')
}

function hasUnsupportedInitiativeDirection(value: unknown, provisional: boolean) {
  const polished = polishReunionNarrativeText(value, provisional)
  const allowedUncertainty = /(?:정하기|판단하기|확정하기|예측하기)\s*(?:어려|힘들)|(?:알|확정할|예측할)\s*수\s*없/
  return splitSentences(polished).some(sentence => safeInitiativeDetail(sentence, provisional) !== sentence && !allowedUncertainty.test(sentence))
}

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

function allowedTimingDateGate(payload: any) {
  const present = Boolean(payload?.reunion_timing_windows && Array.isArray(payload?.reunion_timing_windows?.windows))
  const dates = new Set(arr(payload?.reunion_timing_windows?.windows).flatMap((x:any)=>[text(x?.date),text(x?.start),text(x?.end)]).filter((x:string)=>/^\d{4}-\d{2}-\d{2}$/.test(x) && (!payload?.reunion_hierarchy?.as_of_date || x >= payload.reunion_hierarchy.as_of_date)))
  const ranges = arr(payload?.reunion_timing_windows?.windows).map((x:any)=>({start:text(x?.start ?? x?.date),end:text(x?.end ?? x?.date)}))
  return { present, dates, ranges, strict:Boolean(payload?.reunion_hierarchy) }
}

function timingWindowAllowed(window: any, gate: {present:boolean;dates:Set<string>;ranges:Array<{start:string;end:string}>;strict?:boolean}) {
  if (!gate.present) return true
  const found = text(window?.period).match(/\d{4}-\d{2}-\d{2}/g) ?? []
  return (found.length > 0 || !gate.strict) && found.every((x:string)=>gate.dates.has(x)) &&
    (!gate.strict || found.length < 2 || gate.ranges.some(r=>found.every(x=>x>=r.start && x<=r.end)))
}

function hasCoreText(v: any) {
  return text(v?.conclusion).length >= 12 && text(v?.interpretation).length >= 24
}

export function repairReunionGroundingV2(data: any, payload: any): RepairResult {
  const source = data?.reunion_synthesis_v2
  if (!source || typeof source !== 'object') return { ok: false, repaired: false, data, reason: 'missing_reunion_synthesis_v2' }

  const valid = validSet(payload)
  if (!valid.size) return { ok: false, repaired: false, data, reason: 'missing_evidence_matrix' }

  if (!hasCoreText(source?.why_reconnect) || !hasCoreText(source?.initiative)) {
    return { ok: false, repaired: false, data, reason: 'missing_core_section_text' }
  }
  if (text(source?.timing?.conclusion).length < 12 || text(source?.rebuild?.conclusion).length < 12 || text(source?.repeat_risks?.conclusion).length < 12) {
    return { ok: false, repaired: false, data, reason: 'missing_core_conclusion' }
  }

  const fallbacks: Record<QuestionKey, string[]> = {
    why_reconnect: fallbackRefs(payload, 'why_reconnect', valid),
    initiative: fallbackRefs(payload, 'initiative', valid),
    timing: fallbackRefs(payload, 'timing', valid),
    rebuild: fallbackRefs(payload, 'rebuild', valid),
    repeat_risks: fallbackRefs(payload, 'repeat_risks', valid),
  }

  const rawConsultation=source?.consultation_answer
  if(!rawConsultation||typeof rawConsultation!=='object'){
    return {ok:false,repaired:false,data,reason:'missing_direct_consultation'}
  }

  const before = JSON.stringify(data)
  let v2: any = {
    ...source,
    consultation_answer: {...rawConsultation,evidence_refs:normalizeRefs(rawConsultation?.evidence_refs,[...fallbacks.timing,...fallbacks.rebuild,...fallbacks.repeat_risks],valid,3)},
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

  const provisional = payload?.precision?.partner_time_exact === false
  const timingDateGate = allowedTimingDateGate(payload)
  v2.timing = { ...v2.timing, windows: arr(v2?.timing?.windows).filter((w:any)=>timingWindowAllowed(w, timingDateGate)) }
  const gate = payload?.reunion_evidence_v2?.initiative_gate
  if (gate?.available !== true) {
    const directionalText=[v2?.summary,v2?.initiative?.conclusion,v2?.initiative?.interpretation,v2?.consultation_answer?.initiative].map(text).join(' ')
    if(hasUnsupportedInitiativeDirection(directionalText,provisional)){
      return {ok:false,repaired:false,data,reason:'unsupported_initiative_direction'}
    }
  }

  const allRefs = uniq([
    ...arr(v2?.consultation_answer?.evidence_refs),
    ...arr(v2?.why_reconnect?.evidence_refs),
    ...arr(v2?.initiative?.evidence_refs),
    ...arr(v2?.timing?.evidence_refs),
    ...arr(v2?.rebuild?.evidence_refs),
    ...arr(v2?.repeat_risks?.evidence_refs),
  ].map(text).filter(x => valid.has(x)))

  const consultation=v2?.consultation_answer??{}
  const requiredConsultation=["current_stage","contact_type_if_any","initiative","continuity","meeting_gate","rebuild_gate","behavior_change_evidence"]
  if(requiredConsultation.some(key=>text(consultation?.[key]).length<12)||arr(consultation?.next_stage_up_conditions).length<1||arr(consultation?.down_conditions).length<1||arr(consultation?.repeat_risks).length<1){
    return {ok:false,repaired:false,data,reason:'incomplete_direct_consultation'}
  }

  if (text(v2.summary).length < 120 || allRefs.length < 3) {
    return { ok: false, repaired: false, data, reason: 'insufficient_grounded_content' }
  }

  const next = {...data,reunion_synthesis_v2:v2}
  if (/끊어지지 않는 인연|끊을 수 없는 인연|카르마적 인연|운명적 인연|운명적으로 다시 만난다|천생연분|서로를 지울 수 없다|반드시 연락한다|상대가 아직 사랑한다|(?:연락|만남|재회)\s*확률\s*\d+(?:\.\d+)?\s*%/.test(JSON.stringify(next))) {
    return { ok:false, repaired:false, data, reason:'unsupported_deterministic_claim' }
  }
  return { ok: true, repaired: before !== JSON.stringify(next), data: next }
}
