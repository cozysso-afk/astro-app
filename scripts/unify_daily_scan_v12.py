from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / 'integrated_fortune_v1.py'
s = p.read_text(encoding='utf-8')

old_detail = '''def _daily_detail(day_value: date, natal_lons: dict, natal_houses: dict, offset_hours: float):
    rows = _scan_intraday(day_value, dt_time(7, 30), dt_time(23, 0), 45, natal_lons, natal_houses, offset_hours)
    details = {}
    keys = ["금전", "학업", "시험", "직장", "이직", "연애", "연락", "재회", "소식", "컨디션"]
    if _is_market_day(day_value):
        keys += ["투자심리", "수익실현", "신규진입", "투자주의"]
    for key in keys:
        best, worst = _rolling_window(rows, key, 3)
        if not best:
            continue
        evidence = []
        if key in TOPIC_SPECS:
            scored = [r for r in rows if isinstance(r.get(key), (int, float))]
            if scored:
                peak = max(scored, key=lambda r: float(r.get(key, 0)))
                topic_raw = (peak.get("topics") or {}).get(key) or {}
                raw_evidence = topic_raw.get("evidence") or []
                evidence = [str(x) for x in raw_evidence[:6]]
        elif key in {"수익실현", "신규진입", "투자주의"}:
            scored = [r for r in rows if isinstance(r.get(key), (int, float))]
            if scored:
                peak = max(scored, key=lambda r: float(r.get(key, 0)))
                for base_key in ("금전", "투자심리"):
                    raw = ((peak.get("topics") or {}).get(base_key) or {}).get("evidence") or []
                    evidence.extend(str(x) for x in raw[:3])
        details[key] = {"best_window": best, "caution_window": worst, "evidence": evidence[:6]}
    return {"date": day_value.isoformat(), "market_open": _is_market_day(day_value), "topics": details}
'''
new_detail = '''def _evidence_text(item: dict) -> str:
    if not isinstance(item, dict):
        return str(item)
    if item.get("kind") == "aspect":
        transit = item.get("transit", "")
        target = item.get("target", "")
        aspect = item.get("aspect", "")
        orb = item.get("orb")
        direction = item.get("direction", "")
        orb_text = f" · orb {float(orb):.2f}°" if isinstance(orb, (int, float)) else ""
        dir_text = f" · {direction}" if direction else ""
        return f"{transit}→{target} {aspect}{orb_text}{dir_text}".strip()
    if item.get("kind") == "house":
        transit = item.get("transit", "")
        whole = item.get("whole_house")
        placidus = item.get("placidus_house")
        return f"{transit} · Whole Sign {whole}H · Placidus {placidus}H"
    return str(item)


def _detail_from_rows(day_value: date, rows: list[dict]):
    details = {}
    keys = ["금전", "학업", "시험", "직장", "이직", "연애", "연락", "재회", "소식", "컨디션"]
    if _is_market_day(day_value):
        keys += ["투자심리", "수익실현", "신규진입", "투자주의"]
    for key in keys:
        # 90-minute samples + 2-point window preserve a 1h30m readable window
        # while avoiding a second expensive astronomy pass on Render.
        best, worst = _rolling_window(rows, key, 2)
        if not best:
            continue
        evidence = []
        scored = [r for r in rows if isinstance(r.get(key), (int, float))]
        if scored:
            peak = max(scored, key=lambda r: float(r.get(key, 0)))
            if key in TOPIC_SPECS:
                raw = ((peak.get("topics") or {}).get(key) or {}).get("evidence") or []
                evidence = [_evidence_text(x) for x in raw[:6]]
            elif key in {"수익실현", "신규진입", "투자주의"}:
                for base_key in ("금전", "투자심리"):
                    raw = ((peak.get("topics") or {}).get(base_key) or {}).get("evidence") or []
                    evidence.extend(_evidence_text(x) for x in raw[:3])
        details[key] = {"best_window": best, "caution_window": worst, "evidence": evidence[:6]}
    return {"date": day_value.isoformat(), "market_open": _is_market_day(day_value), "topics": details}


def _daily_detail(day_value: date, natal_lons: dict, natal_houses: dict, offset_hours: float):
    rows = _scan_intraday(day_value, dt_time(7, 30), dt_time(23, 0), 90, natal_lons, natal_houses, offset_hours)
    return _detail_from_rows(day_value, rows)
'''
if old_detail not in s:
    raise SystemExit('daily detail anchor missing')
s = s.replace(old_detail, new_detail, 1)

agg_anchor = '''@lru_cache(maxsize=5000)
def _daily_aggregate_cached(day_iso: str, natal_packed: tuple, houses_packed: tuple, offset_hours: float):
    day_value = date.fromisoformat(day_iso)
    life = _scan_intraday(
        day_value,
        dt_time(8, 0),
        dt_time(22, 0),
        120,
        _unpack_natal_lons(natal_packed),
        _unpack_houses(houses_packed),
        offset_hours,
    )
    row = {
        "date": day_value.isoformat(),
        "label": f"{day_value.month}/{day_value.day}({WEEKDAY_KO[day_value.weekday()]})",
    }
    for key in TOPIC_ORDER + ["수신신호", "발신적합", "과거인연접점"]:
        row[key] = _rows_avg(life, key)
    return row
'''
agg_new = agg_anchor + '''

@lru_cache(maxsize=1000)
def _daily_detailed_cached(day_iso: str, natal_packed: tuple, houses_packed: tuple, offset_hours: float):
    day_value = date.fromisoformat(day_iso)
    natal_lons = _unpack_natal_lons(natal_packed)
    natal_houses = _unpack_houses(houses_packed)
    # One scan powers BOTH daily averages and time/evidence detail. The previous
    # mobile v2 performed a second scan and could exceed Render's request window.
    life = _scan_intraday(day_value, dt_time(7, 30), dt_time(23, 0), 90, natal_lons, natal_houses, offset_hours)
    row = {
        "date": day_value.isoformat(),
        "label": f"{day_value.month}/{day_value.day}({WEEKDAY_KO[day_value.weekday()]})",
    }
    for key in TOPIC_ORDER + ["수신신호", "발신적합", "과거인연접점"]:
        row[key] = _rows_avg(life, key)
    return {"row": row, "detail": _detail_from_rows(day_value, life)}
'''
if agg_anchor not in s:
    raise SystemExit('aggregate anchor missing')
s = s.replace(agg_anchor, agg_new, 1)

old_rows = '''    day_count = (end_date - start_date).days + 1
    rows = [
        dict(_daily_aggregate_cached((start_date + timedelta(days=i)).isoformat(), natal_packed, houses_packed, float(utc_offset_hours)))
        for i in range(day_count)
    ]

    market_rows = [r for r in rows if _is_market_day(date.fromisoformat(r["date"]))]
'''
new_rows = '''    day_count = (end_date - start_date).days + 1
    detail_days = []
    if day_count == 1:
        packed_day = _daily_detailed_cached(start_date.isoformat(), natal_packed, houses_packed, float(utc_offset_hours))
        rows = [dict(packed_day["row"])]
        detail_days = [packed_day["detail"]]
    else:
        rows = [
            dict(_daily_aggregate_cached((start_date + timedelta(days=i)).isoformat(), natal_packed, houses_packed, float(utc_offset_hours)))
            for i in range(day_count)
        ]

    market_rows = [r for r in rows if _is_market_day(date.fromisoformat(r["date"]))]
'''
if old_rows not in s:
    raise SystemExit('western rows anchor missing')
s = s.replace(old_rows, new_rows, 1)

old_detail_loop = '''    # Rich intraday evidence is intentionally limited to short ranges to keep
    # annual/monthly payloads and Gemini prompts bounded.
    detail_days = []
    if day_count <= 7:
        for i in range(day_count):
            detail_days.append(_daily_detail(start_date + timedelta(days=i), natal_lons, natal_houses, float(utc_offset_hours)))

'''
if old_detail_loop not in s:
    raise SystemExit('detail loop anchor missing')
s = s.replace(old_detail_loop, '''    # Intraday evidence is returned for a single selected day. Multi-day reports
    # keep best/caution dates but avoid multiplying expensive intraday scans.

''', 1)

old_method = '        "method": "하루 08:00~22:00 현지시간을 120분 간격으로 샘플링해 기존 기간 엔진 방식으로 집계",'
new_method = '        "method": ("단일일은 07:30~23:00 90분 간격 단일 패스로 평균+시간창을 함께 산출" if day_count == 1 else "다일 기간은 하루 08:00~22:00 120분 간격으로 집계하고 날짜별 강약을 비교"),'
if old_method not in s:
    raise SystemExit('method anchor missing')
s = s.replace(old_method, new_method, 1)

p.write_text(s, encoding='utf-8')

# Keep home flow dense but not duplicated: lifestyle topics in core, market in its own card.
p = ROOT / 'web/src/AppNext.tsx'
s = p.read_text(encoding='utf-8')
old_order = "const topicOrder = ['금전','투자심리','수익실현','신규진입','투자주의','학업','시험','직장','이직','연애','연락','재회','소식','컨디션']\nconst relationshipSignalOrder = ['수신신호','발신적합','과거인연접점']"
new_order = "const coreTopicOrder = ['금전','학업','시험','직장','이직','연애','연락','재회','소식','컨디션']\nconst marketTopicOrder = ['투자심리','수익실현','신규진입','투자주의']\nconst topicOrder = [...coreTopicOrder, ...marketTopicOrder]\nconst relationshipSignalOrder = ['수신신호','발신적합','과거인연접점']"
if old_order not in s:
    raise SystemExit('frontend topic order anchor missing')
s = s.replace(old_order, new_order, 1)
old_ordered = '''  const orderedIntegratedTopics = integratedResult
    ? topicOrder
        .map((topic) => ({ topic, stat: integratedResult.western.overall[topic] }))
        .filter((row): row is { topic: string; stat: FortuneStat } => Boolean(row.stat))
    : []
'''
new_ordered = '''  const orderedIntegratedTopics = integratedResult
    ? coreTopicOrder
        .map((topic) => ({ topic, stat: integratedResult.western.overall[topic] }))
        .filter((row): row is { topic: string; stat: FortuneStat } => Boolean(row.stat))
    : []
'''
if old_ordered not in s:
    raise SystemExit('ordered topics anchor missing')
s = s.replace(old_ordered, new_ordered, 1)
p.write_text(s, encoding='utf-8')
print('single-pass daily scan patch applied')
