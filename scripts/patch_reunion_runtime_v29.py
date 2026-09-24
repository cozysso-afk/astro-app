from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


root = Path(__file__).resolve().parents[1]
hierarchy_path = root / "reunion_hierarchy_v2.py"
western_path = root / "relationship_western_v1.py"
async_path = root / "api" / "relationship_async_v1.py"

hierarchy = hierarchy_path.read_text(encoding="utf-8")

hierarchy = replace_once(
    hierarchy,
    "VERSION = 'reunion-hierarchy-v2.8-birth-time-precision-audit'",
    "VERSION = 'reunion-hierarchy-v2.9-runtime-efficiency'",
    "hierarchy version",
)

hierarchy = replace_once(
    hierarchy,
    "PRIMARY_TRIGGER_ASPECTS = DIRECT_TRIGGER_ASPECTS\nDISCLAIMER = '점수는 해당 기간의 점성·명리적 상대 활성도를 비교하기 위한 값이며, 실제 연락·만남·재회의 확률을 의미하지 않습니다.'",
    """PRIMARY_TRIGGER_ASPECTS = DIRECT_TRIGGER_ASPECTS
# Performance-only body subsets. They are derived from the canonical stage policies,
# so changing a policy automatically widens the calculation set instead of silently
# dropping a required body. Longitude math, sample hours, gates, weights and orbs stay unchanged.
FAST_TRANSIT_BODIES = frozenset().union(*FAST_BY_STAGE.values())
PROGRESSED_BODIES = frozenset(
    set().union(*(policy['directed_planets'] for policy in STAGE_LONG_POLICY.values()))
    | (set().union(*(policy['targets'] for policy in STAGE_TRIGGER_POLICY.values())) & set(rw.BODIES))
    | {'Sun'}
)
DISCLAIMER = '점수는 해당 기간의 점성·명리적 상대 활성도를 비교하기 위한 값이며, 실제 연락·만남·재회의 확률을 의미하지 않습니다.'""",
    "derived runtime body sets",
)

hierarchy = replace_once(
    hierarchy,
    """def _points(chart, allow_angles=True):
    points = {k: float(v['lon']) for k, v in chart.get('positions', {}).items()}
    if allow_angles and rw._chart_time_exact(chart):
        points.update({k: float(v) for k, v in chart.get('angles', {}).items() if k in {'ASC', 'DSC'}})
    return points
""",
    """def _selected_planet_points(jd, names):
    \"\"\"Return the same rounded Swiss longitudes as rw._planet_positions for selected bodies only.\"\"\"
    flags = swe.FLG_SWIEPH | swe.FLG_SPEED
    wanted = set(names)
    out = {}
    # Preserve relationship_western_v1.BODIES iteration order for deterministic traces.
    for name, pid in rw.BODIES.items():
        if name not in wanted:
            continue
        xx, _ = swe.calc_ut(float(jd), pid, flags)
        out[name] = round(rw._norm(xx[0]), 6)
    missing = wanted - set(out)
    if missing:
        raise ValueError(f'unknown Swiss body names: {sorted(missing)}')
    return out


def _secondary_progressed_points(profile, target_dt, birth_utc, names=PROGRESSED_BODIES):
    \"\"\"Day-for-year progression equivalent to rw._secondary_progressed_chart without unused bodies.\"\"\"
    age_days = (target_dt.astimezone(timezone.utc) - birth_utc).total_seconds() / 86400.0
    progressed_days = age_days / rw.YEAR_DAYS
    jd = rw._jd_from_utc(birth_utc) + progressed_days
    return jd, _selected_planet_points(jd, names)


def _points(chart, allow_angles=True):
    points = {k: float(v['lon']) for k, v in chart.get('positions', {}).items()}
    if allow_angles and rw._chart_time_exact(chart):
        points.update({k: float(v) for k, v in chart.get('angles', {}).items() if k in {'ASC', 'DSC'}})
    return points
""",
    "selected Swiss-body helpers",
)

hierarchy = replace_once(
    hierarchy,
    """            pc = rw._secondary_progressed_chart(p, instant, include_angles=False)
            progression[side] = _points(pc, False)
            birth = birth_resolutions[side].utc
            expected = rw._jd_from_utc(birth) + (instant - birth).total_seconds() / 86400 / rw.YEAR_DAYS
            if abs(pc['jd_ut'] - expected) > 1e-6:
                raise ValueError('secondary progression epoch mismatch')
""",
    """            birth = birth_resolutions[side].utc
            progressed_jd, progression[side] = _secondary_progressed_points(p, instant, birth)
            expected = rw._jd_from_utc(birth) + (instant - birth).total_seconds() / 86400 / rw.YEAR_DAYS
            if abs(progressed_jd - expected) > 1e-6:
                raise ValueError('secondary progression epoch mismatch')
""",
    "secondary progression subset",
)

hierarchy = replace_once(
    hierarchy,
    """                        fast_transit_cache[hour] = _points(
                            rw._chart_from_jd(rw._jd_from_utc(sample), include_angles=False)
                        )
""",
    """                        fast_transit_cache[hour] = _selected_planet_points(
                            rw._jd_from_utc(sample), FAST_TRANSIT_BODIES
                        )
""",
    "fast transit subset",
)

hierarchy_path.write_text(hierarchy, encoding="utf-8")

western = western_path.read_text(encoding="utf-8")
western = replace_once(
    western,
    'def build_relationship_western(user_profile, counterpart_profile, month_segments, analysis_mode="compatibility"):',
    'def build_relationship_western(user_profile, counterpart_profile, month_segments, analysis_mode="compatibility", *, include_reunion_daily_scan=True):',
    "western optional daily scan flag",
)
western = replace_once(
    western,
    '    Daily two-person reunion transit scanning runs only for analysis_mode="reunion".\n',
    '    Daily two-person reunion transit scanning runs only for analysis_mode="reunion". Async reunion jobs may defer this duplicate scan to the canonical reunion hierarchy.\n',
    "western scan docstring",
)
western = replace_once(
    western,
    '    if month_segments and analysis_mode == "reunion":\n        transit_layer = _build_reunion_transits(',
    '    if month_segments and analysis_mode == "reunion" and include_reunion_daily_scan:\n        transit_layer = _build_reunion_transits(',
    "western duplicate daily scan guard",
)
western_path.write_text(western, encoding="utf-8")

async_text = async_path.read_text(encoding="utf-8")
async_text = replace_once(
    async_text,
    "import json\nimport os\nimport threading",
    "import json\nimport logging\nimport os\nimport threading",
    "async logging import",
)
async_text = replace_once(
    async_text,
    "_semaphore = threading.Semaphore(_MAX_CONCURRENCY)\n",
    "_semaphore = threading.Semaphore(_MAX_CONCURRENCY)\n_logger = logging.getLogger('astro.relationship_async')\n",
    "async logger",
)
async_text = replace_once(
    async_text,
    """def _progress(job_id: str, phase: str, percent: int, detail: str) -> None:
    _set_job(
        job_id,
        heartbeat_ts=time.time(),
        progress={
            \"phase\": phase,
            \"percent\": max(0, min(99, int(percent))),
            \"detail\": detail,
        },
    )
""",
    """def _progress(job_id: str, phase: str, percent: int, detail: str) -> None:
    _set_job(
        job_id,
        heartbeat_ts=time.time(),
        progress={
            \"phase\": phase,
            \"percent\": max(0, min(99, int(percent))),
            \"detail\": detail,
        },
    )
    _logger.info(
        \"relationship_job_progress job=%s phase=%s percent=%s detail=%s\",
        job_id,
        phase,
        max(0, min(99, int(percent))),
        detail,
    )
""",
    "async progress logging",
)
async_text = replace_once(
    async_text,
    "    result = build_relationship_western(user_payload, cp_payload, segments, analysis_mode=request.analysis_mode)\n",
    """    # The canonical v2 hierarchy performs the authoritative full-period daily scan below.
    # Avoid paying for the legacy reunion daily scan here and immediately overwriting it.
    result = build_relationship_western(
        user_payload,
        cp_payload,
        segments,
        analysis_mode=request.analysis_mode,
        include_reunion_daily_scan=False,
    )
""",
    "async duplicate reunion scan skip",
)
async_text = replace_once(
    async_text,
    """        if worker.is_alive():
            with _lock:
                current = dict(_jobs.get(job_id) or {})
            phase = str((current.get(\"progress\") or {}).get(\"phase\") or \"unknown\")
            _set_job(
                job_id,
                status=\"failed\",
                finished_at=time.time(),
                elapsed_seconds=round(time.time() - started_at, 3),
                status_code=504,
                timed_out=True,
                error=(
                    f\"재회운 계산이 {_HARD_TIMEOUT_SECONDS}초 제한을 넘겨 중단 처리됐어. \"
                    f\"마지막 단계: {phase}. 같은 멈춘 작업을 다시 재사용하지 않도록 차단했어.\"
                ),
            )
            return
""",
    """        if worker.is_alive():
            with _lock:
                current = dict(_jobs.get(job_id) or {})
            phase = str((current.get(\"progress\") or {}).get(\"phase\") or \"unknown\")
            elapsed = round(time.time() - started_at, 3)
            _set_job(
                job_id,
                status=\"failed\",
                finished_at=time.time(),
                elapsed_seconds=elapsed,
                status_code=504,
                timed_out=True,
                error=(
                    f\"재회운 계산이 {_HARD_TIMEOUT_SECONDS}초 제한을 넘겨 중단 처리됐어. \"
                    f\"마지막 단계: {phase}. 같은 멈춘 작업을 다시 재사용하지 않도록 차단했어.\"
                ),
            )
            _logger.error(
                \"relationship_job_timeout job=%s phase=%s elapsed_seconds=%s; waiting for abandoned core before releasing semaphore\",
                job_id,
                phase,
                elapsed,
            )
            # Python threads cannot be force-killed safely. Keep the concurrency slot
            # occupied until the abandoned calculation really exits, preventing a retry
            # from stacking another CPU-heavy calculation on top of it.
            worker.join()
            _logger.info(\"relationship_job_abandoned_core_exited job=%s\", job_id)
            return
""",
    "timeout overlap guard",
)
async_path.write_text(async_text, encoding="utf-8")

print("patched reunion_hierarchy_v2.py, relationship_western_v1.py, and api/relationship_async_v1.py")
