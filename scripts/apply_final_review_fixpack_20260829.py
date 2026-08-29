from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing anchor: {label}')
    return text.replace(old, new, 1)


app = Path('web/src/AppNext.tsx')
s = app.read_text(encoding='utf-8')

# 1) Make relationship/reunion copy portable: reunion gets its own label/rules and directional context.
start = s.index("function relationshipPromptText(")
end = s.index("\nfunction precisionPromptText", start)
new_copy_block = r'''function relationshipPromptText(kind: 'compatibility' | 'reunion' | 'marriage', request: Record<string, unknown>, calculation?: RelationshipApiResponse | null, reunionContext?: ReunionTimingContext | null) {
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
    `상대 좌표: ${cp.time_known ? `${String(cp.latitude ?? '')}, ${String(cp.longitude ?? '')}` : '정밀 좌표 레이어 제외'}`,
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

function relationshipResultText(kind: 'compatibility' | 'reunion' | 'marriage', response: RelationshipApiResponse, reunionContext?: ReunionTimingContext | null) {
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
'''
s = s[:start] + new_copy_block + s[end:]

# 2) Annual AI job completion must compare against the calendar-year selection, not the coarse global period.
s = replace_once(
    s,
    "          const currentEnd = periodEnd(queryDate, period)\n          if (!periodStart || (queryDate === periodStart && currentEnd === periodEndValue)) {",
    "          const currentStart = integratedCalendarYear ? `${integratedCalendarYear}-01-01` : queryDate\n          const currentEnd = integratedCalendarYear ? `${integratedCalendarYear}-12-31` : periodEnd(queryDate, period)\n          if (!periodStart || (currentStart === periodStart && currentEnd === periodEndValue)) {",
    'calendar-year AI job match',
)

# 3) Reuse a matching integrated result for reunion timing even when a calendar year is selected.
s = replace_once(
    s,
    "      if (integratedResult && integratedResult.period.start === queryDate && integratedResult.period.end === end) {",
    "      if (integratedResult && integratedResult.period.start === relationshipStartDate && integratedResult.period.end === end) {",
    'reunion cache start',
)

# 4) Reunion archives retain their mode and directional calculation context.
s = replace_once(
    s,
    "    const kind = selectedTool === 'marriage' ? 'marriage' : 'compatibility'\n    const cp = (relationshipRequestSnapshot.counterpart ?? {}) as Record<string, unknown>\n    try {\n    const saved = await saveArchive({\n      kind,\n      periodKey: relationshipPeriodKey,\n      title: `${kind === 'marriage' ? '결혼운' : '궁합운'} · ${String(cp.name ?? '상대')} · ${relationshipResult.period.start}`,\n      periodStart: relationshipResult.period.start,\n      periodEnd: relationshipResult.period.end,\n      engine: relationshipResult.engine,\n      request: relationshipRequestSnapshot,",
    "    const kind = selectedTool === 'marriage' ? 'marriage' : 'compatibility'\n    const isReunion = selectedTool === 'compatibility' && relationshipPurpose === 'reunion'\n    const cp = (relationshipRequestSnapshot.counterpart ?? {}) as Record<string, unknown>\n    const archiveRequest = isReunion ? { ...relationshipRequestSnapshot, reunion_context: reunionTiming } : relationshipRequestSnapshot\n    const archiveLabel = kind === 'marriage' ? '결혼운' : isReunion ? '재회운' : '궁합운'\n    try {\n    const saved = await saveArchive({\n      kind,\n      periodKey: relationshipPeriodKey,\n      title: `${archiveLabel} · ${String(cp.name ?? '상대')} · ${relationshipResult.period.start}`,\n      periodStart: relationshipResult.period.start,\n      periodEnd: relationshipResult.period.end,\n      engine: relationshipResult.engine,\n      request: archiveRequest,",
    'reunion archive save',
)

s = replace_once(
    s,
    "      setRelationshipMode((request.relationship_status as RelationshipStatus) || 'dating')\n      if (request.analysis_mode === 'marriage_married') setMarriageMode('married')",
    "      setRelationshipMode((request.relationship_status as RelationshipStatus) || 'dating')\n      const restoredAnalysisMode = String(request.analysis_mode ?? 'compatibility')\n      if (restoredAnalysisMode === 'reunion') {\n        setRelationshipPurpose('reunion')\n        const archivedContext = request.reunion_context\n        setReunionTiming(archivedContext && typeof archivedContext === 'object' ? archivedContext as ReunionTimingContext : null)\n      } else {\n        setRelationshipPurpose('compatibility')\n        setReunionTiming(null)\n      }\n      if (request.analysis_mode === 'marriage_married') setMarriageMode('married')",
    'reunion archive restore',
)

s = replace_once(
    s,
    "    } else {\n      await handleCopy('저장 결과 전체복사', relationshipResultText(item.kind, item.result as unknown as RelationshipApiResponse))\n    }",
    "    } else {\n      const analysisMode = String(item.request.analysis_mode ?? '')\n      const copyKind: 'compatibility' | 'reunion' | 'marriage' = item.kind === 'marriage' ? 'marriage' : analysisMode === 'reunion' ? 'reunion' : 'compatibility'\n      const archivedContext = item.request.reunion_context\n      await handleCopy('저장 결과 전체복사', relationshipResultText(copyKind, item.result as unknown as RelationshipApiResponse, archivedContext && typeof archivedContext === 'object' ? archivedContext as ReunionTimingContext : null))\n    }",
    'archive relationship copy',
)

# 5) Remove the stale global-period line from relationship UI and use the exact relationship range.
s = replace_once(
    s,
    "            <div className=\"calculation-range\"><CalendarDays size={17}/><span>분석기간 {queryDate} ~ {periodEnd(queryDate,period)} · {periodRangeLabel(period)}</span></div>",
    "            <div className=\"calculation-range\"><CalendarDays size={17}/><span>관계 분석기간 {relationshipStartDate} ~ {relationshipEndDate} · {relationshipDayCount}일</span></div>",
    'relationship stale range',
)

s = replace_once(
    s,
    "<span>{relationshipResult.period.start} ~ {relationshipResult.period.end} · {clampedRelationshipDays}일</span>",
    "<span>{relationshipResult.period.start} ~ {relationshipResult.period.end} · {relationshipDayCount}일</span>",
    'relationship result day count',
)

# 6) Live copy buttons use the actual mode and include reunion directional context.
s = replace_once(
    s,
    "relationshipPromptText(selectedTool==='marriage'?'marriage':'compatibility', relationshipRequestSnapshot, relationshipResult)",
    "relationshipPromptText(selectedTool==='marriage'?'marriage':relationshipPurpose, relationshipRequestSnapshot, relationshipResult, reunionTiming)",
    'live prompt copy mode',
)
s = replace_once(
    s,
    "relationshipResultText(selectedTool==='marriage'?'marriage':'compatibility', relationshipResult)",
    "relationshipResultText(selectedTool==='marriage'?'marriage':relationshipPurpose, relationshipResult, reunionTiming)",
    'live result copy mode',
)

app.write_text(s, encoding='utf-8')

# 7) Map: show all planet selectors in 10-planet mode, display DSC terminology, and make OSM attribution compliant/clickable.
map_file = Path('web/src/AstrocartographyWorldMap.tsx')
m = map_file.read_text(encoding='utf-8')
m = replace_once(
    m,
    "  const activePlanets = selectedPlanet ? [selectedPlanet] : expandedPlanets ? Object.keys(PLANET_LABELS) : defaultPlanets\n  const lines = useMemo",
    "  const activePlanets = selectedPlanet ? [selectedPlanet] : expandedPlanets ? Object.keys(PLANET_LABELS) : defaultPlanets\n  const selectablePlanets = expandedPlanets ? Object.keys(PLANET_LABELS) : defaultPlanets\n  const angleLabel = (key: 'ALL'|'ASC'|'DC'|'MC'|'IC') => key === 'ALL' ? '전체' : key === 'DC' ? 'DSC' : key\n  const lines = useMemo",
    'map selectors',
)
m = replace_once(m, "<span>© OpenStreetMap contributors</span>", "<a href=\"https://www.openstreetmap.org/copyright\" target=\"_blank\" rel=\"noreferrer\">© OpenStreetMap contributors</a>", 'OSM attribution')
m = replace_once(m, "{key==='ALL'?'전체':key}</button>)}</div>", "{angleLabel(key)}</button>)}</div>", 'angle button label')
m = replace_once(m, "{defaultPlanets.map((planet)=><button", "{selectablePlanets.map((planet)=><button", 'all planet selectors')
m = replace_once(m, "{['ASC','DC','MC','IC'].map((key)=><span key={key}><b>{key}</b> {ANGLE_HELP[key]}</span>)}", "{['ASC','DC','MC','IC'].map((key)=><span key={key}><b>{key==='DC'?'DSC':key}</b> {ANGLE_HELP[key]}</span>)}", 'angle guide label')
map_file.write_text(m, encoding='utf-8')

css = Path('web/src/astrocartography-map.css')
c = css.read_text(encoding='utf-8')
c = replace_once(c, ".astro-map-caption span:first-child{display:flex;align-items:center;gap:4px;padding:5px 7px;border-radius:999px;background:rgba(255,255,255,.78);backdrop-filter:blur(8px)}", ".astro-map-caption span:first-child{display:flex;align-items:center;gap:4px;padding:5px 7px;border-radius:999px;background:rgba(255,255,255,.78);backdrop-filter:blur(8px)}.astro-map-caption a{color:inherit;text-decoration:none;border-bottom:1px solid rgba(40,33,55,.28);pointer-events:auto}", 'map attribution css')
c = c.replace(".astro-map-caption span:last-child{display:none}", ".astro-map-caption a{display:none}")
css.write_text(c, encoding='utf-8')

# 8) API metadata should expose the location engine, and the app version should reflect the final review pack.
api = Path('api/main.py')
a = api.read_text(encoding='utf-8')
a = replace_once(a, 'APP_VERSION = "api-fortune-v4.7-relationship-depth"', 'APP_VERSION = "api-fortune-v4.8-final-review"', 'api version')
a = replace_once(a, '        "integrated_engine": INTEGRATED_ENGINE_VERSION,\n        "calculation_engine_connected": True,', '        "integrated_engine": INTEGRATED_ENGINE_VERSION,\n        "location_engine": LOCATION_ENGINE_VERSION,\n        "calculation_engine_connected": True,', 'location engine meta')
api.write_text(a, encoding='utf-8')

print('FINAL_REVIEW_FIXPACK_APPLIED')
