type QuestionKey = 'why_reconnect' | 'initiative' | 'timing' | 'rebuild' | 'repeat_risks'

type RepairResult = {
  ok: boolean
  repaired: boolean
  data: any
  reason?: string
}

type DedupState = {
  sentences: Set<string>
  evidence: Set<string>
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
const BODY_KO = PLANET_TERMS.map(([,ko]) => ko)
const ASPECT_KO = ASPECT_TERMS.map(([,ko]) => ko)

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

function sentenceFingerprint(value: string) {
  return value
    .toLowerCase()
    .replace(/\d+(?:\.\d+)?/g, '#')
    .replace(/[°·,:;()\[\]{}'"“”‘’/\\\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function aspectToken(value: string) {
  for (const term of ASPECT_KO) {
    if (term !== '합' && value.includes(term)) return term
  }
  return /합(?:을|를|이|가|의|으로|과|과의|$|[\s,.!?])/.test(value) ? '합' : ''
}

function evidenceFingerprint(value: string) {
  const bodies = uniq(BODY_KO.filter(term => value.includes(term))).sort()
  const aspect = aspectToken(value)
  const technical = Boolean(aspect) || value.includes('오브') || value.includes('°') || value.includes('조화각') || value.includes('긴장각')
  if (bodies.length < 2 || !technical) return ''
  return `${bodies.join('+')}|${aspect || '각'}`
}

function dedupeNarrative(value: unknown, state: DedupState, provisional: boolean, trackEvidence = true) {
  const polished = polishReunionNarrativeText(value, provisional)
  const sentences = splitSentences(polished)
  if (sentences.length <= 1) {
    const only = sentences[0] ?? polished
    const fp = sentenceFingerprint(only)
    const ev = trackEvidence ? evidenceFingerprint(only) : ''
    if (fp) state.sentences.add(fp)
    if (ev) state.evidence.add(ev)
    return only
  }

  const kept: string[] = []
  const candidates = sentences.map(sentence => {
    const fp = sentenceFingerprint(sentence)
    const ev = trackEvidence ? evidenceFingerprint(sentence) : ''
    const duplicate = (fp && state.sentences.has(fp)) || (ev && state.evidence.has(ev))
    return { sentence, fp, ev, duplicate }
  })

  for (const row of candidates) if (!row.duplicate) kept.push(row.sentence)
  const finalRows = kept.length ? candidates.filter(row => kept.includes(row.sentence)) : candidates.slice(0,1)
  for (const row of finalRows) {
    if (row.fp) state.sentences.add(row.fp)
    if (row.ev) state.evidence.add(row.ev)
  }
  return finalRows.map(row => row.sentence).join(' ')
}

function localText(value: unknown, provisional: boolean, trackEvidence = true) {
  return dedupeNarrative(value, { sentences: new Set(), evidence: new Set() }, provisional, trackEvidence)
}

function sectionPair(section: any, provisional: boolean) {
  const state: DedupState = { sentences: new Set(), evidence: new Set() }
  return {
    ...section,
    conclusion: dedupeNarrative(section?.conclusion, state, provisional, false),
    interpretation: dedupeNarrative(section?.interpretation, state, provisional, true),
  }
}

function safeInitiativeDetail(value: unknown, provisional: boolean) {
  const polished = polishReunionNarrativeText(value, provisional)
  const blocked = /(?:누가\s*먼저|선연락|상대가\s*(?:먼저\s*)?(?:연락|메시지)|내가\s*(?:먼저\s*)?(?:연락|메시지)|상대측\s*활성|내측\s*활성|수신\s*신호|발신\s*적합|시작\s*압력|(?:내|나|상대)(?:\s*쪽|\s*방향|\s*측)?[^.!?]{0,32}(?:먼저|앞서|우세)|(?:먼저|앞서|우세)[^.!?]{0,32}(?:내|나|상대)(?:\s*쪽|\s*방향|\s*측)?)/
  return splitSentences(polished).filter(sentence => !blocked.test(sentence)).join(' ')
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

function composeSummary(v2: any) {
  const primary = uniq([
    text(v2?.why_reconnect?.conclusion),
    text(v2?.initiative?.conclusion),
    text(v2?.timing?.conclusion),
    text(v2?.rebuild?.conclusion),
    text(v2?.repeat_risks?.conclusion),
    ...arr(v2?.timing?.windows).slice(0,2).map((x: any) => text(x?.meaning)),
  ])
  let result = primary.join(' ')
  if (result.length < 180) {
    const backup = uniq([
      text(v2?.why_reconnect?.interpretation),
      text(v2?.initiative?.interpretation),
      ...arr(v2?.rebuild?.conditions).slice(0,2).map(text),
      ...arr(v2?.repeat_risks?.patterns).slice(0,2).map(text),
    ])
    for (const part of backup) {
      if (!part || result.includes(part)) continue
      result = `${result} ${part}`.trim()
      if (result.length >= 180) break
    }
  }
  return result.slice(0, 3200)
}

function polishV2(v2: any, provisional: boolean) {
  const why = sectionPair(v2?.why_reconnect, provisional)
  const initiative = sectionPair(v2?.initiative, provisional)
  const timingConclusion = localText(v2?.timing?.conclusion, provisional, false)
  const timingWindows = arr(v2?.timing?.windows).map((w: any) => ({
    ...w,
    period: text(w?.period),
    meaning: localText(w?.meaning, provisional, true),
  }))
  const rebuildConclusion = localText(v2?.rebuild?.conclusion, provisional, false)
  const rebuildConditions = arr(v2?.rebuild?.conditions).map((x: any) => localText(x, provisional, true)).filter(Boolean)
  const repeatConclusion = localText(v2?.repeat_risks?.conclusion, provisional, false)
  const repeatPatterns = arr(v2?.repeat_risks?.patterns).map((x: any) => localText(x, provisional, true)).filter(Boolean)

  return {
    ...v2,
    summary: polishReunionNarrativeText(v2?.summary, provisional),
    why_reconnect: why,
    initiative,
    timing: { ...v2.timing, conclusion: timingConclusion, windows: timingWindows },
    rebuild: { ...v2.rebuild, conclusion: rebuildConclusion, conditions: uniq(rebuildConditions) },
    repeat_risks: { ...v2.repeat_risks, conclusion: repeatConclusion, patterns: uniq(repeatPatterns) },
    convergence: arr(v2?.convergence).map((x: any) => ({
      ...x,
      theme: polishReunionNarrativeText(x?.theme, provisional),
      meaning: polishReunionNarrativeText(x?.meaning, provisional),
    })),
    precision_note: polishReunionNarrativeText(v2?.precision_note, provisional),
  }
}

function sanitizeUnsupportedClaims(value: any): any {
  if (typeof value === 'string') return value
    .replace(/끊어지지 않는 인연|끊을 수 없는 인연|서로를 지울 수 없다/g, '쉽게 정리되지 않는 느낌이 들 수 있는 관계')
    .replace(/카르마적 인연|운명적 인연|천생연분/g, '강하게 체감될 수 있는 관계')
    .replace(/운명적으로 다시 만난다/g, '다시 접점이 생길 수 있는 흐름이 보인다')
    .replace(/반드시 연락한다/g, '연락을 확정할 수는 없지만 관련 신호가 있다')
    .replace(/상대가 아직 사랑한다/g, '상대의 실제 감정은 차트만으로 확정할 수 없다')
    .replace(/(연락|만남|재회)\s*확률\s*\d+(?:\.\d+)?\s*%/g, '$1 관련 점수는 사건 확률이 아니다')
  if (Array.isArray(value)) return value.map(sanitizeUnsupportedClaims)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, sanitizeUnsupportedClaims(v)]))
  return value
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

  const before = JSON.stringify(data)
  let v2: any = {
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

  const provisional = payload?.precision?.partner_time_exact === false
  const timingDateGate = allowedTimingDateGate(payload)
  v2.timing = { ...v2.timing, windows: arr(v2?.timing?.windows).filter((w:any)=>timingWindowAllowed(w, timingDateGate)) }
  const gate = payload?.reunion_evidence_v2?.initiative_gate
  if (gate?.available !== true) {
    v2.summary = safeInitiativeDetail(v2?.summary, provisional)
    const preserved = safeInitiativeDetail(`${v2?.initiative?.conclusion ?? ''} ${v2?.initiative?.interpretation ?? ''}`, provisional)
    v2.initiative = {
      ...v2.initiative,
      conclusion: '누가 먼저 연락할지는 현재 계산만으로 정하기 어렵다.',
      interpretation: `${preserved ? `${preserved} ` : ''}누가 먼저냐보다 연락이 생긴 뒤 대화가 이어지는지, 실제 만남을 잡는지, 예전 문제를 피하지 않는지를 보는 편이 더 중요하다.`.trim(),
      evidence_refs: normalizeRefs(v2?.initiative?.evidence_refs, fallbacks.initiative, valid),
    }
  }

  if (text(v2.summary).length < 180) v2.summary = composeSummary(v2)
  v2 = polishV2(v2, provisional)

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

  const next = {
    ...data,
    headline: polishReunionNarrativeText(data?.headline, provisional),
    overview: polishReunionNarrativeText(data?.overview, provisional),
    timing: polishReunionNarrativeText(data?.timing, provisional),
    reunion_context: polishReunionNarrativeText(data?.reunion_context, provisional),
    practical_advice: arr(data?.practical_advice).map((x: any) => polishReunionNarrativeText(x, provisional)),
    top_aspects: arr(data?.top_aspects).map((x: any) => ({
      ...x,
      label: polishReunionNarrativeText(x?.label, provisional),
      meaning: polishReunionNarrativeText(x?.meaning, provisional),
    })),
    limits: polishReunionNarrativeText(data?.limits, provisional),
    reunion_synthesis_v2: v2,
  }
  const safeNext = sanitizeUnsupportedClaims(next)
  if (/끊어지지 않는 인연|끊을 수 없는 인연|카르마적 인연|운명적 인연|운명적으로 다시 만난다|천생연분|서로를 지울 수 없다|반드시 연락한다|상대가 아직 사랑한다|(?:연락|만남|재회)\s*확률\s*\d+(?:\.\d+)?\s*%/.test(JSON.stringify(safeNext))) {
    return { ok:false, repaired:false, data, reason:'unsupported_deterministic_claim' }
  }
  return { ok: true, repaired: before !== JSON.stringify(safeNext), data: safeNext }
}
