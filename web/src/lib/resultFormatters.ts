import type { Aspect, FortuneStat, IntegratedApiResponse, RelationshipApiResponse, ReunionTimingContext } from '../appTypes'
import { topicOrder } from './fortuneTopics'

export const planetLabels: Record<string, string> = {
  Sun:'태양', Moon:'달', Mercury:'수성', Venus:'금성', Mars:'화성', Jupiter:'목성', Saturn:'토성',
  Uranus:'천왕성', Neptune:'해왕성', Pluto:'명왕성', 'True Node':'진북교점', ASC:'상승점', DSC:'하강점', MC:'중천점', IC:'천저점',
}
const aspectLabels: Record<string, string> = {
  conjunction:'합', sextile:'육합', square:'사각', trine:'삼각', quincunx:'퀸컨스', opposition:'대립',
}

export function aspectText(aspect: Aspect) {
  return `${planetLabels[aspect.a] ?? aspect.a} · ${planetLabels[aspect.b] ?? aspect.b} ${aspectLabels[aspect.aspect] ?? aspect.aspect}`
}

export function integratedPromptText(request: Record<string, unknown>, calculation?: IntegratedApiResponse | null) {
  const profile = (request.profile ?? {}) as Record<string, unknown>
  return [
    '[별빛의 운명 · 통합운세 분석 요청]',
    `분석 기간: ${String(request.start_date ?? '')} ~ ${String(request.end_date ?? '')}`,
    `이름: ${String(profile.name ?? '미입력')}`,
    `출생: ${String(profile.birth_date ?? '')} ${String(profile.birth_time ?? '')}`,
    `좌표: ${String(profile.latitude ?? '')}, ${String(profile.longitude ?? '')} / UTC ${String(profile.utc_offset_hours ?? '')}`,
    `성별(사주 대운 계산 기준): ${String(profile.gender ?? '')}`,
    '',
    '계산/해석 원칙:',
    '- Western(서양점성술), 사주, Thai(태국점성술)를 서로 다른 체계로 분리해서 본다.',
    '- Western 점수는 사건 확률이 아니라 상대적 활성도다.',
    '- 사주는 진태양시 보정을 사용하고, 엔진이 계산하지 않은 신강·신약/용희기신 등을 임의 생성하지 않는다.',
    '- 사주 annual(세운)은 입춘, monthly(월운)은 각 절(節)의 정확시각 경계로 분할된 구간이다. 같은 달력 연도·월 이름이 반복돼도 서로 다른 구간을 임의 병합하지 않는다.',
    '- Thai(태국점성술)는 Mahathaksa(마하탁사)·Taksajorn(탁사쫀), 교차검증된 Suriyayat(수리야얏) 10행성 위치, 검증된 numeric Lagna(숫자 라그나)와 whitelist-only 12개 하우스 경로를 서로 구분해 읽는다. 하우스 경로는 비예측형 맥락으로만 설명하며 Western(서양점성술) 수치점수에 합산하지 않는다.',
    '',
    '[원본 API 요청 JSON]',
    JSON.stringify(request, null, 2),
    '',
    '[외부 AI 해석 지시]',
    '- 아래 CALCULATED_DATA는 별빛의 운명 계산엔진이 이미 산출한 값이다. 행성 위치·하우스·점수·사주를 다시 계산하거나 임의 수정하지 말고 이 값만 근거로 해석한다.',
    '- 데이터에 없는 점성술/사주 요소, 사건 확률, 상대의 속마음은 만들지 않는다.',
    '- Thai(태국점성술)는 CALCULATED_DATA.thai의 실제 값만 사용한다. ai_safe_packet_product가 제품 계약을 만족할 때만 Lagna와 source house → lord → destination house 연결을 비예측형으로 설명한다. 학파 예외·최종 길흉·사건·정확한 미래 시기·확률·점수는 만들지 않으며 not_calculated 항목은 추정하지 않는다.',
    '- 전문용어는 한국어 뜻을 붙이고, 결론→계산 근거→현실에서 체감되는 방식→시기 순서로 설명한다.',
    '',
    '[CALCULATED_DATA · 원본 계산 JSON]',
    calculation ? JSON.stringify(calculation, null, 2) : '계산 결과 없음',
  ].join('\n')
}

export function integratedResultText(result: IntegratedApiResponse) {
  const lines = [
    '[별빛의 운명 · 통합운세 전체 결과]',
    `엔진: ${result.engine} / API: ${result.api_version}`,
    `기간: ${result.period.start} ~ ${result.period.end} (${result.period.day_count}일)`,
    '',
    '■ Western(서양점성술)',
  ]
  topicOrder.forEach((topic) => {
    const stat = result.western.overall[topic]
    if (stat) lines.push(`- ${topic}: ${stat.average.toFixed(1)} · ${stat.band} · 변동폭 ${stat.spread.toFixed(1)}`)
  })
  if (result.saju.ok && result.saju.pillars) {
    lines.push('', '■ 사주')
    lines.push(`- 원국: ${result.saju.pillars.year} / ${result.saju.pillars.month} / ${result.saju.pillars.day} / ${result.saju.pillars.hour}`)
    lines.push(`- 일간: ${result.saju.day_master ?? ''}`)
    if (result.saju.true_solar) lines.push(`- 진태양시: ${result.saju.true_solar.true_solar_time} (보정 ${result.saju.true_solar.total_correction_minutes.toFixed(1)}분)`)
    for (const row of result.saju.dayun ?? []) lines.push(`- 대운: ${row.start_year}~${row.end_year} ${row.ganzhi} (${row.start_age}~${row.end_age}세)`)
    for (const row of result.saju.annual ?? []) lines.push(`- ${row.year} 세운${row.segment_start&&row.segment_end_exclusive?` · ${row.segment_start} ~ ${row.segment_end_exclusive}`:''}${row.start_jie_ko?` · ${row.start_jie_ko}(${row.start_jie}) 기준`:''}: ${row.ganzhi} · ${row.stem_ten_god} · ${row.branch_links.join(', ') || '지지 연결 없음'}`)
    for (const row of result.saju.monthly ?? []) lines.push(`- ${row.calendar_month} 월운${row.segment_start&&row.segment_end_exclusive?` · ${row.segment_start} ~ ${row.segment_end_exclusive}`:''}${row.jie_name_ko?` · ${row.jie_name_ko}(${row.jie_name}) 시작`:''}: ${row.ganzhi} · ${row.stem_ten_god} · ${row.branch_links.join(', ') || '지지 연결 없음'}`)
    if (result.saju.not_calculated?.length) lines.push(`- 미계산 항목: ${result.saju.not_calculated.join(', ')}`)
  }
  lines.push('', '■ Thai(태국점성술)')
  lines.push(`- ${result.thai.thai_day} · ${result.thai.ruler}`)
  lines.push(`- 규칙: ${result.thai.rule}`)
  for (const seg of result.thai.taksajorn?.segments ?? []) lines.push(`- Taksajorn(탁사쫀) ${seg.start}~${seg.end}: 나이 진행 ${seg.age_in_progress} · 연간 Boriwan ${seg.annual_boriwan.label}${seg.landed_center?' (중앙 착지→Jupiter 적용)':''}`)
  if (result.thai.suriyayat?.available) {
    lines.push(`- Suriyayat 10행성: 검증됨 · 기준 ${result.thai.suriyayat.time_basis} · 최대 검산오차 ${result.thai.suriyayat.validation?.max_delta_arcmin ?? '—'}각분`)
    const natal = result.thai.suriyayat.natal?.positions ?? {}
    const natalText = Object.entries(natal).map(([key,row])=>`${key} ${row.display}`).join(' · ')
    if (natalText) lines.push(`- Suriyayat 출생위치: ${natalText}`)
    lines.push(`- Suriyayat Lagna: ${result.thai.suriyayat.lagna?.available?(result.thai.suriyayat.lagna.display||'검증된 숫자 위치 계산됨'):'제품 계약 미충족 · 해설 제외'}`)
    lines.push(`- 비예측형 하우스 경로: ${result.thai.suriyayat.ai_safe_packet_product?.eligible_for_gemini&&result.thai.suriyayat.ai_safe_packet_product?.route_count===12?'12개 검증됨':'해설 제외'}`)
  }
  lines.push(`- 예측 상태: ${result.thai.predictive_status}`)
  if (result.thai.not_calculated?.length) lines.push(`- 미계산: ${result.thai.not_calculated.join(', ')}`)
  lines.push('', '[원본 계산 JSON]', JSON.stringify(result, null, 2))
  return lines.join('\n')
}

const EXTERNAL_RELATIONSHIP_PROMPT_MAX_CHARS = 28000

function compactAspectForExternal(aspect: unknown) {
  if (!aspect || typeof aspect !== 'object') return null
  const row = aspect as Record<string, unknown>
  const orb = Number(row.orb)
  if (!Number.isFinite(orb)) return null
  return {
    a: String(row.a ?? ''), aspect: String(row.aspect ?? ''), b: String(row.b ?? ''),
    orb: Number(orb.toFixed(2)), tone: String(row.tone ?? 'mixed'), layer: row.layer ?? undefined,
    orb_grade:row.orb_grade ?? undefined, time_sensitivity:row.time_sensitivity ?? undefined,
    evidence_confidence:row.evidence_confidence ?? undefined, layer_priority:row.layer_priority ?? undefined,
    event_probability:row.event_probability ?? 'not_calculated',
  }
}

function compactStatForExternal(stat: unknown, bestLimit: number, cautionLimit: number) {
  if (!stat || typeof stat !== 'object') return null
  const row = stat as Record<string, unknown>
  const point = (value: unknown) => {
    if (!value || typeof value !== 'object') return null
    const p = value as Record<string, unknown>
    const score = Number(p.score)
    return { date: String(p.date ?? ''), score: Number.isFinite(score) ? Number(score.toFixed(1)) : 0 }
  }
  return {
    average: Number(Number(row.average ?? 0).toFixed(1)),
    band: String(row.band ?? ''),
    spread: Number(Number(row.spread ?? 0).toFixed(1)),
    best_days: (Array.isArray(row.best_days) ? row.best_days : []).slice(0,bestLimit).map(point).filter(Boolean),
    caution_days: (Array.isArray(row.caution_days) ? row.caution_days : []).slice(0,cautionLimit).map(point).filter(Boolean),
  }
}

function compactHouseRowsForExternal(value: unknown, limit: number) {
  return (Array.isArray(value) ? value : []).slice(0,limit).map((item) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    return { planet: String(row.planet ?? ''), whole_house: row.whole_house ?? null, placidus_house: row.placidus_house ?? row.house ?? null }
  })
}

function compactSajuForExternal(value: unknown, limit: number) {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const person = (p: unknown) => {
    if (!p || typeof p !== 'object') return null
    const x = p as Record<string, unknown>
    return { year:x.year ?? null, month:x.month ?? null, day:x.day ?? null, hour:x.hour ?? null, day_stem:x.day_stem ?? null, day_branch:x.day_branch ?? null, precision:x.precision ?? null, time_known:Boolean(x.time_known) }
  }
  if (row.available === false) return { available:false, error:row.error ?? null }
  return {
    available: row.available ?? true,
    policy: row.policy ?? null,
    user: person(row.user), counterpart: person(row.counterpart),
    day_master_relation: row.day_master_relation ?? null,
    spouse_palace: row.spouse_palace ?? null,
    cross_branch_links: (Array.isArray(row.cross_branch_links) ? row.cross_branch_links : []).slice(0,limit),
    limitations: (Array.isArray(row.limitations) ? row.limitations : []).slice(0,4),
  }
}

const RELATIONSHIP_CORE_POINTS = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto','True Node','ASC','MC']

function compactRelationshipChartForExternal(value: unknown, limit = 10) {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const positions = (row.positions && typeof row.positions === 'object' ? row.positions : {}) as Record<string, unknown>
  const keys = RELATIONSHIP_CORE_POINTS.filter((key)=>positions[key]).slice(0,limit)
  const compactPositions = Object.fromEntries(keys.map((key)=>{
    const source = (positions[key] && typeof positions[key] === 'object' ? positions[key] : {}) as Record<string, unknown>
    const lon = Number(source.lon ?? source.longitude ?? source.longitude_deg ?? 0)
    return [key,{ lon:Number.isFinite(lon)?Number(lon.toFixed(4)):0, sign:source.sign ?? source.sign_ko ?? null, house:source.house ?? null }]
  }))
  const angles = (row.angles && typeof row.angles === 'object' ? row.angles : null) as Record<string, unknown> | null
  return { positions:compactPositions, angles:angles?{ASC:angles.ASC??null,MC:angles.MC??null,IC:angles.IC??null,DSC:angles.DSC??null}:null }
}

function compactAdvancedStaticForExternal(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (row.available === false) return { available:false, reason:row.reason ?? null }
  return {
    available:row.available ?? true, reason:row.reason ?? null, method:row.method ?? null,
    chart:compactRelationshipChartForExternal(row.chart),
    user:compactRelationshipChartForExternal(row.user),
    counterpart:compactRelationshipChartForExternal(row.counterpart),
  }
}

function compactAdvancedMonthForExternal(value: unknown, limit: number) {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const ps = (row.progressed_synastry && typeof row.progressed_synastry === 'object' ? row.progressed_synastry : {}) as Record<string, unknown>
  const pc = (row.progressed_composite && typeof row.progressed_composite === 'object' ? row.progressed_composite : {}) as Record<string, unknown>
  const mt = (row.marks_tertiary && typeof row.marks_tertiary === 'object' ? row.marks_tertiary : {}) as Record<string, unknown>
  const mtUser = (mt.user && typeof mt.user === 'object' ? mt.user : {}) as Record<string, unknown>
  const mtCounterpart = (mt.counterpart && typeof mt.counterpart === 'object' ? mt.counterpart : {}) as Record<string, unknown>
  const list = (x: unknown) => (Array.isArray(x) ? x : []).slice(0,limit).map(compactAspectForExternal).filter(Boolean)
  const summary = (row.signal_summary && typeof row.signal_summary === 'object' ? row.signal_summary : {}) as Record<string, unknown>
  return {
    calendar_month:row.calendar_month ?? null, representative_date:row.representative_date ?? null,
    signal_summary:{
      exact_contacts:Number(summary.exact_contacts ?? 0), supportive_contacts:Number(summary.supportive_contacts ?? 0), challenging_contacts:Number(summary.challenging_contacts ?? 0), tightest:list(summary.tightest),
    },
    progressed_synastry:ps.available === true ? {
      available:true, user_progressed_to_partner_natal:list(ps.user_progressed_to_partner_natal), partner_progressed_to_user_natal:list(ps.partner_progressed_to_user_natal), progressed_to_progressed:list(ps.progressed_to_progressed),
    } : { available:false, reason:ps.reason ?? null },
    progressed_composite:pc.available === true ? { available:true, method:pc.method ?? null, to_natal_composite_aspects:list(pc.to_natal_composite_aspects) } : { available:false, reason:pc.reason ?? null },
    marks_tertiary:mt.available === true ? {
      available:true,
      user:{completed_lunar_months:mtUser.completed_lunar_months ?? null,to_base_marks_aspects:list(mtUser.to_base_marks_aspects)},
      counterpart:{completed_lunar_months:mtCounterpart.completed_lunar_months ?? null,to_base_marks_aspects:list(mtCounterpart.to_base_marks_aspects)},
      directional_cross_aspects:list(mt.directional_cross_aspects), angle_policy:mt.angle_policy ?? null,
    } : { available:false, reason:mt.reason ?? null },
  }
}

function compactRelationshipExternalPacket(calculation: RelationshipApiResponse | null | undefined, reunionContext: ReunionTimingContext | null | undefined, level: number) {
  if (!calculation) return null
  const rawResult = calculation.result as RelationshipApiResponse['result'] & Record<string, unknown>
  const natal = rawResult.natal_synastry
  const caps = level === 0
    ? { aspects:24, house:8, focus:3, months:12, tight:2, transitDays:8, transitHits:2, transitMonths:8, directionalMonths:8, statBest:4, statCaution:3, saju:8 }
    : level === 1
      ? { aspects:16, house:6, focus:2, months:8, tight:2, transitDays:6, transitHits:2, transitMonths:6, directionalMonths:6, statBest:3, statCaution:2, saju:6 }
      : { aspects:12, house:4, focus:1, months:6, tight:1, transitDays:4, transitHits:1, transitMonths:4, directionalMonths:4, statBest:2, statCaution:1, saju:4 }
  const aspects = [...(natal?.aspects ?? [])].sort((a,b)=>a.orb-b.orb).slice(0,caps.aspects).map(compactAspectForExternal).filter(Boolean)
  const house = rawResult.house_overlays
  const focusSource = ((rawResult.relationship_focus as Record<string, unknown> | undefined)?.groups ?? {}) as Record<string, unknown>
  const focus = Object.fromEntries(Object.entries(focusSource).map(([key,value]) => [key, (Array.isArray(value) ? value : []).slice().sort((a,b)=>Number((a as Record<string, unknown>)?.orb ?? 99)-Number((b as Record<string, unknown>)?.orb ?? 99)).slice(0,caps.focus).map(compactAspectForExternal).filter(Boolean)]))
  const months = (rawResult.months ?? []).slice(0,caps.months).map((month) => compactAdvancedMonthForExternal(month,caps.tight))
  const transits = rawResult.reunion_transits?.available ? {
    available: true,
    period: rawResult.reunion_transits.period,
    policy: rawResult.reunion_transits.policy,
    top_days: rawResult.reunion_transits.top_days.slice(0,caps.transitDays).map((day)=>({
      date:day.date,
      score:Number(day.score.toFixed(1)), user_score:Number(day.user_score.toFixed(1)), counterpart_score:Number(day.counterpart_score.toFixed(1)),
      shared_activation:day.shared_activation,
      hits:day.hits.slice(0,caps.transitHits).map((hit)=>({ person:hit.person, transit:hit.transit, aspect:hit.aspect, target:hit.target, orb:Number(hit.orb.toFixed(2)), tone:hit.tone, score:Number(hit.score.toFixed(1)) })),
    })),
    top_months: rawResult.reunion_transits.top_months.slice(0,caps.transitMonths).map((month)=>({ calendar_month:month.calendar_month, score:Number(month.score.toFixed(1)), top_dates:month.top_dates.slice(0,3) })),
  } : null
  const directionalMonths = (reunionContext?.months ?? []).map((month)=>({
    calendar_month:month.calendar_month, start:month.start, end:month.end,
    incoming:compactStatForExternal(month.incoming,1,1), outgoing:compactStatForExternal(month.outgoing,1,1), reconnection:compactStatForExternal(month.reconnection,1,1),
    rank:Number(((month.reconnection?.average ?? 0)*.5 + (month.incoming?.average ?? 0)*.35 + (month.outgoing?.average ?? 0)*.15).toFixed(2)),
  })).sort((a,b)=>b.rank-a.rank).slice(0,caps.directionalMonths)
  return {
    engine: calculation.engine,
    api_version: calculation.api_version,
    relationship_status: calculation.relationship_status,
    period: calculation.period,
    timing_contract: {
      timing_timezone_policy:rawResult.timing_timezone_policy ?? null,
      secondary_key:rawResult.secondary_key ?? null,
      tertiary_key:rawResult.tertiary_key ?? null,
      orb_policy:rawResult.orb_policy ?? null,
      interpretation_policy:rawResult.interpretation_policy ?? null,
    },
    precision: { partner_time_available:Boolean(natal?.partner_time_available), partner_time_exact:Boolean(natal?.partner_time_exact), birth_time_reliability:rawResult.birth_time_reliability ?? null, note:natal?.note ?? null },
    natal_synastry: { aspects },
    relationship_focus: focus,
    house_overlays: house ? {
      available:house.available,
      precision_note:house.precision_note ?? null,
      user_in_counterpart:compactHouseRowsForExternal(house.user_in_counterpart?.relationship_houses,caps.house),
      counterpart_in_user:compactHouseRowsForExternal(house.counterpart_in_user?.relationship_houses,caps.house),
    } : null,
    saju_relationship: compactSajuForExternal(rawResult.saju_relationship,caps.saju),
    advanced: { composite:compactAdvancedStaticForExternal(rawResult.composite), davison:compactAdvancedStaticForExternal(rawResult.davison), marks:compactAdvancedStaticForExternal(rawResult.marks), months },
    reunion_transits: transits,
    reunion_dimensions: rawResult.reunion_dimensions ?? null,
    reunion_secondary_support: rawResult.reunion_secondary_support ?? null,
    reunion_directional_context: reunionContext ? {
      period:reunionContext.period,
      incoming:compactStatForExternal(reunionContext.incoming,caps.statBest,caps.statCaution),
      outgoing:compactStatForExternal(reunionContext.outgoing,caps.statBest,caps.statCaution),
      reconnection:compactStatForExternal(reunionContext.reconnection,caps.statBest,caps.statCaution),
      strongest_months:directionalMonths,
    } : null,
    limitations:(rawResult.limitations ?? []).slice(0,6),
  }
}

export function relationshipPromptText(kind: 'compatibility' | 'reunion' | 'marriage', request: Record<string, unknown>, calculation?: RelationshipApiResponse | null, reunionContext?: ReunionTimingContext | null) {
  const user = (request.user ?? {}) as Record<string, unknown>
  const cp = (request.counterpart ?? {}) as Record<string, unknown>
  const label = kind === 'marriage' ? '결혼운' : kind === 'reunion' ? '재회운' : '궁합운'
  const modeRule = kind === 'marriage'
    ? '- 결혼 여부를 예언하지 않고 장기 결속·협력·긴장 활성도를 본다.'
    : kind === 'reunion'
      ? '- 재회는 ① 연락/재접촉 활성화 ② 감정 재활성화 ③ 실제 관계 재구축 가능성을 서로 다른 층으로 분리한다. 수신(상대→나)·발신(나→상대)·과거인연 재접점도 섞지 않는다.'
      : '- 궁합의 정적 구조와 선택 기간의 시기 활성도를 구분한다.'
  const intro = [
    `[별빛의 운명 · ${label} 외부 AI용 초압축 해석 요청]`,
    `관계 상태: ${String(request.relationship_status ?? '')} / 분석 모드: ${String(request.analysis_mode ?? kind)} / 기간: ${String(request.start_date ?? '')} ~ ${String(request.end_date ?? '')}`,
    `본인: ${String(user.name ?? '나')} · ${String(user.birth_date ?? '')} ${String(user.birth_time ?? '')}`,
    `상대: ${String(cp.name ?? '상대')} · ${String(cp.birth_date ?? '')} ${cp.time_known ? String(cp.birth_time ?? '') : '출생시간 모름'}`,
    '※ 좌표·원본 API 요청은 이미 계산에 반영됐으므로 외부 AI 입력에서는 중복 제거했다. 아래 계산값을 다시 천문/사주 계산하지 마라.',
    '',
    '[해석 규칙]',
    '- 아래 COMPACT_CALCULATED_DATA만 단일 근거로 사용한다. 데이터에 없는 요소·사건 확률·상대 속마음은 만들지 않는다.',
    '- 재회운은 reunion_dimensions의 연락·재접촉 / 감정·관계 재활성 / 관계 재구축 지원층을 분리하고, 각 축의 incoming/outgoing/reconnection도 합치지 않는다. reunion_secondary_support는 daily transit 점수와 합산하지 않는다.',
    '- 좁은 오브의 실제 접점과 서로 독립된 레이어에서 반복되는 근거를 우선한다. 접점 수·점수는 연락/재회/결혼 확률이 아니다.',
    '- timing_contract의 fixed UTC offset·local noon 정책을 그대로 유지하고, advanced.composite 및 월별 progressed_synastry·progressed_composite·marks_tertiary를 서로 다른 층으로 읽는다.',
    '- 생시 미상으로 빠진 Moon(달)·각도점·하우스·진행 레이어는 추정하지 않는다.',
    '- 사주는 실제 포함된 일간 관계·십성·배우자궁·교차 지지관계만 사용하고 없는 천간합·신강/신약·용신·배우자성은 만들지 않는다.',
    modeRule,
    kind === 'reunion' ? '- 수신(상대→나)·발신(나→상대)·재접점을 따로 읽고, directional 날짜와 reunion_transits의 실제 날짜가 겹치는지 교차검증한다.' : '',
    '- 답변 순서: 한줄 결론 → 가장 강한 계산근거 5~8개 → 관계에서 체감되는 패턴 → 강한 시기/약한 시기 → 내가 취할 현실적 행동 → 한계.',
  ].filter(Boolean)
  let prompt = ''
  for (let level=0; level<=2; level++) {
    const packet = compactRelationshipExternalPacket(calculation,reunionContext,level)
    const candidate = [...intro, '', `[COMPACT_CALCULATED_DATA · 압축단계 ${level}]`, packet ? JSON.stringify(packet) : '계산 결과 없음'].join('\n')
    prompt = candidate
    if (candidate.length <= EXTERNAL_RELATIONSHIP_PROMPT_MAX_CHARS) break
  }
  return prompt.length <= EXTERNAL_RELATIONSHIP_PROMPT_MAX_CHARS
    ? prompt
    : `${prompt.slice(0,EXTERNAL_RELATIONSHIP_PROMPT_MAX_CHARS - 180)}\n[길이 안전 절단] 뒤쪽 저우선순위 근거는 외부 AI 입력 한도를 위해 생략됨. 앞의 계산근거만 사용해 해석해.`
}

export function relationshipResultText(kind: 'compatibility' | 'reunion' | 'marriage', response: RelationshipApiResponse, reunionContext?: ReunionTimingContext | null) {
  const result = response.result
  const aspects = result.natal_synastry?.aspects ?? []
  const label = kind === 'marriage' ? '결혼운' : kind === 'reunion' ? '재회운' : '궁합운'
  const lines = [
    `[별빛의 운명 · ${label} 전체 결과]`,
    `엔진: ${response.engine} / API: ${response.api_version}`,
    `관계 상태: ${response.relationship_status}`,
    `기간: ${response.period.start} ~ ${response.period.end}`,
    '',
    '■ 기본 관계 구조',
    `- 시너스트리 접점: ${aspects.length}`,
    `- 다빈슨: ${result.davison?.available ? 'ON' : `OFF · ${result.davison?.reason ?? ''}`}`,
    `- 마크스: ${result.marks?.available ? 'ON' : `OFF · ${result.marks?.reason ?? ''}`}`,
  ]
  aspects.forEach((aspect) => lines.push(`- ${aspectText(aspect)} · orb(오브) ${aspect.orb.toFixed(2)}° · ${aspect.tone}`))
  if (kind === 'reunion' && reunionContext) {
    lines.push('', '■ 재회 방향별 활성도')
    const directional: Array<[string, FortuneStat | null]> = [
      ['수신 · 상대→나', reunionContext.incoming],
      ['발신 · 나→상대', reunionContext.outgoing],
      ['과거인연 재접점', reunionContext.reconnection],
    ]
    directional.forEach(([name, stat]) => {
      if (!stat) return
      lines.push(`- ${name}: ${stat.average.toFixed(1)} · ${stat.band}`)
      if (stat.best_days?.length) lines.push(`  강한 날짜: ${stat.best_days.slice(0,5).map((x)=>`${x.date} ${x.score.toFixed(1)}`).join(' · ')}`)
      if (stat.caution_days?.length) lines.push(`  약한 날짜: ${stat.caution_days.slice(0,3).map((x)=>`${x.date} ${x.score.toFixed(1)}`).join(' · ')}`)
    })
  }
  if (kind === 'reunion' && result.reunion_transits?.available) {
    lines.push('', '■ 실제 transit(트랜짓·현재 행성 이동) 재접점')
    result.reunion_transits.top_days.slice(0,10).forEach((day) => {
      const hits = day.hits.slice(0,3).map((hit)=>`${hit.transit}→${hit.person === 'counterpart' ? '상대' : '나'} ${hit.target} ${hit.aspect} orb ${hit.orb.toFixed(2)}°`).join(' · ')
      lines.push(`- ${day.date}: ${day.score.toFixed(1)} · ${hits}`)
    })
  }
  for (const month of result.months ?? []) {
    lines.push('', `■ ${month.calendar_month} / 대표일 ${month.representative_date}`)
    lines.push(`- 정밀 ${month.signal_summary.exact_contacts} · 조화 ${month.signal_summary.supportive_contacts} · 긴장 ${month.signal_summary.challenging_contacts}`)
    month.signal_summary.tightest.forEach((aspect) => lines.push(`- ${aspectText(aspect)} · orb(오브) ${aspect.orb.toFixed(2)}°`))
  }
  if (result.limitations?.length) lines.push('', `제한사항: ${result.limitations.join(' ')}`)
  const raw = kind === 'reunion' ? { relationship: response, reunion_directional_context: reunionContext ?? null } : response
  lines.push('', '[원본 계산 JSON]', JSON.stringify(raw, null, 2))
  return lines.join('\n')
}

export function precisionPromptText(request: Record<string, unknown>, calculation?: IntegratedApiResponse | null) {
  return integratedPromptText(request, calculation)
    .replace('[별빛의 운명 · 통합운세 분석 요청]', '[별빛의 운명 · 정밀분석 요청]')
    .concat('\n\n[정밀분석 표시 원칙]\n- 요약 점수를 새로 만들지 않고 동일 실계산의 원자료를 더 자세히 펼쳐본다.\n- 엔진이 계산하지 않은 항목은 추정하지 않는다.')
}

export function precisionResultText(result: IntegratedApiResponse) {
  return integratedResultText(result)
    .replace('[별빛의 운명 · 통합운세 전체 결과]', '[별빛의 운명 · 정밀분석 전체 결과]')
}
