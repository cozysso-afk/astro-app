from pathlib import Path

# ---------------------------------------------------------------------------
# Backend: exact LiChun/Jie segmentation for Saju annual/monthly flow
# ---------------------------------------------------------------------------
p = Path('integrated_fortune_v1.py')
s = p.read_text(encoding='utf-8')
s = s.replace('ENGINE_VERSION = "integrated-fortune-v2.7-bounded-vector-thai"', 'ENGINE_VERSION = "integrated-fortune-v2.8-saju-jie-exact-thai"', 1)
s = s.replace('SAJU_ENGINE_VERSION = "lunar_python-1.4.8-true-solar"', 'SAJU_ENGINE_VERSION = "lunar_python-1.4.8-true-solar-jie-exact"', 1)

anchor = '''def _saju_payload(\n    birth_date: date,\n'''
assert anchor in s, 'saju payload anchor missing'
helpers = r'''_CST = timezone(timedelta(hours=8))
_JIE_KO = {
    "小寒": "소한", "立春": "입춘", "惊蛰": "경칩", "驚蟄": "경칩", "清明": "청명",
    "立夏": "입하", "芒种": "망종", "芒種": "망종", "小暑": "소서", "立秋": "입추",
    "白露": "백로", "寒露": "한로", "立冬": "입동", "大雪": "대설",
}


def _fixed_timezone(offset_hours: float):
    return timezone(timedelta(hours=float(offset_hours)))


def _aware_to_lunar_exact(value: datetime):
    cst = value.astimezone(_CST)
    return Solar.fromYmdHms(cst.year, cst.month, cst.day, cst.hour, cst.minute, cst.second).getLunar()


def _jie_solar_to_target(solar, offset_hours: float) -> datetime:
    cst = datetime(
        int(solar.getYear()), int(solar.getMonth()), int(solar.getDay()),
        int(solar.getHour()), int(solar.getMinute()), int(solar.getSecond()),
        tzinfo=_CST,
    )
    return cst.astimezone(_fixed_timezone(offset_hours))


def _next_jie(current):
    # Moving one civil day beyond the exact boundary prevents getNextJie() from
    # returning the same Jie object on implementations that treat equality as current.
    return current.getSolar().next(1).getLunar().getNextJie()


def _jie_boundaries_for_range(start_date: date, end_date: date, offset_hours: float):
    target_tz = _fixed_timezone(offset_hours)
    range_start = datetime.combine(start_date, dt_time(0, 0), tzinfo=target_tz)
    range_end_exclusive = datetime.combine(end_date + timedelta(days=1), dt_time(0, 0), tzinfo=target_tz)
    current = _aware_to_lunar_exact(range_start).getPrevJie()
    boundaries = []
    seen = set()
    for _ in range(40):
        solar = current.getSolar()
        instant = _jie_solar_to_target(solar, offset_hours)
        key = (current.getName(), instant.isoformat())
        if key in seen:
            raise RuntimeError('duplicate Jie boundary while iterating')
        seen.add(key)
        boundaries.append({
            'name': current.getName(),
            'name_ko': _JIE_KO.get(current.getName(), current.getName()),
            'instant': instant,
        })
        if instant > range_end_exclusive + timedelta(days=45):
            break
        current = _next_jie(current)
    boundaries.sort(key=lambda row: row['instant'])
    return range_start, range_end_exclusive, boundaries


def _month_jie_segments(start_date: date, end_date: date, offset_hours: float):
    range_start, range_end_exclusive, boundaries = _jie_boundaries_for_range(start_date, end_date, offset_hours)
    rows = []
    for idx in range(len(boundaries) - 1):
        active = boundaries[idx]
        nxt = boundaries[idx + 1]
        seg_start = max(range_start, active['instant'])
        seg_end = min(range_end_exclusive, nxt['instant'])
        if seg_start >= seg_end:
            continue
        midpoint = seg_start + (seg_end - seg_start) / 2
        lunar = _aware_to_lunar_exact(midpoint)
        gz = lunar.getMonthInGanZhiExact()
        rows.append({
            'calendar_month': f'{seg_start.year}-{seg_start.month:02d}',
            'segment_start': seg_start.isoformat(timespec='seconds'),
            'segment_end_exclusive': seg_end.isoformat(timespec='seconds'),
            'jie_name': active['name'],
            'jie_name_ko': active['name_ko'],
            'next_jie': nxt['name'],
            'next_jie_ko': nxt['name_ko'],
            'representative_time': midpoint.isoformat(timespec='seconds'),
            'ganzhi': gz,
        })
    return rows


def _lichun_for_year(year: int, offset_hours: float):
    # lunar_python Solar/JieQi timestamps are China Standard Time (UTC+8).
    probe = Solar.fromYmdHms(int(year), 2, 1, 12, 0, 0).getLunar()
    solar = probe.getJieQiTable().get('立春')
    if solar is None:
        raise RuntimeError(f'立春 boundary unavailable for {year}')
    return _jie_solar_to_target(solar, offset_hours)


def _annual_lichun_segments(start_date: date, end_date: date, offset_hours: float):
    target_tz = _fixed_timezone(offset_hours)
    range_start = datetime.combine(start_date, dt_time(0, 0), tzinfo=target_tz)
    range_end_exclusive = datetime.combine(end_date + timedelta(days=1), dt_time(0, 0), tzinfo=target_tz)
    boundaries = [
        {'name': '立春', 'name_ko': '입춘', 'instant': _lichun_for_year(y, offset_hours)}
        for y in range(start_date.year - 1, end_date.year + 2)
    ]
    boundaries.sort(key=lambda row: row['instant'])
    rows = []
    for idx in range(len(boundaries) - 1):
        active = boundaries[idx]
        nxt = boundaries[idx + 1]
        seg_start = max(range_start, active['instant'])
        seg_end = min(range_end_exclusive, nxt['instant'])
        if seg_start >= seg_end:
            continue
        midpoint = seg_start + (seg_end - seg_start) / 2
        lunar = _aware_to_lunar_exact(midpoint)
        rows.append({
            'year': seg_start.year,
            'segment_start': seg_start.isoformat(timespec='seconds'),
            'segment_end_exclusive': seg_end.isoformat(timespec='seconds'),
            'start_jie': active['name'],
            'start_jie_ko': active['name_ko'],
            'representative_time': midpoint.isoformat(timespec='seconds'),
            'ganzhi': lunar.getYearInGanZhiExact(),
        })
    return rows


'''
s = s.replace(anchor, helpers + anchor, 1)

old = '''        years = []\n        for y in range(start_date.year, end_date.year + 1):\n            rep = Solar.fromYmdHms(y, 7, 1, 12, 0, 0).getLunar()\n            gz = rep.getYearInGanZhiExact()\n            years.append({\n                "year": y,\n                "ganzhi": gz,\n                "stem_ten_god": _ten_god(day_master, gz[:1]),\n                "branch_links": _branch_links(gz[1:2], branches),\n            })\n\n        months = []\n        for seg_start, seg_end in _month_segments(start_date, end_date):\n            rep_date = seg_start + (seg_end - seg_start) // 2\n            rep = Solar.fromYmdHms(rep_date.year, rep_date.month, rep_date.day, 12, 0, 0).getLunar()\n            gz = rep.getMonthInGanZhiExact()\n            months.append({\n                "calendar_month": f"{seg_start.year}-{seg_start.month:02d}",\n                "segment_start": seg_start.isoformat(),\n                "segment_end": seg_end.isoformat(),\n                "representative_date": rep_date.isoformat(),\n                "ganzhi": gz,\n                "stem_ten_god": _ten_god(day_master, gz[:1]),\n                "branch_links": _branch_links(gz[1:2], branches),\n                "boundary_note": "월 중 대표일의 절기월 간지. 절입 경계 정확시각은 별도 노출하지 않음.",\n            })\n'''
new = '''        years = []\n        for row in _annual_lichun_segments(start_date, end_date, utc_offset_hours):\n            gz = row["ganzhi"]\n            years.append({\n                **row,\n                "stem_ten_god": _ten_god(day_master, gz[:1]),\n                "branch_links": _branch_links(gz[1:2], branches),\n                "boundary_note": "세운은 立春(입춘) 정확시각 경계. lunar_python UTC+8 절기시각을 프로필 UTC 오프셋으로 변환함.",\n            })\n\n        months = []\n        for row in _month_jie_segments(start_date, end_date, utc_offset_hours):\n            gz = row["ganzhi"]\n            months.append({\n                **row,\n                "stem_ten_god": _ten_god(day_master, gz[:1]),\n                "branch_links": _branch_links(gz[1:2], branches),\n                "boundary_note": "월운은 절(節) 정확시각 경계. lunar_python UTC+8 절기시각을 프로필 UTC 오프셋으로 변환함.",\n            })\n'''
assert old in s, 'representative Saju annual/monthly block missing'
s = s.replace(old, new, 1)

old_policy = '"thai": "출생요일 baseline만 제공. Suriyayat transit 미구현이므로 기간 예측 합의에 포함하지 않음.",'
new_policy = '"thai": "Mahathaksa/Taksajorn 기간층은 독립 계산. 검증 전 Full Suriyayat Lagna/태국식 트랜짓은 Western 수치점수에 임의 합산하지 않음.",'
assert old_policy in s, 'stale Thai backend consensus policy missing'
s = s.replace(old_policy, new_policy, 1)
p.write_text(s, encoding='utf-8')

# ---------------------------------------------------------------------------
# Frontend: type/output/UI must preserve exact Jie segmentation
# ---------------------------------------------------------------------------
p = Path('web/src/AppNext.tsx')
s = p.read_text(encoding='utf-8')
old_types = '''    annual?: Array<{ year: number; ganzhi: string; stem_ten_god: string; branch_links: string[] }>\n    monthly?: Array<{ calendar_month: string; ganzhi: string; stem_ten_god: string; branch_links: string[]; boundary_note?: string }>'''
new_types = '''    annual?: Array<{ year: number; ganzhi: string; stem_ten_god: string; branch_links: string[]; segment_start?: string; segment_end_exclusive?: string; start_jie?: string; start_jie_ko?: string; representative_time?: string; boundary_note?: string }>\n    monthly?: Array<{ calendar_month: string; ganzhi: string; stem_ten_god: string; branch_links: string[]; segment_start?: string; segment_end_exclusive?: string; representative_time?: string; jie_name?: string; jie_name_ko?: string; next_jie?: string; next_jie_ko?: string; boundary_note?: string }>'''
assert old_types in s, 'frontend Saju types anchor missing'
s = s.replace(old_types, new_types, 1)

prompt_old = "    '- 사주는 진태양시 보정을 사용하고, 엔진이 계산하지 않은 신강·신약/용희기신 등을 임의 생성하지 않는다.',"
prompt_new = prompt_old + "\n    '- 사주 annual(세운)은 입춘, monthly(월운)은 각 절(節)의 정확시각 경계로 분할된 구간이다. 같은 달력 연도·월 이름이 반복돼도 서로 다른 구간을 임의 병합하지 않는다.',"
assert prompt_old in s, 'integrated prompt Saju rule missing'
s = s.replace(prompt_old, prompt_new, 1)

annual_old = "    for (const row of result.saju.annual ?? []) lines.push(`- ${row.year} 세운: ${row.ganzhi} · ${row.stem_ten_god} · ${row.branch_links.join(', ') || '지지 연결 없음'}`)"
annual_new = "    for (const row of result.saju.annual ?? []) lines.push(`- ${row.year} 세운${row.segment_start&&row.segment_end_exclusive?` · ${row.segment_start} ~ ${row.segment_end_exclusive}`:''}${row.start_jie_ko?` · ${row.start_jie_ko}(${row.start_jie}) 기준`:''}: ${row.ganzhi} · ${row.stem_ten_god} · ${row.branch_links.join(', ') || '지지 연결 없음'}`)"
assert annual_old in s, 'integratedResultText annual anchor missing'
s = s.replace(annual_old, annual_new, 1)
monthly_old = "    for (const row of result.saju.monthly ?? []) lines.push(`- ${row.calendar_month} 월운: ${row.ganzhi} · ${row.stem_ten_god} · ${row.branch_links.join(', ') || '지지 연결 없음'}`)"
monthly_new = "    for (const row of result.saju.monthly ?? []) lines.push(`- ${row.calendar_month} 월운${row.segment_start&&row.segment_end_exclusive?` · ${row.segment_start} ~ ${row.segment_end_exclusive}`:''}${row.jie_name_ko?` · ${row.jie_name_ko}(${row.jie_name}) 시작`:''}: ${row.ganzhi} · ${row.stem_ten_god} · ${row.branch_links.join(', ') || '지지 연결 없음'}`)"
assert monthly_old in s, 'integratedResultText monthly anchor missing'
s = s.replace(monthly_old, monthly_new, 1)

old_note = '사주 월운 표시는 현재 달력 월 중 대표일의 절기월 간지야. 절입 경계의 정확 시각까지 월 구간을 쪼갠 방식은 아직 아니며, 원본 데이터의 boundary_note(경계 주석)를 보존해.'
new_note = '사주 세운은 立春(입춘), 월운은 각 절(節)의 정확 시각을 경계로 구간을 나눠. 절기 시각은 lunar_python의 UTC+8 계산시각을 네 프로필 UTC 오프셋으로 변환해 표시해.'
assert old_note in s, 'stale representative-month UI note missing'
s = s.replace(old_note, new_note, 1)

# Precision raw lists: preserve exact boundaries instead of hiding them behind Gregorian labels.
old_annual_raw = "{(integratedResult.saju.annual?.length??0)>0 && <details className=\"precision-details\"><summary>세운 전체</summary><div className=\"precision-details-body\">{integratedResult.saju.annual?.map((row)=><div className=\"tight-row\" key={`${row.year}-${row.ganzhi}`}><span>{row.year} · {row.stem_ten_god} · {row.branch_links.join(', ')||'연결 없음'}</span><b>{row.ganzhi}</b></div>)}</div></details>}"
new_annual_raw = "{(integratedResult.saju.annual?.length??0)>0 && <details className=\"precision-details\"><summary>세운 전체 · 입춘 경계</summary><div className=\"precision-details-body\">{integratedResult.saju.annual?.map((row,index)=><div className=\"tight-row\" key={`${row.year}-${row.ganzhi}-${index}`}><span>{row.segment_start&&row.segment_end_exclusive?`${row.segment_start} ~ ${row.segment_end_exclusive}`:`${row.year}`} · {row.start_jie_ko?`${row.start_jie_ko}(${row.start_jie}) · `:''}{row.stem_ten_god} · {row.branch_links.join(', ')||'연결 없음'}</span><b>{row.ganzhi}</b></div>)}</div></details>}"
assert old_annual_raw in s, 'precision annual raw anchor missing'
s = s.replace(old_annual_raw, new_annual_raw, 1)
old_month_raw = "{(integratedResult.saju.monthly?.length??0)>0 && <details className=\"precision-details\"><summary>월운 전체</summary><div className=\"precision-details-body\">{integratedResult.saju.monthly?.map((row)=><div className=\"tight-row\" key={`${row.calendar_month}-${row.ganzhi}`}><span>{row.calendar_month} · {row.stem_ten_god} · {row.branch_links.join(', ')||'연결 없음'}</span><b>{row.ganzhi}</b></div>)}</div></details>}"
new_month_raw = "{(integratedResult.saju.monthly?.length??0)>0 && <details className=\"precision-details\"><summary>월운 전체 · 절(節) 경계</summary><div className=\"precision-details-body\">{integratedResult.saju.monthly?.map((row,index)=><div className=\"tight-row\" key={`${row.calendar_month}-${row.ganzhi}-${index}`}><span>{row.segment_start&&row.segment_end_exclusive?`${row.segment_start} ~ ${row.segment_end_exclusive}`:row.calendar_month} · {row.jie_name_ko?`${row.jie_name_ko}(${row.jie_name}) · `:''}{row.stem_ten_god} · {row.branch_links.join(', ')||'연결 없음'}</span><b>{row.ganzhi}</b></div>)}</div></details>}"
assert old_month_raw in s, 'precision monthly raw anchor missing'
s = s.replace(old_month_raw, new_month_raw, 1)

p.write_text(s, encoding='utf-8')
print('PATCH_SAJU_JIE_EXACT_V1_APPLIED')
