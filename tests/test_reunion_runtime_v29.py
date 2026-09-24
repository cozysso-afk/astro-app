from datetime import datetime, timezone

import relationship_western_v1 as rw
import reunion_hierarchy_v2 as h


def _full_points(jd):
    chart = rw._chart_from_jd(jd, include_angles=False)
    return {name: float(row["lon"]) for name, row in chart["positions"].items()}


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
    profile = {
        "birth_date": datetime(1991, 3, 21).date(),
        "birth_time": datetime.strptime("07:26", "%H:%M").time(),
        "utc_offset_hours": 9.0,
        "timezone_id": "Asia/Seoul",
        "latitude": 34.7604,
        "longitude": 127.6622,
        "time_known": True,
    }
    target = datetime(2026, 9, 24, 12, 0, tzinfo=timezone.utc)
    birth_utc = rw._profile_birth_resolution(profile).utc
    selected_jd, selected = h._secondary_progressed_points(profile, target, birth_utc)
    canonical = rw._secondary_progressed_chart(profile, target, include_angles=False)
    full = {name: float(row["lon"]) for name, row in canonical["positions"].items()}

    assert abs(selected_jd - canonical["jd_ut"]) < 1e-8
    assert selected == {name: full[name] for name in rw.BODIES if name in h.PROGRESSED_BODIES}
