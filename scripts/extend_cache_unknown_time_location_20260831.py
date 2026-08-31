from pathlib import Path

APP = Path('web/src/AppNext.tsx')
API = Path('api/main.py')
app = APP.read_text(encoding='utf-8')
api = API.read_text(encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'[{label}] expected 1 match, got {count}')
    return text.replace(old, new, 1)

# -----------------------------------------------------------------------------
# Cache retention policy: keep auto-saved archive records indefinitely, but
# extend the fast local calculation/AI reuse window substantially.
# -----------------------------------------------------------------------------
period_marker = "const periods = [\n"
cache_policy = """const PERIOD_CACHE_TTL_DAYS: Record<PeriodKey, number> = {\n  today: 180,\n  week: 370,\n  month: 730,\n  year: 1825,\n}\nconst RELATIONSHIP_AI_CACHE_TTL_DAYS = 1825\n\nfunction fortuneCacheTtlDays(periodKey: PeriodKey, tool: ToolKey | null) {\n  if (tool === 'integrated') return PERIOD_CACHE_TTL_DAYS.year\n  return PERIOD_CACHE_TTL_DAYS[periodKey]\n}\n\n"""
if 'PERIOD_CACHE_TTL_DAYS' not in app:
    if period_marker not in app:
        raise SystemExit('period marker missing')
    app = app.replace(period_marker, cache_policy + period_marker, 1)

app = replace_once(
    app,
    "  const pollAiInterpretationJob = async (jobId: string, periodStart?: string, periodEndValue?: string, cacheId?: string, ttlDays = 90, requestForArchive?: Record<string, unknown>) => {",
    "  const pollAiInterpretationJob = async (jobId: string, periodStart?: string, periodEndValue?: string, cacheId?: string, ttlDays = PERIOD_CACHE_TTL_DAYS.today, requestForArchive?: Record<string, unknown>) => {",
    'AI poll default TTL',
)
app = replace_once(
    app,
    "      if (saved.jobId) void pollAiInterpretationJob(saved.jobId, saved.periodStart, saved.periodEnd, saved.cacheId, saved.ttlDays ?? 90, saved.request)",
    "      if (saved.jobId) void pollAiInterpretationJob(saved.jobId, saved.periodStart, saved.periodEnd, saved.cacheId, saved.ttlDays ?? PERIOD_CACHE_TTL_DAYS.today, saved.request)",
    'AI resume default TTL',
)
app = replace_once(
    app,
    "    const ttlDays = selectedTool === 'integrated' || period === 'year' ? 370 : period === 'today' ? 90 : 30",
    "    const ttlDays = fortuneCacheTtlDays(period, selectedTool)",
    'AI cache TTL policy',
)
app = replace_once(
    app,
    "      const calcTtlDays = selectedTool === 'integrated' || period === 'year' ? 370 : period === 'today' ? 90 : 30",
    "      const calcTtlDays = fortuneCacheTtlDays(period, selectedTool)",
    'calculation cache TTL policy',
)
app = replace_once(
    app,
    "      await writeReadingCache(relationshipCacheId, 'relationship-ai', annotated, 370)",
    "      await writeReadingCache(relationshipCacheId, 'relationship-ai', annotated, RELATIONSHIP_AI_CACHE_TTL_DAYS)",
    'relationship AI TTL',
)

# -----------------------------------------------------------------------------
# Unknown partner birth time must not disable birthplace entry. Birthplace is
# preserved as known metadata; only time-sensitive layers are disabled.
# -----------------------------------------------------------------------------
app = replace_once(
    app,
    "    `상대 좌표: ${cp.time_known ? `${String(cp.latitude ?? '')}, ${String(cp.longitude ?? '')}` : '정밀 좌표 레이어 제외'}`",
    "    `상대 출생지역 좌표: ${cp.latitude != null && cp.longitude != null ? `${String(cp.latitude)}, ${String(cp.longitude)} / UTC ${String(cp.utc_offset_hours ?? '')}` : '미입력'}${cp.time_known ? '' : ' · 생시 모름: 각도·하우스 등 시간민감 레이어에서는 사용하지 않음'}`",
    'relationship copy birthplace text',
)

app = replace_once(
    app,
    "    const counterpartLatitude = counterpart.timeKnown ? parseOptionalNumber(counterpart.latitude) : null\n    const counterpartLongitude = counterpart.timeKnown ? parseOptionalNumber(counterpart.longitude) : null\n    if (counterpart.timeKnown && (counterpartLatitude === null || counterpartLongitude === null)) { setRelationshipError('상대 출생시간을 안다면 출생지역도 선택해줘. 모르면 “출생시간 모름”을 체크해줘.'); return }",
    "    const counterpartLatitude = parseOptionalNumber(counterpart.latitude)\n    const counterpartLongitude = parseOptionalNumber(counterpart.longitude)\n    if (counterpart.timeKnown && (counterpartLatitude === null || counterpartLongitude === null)) { setRelationshipError('상대 출생시간을 안다면 출생지역도 선택해줘. 모르면 “출생시간 모름”을 체크해줘.'); return }",
    'unknown-time coordinate parsing',
)

app = replace_once(
    app,
    "        latitude: counterpartLatitude,\n        longitude: counterpartLongitude, utc_offset_hours: Number(counterpart.utcOffset || 9),",
    "        latitude: counterpartLatitude,\n        longitude: counterpartLongitude, utc_offset_hours: Number(counterpart.utcOffset || 9),",
    'counterpart payload coords preserved',
)

app = replace_once(
    app,
    "        latitude: known && cp.latitude != null ? String(cp.latitude) : '',\n        longitude: known && cp.longitude != null ? String(cp.longitude) : '',",
    "        latitude: cp.latitude != null ? String(cp.latitude) : '',\n        longitude: cp.longitude != null ? String(cp.longitude) : '',",
    'archive restore unknown-time coords',
)

old_ui = """              <label className=\"check-field field-wide\"><input type=\"checkbox\" checked={!counterpart.timeKnown} onChange={(e)=>setCounterpart({...counterpart,timeKnown:!e.target.checked,birthTime:e.target.checked?'':counterpart.birthTime})}/><span>상대 출생시간 모름 — 달·각도·다빈슨/마크스 일부 정밀 레이어는 자동 제외</span></label>\n              <KoreaBirthplaceSelector disabled={!counterpart.timeKnown} value={counterpart} onChange={(location)=>setCounterpart({...counterpart,...location})}/>\n              <details className=\"advanced-panel field-wide\"><summary>고급 위치 설정 · 위도/경도 직접 수정</summary><div className=\"advanced-grid\">\n                <label className=\"field\"><span>위도</span><input inputMode=\"decimal\" value={counterpart.latitude} disabled={!counterpart.timeKnown} onChange={(e)=>setCounterpart({...counterpart,latitude:e.target.value,placeKey:''})}/></label>\n                <label className=\"field\"><span>경도</span><input inputMode=\"decimal\" value={counterpart.longitude} disabled={!counterpart.timeKnown} onChange={(e)=>setCounterpart({...counterpart,longitude:e.target.value,placeKey:''})}/></label>\n                <label className=\"field field-wide\"><span>UTC(협정세계시) 시차</span><input inputMode=\"decimal\" value={counterpart.utcOffset} disabled={!counterpart.timeKnown} onChange={(e)=>setCounterpart({...counterpart,utcOffset:e.target.value})}/></label>"""
new_ui = """              <label className=\"check-field field-wide\"><input type=\"checkbox\" checked={!counterpart.timeKnown} onChange={(e)=>setCounterpart({...counterpart,timeKnown:!e.target.checked,birthTime:e.target.checked?'':counterpart.birthTime})}/><span>상대 출생시간 모름 — 출생지역은 그대로 기록 가능 · Moon(달)·각도·하우스·다빈슨/마크스 등 시간민감 레이어만 자동 제외</span></label>\n              <KoreaBirthplaceSelector value={counterpart} onChange={(location)=>setCounterpart({...counterpart,...location})}/>\n              <details className=\"advanced-panel field-wide\"><summary>고급 위치 설정 · 위도/경도 직접 수정</summary><div className=\"advanced-grid\">\n                <label className=\"field\"><span>위도</span><input inputMode=\"decimal\" value={counterpart.latitude} onChange={(e)=>setCounterpart({...counterpart,latitude:e.target.value,placeKey:''})}/></label>\n                <label className=\"field\"><span>경도</span><input inputMode=\"decimal\" value={counterpart.longitude} onChange={(e)=>setCounterpart({...counterpart,longitude:e.target.value,placeKey:''})}/></label>\n                <label className=\"field field-wide\"><span>UTC(협정세계시) 시차</span><input inputMode=\"decimal\" value={counterpart.utcOffset} onChange={(e)=>setCounterpart({...counterpart,utcOffset:e.target.value})}/></label>"""
app = replace_once(app, old_ui, new_ui, 'unknown-time birthplace UI')

# API must preserve known birthplace metadata even when time is unknown. The
# relationship engine still checks time_known before enabling angles/houses.
api = replace_once(
    api,
    '            "latitude": self.latitude if exact_time else None,\n            "longitude": self.longitude if exact_time else None,',
    '            "latitude": self.latitude,\n            "longitude": self.longitude,',
    'API engine payload birthplace preservation',
)

# Guardrails.
required_app = [
    "today: 180",
    "week: 370",
    "month: 730",
    "year: 1825",
    "fortuneCacheTtlDays(period, selectedTool)",
    "RELATIONSHIP_AI_CACHE_TTL_DAYS = 1825",
    "<KoreaBirthplaceSelector value={counterpart}",
    "출생지역은 그대로 기록 가능",
    "const counterpartLatitude = parseOptionalNumber(counterpart.latitude)",
    "latitude: cp.latitude != null ? String(cp.latitude) : ''",
]
for token in required_app:
    if token not in app:
        raise SystemExit(f'missing app token: {token}')
for forbidden in [
    '<KoreaBirthplaceSelector disabled={!counterpart.timeKnown}',
    'value={counterpart.latitude} disabled={!counterpart.timeKnown}',
    'value={counterpart.longitude} disabled={!counterpart.timeKnown}',
    'value={counterpart.utcOffset} disabled={!counterpart.timeKnown}',
    "period === 'today' ? 90 : 30",
]:
    if forbidden in app:
        raise SystemExit(f'regression remains: {forbidden}')
if '"latitude": self.latitude if exact_time else None' in api:
    raise SystemExit('API still discards unknown-time birthplace')

APP.write_text(app, encoding='utf-8')
API.write_text(api, encoding='utf-8')
