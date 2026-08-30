from pathlib import Path

# Progress callback through the deterministic annual engine.
int_path=Path('integrated_fortune_v1.py')
s=int_path.read_text(encoding='utf-8')
old='''    start_date: date,\n    end_date: date,\n):\n    birth_local = _aware_local(birth_date, birth_time, utc_offset_hours)\n'''
new='''    start_date: date,\n    end_date: date,\n    progress_callback=None,\n):\n    birth_local = _aware_local(birth_date, birth_time, utc_offset_hours)\n'''
assert old in s, 'western signature anchor missing'
s=s.replace(old,new,1)
old='''    else:\n        rows = [\n            dict(_daily_aggregate_cached((start_date + timedelta(days=i)).isoformat(), natal_packed, houses_packed, float(utc_offset_hours)))\n            for i in range(day_count)\n        ]\n\n    market_rows = [r for r in rows if _is_market_day(date.fromisoformat(r["date"]))]\n'''
new='''    else:\n        rows = []\n        for i in range(day_count):\n            rows.append(dict(_daily_aggregate_cached((start_date + timedelta(days=i)).isoformat(), natal_packed, houses_packed, float(utc_offset_hours))))\n            completed = i + 1\n            if progress_callback and (completed == day_count or completed == 1 or completed % 5 == 0):\n                progress_callback(completed, day_count, "western_daily")\n\n    market_rows = [r for r in rows if _is_market_day(date.fromisoformat(r["date"]))]\n'''
assert old in s, 'annual rows anchor missing'
s=s.replace(old,new,1)
old='''    end_date: date,\n) -> dict[str, Any]:\n'''
new='''    end_date: date,\n    progress_callback=None,\n) -> dict[str, Any]:\n'''
assert old in s, 'build signature anchor missing'
s=s.replace(old,new,1)
old='''    western = _western_payload(\n        birth_date, birth_time, latitude, longitude, utc_offset_hours, start_date, end_date\n    )\n'''
new='''    western = _western_payload(\n        birth_date, birth_time, latitude, longitude, utc_offset_hours, start_date, end_date, progress_callback\n    )\n'''
assert old in s, 'western call anchor missing'
s=s.replace(old,new,1)
int_path.write_text(s,encoding='utf-8')

# API job progress is in-memory alongside the existing job, no new service/storage.
api_path=Path('api/main.py')
a=api_path.read_text(encoding='utf-8')
old='''def _run_calc_job(job_id: str, payload: dict):\n    _set_job(_calc_jobs, _calc_jobs_lock, job_id, status="running")\n    try:\n        result = build_integrated_fortune(**payload)\n        _set_job(_calc_jobs, _calc_jobs_lock, job_id, status="done", result=result)\n'''
new='''def _run_calc_job(job_id: str, payload: dict):\n    _set_job(_calc_jobs, _calc_jobs_lock, job_id, status="running", progress={"completed": 0, "total": int((payload["end_date"] - payload["start_date"]).days + 1), "percent": 0, "stage": "starting"})\n    def on_progress(completed: int, total: int, stage: str):\n        percent = int(round((completed / max(1, total)) * 100))\n        _set_job(_calc_jobs, _calc_jobs_lock, job_id, progress={"completed": completed, "total": total, "percent": percent, "stage": stage})\n    try:\n        result = build_integrated_fortune(**payload, progress_callback=on_progress)\n        _set_job(_calc_jobs, _calc_jobs_lock, job_id, status="done", progress={"completed": int((payload["end_date"] - payload["start_date"]).days + 1), "total": int((payload["end_date"] - payload["start_date"]).days + 1), "percent": 100, "stage": "done"}, result=result)\n'''
assert old in a, 'calc job anchor missing'
a=a.replace(old,new,1)
api_path.write_text(a,encoding='utf-8')

# Frontend shows actual backend progress, not a fake timer.
app_path=Path('web/src/AppNext.tsx')
w=app_path.read_text(encoding='utf-8')
needle="  const [integratedLoading, setIntegratedLoading] = useState(false)\n"
assert needle in w, 'integrated loading state anchor missing'
w=w.replace(needle,needle+"  const [integratedProgress, setIntegratedProgress] = useState<{completed:number;total:number;percent:number}|null>(null)\n",1)

# reset when a fresh calculation starts
needle="    setIntegratedLoading(true)\n    try {\n"
assert needle in w, 'integrated start anchor missing'
w=w.replace(needle,"    setIntegratedProgress(null)\n    setIntegratedLoading(true)\n    try {\n",1)

# update from polled job
needle="          transientFailures = 0\n          if (job.status === 'failed') throw new Error(job.error || '통합운세 계산 작업이 실패했어.')\n"
assert needle in w, 'poll progress anchor missing'
w=w.replace(needle,"          transientFailures = 0\n          if (job?.progress && Number.isFinite(Number(job.progress.percent))) setIntegratedProgress({completed:Number(job.progress.completed??0),total:Number(job.progress.total??0),percent:Number(job.progress.percent??0)})\n          if (job.status === 'failed') throw new Error(job.error || '통합운세 계산 작업이 실패했어.')\n",1)

# Clear only after result/error is settled.
needle="    } finally { setIntegratedLoading(false) }\n  }\n\n  const runReunionTiming"
assert needle in w, 'integrated finally anchor missing'
w=w.replace(needle,"    } finally { setIntegratedLoading(false); setIntegratedProgress(null) }\n  }\n\n  const runReunionTiming",1)

# Button displays real completed-day progress.
old="<span>{integratedLoading?'통합 계산 중…':'통합운세 실제 계산'}</span>"
new="<span>{integratedLoading?(integratedProgress?`통합 계산 중 · ${integratedProgress.completed}/${integratedProgress.total}일 (${integratedProgress.percent}%)`:'통합 계산 준비 중…'):'통합운세 실제 계산'}</span>"
assert old in w, 'integrated button anchor missing'
w=w.replace(old,new,1)

# Saju monthly precision is explicit rather than hidden in raw JSON.
old="    monthly?: Array<{ calendar_month: string; ganzhi: string; stem_ten_god: string; branch_links: string[] }>\n"
new="    monthly?: Array<{ calendar_month: string; ganzhi: string; stem_ten_god: string; branch_links: string[]; boundary_note?: string }>\n"
assert old in w, 'saju monthly type anchor missing'
w=w.replace(old,new,1)
needle="                  {integratedResult.saju.true_solar && <div className=\"coordinate-note\"><Sun size={16}/><span>법정시 {integratedResult.saju.true_solar.legal_local_time.slice(11,16)} → 진태양시 {integratedResult.saju.true_solar.true_solar_time.slice(11,16)} · 보정 {integratedResult.saju.true_solar.total_correction_minutes>0?'+':''}{integratedResult.saju.true_solar.total_correction_minutes.toFixed(1)}분</span></div>}\n"
assert needle in w, 'saju result note anchor missing'
w=w.replace(needle,needle+"                  {!!integratedResult.saju.monthly?.length && <p className=\"result-note\">사주 월운 표시는 현재 달력 월 중 대표일의 절기월 간지야. 절입 경계의 정확 시각까지 월 구간을 쪼갠 방식은 아직 아니며, 원본 데이터의 boundary_note(경계 주석)를 보존해.</p>}\n",1)
app_path.write_text(w,encoding='utf-8')

print('Applied branch-only annual job progress and Saju precision disclosure.')
