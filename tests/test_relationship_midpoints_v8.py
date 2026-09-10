from __future__ import annotations

from datetime import date, datetime, time as dt_time, timedelta, timezone

import pytest

from relationship_western_v1 import (
    ENGINE_VERSION,
    TROPICAL_MONTH_DAYS,
    _davison_from_profiles,
    _geo_midpoint,
    _mid_angle,
    _midpoint_chart,
    _secondary_progressed_chart,
    _tertiary_progressed_chart,
    _utc_datetime,
    build_relationship_western,
)


def _profile(*, birth_date, birth_time, utc_offset_hours, latitude, longitude):
    return {
        "birth_date": birth_date,
        "birth_time": birth_time,
        "utc_offset_hours": utc_offset_hours,
        "latitude": latitude,
        "longitude": longitude,
        "time_known": True,
        "time_source": "official_record",
        "time_confidence": "exact",
    }


def _angular_delta(a: float, b: float) -> float:
    return abs((float(a) - float(b) + 180.0) % 360.0 - 180.0)


def test_composite_midpoint_crosses_zero_on_short_arc_and_is_swap_invariant():
    assert _angular_delta(_mid_angle(350.0, 10.0), 0.0) <= 1e-12
    assert _angular_delta(_mid_angle(10.0, 350.0), 0.0) <= 1e-12

    a = {"positions": {"Sun": {"lon": 350.0}}, "angles": {"ASC": 359.0}}
    b = {"positions": {"Sun": {"lon": 10.0}}, "angles": {"ASC": 1.0}}
    ab = _midpoint_chart(a, b)
    ba = _midpoint_chart(b, a)
    assert ab == ba
    assert _angular_delta(ab["positions"]["Sun"]["lon"], 0.0) <= 1e-12
    assert _angular_delta(ab["angles"]["ASC"], 0.0) <= 1e-12


def test_exact_opposition_composite_midpoint_uses_order_independent_canonical_antipode():
    # Exact 180° separation has two equally valid midpoint candidates. V8 does
    # not pretend otherwise; it picks a deterministic canonical candidate so
    # partner A/B ordering cannot change the relationship chart.
    ab = _mid_angle(0.0, 180.0)
    ba = _mid_angle(180.0, 0.0)
    assert ab == ba
    assert ab in {90.0, 270.0}

    chart_a = {"positions": {"Sun": {"lon": 0.0}, "Venus": {"lon": 45.0}}, "angles": {"ASC": 180.0}}
    chart_b = {"positions": {"Sun": {"lon": 180.0}, "Venus": {"lon": 225.0}}, "angles": {"ASC": 0.0}}
    assert _midpoint_chart(chart_a, chart_b) == _midpoint_chart(chart_b, chart_a)


def test_uncorrected_davison_uses_separate_mean_latitude_and_longitude():
    # Astrodienst's uncorrected DRC contract: average latitude and longitude
    # separately, rather than using a great-circle/spherical midpoint.
    a = _profile(
        birth_date=date(1990, 1, 1), birth_time=dt_time(0, 0), utc_offset_hours=0,
        latitude=10.0, longitude=20.0,
    )
    b = _profile(
        birth_date=date(1990, 1, 3), birth_time=dt_time(0, 0), utc_offset_hours=0,
        latitude=30.0, longitude=80.0,
    )
    chart = _davison_from_profiles(a, b)
    assert chart["variant"] == "uncorrected"
    assert chart["latitude"] == 20.0
    assert chart["longitude"] == 50.0
    assert chart["utc"] == datetime(1990, 1, 2, 0, 0, tzinfo=timezone.utc).isoformat()
    assert "mean latitude" in chart["method"]


def test_uncorrected_davison_is_invariant_when_people_are_swapped():
    a = _profile(
        birth_date=date(1988, 7, 4), birth_time=dt_time(21, 15), utc_offset_hours=-4,
        latitude=40.7128, longitude=-74.0060,
    )
    b = _profile(
        birth_date=date(1992, 11, 18), birth_time=dt_time(6, 45), utc_offset_hours=9,
        latitude=37.5665, longitude=126.9780,
    )
    ab = _davison_from_profiles(a, b)
    ba = _davison_from_profiles(b, a)
    assert ab["variant"] == ba["variant"] == "uncorrected"
    assert ab["utc"] == ba["utc"]
    assert ab["latitude"] == ba["latitude"]
    assert ab["longitude"] == ba["longitude"]
    assert ab["positions"] == ba["positions"]
    assert ab["angles"] == ba["angles"]


def test_uncorrected_and_spherical_davison_variants_are_explicitly_distinct_at_date_line():
    a = _profile(
        birth_date=date(2000, 1, 1), birth_time=dt_time(12, 0), utc_offset_hours=12,
        latitude=0.0, longitude=179.0,
    )
    b = _profile(
        birth_date=date(2000, 1, 1), birth_time=dt_time(12, 0), utc_offset_hours=-12,
        latitude=0.0, longitude=-179.0,
    )
    classic = _davison_from_profiles(a, b, variant="uncorrected")
    spherical = _davison_from_profiles(a, b, variant="spherical")

    # The classical uncorrected convention literally averages signed
    # longitudes, while the spherical variant follows the shortest path.
    assert classic["longitude"] == 0.0
    assert abs(abs(spherical["longitude"]) - 180.0) <= 1e-6
    assert classic["variant"] == "uncorrected"
    assert spherical["variant"] == "spherical"
    assert classic["method"] != spherical["method"]


def test_spherical_geographic_midpoint_rejects_antipodal_locations_instead_of_returning_noise():
    with pytest.raises(ValueError, match="antipodal"):
        _geo_midpoint(0.0, 0.0, 0.0, 180.0, variant="spherical")

    with pytest.raises(ValueError, match="antipodal"):
        _geo_midpoint(10.0, 20.0, -10.0, -160.0, variant="spherical")


def test_geo_midpoint_rejects_unknown_variant():
    with pytest.raises(ValueError, match="variant"):
        _geo_midpoint(0.0, 0.0, 10.0, 10.0, variant="mystery")


def test_tertiary_i_is_stepwise_by_completed_tropical_lunar_month():
    base = {
        "jd_ut": 2451545.0,
        "positions": {},
        "angles": {},
    }
    base_utc = datetime(2000, 1, 1, 12, 0, tzinfo=timezone.utc)

    before, months_before = _tertiary_progressed_chart(
        base, base_utc + timedelta(days=TROPICAL_MONTH_DAYS - 1e-6)
    )
    exact, months_exact = _tertiary_progressed_chart(
        base, base_utc + timedelta(days=TROPICAL_MONTH_DAYS)
    )
    after, months_after = _tertiary_progressed_chart(
        base, base_utc + timedelta(days=TROPICAL_MONTH_DAYS + 5.0)
    )

    assert months_before == 0
    assert before["jd_ut"] == 2451545.0
    assert months_exact == 1
    assert exact["jd_ut"] == 2451546.0
    assert months_after == 1
    assert after["jd_ut"] == 2451546.0


def test_secondary_progression_keeps_continuous_day_for_year_ratio():
    p = _profile(
        birth_date=date(2000, 1, 1), birth_time=dt_time(12, 0), utc_offset_hours=0,
        latitude=0.0, longitude=0.0,
    )
    birth_utc = _utc_datetime(p["birth_date"], p["birth_time"], 0.0)
    target = birth_utc + timedelta(days=365.2422 / 2.0)
    progressed = _secondary_progressed_chart(p, target)

    # Half a tropical year of life corresponds to half an ephemeris day.
    birth_jd = 2451545.0
    assert abs(float(progressed["jd_ut"]) - (birth_jd + 0.5)) <= 1e-7


def test_full_relationship_build_threads_uncorrected_davison_into_marks_and_tertiary_layers():
    user = _profile(
        birth_date=date(1990, 1, 1), birth_time=dt_time(9, 30), utc_offset_hours=9,
        latitude=37.5665, longitude=126.9780,
    )
    counterpart = _profile(
        birth_date=date(1992, 6, 15), birth_time=dt_time(18, 20), utc_offset_hours=-4,
        latitude=40.7128, longitude=-74.0060,
    )
    out = build_relationship_western(
        user,
        counterpart,
        [(date(2026, 9, 1), date(2026, 9, 30))],
        analysis_mode="compatibility",
    )

    assert out["ok"] is True
    assert out["engine"] == ENGINE_VERSION
    assert out["composite"]["available"] is True
    assert out["davison"]["available"] is True
    assert out["davison"]["chart"]["variant"] == "uncorrected"
    assert "mean latitude" in out["davison"]["chart"]["method"]
    assert out["marks"]["available"] is True
    assert out["marks"]["user"]["variant"] == "uncorrected"
    assert out["marks"]["counterpart"]["variant"] == "uncorrected"
    assert len(out["months"]) == 1
    assert out["months"][0]["progressed_composite"]["available"] is True
    assert out["months"][0]["marks_tertiary"]["available"] is True
