from datetime import date, datetime, time as dt_time, timezone
import inspect

import relationship_western_v1 as rw
import reunion_hierarchy_v2 as h


def _full_points(jd):
    chart = rw._chart_from_jd(jd, include_angles=False)
    return {name: float(row["lon"]) for name, row in chart["positions"].items()}


def _profile(*, birth_date, birth_time, latitude, longitude):
    return {
        "birth_date": birth_date,
        "birth_time": birth_time,
        "utc_offset_hours": 9.0,
        "timezone_id": "Asia/Seoul",
        "latitude": latitude,
        "longitude": longitude,
        "time_known": True,
        "time_source": "official_record",
        "time_confidence": "exact",
    }


def test_fast_body_subset_is_derived_from_every_stage_policy():
    required = set().union(*h.FAST_BY_STAGE.values())
    assert h.FAST_TRANSIT_BODIES == required
    assert h.FAST_TRANSIT_BODIES == {"Sun", "Moon", "Mercury", "Venus", "Mars"}


def test_progressed_subset_covers_every_consumed_progressed_point():
    directed = set().union(*(p["directed_planets"] for p in h.STAGE_LONG_POLICY.values()))
    trigger_targets = set().union(*(p["targets"] for p in h.STAGE_TRIGGER_POLICY.values())) & set(rw.BODIES)
    assert directed | trigger_targets | {"Sun"} <= h.PROGRESSED_BODIES
    assert h.PROGRESSED_BODIES == {"Sun", "Moon", "Mercury", "Venus", "Mars", "Saturn"}


def test_selected_fast_longitudes_are_identical_to_full_chart():
    for instant in (
        datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc),
        datetime(2026, 6, 21, 12, 34, tzinfo=timezone.utc),
        datetime(2026, 12, 31, 23, 59, tzinfo=timezone.utc),
    ):
        jd = rw._jd_from_utc(instant)
        full = _full_points(jd)
        selected = h._selected_planet_points(jd, h.FAST_TRANSIT_BODIES)
        assert selected == {name: full[name] for name in rw.BODIES if name in h.FAST_TRANSIT_BODIES}


def test_selected_progressed_longitudes_and_epoch_match_canonical_chart():
    profile = _profile(
        birth_date=date(1991, 3, 21),
        birth_time=dt_time(7, 26),
        latitude=34.7604,
        longitude=127.6622,
    )
    target = datetime(2026, 9, 24, 12, 0, tzinfo=timezone.utc)
    birth_utc = rw._profile_birth_resolution(profile).utc
    selected_jd, selected = h._secondary_progressed_points(profile, target, birth_utc)
    canonical = rw._secondary_progressed_chart(profile, target, include_angles=False)
    full = {name: float(row["lon"]) for name, row in canonical["positions"].items()}

    assert abs(selected_jd - canonical["jd_ut"]) < 1e-8
    assert selected == {name: full[name] for name in rw.BODIES if name in h.PROGRESSED_BODIES}


def test_reunion_daily_scan_defaults_on_but_can_be_deferred_without_losing_monthly_layers(monkeypatch):
    parameter = inspect.signature(rw.build_relationship_western).parameters["include_reunion_daily_scan"]
    assert parameter.default is True

    calls = []

    def forbidden_duplicate_scan(*args, **kwargs):
        calls.append((args, kwargs))
        raise AssertionError("legacy daily reunion scan must be deferred in async mode")

    monkeypatch.setattr(rw, "_build_reunion_transits", forbidden_duplicate_scan)
    user = _profile(
        birth_date=date(1991, 3, 21),
        birth_time=dt_time(7, 26),
        latitude=34.7604,
        longitude=127.6622,
    )
    counterpart = _profile(
        birth_date=date(1992, 2, 29),
        birth_time=dt_time(19, 0),
        latitude=35.1595,
        longitude=126.8526,
    )
    out = rw.build_relationship_western(
        user,
        counterpart,
        [(date(2026, 9, 1), date(2026, 9, 30))],
        analysis_mode="reunion",
        include_reunion_daily_scan=False,
    )

    assert calls == []
    assert "relationship_transits" not in out
    assert "reunion_transits" not in out
    assert len(out["months"]) == 1
    assert out["months"][0]["calendar_month"] == "2026-09"
    assert "reunion_evidence_contract" in out
    assert "reunion_secondary_support" in out
