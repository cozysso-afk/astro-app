from pathlib import Path

# ---- integrated fortune: zero-math-change ephemeris memoization + market-calendar transparency ----
int_path = Path('integrated_fortune_v1.py')
s = int_path.read_text(encoding='utf-8')
s = s.replace('ENGINE_VERSION = "integrated-fortune-v2.4-full-year-efficient"', 'ENGINE_VERSION = "integrated-fortune-v2.5-ephemeris-cache-audit"', 1)
s = s.replace('WESTERN_ENGINE_VERSION = "western-period-engine-v7-full-year-efficient"', 'WESTERN_ENGINE_VERSION = "western-period-engine-v8-ephemeris-cache-audit"', 1)

old = '''def _planet_lon(body_name: str, dt_aware: datetime):
    _, _, earth, targets, _, _, _ = _ephemeris_bundle()
'''
new = '''@lru_cache(maxsize=60000)
def _planet_lon(body_name: str, dt_aware: datetime):
    # Deterministic astronomical lookup. Annual scans revisit many identical
    # timestamps across life/market scans and applying/separating windows.
    _, _, earth, targets, _, _, _ = _ephemeris_bundle()
'''
assert old in s, 'planet lon anchor missing'
s = s.replace(old, new, 1)

old = '''def _planet_snapshot(body: str, query_dt_utc: datetime):
    h = _motion_window_hours(body)
'''
new = '''@lru_cache(maxsize=30000)
def _planet_snapshot(body: str, query_dt_utc: datetime):
    # Cached snapshots preserve the exact same lon/past/future math while
    # avoiding duplicate Skyfield observations at overlapping scan times.
    h = _motion_window_hours(body)
'''
assert old in s, 'planet snapshot anchor missing'
s = s.replace(old, new, 1)

old = '''@lru_cache(maxsize=1)
def _krx_session_set() -> frozenset[str]:
    path = Path(__file__).resolve().parent / "data" / "krx_sessions_2020_2027.json"
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        values = payload.get("sessions") if isinstance(payload, dict) else payload
        if isinstance(values, list):
            return frozenset(str(x) for x in values)
    except Exception:
        pass
    return frozenset()


def _is_market_day(day_value: date) -> bool:
    # Runtime stays lightweight: the exact XKRX calendar is precomputed at build
    # time through the currently available range. Outside it we explicitly fall
    # back to weekdays instead of loading pandas/exchange_calendars in Render.
    sessions = _krx_session_set()
    iso = day_value.isoformat()
    if sessions and "2020-01-01" <= iso <= "2027-08-27":
        return iso in sessions
    return day_value.weekday() < 5
'''
new = '''@lru_cache(maxsize=1)
def _krx_calendar_data():
    path = Path(__file__).resolve().parent / "data" / "krx_sessions_2020_2027.json"
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        values = payload.get("sessions") if isinstance(payload, dict) else payload
        coverage = payload.get("range") if isinstance(payload, dict) else None
        if isinstance(values, list):
            start = str(coverage[0]) if isinstance(coverage, list) and len(coverage) >= 2 else "2020-01-01"
            end = str(coverage[1]) if isinstance(coverage, list) and len(coverage) >= 2 else "2027-08-27"
            return frozenset(str(x) for x in values), start, end
    except Exception:
        pass
    return frozenset(), None, None


def _krx_session_set() -> frozenset[str]:
    return _krx_calendar_data()[0]


def _krx_calendar_precision(start_date: date, end_date: date):
    sessions, exact_start, exact_end = _krx_calendar_data()
    if not sessions or not exact_start or not exact_end:
        return {
            "mode": "weekday_fallback",
            "exact_range": None,
            "warning": "XKRX 정확 거래일 캘린더를 읽지 못해 평일 기준으로 계산함",
        }
    start_iso, end_iso = start_date.isoformat(), end_date.isoformat()
    if exact_start <= start_iso and end_iso <= exact_end:
        mode = "exact_xkrx"
        warning = None
    elif end_iso < exact_start or start_iso > exact_end:
        mode = "weekday_fallback"
        warning = f"{exact_end} 이후(또는 {exact_start} 이전)는 확정 XKRX 휴장일 데이터 범위 밖이라 평일 기준을 사용함"
    else:
        mode = "mixed"
        warning = f"{exact_start}~{exact_end}는 XKRX 정확 거래일, 범위 밖 날짜는 평일 기준을 함께 사용함"
    return {"mode": mode, "exact_range": [exact_start, exact_end], "warning": warning}


def _is_market_day(day_value: date) -> bool:
    # Runtime stays lightweight: exact XKRX sessions are precomputed. Outside
    # their explicit coverage we retain the old weekday fallback, but now expose
    # that precision downgrade in the response instead of silently implying exactness.
    sessions, exact_start, exact_end = _krx_calendar_data()
    iso = day_value.isoformat()
    if sessions and exact_start and exact_end and exact_start <= iso <= exact_end:
        return iso in sessions
    return day_value.weekday() < 5
'''
assert old in s, 'krx calendar anchor missing'
s = s.replace(old, new, 1)

old = '''    market_info = {
        "has_open_session": bool(market_rows),
        "session_count": len(market_rows),
        "session_dates": [r["date"] for r in market_rows],
    }
'''
new = '''    market_precision = _krx_calendar_precision(start_date, end_date)
    market_info = {
        "has_open_session": bool(market_rows),
        "session_count": len(market_rows),
        "session_dates": [r["date"] for r in market_rows],
        "calendar_mode": market_precision["mode"],
        "calendar_exact_range": market_precision["exact_range"],
        "calendar_warning": market_precision["warning"],
    }
'''
assert old in s, 'market info anchor missing'
s = s.replace(old, new, 1)
int_path.write_text(s, encoding='utf-8')

# ---- relationship engine: dual Whole Sign + Placidus house overlays ----
rel_path = Path('relationship_western_v1.py')
r = rel_path.read_text(encoding='utf-8')
r = r.replace('ENGINE_VERSION = "relationship-western-v1.3-dual-chart-timing"', 'ENGINE_VERSION = "relationship-western-v1.4-dual-house-audit"', 1)

old = '''def _angles(jd, lat, lon):
    if lat is None or lon is None:
        return {}
    cusps, ascmc = swe.houses(float(jd), float(lat), float(lon), b"P")
    return {
        "ASC": round(_norm(ascmc[0]), 6),
        "MC": round(_norm(ascmc[1]), 6),
        "DSC": round(_norm(ascmc[0] + 180.0), 6),
        "IC": round(_norm(ascmc[1] + 180.0), 6),
        "cusps": [round(_norm(x), 6) for x in cusps],
    }
'''
new = '''def _angles(jd, lat, lon):
    if lat is None or lon is None:
        return {}
    placidus_cusps, ascmc = swe.houses(float(jd), float(lat), float(lon), b"P")
    asc = _norm(ascmc[0])
    asc_sign = int(asc // 30.0)
    whole_cusps = [float(((asc_sign + i) % 12) * 30.0) for i in range(12)]
    placidus = [round(_norm(x), 6) for x in placidus_cusps]
    return {
        "ASC": round(asc, 6),
        "MC": round(_norm(ascmc[1]), 6),
        "DSC": round(_norm(ascmc[0] + 180.0), 6),
        "IC": round(_norm(ascmc[1] + 180.0), 6),
        # `cusps` remains a backward-compatible Placidus alias.
        "cusps": placidus,
        "placidus_cusps": placidus,
        "whole_cusps": whole_cusps,
    }
'''
assert old in r, 'relationship angles anchor missing'
r = r.replace(old, new, 1)

anchor = '''def _house_of_longitude(cusps, longitude):
    if not cusps or len(cusps) < 12:
        return None
    lon = _norm(longitude)
    for idx in range(12):
        start = _norm(cusps[idx])
        end = _norm(cusps[(idx + 1) % 12])
        arc = (end - start) % 360.0
        pos = (lon - start) % 360.0
        if pos < arc or abs(pos - arc) < 1e-9:
            return idx + 1
    return None


'''
assert anchor in r, 'house helper anchor missing'
r = r.replace(anchor, anchor + '''def _whole_sign_house(asc_longitude, longitude):
    asc_sign = int(_norm(asc_longitude) // 30.0)
    planet_sign = int(_norm(longitude) // 30.0)
    return (planet_sign - asc_sign) % 12 + 1


''', 1)

old = '''def _house_overlays(source_chart, target_chart, source_label, target_label):
    cusps = (target_chart.get("angles") or {}).get("cusps")
    if not cusps:
        return {"available": False, "reason": f"{target_label} exact birth time/place required for house overlays"}
    rows=[]
    for planet, info in (source_chart.get("positions") or {}).items():
        house=_house_of_longitude(cusps, info["lon"])
        if house:
            rows.append({"source": source_label, "planet": planet, "target": target_label, "house": house})
    priority={4:0,5:1,7:2,8:3,1:4,10:5}
    rows.sort(key=lambda x:(priority.get(x["house"],9), x["house"], x["planet"]))
    return {
        "available": True,
        "all": rows,
        "relationship_houses": [x for x in rows if x["house"] in {4,5,7,8}],
        "note": "4=가정/정서적 기반, 5=연애/즐거움, 7=파트너십, 8=친밀감/공유자원. 사건 보장이나 궁합 점수가 아님",
    }
'''
new = '''def _house_overlays(source_chart, target_chart, source_label, target_label):
    angles = target_chart.get("angles") or {}
    placidus_cusps = angles.get("placidus_cusps") or angles.get("cusps")
    asc = angles.get("ASC")
    if not placidus_cusps or asc is None:
        return {"available": False, "reason": f"{target_label} exact birth time/place required for house overlays"}
    rows=[]
    for planet, info in (source_chart.get("positions") or {}).items():
        placidus_house = _house_of_longitude(placidus_cusps, info["lon"])
        whole_house = _whole_sign_house(asc, info["lon"])
        if placidus_house or whole_house:
            rows.append({
                "source": source_label,
                "planet": planet,
                "target": target_label,
                # backward-compatible field; new consumers should use both fields below.
                "house": placidus_house,
                "placidus_house": placidus_house,
                "whole_house": whole_house,
            })
    relationship_houses = {4,5,7,8}
    priority={4:0,5:1,7:2,8:3,1:4,10:5}
    rows.sort(key=lambda x:(min(priority.get(x.get("whole_house"),9), priority.get(x.get("placidus_house"),9)), x["planet"]))
    return {
        "available": True,
        "systems": ["Whole Sign", "Placidus"],
        "all": rows,
        "relationship_houses": [x for x in rows if x.get("whole_house") in relationship_houses or x.get("placidus_house") in relationship_houses],
        "note": "Whole Sign(홀사인)과 Placidus(플라시두스)를 병행. 4=가정/정서적 기반, 5=연애/즐거움, 7=파트너십, 8=친밀감/공유자원. 두 체계가 다르면 각각 분리해서 읽고 사건 보장/궁합 점수로 합산하지 않음",
    }
'''
assert old in r, 'house overlay anchor missing'
r = r.replace(old, new, 1)
r = r.replace('"house_system": "Placidus for exact-time natal/Davison/Marks charts",', '"house_system": "Whole Sign + Placidus for exact-time natal/Davison/Marks charts",', 1)
r = r.replace('"Exact-time Placidus house overlays available."', '"Exact-time Whole Sign + Placidus house overlays available."', 1)
rel_path.write_text(r, encoding='utf-8')

# ---- AI relationship source: teach the interpreter to preserve both house systems (source only; do not deploy here) ----
edge_path = Path('supabase/functions/relationship-interpret-v9-preview/index.ts')
if edge_path.exists():
    e = edge_path.read_text(encoding='utf-8')
    needle = '- 생시 미상으로 제거된 Moon(달)·각도점·하우스는 추측하지 않는다. 사용 가능하지 않은 Davison(데이비슨)·Marks(마크스)도 추측 금지.\n'
    addition = needle + '- 정확 생시에서 house_overlays의 whole_house(홀사인)와 placidus_house(플라시두스)를 둘 다 읽는다. 둘이 같은 하우스를 가리키면 중첩 근거로, 다르면 각 체계의 의미를 분리해 설명하며 한 체계로 덮어쓰거나 임의 평균하지 않는다.\n'
    assert needle in e, 'edge house prompt anchor missing'
    e = e.replace(needle, addition, 1)
    edge_path.write_text(e, encoding='utf-8')

# ---- frontend: expose market-calendar precision and dual house overlays to user ----
app_path = Path('web/src/AppNext.tsx')
a = app_path.read_text(encoding='utf-8')

# Extend relationship response type.
needle = '    natal_synastry?: { available: boolean; partner_time_exact: boolean; aspects: Aspect[]; note?: string }\n'
assert needle in a, 'relationship type anchor missing'
a = a.replace(needle, needle + '''    house_overlays?: {
      available: boolean
      precision_note?: string
      user_in_counterpart?: { available: boolean; relationship_houses?: Array<{ source:string; planet:string; target:string; house?:number|null; placidus_house?:number|null; whole_house?:number|null }> }
      counterpart_in_user?: { available: boolean; relationship_houses?: Array<{ source:string; planet:string; target:string; house?:number|null; placidus_house?:number|null; whole_house?:number|null }> }
    }
''', 1)

# Extend market type.
old = '    market?: { has_open_session: boolean; session_count: number; session_dates: string[] }\n'
new = '    market?: { has_open_session: boolean; session_count: number; session_dates: string[]; calendar_mode?: string; calendar_exact_range?: string[] | null; calendar_warning?: string | null }\n'
assert old in a, 'market type anchor missing'
a = a.replace(old, new, 1)

# Missing emoji for contact topic.
a = a.replace("연애:'💗',재회:'🪐'", "연애:'💗',연락:'💌',재회:'🪐'", 1)

# Add transparent market precision notice below Western score policy.
needle = '                <p className="result-note">{integratedResult.western.score_policy} · {integratedResult.western.ephemeris}</p>\n'
assert needle in a, 'integrated result note anchor missing'
a = a.replace(needle, needle + '''                {integratedResult.western.market?.calendar_warning && <div className="status-banner subtle"><AlertTriangle size={16}/><span>KRX 거래일 정밀도: {integratedResult.western.market.calendar_warning}</span></div>}
''', 1)

# Add direct dual-house evidence before generic relationship evidence details.
needle = '              <RelationshipInterpretationPanel aspects={natalAspects} partnerExact={Boolean(relationshipResult.result.natal_synastry?.partner_time_exact)} ai={relationshipAi} aiLoading={relationshipAiLoading} aiError={relationshipAiError} onAi={runRelationshipAi} analysisMode={selectedTool===\'marriage\'?`marriage_${marriageMode}`:relationshipPurpose} />\n'
assert needle in a, 'relationship interpretation anchor missing'
dual_house_ui = needle + '''              {partnerTimeExact&&relationshipResult.result.house_overlays?.available&&<section className="result-card"><div className="result-card-title"><span>HOUSE OVERLAY</span><strong>홀사인 + 플라시두스 관계 하우스</strong></div><p className="result-note">한 체계로 덮어쓰지 않고 둘 다 보여줘. 숫자가 다르면 서로 다른 해석층이고, 같으면 중첩 근거로 봐.</p><div className="month-list">{[
                {title:'내 행성 → 상대 하우스',rows:relationshipResult.result.house_overlays.user_in_counterpart?.relationship_houses??[]},
                {title:'상대 행성 → 내 하우스',rows:relationshipResult.result.house_overlays.counterpart_in_user?.relationship_houses??[]},
              ].map((group)=><div className="month-card" key={group.title}><div className="month-title"><strong>{group.title}</strong><span>{group.rows.length}개 관계 하우스 접점</span></div>{group.rows.slice(0,12).map((row,index)=><div className="tight-row" key={`${group.title}-${row.planet}-${index}`}><span>{planetLabels[row.planet]??row.planet}</span><b>홀사인 {row.whole_house??'—'}H · 플라시두스 {row.placidus_house??row.house??'—'}H</b></div>)}</div>)}</div></section>}
'''
a = a.replace(needle, dual_house_ui, 1)
app_path.write_text(a, encoding='utf-8')

print('Applied branch-only annual cache, KRX precision, dual-house, AI-source and UI audit fixes.')
