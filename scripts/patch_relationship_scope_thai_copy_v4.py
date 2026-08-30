from pathlib import Path

# ---------------------------------------------------------------------------
# relationship_western_v1.py: run expensive daily reunion transit only for reunion
# ---------------------------------------------------------------------------
p = Path('relationship_western_v1.py')
s = p.read_text(encoding='utf-8')
s = s.replace('ENGINE_VERSION = "relationship-western-v1.4-dual-house-audit"', 'ENGINE_VERSION = "relationship-western-v1.5-purpose-scoped-transits"', 1)
s = s.replace(
    'def build_relationship_western(user_profile, counterpart_profile, month_segments):',
    'def build_relationship_western(user_profile, counterpart_profile, month_segments, analysis_mode="compatibility"):',
    1,
)
s = s.replace(
    '    month_segments: iterable of (segment_start: date, segment_end: date); midpoint noon KST is used as\n    the representative timing date. Exact partner birth time/place unlocks Davison and Marks layers.\n',
    '    month_segments: iterable of (segment_start: date, segment_end: date); midpoint noon KST is used as\n    the representative timing date. Exact partner birth time/place unlocks Davison and Marks layers.\n    Daily two-person reunion transit scanning runs only for analysis_mode="reunion".\n',
    1,
)
old = '''    if month_segments:\n        transit_layer = _build_reunion_transits(\n            user_natal, cp_natal, month_segments[0][0], month_segments[-1][1], user_profile.get("utc_offset_hours", 9.0)\n        )\n        result["relationship_transits"] = transit_layer\n        result["reunion_transits"] = transit_layer\n'''
new = '''    result["analysis_mode"] = analysis_mode\n    result["daily_transit_policy"] = {\n        "reunion_scan": "enabled" if analysis_mode == "reunion" else "skipped",\n        "reason": "daily two-person reunion transit scan is purpose-specific; monthly progressed timing layers remain available for compatibility/marriage",\n    }\n    if month_segments and analysis_mode == "reunion":\n        transit_layer = _build_reunion_transits(\n            user_natal, cp_natal, month_segments[0][0], month_segments[-1][1], user_profile.get("utc_offset_hours", 9.0)\n        )\n        result["relationship_transits"] = transit_layer\n        result["reunion_transits"] = transit_layer\n'''
assert old in s, 'unconditional reunion transit anchor missing'
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# ---------------------------------------------------------------------------
# api/main.py: pass purpose into relationship engine instead of tagging afterward
# ---------------------------------------------------------------------------
p = Path('api/main.py')
s = p.read_text(encoding='utf-8')
s = s.replace('APP_VERSION = "api-fortune-v5.1-bounded-calc-queue"', 'APP_VERSION = "api-fortune-v5.2-purpose-scoped-relationship"', 1)
old = '''        result = build_relationship_western(user_payload, cp_payload, segments)\n        result["analysis_mode"] = request.analysis_mode\n'''
new = '''        result = build_relationship_western(user_payload, cp_payload, segments, analysis_mode=request.analysis_mode)\n'''
assert old in s, 'relationship api mode anchor missing'
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# ---------------------------------------------------------------------------
# AppNext.tsx: remove stale weekday-baseline-only descriptions
# ---------------------------------------------------------------------------
p = Path('web/src/AppNext.tsx')
s = p.read_text(encoding='utf-8')
replacements = {
    '- Thai transit(태국식 트랜짓)이 미구현이면 출생요일 baseline을 날짜 예측 합의점수에 섞지 않는다.':
    '- Thai(태국점성술)는 Mahathaksa(마하탁사)·Taksajorn(탁사쫀)의 실제 계산 구간만 독립적으로 해석한다. Full Suriyayat(수리야얏) 행성·Lagna(라그나)·Rahu/Ketu(라후/게투) 트랜짓은 검증 전이므로 만들거나 Western(서양점성술) 수치점수에 임의 합산하지 않는다.',
    'Western(서양점성술) 기간 흐름, 진태양시 보정 사주, Thai(태국점성술) 출생요일층을 각각 계산해 한 화면에서 비교해.':
    'Western(서양점성술) 기간 흐름, 진태양시 보정 사주, Thai(태국점성술) Mahathaksa(마하탁사)·Taksajorn(탁사쫀) 기간층을 각각 계산해 한 화면에서 비교해.',
    '사주는 출생지 경도로 진태양시를 보정하고, 서양점성술은 출생지 좌표로 상승점·하우스를 계산해. Thai(태국점성술)는 현재 출생요일 기준값만 사용해.':
    '사주는 출생지 경도로 진태양시를 보정하고, 서양점성술은 출생지 좌표로 상승점·하우스를 계산해. Thai(태국점성술)는 출생요일 규칙과 Mahathaksa(마하탁사)·Taksajorn(탁사쫀) 기간층을 계산하며 Full Suriyayat(수리야얏) 트랜짓은 아직 검증 전이야.',
}
for old, new in replacements.items():
    assert old in s, f'stale Thai copy anchor missing: {old[:50]}'
    s = s.replace(old, new, 1)

# Keep external prompt strict about actual Thai data and unimplemented Suriyayat.
external_anchor = "    '- 데이터에 없는 점성술/사주 요소, 사건 확률, 상대의 속마음은 만들지 않는다.',\n"
external_add = external_anchor + "    '- Thai(태국점성술)는 CALCULATED_DATA.thai의 mahathaksa/taksajorn에 실제 들어온 값만 사용하고, not_calculated의 Suriyayat(수리야얏) 항목은 추정하지 않는다.',\n"
assert external_anchor in s, 'external prompt safety anchor missing'
s = s.replace(external_anchor, external_add, 1)
p.write_text(s, encoding='utf-8')

print('PATCH_RELATIONSHIP_SCOPE_THAI_COPY_V4_APPLIED')
