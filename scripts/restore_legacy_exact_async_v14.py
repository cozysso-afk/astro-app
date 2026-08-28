from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
engine = ROOT / 'integrated_fortune_v1.py'
api = ROOT / 'api' / 'main.py'
front = ROOT / 'web' / 'src' / 'AppNext.tsx'

# ---------------- engine: restore legacy sampling exactly ----------------
s = engine.read_text(encoding='utf-8')
s = s.replace('ENGINE_VERSION = "integrated-fortune-v2.1"', 'ENGINE_VERSION = "integrated-fortune-v2.2-legacy-exact"')
s = s.replace('WESTERN_ENGINE_VERSION = "western-period-engine-v5-compatible"', 'WESTERN_ENGINE_VERSION = "western-period-engine-v5-legacy-exact"')

start = s.index('@lru_cache(maxsize=5000)\ndef _daily_aggregate_cached')
end = s.index('\n\ndef _score_band', start)
replacement = r'''@lru_cache(maxsize=5000)
def _daily_aggregate_cached(day_iso: str, natal_packed: tuple, houses_packed: tuple, offset_hours: float):
    """Legacy Streamlit period aggregation, unchanged in sampling policy.

    Life topics: 08:00~22:00, 120-minute samples.
    KRX investment derivatives: 09:00~15:30, 60-minute samples, open sessions only.
    """
    day_value = date.fromisoformat(day_iso)
    natal_lons = _unpack_natal_lons(natal_packed)
    natal_houses = _unpack_houses(houses_packed)
    life = _scan_intraday(day_value, dt_time(8, 0), dt_time(22, 0), 120, natal_lons, natal_houses, offset_hours)
    market = _scan_intraday(day_value, dt_time(9, 0), dt_time(15, 30), 60, natal_lons, natal_houses, offset_hours) if _is_market_day(day_value) else []
    row = {
        "date": day_value.isoformat(),
        "label": f"{day_value.month}/{day_value.day}({WEEKDAY_KO[day_value.weekday()]})",
        "market_open": bool(market),
    }
    for key in ["금전", "학업", "시험", "직장", "이직", "연애", "연락", "재회", "소식", "컨디션", "수신신호", "발신적합", "과거인연접점"]:
        row[key] = _rows_avg(life, key)
    row["투자심리"] = _rows_avg(market, "투자심리") if market else None
    for key in ["수익실현", "신규진입", "투자주의"]:
        row[key] = _rows_avg(market, key) if market else None
    return row


def _aggregate_topic_result(rows: list[dict], topic: str) -> dict:
    results = [((row.get("topics") or {}).get(topic)) for row in rows]
    results = [x for x in results if isinstance(x, dict)]
    if not results:
        return {"topic": topic, "activation": 0, "favorability": 50, "layers": [], "evidence": []}
    activation = int(round(sum(float(r.get("activation", 0)) for r in results) / len(results)))
    favorability = int(round(sum(float(r.get("favorability", 50)) for r in results) / len(results)))
    layers = sorted({layer for r in results for layer in (r.get("layers") or [])})
    evidence = []
    for r in results:
        evidence.extend(r.get("evidence") or [])
    evidence.sort(key=lambda x: float(x.get("score", 0)) if isinstance(x, dict) else 0.0, reverse=True)
    return {"topic": topic, "activation": activation, "favorability": favorability, "layers": layers, "evidence": evidence[:8]}


def _window_with_step(rows: list[dict], key: str, size: int = 3):
    usable = [row for row in rows if isinstance(row.get(key), (int, float)) and row.get("dt") is not None]
    if not usable:
        return None, None
    size = max(1, min(size, len(usable)))
    step = (usable[1]["dt"] - usable[0]["dt"]) if len(usable) > 1 else timedelta(minutes=30)
    windows = []
    for i in range(len(usable) - size + 1):
        chunk = usable[i:i + size]
        avg = sum(float(r[key]) for r in chunk) / len(chunk)
        windows.append((avg, chunk[0]["dt"], chunk[-1]["dt"] + step))
    def pack(item):
        avg, start_dt, end_dt = item
        return {"start": start_dt.strftime("%H:%M"), "end": end_dt.strftime("%H:%M"), "score": round(avg, 1)}
    return pack(max(windows, key=lambda x: x[0])), pack(min(windows, key=lambda x: x[0]))


def _legacy_detail(day_value: date, timing_rows: list[dict], market_rows: list[dict]):
    details = {}
    for key in ["금전", "학업", "시험", "직장", "이직", "연애", "연락", "재회", "소식", "컨디션"]:
        best, worst = _window_with_step(timing_rows, key, 3)
        if not best:
            continue
        evidence = []
        scored = [r for r in timing_rows if isinstance(r.get(key), (int, float))]
        if scored:
            peak = max(scored, key=lambda r: float(r.get(key, 0)))
            raw = ((peak.get("topics") or {}).get(key) or {}).get("evidence") or []
            evidence = [_evidence_text(x) for x in raw[:6]]
        details[key] = {"best_window": best, "caution_window": worst, "evidence": evidence}
    if market_rows:
        for key in ["투자심리", "수익실현", "신규진입", "투자주의"]:
            best, worst = _window_with_step(market_rows, key, 3)
            if not best:
                continue
            evidence = []
            scored = [r for r in market_rows if isinstance(r.get(key), (int, float))]
            if scored:
                peak = max(scored, key=lambda r: float(r.get(key, 0)))
                bases = [key] if key in TOPIC_SPECS else ["금전", "투자심리"]
                for base_key in bases:
                    raw = ((peak.get("topics") or {}).get(base_key) or {}).get("evidence") or []
                    evidence.extend(_evidence_text(x) for x in raw[:3])
            details[key] = {"best_window": best, "caution_window": worst, "evidence": evidence[:6]}
    return {"date": day_value.isoformat(), "market_open": bool(market_rows), "topics": details}


@lru_cache(maxsize=64)
def _daily_detailed_cached(day_iso: str, natal_packed: tuple, houses_packed: tuple, offset_hours: float):
    """Exact legacy daily policy used by the Streamlit report.

    Scores: 07:00~23:30 every 30 minutes.
    Timing search: 00:00~23:30 every 30 minutes.
    KRX investment: 09:00~15:30 every 15 minutes.
    """
    day_value = date.fromisoformat(day_iso)
    natal_lons = _unpack_natal_lons(natal_packed)
    natal_houses = _unpack_houses(houses_packed)
    life = _scan_intraday(day_value, dt_time(7, 0), dt_time(23, 30), 30, natal_lons, natal_houses, offset_hours)
    early = _scan_intraday(day_value, dt_time(0, 0), dt_time(6, 30), 30, natal_lons, natal_houses, offset_hours)
    timing = early + life
    market = _scan_intraday(day_value, dt_time(9, 0), dt_time(15, 30), 15, natal_lons, natal_houses, offset_hours) if _is_market_day(day_value) else []
    row = {
        "date": day_value.isoformat(),
        "label": f"{day_value.month}/{day_value.day}({WEEKDAY_KO[day_value.weekday()]})",
        "market_open": bool(market),
    }
    for key in ["금전", "학업", "시험", "직장", "이직", "연애", "연락", "재회", "소식", "컨디션"]:
        row[key] = _rows_avg(life, key)
    aggregated = {topic: _aggregate_topic_result(life, topic) for topic in TOPIC_SPECS}
    row.update(_relationship_direction_scores(aggregated))
    row["투자심리"] = _rows_avg(market, "투자심리") if market else None
    for key in ["수익실현", "신규진입", "투자주의"]:
        row[key] = _rows_avg(market, key) if market else None
    return {"row": row, "detail": _legacy_detail(day_value, timing, market)}
'''
s = s[:start] + replacement + s[end:]

s = s.replace(
    '"method": ("단일일은 07:30~23:00 90분 간격 단일 패스로 평균+시간창을 함께 산출" if day_count == 1 else "다일 기간은 하루 08:00~22:00 120분 간격으로 집계하고 날짜별 강약을 비교"),',
    '"method": ("이전 Streamlit 일일엔진과 동일: 생활점수 07:00~23:30/30분, 시간탐색 00:00~23:30/30분, KRX 09:00~15:30/15분" if day_count == 1 else "이전 Streamlit 기간엔진과 동일: 생활 08:00~22:00/120분, KRX 09:00~15:30/60분"),'
)
engine.write_text(s, encoding='utf-8')

# ---------------- API: async jobs for long calculation and Gemini ----------------
s = api.read_text(encoding='utf-8')
s = s.replace('import os\n', 'import os\nimport threading\nimport time\nimport uuid\n', 1)
s = s.replace('from fastapi import FastAPI, HTTPException', 'from fastapi import BackgroundTasks, FastAPI, HTTPException')
s = s.replace('APP_VERSION = "api-fortune-v4.1"', 'APP_VERSION = "api-fortune-v4.2-async"')
anchor = 'class IntegratedInterpretRequest(BaseModel):\n    calculation: dict\n    model: str = AI_DEFAULT_MODEL\n\n'
insert = anchor + '''\n_ai_jobs: dict[str, dict] = {}\n_ai_jobs_lock = threading.Lock()\n_calc_jobs: dict[str, dict] = {}\n_calc_jobs_lock = threading.Lock()\n_JOB_TTL_SECONDS = 1800\n\ndef _prune_jobs(store: dict, lock: threading.Lock):\n    cutoff = time.time() - _JOB_TTL_SECONDS\n    with lock:\n        stale = [key for key, value in store.items() if float(value.get("created_ts", 0)) < cutoff]\n        for key in stale:\n            store.pop(key, None)\n\ndef _run_ai_job(job_id: str, calculation: dict, model: str):\n    try:\n        result = interpret_integrated_fortune(calculation, model)\n        with _ai_jobs_lock:\n            if job_id in _ai_jobs:\n                _ai_jobs[job_id].update({"status": "done", "result": result, "completed_ts": time.time()})\n    except Exception as exc:\n        with _ai_jobs_lock:\n            if job_id in _ai_jobs:\n                _ai_jobs[job_id].update({"status": "failed", "error": f"{type(exc).__name__}: {exc}", "completed_ts": time.time()})\n\ndef _calculate_integrated_payload(request: IntegratedFortuneRequest) -> dict:\n    if request.end_date < request.start_date:\n        raise ValueError("end_date must be on or after start_date")\n    if (request.end_date - request.start_date).days > 365:\n        raise ValueError("integrated fortune range is limited to 366 days per request")\n    profile = request.profile\n    result = build_integrated_fortune(\n        birth_date=profile.birth_date, birth_time=profile.birth_time, latitude=profile.latitude, longitude=profile.longitude,\n        utc_offset_hours=profile.utc_offset_hours, gender=profile.gender, start_date=request.start_date, end_date=request.end_date,\n    )\n    return {**result, "api_version": APP_VERSION, "profile": {"name": profile.name or None, "gender": profile.gender, "birth_date": profile.birth_date.isoformat(), "birth_time": profile.birth_time.isoformat(), "location_supplied": True, "utc_offset_hours": profile.utc_offset_hours}}\n\ndef _run_calc_job(job_id: str, payload: dict):\n    try:\n        request = IntegratedFortuneRequest.model_validate(payload)\n        result = _calculate_integrated_payload(request)\n        with _calc_jobs_lock:\n            if job_id in _calc_jobs:\n                _calc_jobs[job_id].update({"status": "done", "result": result, "completed_ts": time.time()})\n    except Exception as exc:\n        with _calc_jobs_lock:\n            if job_id in _calc_jobs:\n                _calc_jobs[job_id].update({"status": "failed", "error": f"{type(exc).__name__}: {exc}", "completed_ts": time.time()})\n\n'''
if anchor not in s:
    raise SystemExit('API model anchor missing')
s = s.replace(anchor, insert, 1)

# keep synchronous calculation endpoint for compatibility, but centralize implementation
old_calc = re.compile(r'@app\.post\("/v1/fortune/integrated"\)\ndef integrated_fortune\(request: IntegratedFortuneRequest\) -> dict:\n.*?\n\n@app\.get\("/v1/fortune/ai-meta"\)', re.S)
new_calc = '''@app.post("/v1/fortune/integrated")\ndef integrated_fortune(request: IntegratedFortuneRequest) -> dict:\n    try:\n        return _calculate_integrated_payload(request)\n    except ValueError as exc:\n        raise HTTPException(status_code=422, detail=str(exc)) from exc\n    except Exception as exc:\n        raise HTTPException(status_code=500, detail=f"integrated fortune calculation failed: {exc}") from exc\n\n\n@app.post("/v1/fortune/integrated/start", status_code=202)\ndef integrated_fortune_start(request: IntegratedFortuneRequest, background_tasks: BackgroundTasks) -> dict:\n    _prune_jobs(_calc_jobs, _calc_jobs_lock)\n    if request.end_date < request.start_date or (request.end_date - request.start_date).days > 365:\n        raise HTTPException(status_code=422, detail="invalid integrated fortune range")\n    job_id = uuid.uuid4().hex\n    with _calc_jobs_lock:\n        _calc_jobs[job_id] = {"status": "queued", "created_ts": time.time()}\n    background_tasks.add_task(_run_calc_job, job_id, request.model_dump(mode="json"))\n    return {"ok": True, "job_id": job_id, "status": "queued"}\n\n\n@app.get("/v1/fortune/integrated/jobs/{job_id}")\ndef integrated_fortune_job(job_id: str) -> dict:\n    _prune_jobs(_calc_jobs, _calc_jobs_lock)\n    with _calc_jobs_lock:\n        item = dict(_calc_jobs.get(job_id) or {})\n    if not item:\n        raise HTTPException(status_code=404, detail="calculation job not found")\n    out = {"ok": item.get("status") != "failed", "job_id": job_id, "status": item.get("status")}\n    if item.get("status") == "done": out["result"] = item.get("result")\n    if item.get("status") == "failed": out["error"] = item.get("error")\n    return out\n\n\n@app.get("/v1/fortune/ai-meta")'''
s, n = old_calc.subn(new_calc, s, count=1)
if n != 1:
    raise SystemExit('sync calculation endpoint anchor missing')

old_ai = '@app.post("/v1/fortune/interpret")\ndef fortune_interpret(request: IntegratedInterpretRequest) -> dict:\n    if not isinstance(request.calculation, dict) or not request.calculation:\n        raise HTTPException(status_code=422, detail="calculation result is required")\n    return interpret_integrated_fortune(request.calculation, request.model)\n\n'
new_ai = old_ai + '''\n@app.post("/v1/fortune/interpret/start", status_code=202)\ndef fortune_interpret_start(request: IntegratedInterpretRequest, background_tasks: BackgroundTasks) -> dict:\n    if not isinstance(request.calculation, dict) or not request.calculation:\n        raise HTTPException(status_code=422, detail="calculation result is required")\n    _prune_jobs(_ai_jobs, _ai_jobs_lock)\n    job_id = uuid.uuid4().hex\n    with _ai_jobs_lock:\n        _ai_jobs[job_id] = {"status": "queued", "created_ts": time.time()}\n    background_tasks.add_task(_run_ai_job, job_id, request.calculation, request.model)\n    return {"ok": True, "job_id": job_id, "status": "queued"}\n\n\n@app.get("/v1/fortune/interpret/jobs/{job_id}")\ndef fortune_interpret_job(job_id: str) -> dict:\n    _prune_jobs(_ai_jobs, _ai_jobs_lock)\n    with _ai_jobs_lock:\n        item = dict(_ai_jobs.get(job_id) or {})\n    if not item:\n        raise HTTPException(status_code=404, detail="AI interpretation job not found")\n    out = {"ok": item.get("status") != "failed", "job_id": job_id, "status": item.get("status")}\n    if item.get("status") == "done": out["result"] = item.get("result")\n    if item.get("status") == "failed": out["error"] = item.get("error")\n    return out\n\n'''
if old_ai not in s:
    raise SystemExit('AI endpoint anchor missing')
s = s.replace(old_ai, new_ai, 1)
s = s.replace('"fortune/integrated",\n            "fortune/interpret",', '"fortune/integrated",\n            "fortune/integrated/start+jobs",\n            "fortune/interpret",\n            "fortune/interpret/start+jobs",')
api.write_text(s, encoding='utf-8')

# ---------------- frontend: use async calculation and AI polling ----------------
s = front.read_text(encoding='utf-8')
old_ai_fn = re.compile(r'  const runAiInterpretation = async \(calculation: IntegratedApiResponse \| null = integratedResult\) => \{.*?\n  \}\n\n', re.S)
new_ai_fn = r'''  const runAiInterpretation = async (calculation: IntegratedApiResponse | null = integratedResult) => {
    if (!calculation) return
    setAiLoading(true); setAiError('')
    try {
      const startResponse = await fetch(`${API_BASE}/v1/fortune/interpret/start`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ calculation, model: aiModel }),
      })
      const started = await startResponse.json()
      if (!startResponse.ok || !started?.job_id) throw new Error(started?.detail || started?.error || 'AI 해설 작업을 시작하지 못했어.')
      let finalPayload: AiInterpretationResponse | null = null
      for (let attempt=0; attempt<90; attempt++) {
        await new Promise((resolve)=>window.setTimeout(resolve, 2000))
        const pollResponse = await fetch(`${API_BASE}/v1/fortune/interpret/jobs/${encodeURIComponent(started.job_id)}`)
        const job = await pollResponse.json()
        if (!pollResponse.ok) throw new Error(job?.detail || 'AI 해설 상태를 확인하지 못했어.')
        if (job.status === 'failed') throw new Error(job.error || 'AI 해설 작업이 실패했어.')
        if (job.status === 'done') { finalPayload = job.result as AiInterpretationResponse; break }
      }
      if (!finalPayload) throw new Error('AI 정밀해설 시간이 길어지고 있어. 다시 시도해줘.')
      if (!finalPayload.ok) throw new Error(finalPayload.error || 'AI 해설 생성에 실패했어.')
      setAiInterpretation(finalPayload)
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'AI 해설 중 오류가 발생했어.')
    } finally { setAiLoading(false) }
  }

'''
s, n = old_ai_fn.subn(new_ai_fn, s, count=1)
if n != 1:
    raise SystemExit('frontend AI function anchor missing')

# replace direct integrated POST inside runIntegrated with start/poll; target the known fetch block
old_fetch = '''      const response = await fetch(`${API_BASE}/v1/fortune/integrated`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(typeof payload?.detail === 'string' ? payload.detail : '통합운세 계산 요청에 실패했어.')
      const calculation = payload as IntegratedApiResponse
'''
new_fetch = '''      const startResponse = await fetch(`${API_BASE}/v1/fortune/integrated/start`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body),
      })
      const started = await startResponse.json()
      if (!startResponse.ok || !started?.job_id) throw new Error(started?.detail || started?.error || '통합운세 계산 작업을 시작하지 못했어.')
      let calculation: IntegratedApiResponse | null = null
      for (let attempt=0; attempt<120; attempt++) {
        await new Promise((resolve)=>window.setTimeout(resolve, 2000))
        const pollResponse = await fetch(`${API_BASE}/v1/fortune/integrated/jobs/${encodeURIComponent(started.job_id)}`)
        const job = await pollResponse.json()
        if (!pollResponse.ok) throw new Error(job?.detail || '통합운세 계산 상태를 확인하지 못했어.')
        if (job.status === 'failed') throw new Error(job.error || '통합운세 계산 작업이 실패했어.')
        if (job.status === 'done') { calculation = job.result as IntegratedApiResponse; break }
      }
      if (!calculation) throw new Error('정밀 계산 시간이 길어지고 있어. 다시 시도해줘.')
'''
if old_fetch not in s:
    raise SystemExit('frontend integrated fetch anchor missing')
s = s.replace(old_fetch, new_fetch, 1)
front.write_text(s, encoding='utf-8')

print('restored exact legacy sampling and added async polling jobs')
