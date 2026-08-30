from pathlib import Path
import re

# ---------------------------------------------------------------------------
# integrated_fortune_v1.py: vector prewarm + Thai period layer
# ---------------------------------------------------------------------------
p = Path('integrated_fortune_v1.py')
s = p.read_text(encoding='utf-8')
s = s.replace('import calendar\nimport json\n', 'import calendar\nimport json\nimport os\nimport threading\n', 1)
s = s.replace('from skyfield.framelib import ecliptic_frame\n', 'from skyfield.framelib import ecliptic_frame\nfrom thai_astrology_v2 import ENGINE_VERSION as THAI_ENGINE_VERSION, build_thai_fortune\n', 1)
s = s.replace('ENGINE_VERSION = "integrated-fortune-v2.5-ephemeris-cache-audit"', 'ENGINE_VERSION = "integrated-fortune-v2.6-vector-prewarm-thai"', 1)
s = s.replace('WESTERN_ENGINE_VERSION = "western-period-engine-v8-ephemeris-cache-audit"', 'WESTERN_ENGINE_VERSION = "western-period-engine-v9-vector-prewarm"', 1)
s = s.replace('THAI_ENGINE_VERSION = "thai-weekday-baseline-v1"\n', '', 1)

old_planet = '''@lru_cache(maxsize=60000)\ndef _planet_lon(body_name: str, dt_aware: datetime):\n    # Deterministic astronomical lookup. Annual scans revisit many identical\n    # timestamps across life/market scans and applying/separating windows.\n    _, _, earth, targets, _, _, _ = _ephemeris_bundle()\n    apparent = earth.at(_sf_time(dt_aware)).observe(targets[body_name]).apparent()\n    _, lon, _ = apparent.frame_latlon(ecliptic_frame)\n    return float(lon.degrees % 360.0)\n'''
new_planet = '''_PLANET_PREWARM_LOCAL = threading.local()\n\n\n@lru_cache(maxsize=60000)\ndef _planet_lon(body_name: str, dt_aware: datetime):\n    # Deterministic astronomical lookup. Long annual scans can install a\n    # thread-local vectorized prewarm table; individual calls still pass through\n    # this exact function and then enter the normal LRU cache.\n    key = (body_name, dt_aware.astimezone(timezone.utc))\n    prewarm = getattr(_PLANET_PREWARM_LOCAL, "values", None)\n    if isinstance(prewarm, dict) and key in prewarm:\n        return float(prewarm[key])\n    _, _, earth, targets, _, _, _ = _ephemeris_bundle()\n    apparent = earth.at(_sf_time(dt_aware)).observe(targets[body_name]).apparent()\n    _, lon, _ = apparent.frame_latlon(ecliptic_frame)\n    return float(lon.degrees % 360.0)\n'''
assert old_planet in s, 'planet_lon anchor missing'
s = s.replace(old_planet, new_planet, 1)

motion_anchor = '''def _motion_window_hours(body: str):\n    if body == "Moon":\n        return .25\n    if body in {"Sun", "Mercury", "Venus", "Mars"}:\n        return 1.0\n    return 6.0\n'''
vector_helpers = motion_anchor + '''\n\ndef _vectorized_planet_longitudes(body_name: str, moments: list[datetime]) -> dict[tuple[str, datetime], float]:\n    if not moments:\n        return {}\n    unique = sorted({m.astimezone(timezone.utc) for m in moments})\n    ts, _, earth, targets, _, _, _ = _ephemeris_bundle()\n    sf_times = ts.from_datetimes(unique)\n    apparent = earth.at(sf_times).observe(targets[body_name]).apparent()\n    _, lon, _ = apparent.frame_latlon(ecliptic_frame)\n    raw = lon.degrees\n    values = list(raw) if hasattr(raw, "__iter__") else [raw]\n    return {(body_name, moment): float(value % 360.0) for moment, value in zip(unique, values)}\n\n\ndef _install_period_ephemeris_prewarm(start_date: date, end_date: date, offset_hours: float) -> int:\n    # The legacy period sampling policy is preserved exactly. Only the expensive\n    # Skyfield ephemeris lookup is batched by planet/timestamp before the same\n    # scalar scoring functions consume it. Disable with ASTRO_DISABLE_VECTOR_PREWARM=1\n    # for regression comparison.\n    _PLANET_PREWARM_LOCAL.values = {}\n    if os.getenv("ASTRO_DISABLE_VECTOR_PREWARM", "").strip() == "1":\n        return 0\n    day_count = (end_date - start_date).days + 1\n    if day_count <= 1:\n        return 0\n\n    dynamic_queries: set[datetime] = set()\n    static_queries: set[datetime] = set()\n    for i in range(day_count):\n        day_value = start_date + timedelta(days=i)\n        life = _make_time_points(day_value, dt_time(8, 0), dt_time(22, 0), 120, offset_hours)\n        if life:\n            dynamic_queries.update(x.astimezone(timezone.utc) for x in life)\n            static_queries.add(life[len(life) // 2].astimezone(timezone.utc))\n        if _is_market_day(day_value):\n            market = _make_time_points(day_value, dt_time(9, 0), dt_time(15, 30), 60, offset_hours)\n            if market:\n                dynamic_queries.update(x.astimezone(timezone.utc) for x in market)\n                static_queries.add(market[len(market) // 2].astimezone(timezone.utc))\n\n    table: dict[tuple[str, datetime], float] = {}\n    for body in ("Sun", "Moon", "Mercury", "Venus", "Mars"):\n        h = timedelta(hours=_motion_window_hours(body))\n        needed = []\n        for moment in dynamic_queries:\n            needed.extend((moment, moment - h, moment + h))\n        table.update(_vectorized_planet_longitudes(body, needed))\n    for body in ("Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"):\n        h = timedelta(hours=_motion_window_hours(body))\n        needed = []\n        for moment in static_queries:\n            needed.extend((moment, moment - h, moment + h))\n        table.update(_vectorized_planet_longitudes(body, needed))\n    _PLANET_PREWARM_LOCAL.values = table\n    return len(table)\n\n\ndef _clear_period_ephemeris_prewarm() -> None:\n    _PLANET_PREWARM_LOCAL.values = {}\n'''
assert motion_anchor in s, 'motion anchor missing'
s = s.replace(motion_anchor, vector_helpers, 1)

needle = '''    day_count = (end_date - start_date).days + 1\n    detail_days = []\n'''
replacement = '''    day_count = (end_date - start_date).days + 1\n    prewarmed_longitudes = _install_period_ephemeris_prewarm(start_date, end_date, float(utc_offset_hours))\n    detail_days = []\n'''
assert needle in s, 'western prewarm insert anchor missing'
s = s.replace(needle, replacement, 1)

return_anchor = '''    _, _, _, _, _, ephemeris_used, fallback_reason = _ephemeris_bundle()\n    return {\n'''
return_replacement = '''    _, _, _, _, _, ephemeris_used, fallback_reason = _ephemeris_bundle()\n    _clear_period_ephemeris_prewarm()\n    return {\n'''
assert return_anchor in s, 'western clear anchor missing'
s = s.replace(return_anchor, return_replacement, 1)

method_anchor = '''        "method": ("이전 Streamlit 일일엔진과 동일: 생활점수 07:00~23:30/30분, 시간탐색 00:00~23:30/30분, KRX 09:00~15:30/15분" if day_count == 1 else "이전 Streamlit 기간엔진과 동일: 생활 08:00~22:00/120분, KRX 09:00~15:30/60분"),\n'''
method_replacement = method_anchor + '''        "performance": {"vector_ephemeris_prewarm": bool(prewarmed_longitudes), "prewarmed_longitudes": prewarmed_longitudes},\n'''
assert method_anchor in s, 'performance metadata anchor missing'
s = s.replace(method_anchor, method_replacement, 1)

# Replace the old weekday-only Thai payload with the verified independent module.
s, n = re.subn(
    r'def _thai_payload\(birth_date: date, birth_time: dt_time\):\n.*?\n\ndef build_integrated_fortune\(',
    'def _thai_payload(birth_date: date, birth_time: dt_time, start_date: date, end_date: date):\n    return build_thai_fortune(birth_date, birth_time, start_date, end_date)\n\n\ndef build_integrated_fortune(',
    s,
    count=1,
    flags=re.S,
)
assert n == 1, f'thai payload replace count={n}'
s = s.replace('thai = _thai_payload(birth_date, birth_time)', 'thai = _thai_payload(birth_date, birth_time, start_date, end_date)', 1)
p.write_text(s, encoding='utf-8')

# ---------------------------------------------------------------------------
# api/main.py: dedupe same calculation request while process is alive
# ---------------------------------------------------------------------------
p = Path('api/main.py')
s = p.read_text(encoding='utf-8')
s = s.replace('import os\nimport threading\n', 'import hashlib\nimport json\nimport os\nimport threading\n', 1)
s = s.replace('APP_VERSION = "api-fortune-v4.9-full-year-reunion-hardening"', 'APP_VERSION = "api-fortune-v5.0-dedup-thai-period"', 1)
s = s.replace('_calc_jobs: dict[str, dict] = {}\n_calc_jobs_lock = threading.Lock()\n', '_calc_jobs: dict[str, dict] = {}\n_calc_jobs_lock = threading.Lock()\n_calc_request_index: dict[str, str] = {}\n', 1)

prune_old = '''def _prune_jobs(store: dict, lock: threading.Lock):\n    cutoff = time.time() - _JOB_TTL_SECONDS\n    with lock:\n        stale = [key for key, value in store.items() if float(value.get("created_ts", 0)) < cutoff]\n        for key in stale:\n            store.pop(key, None)\n'''
prune_new = '''def _prune_jobs(store: dict, lock: threading.Lock):\n    cutoff = time.time() - _JOB_TTL_SECONDS\n    with lock:\n        stale = [key for key, value in store.items() if float(value.get("created_ts", 0)) < cutoff]\n        for key in stale:\n            store.pop(key, None)\n        if store is _calc_jobs:\n            live = set(store)\n            for request_key, job_id in list(_calc_request_index.items()):\n                if job_id not in live:\n                    _calc_request_index.pop(request_key, None)\n\n\ndef _calc_request_key(payload: dict) -> str:\n    normalized = {\n        key: value.isoformat() if hasattr(value, "isoformat") else value\n        for key, value in payload.items()\n    }\n    raw = json.dumps(normalized, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")\n    return hashlib.sha256(raw).hexdigest()\n'''
assert prune_old in s, 'prune anchor missing'
s = s.replace(prune_old, prune_new, 1)

start_pattern = re.compile(r'@app\.post\("/v1/fortune/integrated/start"\)\ndef fortune_integrated_start\(request: IntegratedFortuneRequest\) -> dict:\n.*?\n\n@app\.get\("/v1/fortune/integrated/jobs/\{job_id\}"\)', re.S)
start_new = '''@app.post("/v1/fortune/integrated/start")\ndef fortune_integrated_start(request: IntegratedFortuneRequest) -> dict:\n    _prune_jobs(_calc_jobs, _calc_jobs_lock)\n    profile = request.profile\n    payload = {\n        "birth_date": profile.birth_date,\n        "birth_time": profile.birth_time,\n        "latitude": profile.latitude,\n        "longitude": profile.longitude,\n        "utc_offset_hours": profile.utc_offset_hours,\n        "gender": profile.gender,\n        "start_date": request.start_date,\n        "end_date": request.end_date,\n    }\n    request_key = _calc_request_key(payload)\n    with _calc_jobs_lock:\n        existing_id = _calc_request_index.get(request_key)\n        existing = _calc_jobs.get(existing_id or "") if existing_id else None\n        if existing and existing.get("status") in {"queued", "running", "done"}:\n            return {"ok": True, "job_id": existing_id, "status": existing.get("status"), "reused": True}\n        job_id = uuid.uuid4().hex\n        _calc_jobs[job_id] = {"created_ts": time.time(), "status": "queued", "request_key": request_key}\n        _calc_request_index[request_key] = job_id\n    threading.Thread(\n        target=_run_calc_job,\n        args=(job_id, payload),\n        daemon=True,\n        name=f"fortune-calc-{job_id[:8]}",\n    ).start()\n    return {"ok": True, "job_id": job_id, "status": "queued", "reused": False}\n\n\n@app.get("/v1/fortune/integrated/jobs/{job_id}")'''
s, n = start_pattern.subn(start_new, s, count=1)
assert n == 1, f'integrated start replace count={n}'
s = s.replace('    job.pop("created_ts", None)\n    return {"job_id": job_id, **job}\n', '    job.pop("created_ts", None)\n    job.pop("request_key", None)\n    return {"job_id": job_id, **job}\n', 1)
p.write_text(s, encoding='utf-8')

# ---------------------------------------------------------------------------
# ai_interpret_v1.py: pass the new Thai facts, never invent Suriyayat
# ---------------------------------------------------------------------------
p = Path('ai_interpret_v1.py')
s = p.read_text(encoding='utf-8')
s = s.replace('AI_INTERPRETER_VERSION = "mobile-ai-v2.1-render-safe"', 'AI_INTERPRETER_VERSION = "mobile-ai-v2.2-thai-period-safe"', 1)
old = '        "thai": {k: thai.get(k) for k in ("ok", "engine", "thai_day", "ruler", "rule", "predictive_status", "consensus_policy") if k in thai},\n'
new = '''        "thai": {\n            "ok": thai.get("ok"),\n            "engine": thai.get("engine"),\n            "thai_day": thai.get("thai_day"),\n            "birth_planet": thai.get("birth_planet"),\n            "ruler": thai.get("ruler"),\n            "rule": thai.get("rule"),\n            "mahathaksa": thai.get("mahathaksa"),\n            "taksajorn": thai.get("taksajorn"),\n            "predictive_status": thai.get("predictive_status"),\n            "consensus_policy": thai.get("consensus_policy"),\n            "reliability": thai.get("reliability"),\n            "not_calculated": thai.get("not_calculated"),\n        },\n'''
assert old in s, 'python ai thai compact anchor missing'
s = s.replace(old, new, 1)
s = s.replace('Thai는 predictive_status가 미구현이면 출생요일 baseline과 지배자 성격만 설명하고 날짜별 예측 합의에 섞지 마라.', 'Thai는 mahathaksa와 taksajorn에 실제 데이터가 있을 때만 그 연령 구간과 8궁 배치를 설명한다. not_calculated의 Suriyayat(수리야얏) 행성·라그나·라후/게투는 절대 추정하지 말고, Thai 층을 Western 수치점수처럼 확률화하거나 임의 합산하지 마라.', 1)
s = s.replace('"thai": "Thai baseline의 의미와 예측 한계",', '"thai": "Thai 출생요일·Mahathaksa·Taksajorn의 실제 계산 범위와 Suriyayat 미구현 한계",', 1)
p.write_text(s, encoding='utf-8')

# ---------------------------------------------------------------------------
# Supabase fortune interpreter source (source only; no deployment)
# ---------------------------------------------------------------------------
p = Path('supabase/functions/fortune-interpret/index.ts')
s = p.read_text(encoding='utf-8')
s = s.replace('const INTERPRETER_VERSION = "supabase-ai-v3-evidence-first";', 'const INTERPRETER_VERSION = "supabase-ai-v4-thai-period-safe";', 1)
old = '''    thai: {\n      engine: thai?.engine,\n      thai_day: thai?.thai_day,\n      ruler: thai?.ruler,\n      rule: thai?.rule,\n      predictive_status: thai?.predictive_status,\n      consensus_policy: thai?.consensus_policy,\n    },\n'''
new = '''    thai: {\n      engine: thai?.engine,\n      thai_day: thai?.thai_day,\n      birth_planet: thai?.birth_planet ?? null,\n      ruler: thai?.ruler,\n      rule: thai?.rule,\n      mahathaksa: thai?.mahathaksa ?? null,\n      taksajorn: thai?.taksajorn ?? null,\n      predictive_status: thai?.predictive_status,\n      consensus_policy: thai?.consensus_policy,\n      reliability: thai?.reliability ?? null,\n      not_calculated: Array.isArray(thai?.not_calculated) ? thai.not_calculated : [],\n    },\n'''
assert old in s, 'supabase thai compact anchor missing'
s = s.replace(old, new, 1)
s = s.replace('사주의 not_calculated 항목은 임의 추정하지 마라. Thai predictive_status가 미구현이면 출생요일 baseline만 설명하고 날짜별 합의에 섞지 마라.', '사주의 not_calculated 항목은 임의 추정하지 마라. Thai는 mahathaksa와 taksajorn에 실제로 들어온 연령구간·8궁만 해석하고, not_calculated의 Suriyayat(수리야얏) 행성·라그나·라후/게투를 추정하지 마라. Thai 층을 Western 수치점수처럼 임의 합산하거나 확률화하지 마라.', 1)
s = s.replace('thai: "Thai baseline 의미와 한계",', 'thai: "Thai 출생요일·Mahathaksa·Taksajorn의 실제 범위와 Suriyayat 미구현 한계",', 1)
p.write_text(s, encoding='utf-8')

# ---------------------------------------------------------------------------
# AppNext.tsx: expose Thai period facts in UI/copy/precision panels
# ---------------------------------------------------------------------------
p = Path('web/src/AppNext.tsx')
s = p.read_text(encoding='utf-8')
old_type = '''  thai: {\n    ok: boolean\n    engine: string\n    thai_day: string\n    ruler: string\n    rule: string\n    predictive_status: string\n    consensus_policy: string\n  }\n'''
new_type = '''  thai: {\n    ok: boolean\n    engine: string\n    thai_day: string\n    birth_planet?: { key:string; number:number; thai_name:string; label:string }\n    ruler: string\n    rule: string\n    mahathaksa?: { available:boolean; method:string; wheel:Array<{ bhumi_key:string; bhumi_thai:string; bhumi_label:string; planet:{ key:string; number:number; thai_name:string; label:string } }> }\n    taksajorn?: { available:boolean; method:string; method_variance_note?:string; segments:Array<{ start:string; end:string; age_in_progress:number; annual_boriwan:{ key:string; number:number; thai_name:string; label:string }; landed_center:boolean; wheel:Array<{ bhumi_key:string; bhumi_thai:string; bhumi_label:string; planet:{ key:string; number:number; thai_name:string; label:string } }> }> }\n    predictive_status: string\n    consensus_policy: string\n    reliability?: Record<string,string>\n    not_calculated?: string[]\n  }\n'''
assert old_type in s, 'AppNext thai type anchor missing'
s = s.replace(old_type, new_type, 1)

copy_old = '''  lines.push('', '■ Thai(태국점성술)')\n  lines.push(`- ${result.thai.thai_day} · ${result.thai.ruler}`)\n  lines.push(`- 규칙: ${result.thai.rule}`)\n  lines.push(`- 예측 상태: ${result.thai.predictive_status}`)\n'''
copy_new = '''  lines.push('', '■ Thai(태국점성술)')\n  lines.push(`- ${result.thai.thai_day} · ${result.thai.ruler}`)\n  lines.push(`- 규칙: ${result.thai.rule}`)\n  for (const seg of result.thai.taksajorn?.segments ?? []) lines.push(`- Taksajorn(탁사쫀) ${seg.start}~${seg.end}: 나이 진행 ${seg.age_in_progress} · 연간 Boriwan ${seg.annual_boriwan.label}${seg.landed_center?' (중앙 착지→Jupiter 적용)':''}`)\n  lines.push(`- 예측 상태: ${result.thai.predictive_status}`)\n  if (result.thai.not_calculated?.length) lines.push(`- 미계산: ${result.thai.not_calculated.join(', ')}`)\n'''
assert copy_old in s, 'AppNext copy thai anchor missing'
s = s.replace(copy_old, copy_new, 1)

card_old = '''              <section className="result-card">\n                <div className="result-card-title"><span>THAI</span><strong>태국 점성술 출생요일층</strong></div>\n                <div className="thai-baseline"><strong>{integratedResult.thai.thai_day}</strong><span>{integratedResult.thai.ruler}</span><p>{integratedResult.thai.rule}</p></div>\n                <p className="result-note">Thai transit(태국식 트랜짓)은 아직 구현하지 않았기 때문에 날짜별 예측 합의 점수에는 섞지 않아.</p>\n              </section>\n'''
card_new = '''              <section className="result-card">\n                <div className="result-card-title"><span>THAI</span><strong>Mahathaksa(마하탁사) · Taksajorn(탁사쫀)</strong></div>\n                <div className="thai-baseline"><strong>{integratedResult.thai.thai_day}</strong><span>{integratedResult.thai.ruler}</span><p>{integratedResult.thai.rule}</p></div>\n                {!!integratedResult.thai.taksajorn?.segments?.length && <div className="saju-list">{integratedResult.thai.taksajorn.segments.map((seg)=><div key={`${seg.start}-${seg.end}`}><strong>{seg.start} ~ {seg.end}</strong><span>나이 진행 {seg.age_in_progress} · 연간 Boriwan(브리완) {seg.annual_boriwan.label}{seg.landed_center?' · 중앙 착지 후 Jupiter(목성) 적용':''}</span></div>)}</div>}\n                <p className="result-note">Mahathaksa/Taksajorn은 독립 태국 기간층으로 계산해. Full Suriyayat(수리야얏) 10행성·Lagna(라그나)·태국식 Rahu/Ketu(라후/게투) 트랜짓은 검증 전이라 아직 만들거나 점수에 섞지 않아.</p>\n              </section>\n'''
assert card_old in s, 'AppNext Thai main card anchor missing'
s = s.replace(card_old, card_new, 1)

precision_old = '''              <section className="result-card">\n                <div className="result-card-title"><span>THAI STATUS</span><strong>태국점성술 계산 상태</strong></div>\n                <div className="precision-kpi-grid"><div className="precision-kpi"><span>출생요일</span><strong>{integratedResult.thai.thai_day}</strong></div><div className="precision-kpi"><span>주재 행성</span><strong>{integratedResult.thai.ruler}</strong></div></div>\n                <div className="tight-row"><span>규칙</span><b>{integratedResult.thai.rule}</b></div>\n                <div className="tight-row"><span>예측 구현 상태</span><b>{integratedResult.thai.predictive_status}</b></div>\n                <div className="tight-row"><span>합의 정책</span><b>{integratedResult.thai.consensus_policy}</b></div>\n              </section>\n'''
precision_new = '''              <section className="result-card">\n                <div className="result-card-title"><span>THAI STATUS</span><strong>태국점성술 계산 상태</strong></div>\n                <div className="precision-kpi-grid"><div className="precision-kpi"><span>출생요일</span><strong>{integratedResult.thai.thai_day}</strong></div><div className="precision-kpi"><span>주재 행성</span><strong>{integratedResult.thai.ruler}</strong></div></div>\n                <div className="tight-row"><span>Mahathaksa</span><b>{integratedResult.thai.mahathaksa?.available?'8궁 계산됨':'미계산'}</b></div>\n                <div className="tight-row"><span>Taksajorn</span><b>{integratedResult.thai.taksajorn?.available?'연령 기간 계산됨':'미계산'}</b></div>\n                <div className="tight-row"><span>예측 구현 상태</span><b>{integratedResult.thai.predictive_status}</b></div>\n                <div className="tight-row"><span>합의 정책</span><b>{integratedResult.thai.consensus_policy}</b></div>\n                {integratedResult.thai.taksajorn?.method_variance_note && <p className="result-note">{integratedResult.thai.taksajorn.method_variance_note}</p>}\n                {!!integratedResult.thai.not_calculated?.length && <p className="result-note">아직 미계산: {integratedResult.thai.not_calculated.join(' · ')}</p>}\n              </section>\n'''
assert precision_old in s, 'AppNext Thai precision anchor missing'
s = s.replace(precision_old, precision_new, 1)

summary_old = '''                  <span>Thai <b>{integratedResult.thai.thai_day}</b> · {integratedResult.thai.ruler}</span>\n                </div>\n                <p className="result-note">Thai는 아직 출생요일 baseline만 표시하며 날짜별 예측 점수에는 섞지 않아.</p>\n'''
summary_new = '''                  <span>Thai <b>{integratedResult.thai.thai_day}</b> · {integratedResult.thai.ruler}</span>\n                  {integratedResult.thai.taksajorn?.segments?.[0] && <span>Taksajorn <b>{integratedResult.thai.taksajorn.segments[0].annual_boriwan.label}</b> · 나이 진행 {integratedResult.thai.taksajorn.segments[0].age_in_progress}</span>}\n                </div>\n                <p className="result-note">Thai는 Mahathaksa/Taksajorn 기간층까지 계산하고, 검증 전 Suriyayat 행성 트랜짓은 합의 점수에 섞지 않아.</p>\n'''
assert summary_old in s, 'AppNext Thai summary anchor missing'
s = s.replace(summary_old, summary_new, 1)
p.write_text(s, encoding='utf-8')

print('PATCH_URGENT_HARDENING_V2_APPLIED')
