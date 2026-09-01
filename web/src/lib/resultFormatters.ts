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

export function relationshipPromptText(kind: 'compatibility' | 'reunion' | 'marriage', request: Record<string, unknown>, calculation?: RelationshipApiResponse | null, reunionContext?: ReunionTimingContext | null) {
  const user = (request.user ?? {}) as Record<string, unknown>
  const cp = (request.counterpart ?? {}) as Record<string, unknown>
  const label = kind === 'marriage' ? '결혼운' : kind === 'reunion' ? '재회운' : '궁합운'
  const calculatedData = kind === 'reunion'
    ? { relationship: calculation ?? null, reunion_directional_context: reunionContext ?? null }
    : calculation ?? null
  const modeRule = kind === 'marriage'
    ? '- 결혼 여부를 예언하지 않고 장기 결속·협력·긴장 활성도를 본다.'
    : kind === 'reunion'
      ? '- 재회는 ① 연락/재접촉 활성화 ② 감정 재활성화 ③ 실제 관계 재구축 가능성을 서로 다른 층으로 분리한다. 수신(상대→나)·발신(나→상대)·과거인연 재접점도 섞지 않는다.'
      : '- 궁합의 정적 구조와 선택 기간의 시기 활성도를 구분한다.'
  return [
    `[별빛의 운명 · ${label} 분석 요청]`,
    `관계 상태: ${String(request.relationship_status ?? '')}`,
    `분석 모드: ${String(request.analysis_mode ?? kind)}`,
    `분석 기간: ${String(request.start_date ?? '')} ~ ${String(request.end_date ?? '')}`,
    '',
    `본인: ${String(user.name ?? '나')} / ${String(user.birth_date ?? '')} ${String(user.birth_time ?? '')}`,
    `본인 좌표: ${String(user.latitude ?? '')}, ${String(user.longitude ?? '')} / UTC ${String(user.utc_offset_hours ?? '')}`,
    `상대: ${String(cp.name ?? '상대')} / ${String(cp.birth_date ?? '')} ${cp.time_known ? String(cp.birth_time ?? '') : '출생시간 모름'}`,
    `상대 출생지역 좌표: ${cp.latitude != null && cp.longitude != null ? `${String(cp.latitude)}, ${String(cp.longitude)} / UTC ${String(cp.utc_offset_hours ?? '')}` : '미입력'}${cp.time_known ? '' : ' · 생시 모름: 각도·하우스 등 시간민감 레이어에서는 사용하지 않음'}`,
    '',
    '해석 원칙:',
    '- 정적 synastry(시너스트리·궁합차트)와 기간별 transit(트랜짓·현재 행성 이동)/진행 접점을 분리한다.',
    '- 접점 수·점수·오브를 연락·재회·결혼의 통계 확률처럼 말하지 않는다.',
    '- 상대의 사적인 속마음을 계산값만으로 단정하지 않는다.',
    modeRule,
    '',
    '[원본 API 요청 JSON]',
    JSON.stringify(request, null, 2),
    '',
    '[외부 AI 해석 지시]',
    '- 아래 CALCULATED_DATA는 별빛의 운명 계산엔진이 이미 산출한 관계 계산값이다. 다른 천문력/사주 계산으로 덮어쓰지 말고 이 데이터를 해석의 단일 근거로 사용한다.',
    '- 오브가 좁은 실제 접점을 우선하고, 접점 수나 점수를 재회·결혼·연락 확률로 바꾸지 않는다.',
    '- 생시 미상으로 빠진 Moon(달)·ASC(상승점)·DSC(하강점)·MC(중천점)·IC(천저점)·하우스·진행 레이어는 추정하지 않는다.',
    '- 사주는 CALCULATED_DATA에 실제 포함된 일간 관계·십성·배우자궁·교차 지지관계만 사용하고, 없는 천간합·신강/신약·용신·배우자성 등을 만들지 않는다.',
    kind === 'reunion' ? '- reunion_directional_context가 있으면 수신·발신·재접점을 각각 읽고, relationship.reunion_transits의 실제 트랜짓 날짜와 교차 검증한다. 한쪽 데이터가 없으면 없다고 명시한다.' : '',
    '- 결론→가장 강한 계산 근거→관계에서 실제 체감되는 패턴→강한 시기/약한 시기→한계 순서로 구체적으로 설명한다.',
    '',
    '[CALCULATED_DATA · 원본 관계 계산 JSON]',
    JSON.stringify(calculatedData, null, 2),
  ].filter(Boolean).join('\n')
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
