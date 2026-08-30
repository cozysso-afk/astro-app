from pathlib import Path

# integrated_fortune_v1.py: chunk vector calls to keep Render peak memory bounded.
p=Path('integrated_fortune_v1.py')
s=p.read_text(encoding='utf-8')
old='''def _vectorized_planet_longitudes(body_name: str, moments: list[datetime]) -> dict[tuple[str, datetime], float]:
    if not moments:
        return {}
    unique = sorted({m.astimezone(timezone.utc) for m in moments})
    ts, _, earth, targets, _, _, _ = _ephemeris_bundle()
    sf_times = ts.from_datetimes(unique)
    apparent = earth.at(sf_times).observe(targets[body_name]).apparent()
    _, lon, _ = apparent.frame_latlon(ecliptic_frame)
    raw = lon.degrees
    values = list(raw) if hasattr(raw, "__iter__") else [raw]
    return {(body_name, moment): float(value % 360.0) for moment, value in zip(unique, values)}
'''
new='''def _vectorized_planet_longitudes(body_name: str, moments: list[datetime]) -> dict[tuple[str, datetime], float]:
    if not moments:
        return {}
    unique = sorted({m.astimezone(timezone.utc) for m in moments})
    ts, _, earth, targets, _, _, _ = _ephemeris_bundle()
    # Skyfield vectorization is dramatically faster than one observation per
    # timestamp, but one 45k-point vector can temporarily consume too much RAM
    # for Render free (512 MB). Chunking retains the same math with a bounded
    # working set. The table itself is small and remains thread-local.
    try:
        batch_size = max(64, min(2048, int(os.getenv("ASTRO_VECTOR_BATCH_SIZE", "384"))))
    except ValueError:
        batch_size = 384
    out: dict[tuple[str, datetime], float] = {}
    for start in range(0, len(unique), batch_size):
        batch = unique[start:start + batch_size]
        sf_times = ts.from_datetimes(batch)
        apparent = earth.at(sf_times).observe(targets[body_name]).apparent()
        _, lon, _ = apparent.frame_latlon(ecliptic_frame)
        raw = lon.degrees
        values = list(raw) if hasattr(raw, "__iter__") else [raw]
        for moment, value in zip(batch, values):
            out[(body_name, moment)] = float(value % 360.0)
    return out
'''
assert old in s, 'vector helper anchor missing'
s=s.replace(old,new,1)
s=s.replace('ENGINE_VERSION = "integrated-fortune-v2.6-vector-prewarm-thai"','ENGINE_VERSION = "integrated-fortune-v2.7-bounded-vector-thai"',1)
s=s.replace('WESTERN_ENGINE_VERSION = "western-period-engine-v9-vector-prewarm"','WESTERN_ENGINE_VERSION = "western-period-engine-v10-bounded-vector"',1)
p.write_text(s,encoding='utf-8')

# api/main.py: serialize heavy calculation work by default and hide request key.
p=Path('api/main.py')
s=p.read_text(encoding='utf-8')
s=s.replace('APP_VERSION = "api-fortune-v5.0-dedup-thai-period"','APP_VERSION = "api-fortune-v5.1-bounded-calc-queue"',1)
anchor='''_calc_request_index: dict[str, str] = {}
_JOB_TTL_SECONDS = 1800
'''
replacement='''_calc_request_index: dict[str, str] = {}
try:
    _MAX_CALC_CONCURRENCY = max(1, min(2, int(os.getenv("ASTRO_MAX_CALC_CONCURRENCY", "1"))))
except ValueError:
    _MAX_CALC_CONCURRENCY = 1
_calc_semaphore = threading.Semaphore(_MAX_CALC_CONCURRENCY)
_JOB_TTL_SECONDS = 1800
'''
assert anchor in s, 'calc semaphore anchor missing'
s=s.replace(anchor,replacement,1)
old='''def _run_calc_job(job_id: str, payload: dict):
    _set_job(_calc_jobs, _calc_jobs_lock, job_id, status="running", progress={"completed": 0, "total": int((payload["end_date"] - payload["start_date"]).days + 1), "percent": 0, "stage": "starting"})
    def on_progress(completed: int, total: int, stage: str):
        percent = int(round((completed / max(1, total)) * 100))
        _set_job(_calc_jobs, _calc_jobs_lock, job_id, progress={"completed": completed, "total": total, "percent": percent, "stage": stage})
    try:
        result = build_integrated_fortune(**payload, progress_callback=on_progress)
        _set_job(_calc_jobs, _calc_jobs_lock, job_id, status="done", progress={"completed": int((payload["end_date"] - payload["start_date"]).days + 1), "total": int((payload["end_date"] - payload["start_date"]).days + 1), "percent": 100, "stage": "done"}, result=result)
    except Exception as exc:  # noqa: BLE001
        _set_job(_calc_jobs, _calc_jobs_lock, job_id, status="failed", error=f"{type(exc).__name__}: {exc}")
'''
new='''def _run_calc_job(job_id: str, payload: dict):
    total_days = int((payload["end_date"] - payload["start_date"]).days + 1)
    _set_job(_calc_jobs, _calc_jobs_lock, job_id, status="queued", progress={"completed": 0, "total": total_days, "percent": 0, "stage": "queued"})
    with _calc_semaphore:
        _set_job(_calc_jobs, _calc_jobs_lock, job_id, status="running", progress={"completed": 0, "total": total_days, "percent": 0, "stage": "starting"})
        def on_progress(completed: int, total: int, stage: str):
            percent = int(round((completed / max(1, total)) * 100))
            _set_job(_calc_jobs, _calc_jobs_lock, job_id, progress={"completed": completed, "total": total, "percent": percent, "stage": stage})
        try:
            result = build_integrated_fortune(**payload, progress_callback=on_progress)
            _set_job(_calc_jobs, _calc_jobs_lock, job_id, status="done", progress={"completed": total_days, "total": total_days, "percent": 100, "stage": "done"}, result=result)
        except Exception as exc:  # noqa: BLE001
            _set_job(_calc_jobs, _calc_jobs_lock, job_id, status="failed", error=f"{type(exc).__name__}: {exc}")
'''
assert old in s, 'run calc anchor missing'
s=s.replace(old,new,1)
old='''@app.post("/v1/fortune/integrated")
def fortune_integrated(request: IntegratedFortuneRequest) -> dict:
    profile = request.profile
    return build_integrated_fortune(
        birth_date=profile.birth_date,
        birth_time=profile.birth_time,
        latitude=profile.latitude,
        longitude=profile.longitude,
        utc_offset_hours=profile.utc_offset_hours,
        gender=profile.gender,
        start_date=request.start_date,
        end_date=request.end_date,
    )
'''
new='''@app.post("/v1/fortune/integrated")
def fortune_integrated(request: IntegratedFortuneRequest) -> dict:
    profile = request.profile
    with _calc_semaphore:
        return build_integrated_fortune(
            birth_date=profile.birth_date,
            birth_time=profile.birth_time,
            latitude=profile.latitude,
            longitude=profile.longitude,
            utc_offset_hours=profile.utc_offset_hours,
            gender=profile.gender,
            start_date=request.start_date,
            end_date=request.end_date,
        )
'''
assert old in s, 'sync integrated anchor missing'
s=s.replace(old,new,1)
old='''    job.pop("created_ts", None)
    return {"job_id": job_id, **job}
'''
# There are two occurrences; the first AI endpoint already has request_key pop.
# Replace the LAST remaining raw occurrence for calculation jobs.
idx=s.rfind(old)
assert idx!=-1, 'calc job response anchor missing'
s=s[:idx]+'''    job.pop("created_ts", None)
    job.pop("request_key", None)
    return {"job_id": job_id, **job}
'''+s[idx+len(old):]
p.write_text(s,encoding='utf-8')

print('PATCH_MEMORY_JOB_HARDENING_V3_APPLIED')
