from __future__ import annotations

from datetime import date, datetime, time as dt_time, timezone

import pytest
import swisseph as swe

from integrated_fortune_v1 import (
    _aware_local,
    _compute_houses,
    _pack_houses,
    _to_jd_ut,
    _unpack_houses,
)
from personal_marriage_v1 import (
    _house_data as _marriage_house_data,
    _jd as _marriage_jd,
    _utc_datetime as _marriage_utc_datetime,
)
from relationship_western_v1 import (
    _angles,
    _jd_from_utc,
    _utc_datetime as _relationship_utc_datetime,
)
from western_house_system_v1 import calculate_quadrant_houses


def _angular_delta_deg(a: float, b: float) -> float:
    return abs((float(a) - float(b) + 180.0) % 360.0 - 180.0)


def _assert_cusps_close(actual, expected, tolerance: float = 1e-6):
    assert len(actual) == len(expected) == 12
    for left, right in zip(actual, expected):
        assert _angular_delta_deg(left, right) <= tolerance


@pytest.mark.parametrize("latitude", [69.6492, -69.0])
def test_polar_placidus_falls_back_to_explicit_porphyry_across_all_western_paths(latitude):
    moment = datetime(2000, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    longitude = 18.9553
    jd = _to_jd_ut(moment)
    porphyry_cusps, porphyry_ascmc = swe.houses(jd, latitude, longitude, b"O")
    gold_cusps = [float(x) % 360.0 for x in porphyry_cusps]

    integrated = _compute_houses(moment, latitude, longitude)
    relationship = _angles(jd, latitude, longitude)
    marriage = _marriage_house_data(jd, latitude, longitude)

    for metadata in (
        integrated["house_system"],
        relationship["house_system"],
        marriage["house_system"],
    ):
        assert metadata["requested"] == "Placidus"
        assert metadata["used"] == "Porphyry"
        assert metadata["fallback"] is True
        assert "Porphyry" in metadata["fallback_reason"]

    _assert_cusps_close(integrated["quadrant_cusps"], gold_cusps)
    _assert_cusps_close(relationship["quadrant_cusps"], gold_cusps)
    _assert_cusps_close(marriage["quadrant_cusps"], gold_cusps)

    # Backward-compatible Placidus-named aliases must contain the same actual
    # quadrant cusps, while metadata makes the fallback explicit.
    _assert_cusps_close(integrated["placidus_cusps"], gold_cusps)
    _assert_cusps_close(relationship["placidus_cusps"], gold_cusps)
    _assert_cusps_close(marriage["placidus_cusps"], gold_cusps)

    gold_asc = float(porphyry_ascmc[0]) % 360.0
    gold_mc = float(porphyry_ascmc[1]) % 360.0
    assert _angular_delta_deg(integrated["asc"], gold_asc) <= 1e-6
    assert _angular_delta_deg(relationship["ASC"], gold_asc) <= 1e-6
    assert _angular_delta_deg(marriage["asc"], gold_asc) <= 1e-6
    assert _angular_delta_deg(integrated["mc"], gold_mc) <= 1e-6
    assert _angular_delta_deg(relationship["MC"], gold_mc) <= 1e-6
    assert _angular_delta_deg(marriage["mc"], gold_mc) <= 1e-6


def test_near_polar_limit_keeps_placidus_when_swiss_can_calculate_it():
    moment = datetime(2000, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    latitude = 66.55
    longitude = 0.0
    jd = _to_jd_ut(moment)
    placidus_cusps, _ = swe.houses(jd, latitude, longitude, b"P")
    gold = [float(x) % 360.0 for x in placidus_cusps]

    integrated = _compute_houses(moment, latitude, longitude)
    relationship = _angles(jd, latitude, longitude)
    marriage = _marriage_house_data(jd, latitude, longitude)

    for metadata in (
        integrated["house_system"],
        relationship["house_system"],
        marriage["house_system"],
    ):
        assert metadata == {
            "requested": "Placidus",
            "used": "Placidus",
            "fallback": False,
            "fallback_reason": None,
            "swiss_error": None,
        }

    _assert_cusps_close(integrated["quadrant_cusps"], gold)
    _assert_cusps_close(relationship["quadrant_cusps"], gold)
    _assert_cusps_close(marriage["quadrant_cusps"], gold)


@pytest.mark.parametrize(
    "birth_date,birth_time,offset_hours,expected_utc",
    [
        (date(2024, 1, 1), dt_time(0, 15), 5.75, datetime(2023, 12, 31, 18, 30, tzinfo=timezone.utc)),
        (date(2024, 1, 1), dt_time(0, 15), -3.5, datetime(2024, 1, 1, 3, 45, tzinfo=timezone.utc)),
        (date(2024, 1, 1), dt_time(0, 15), 14.0, datetime(2023, 12, 31, 10, 15, tzinfo=timezone.utc)),
        (date(2024, 1, 1), dt_time(23, 50), -12.0, datetime(2024, 1, 2, 11, 50, tzinfo=timezone.utc)),
    ],
)
def test_fractional_and_extreme_utc_offsets_preserve_the_same_absolute_instant_across_paths(
    birth_date, birth_time, offset_hours, expected_utc
):
    integrated_utc = _aware_local(birth_date, birth_time, offset_hours).astimezone(timezone.utc)
    relationship_utc = _relationship_utc_datetime(birth_date, birth_time, offset_hours)
    marriage_utc = _marriage_utc_datetime(birth_date, birth_time, offset_hours)

    assert integrated_utc == expected_utc
    assert relationship_utc == expected_utc
    assert marriage_utc == expected_utc

    integrated_jd = _to_jd_ut(integrated_utc)
    relationship_jd = _jd_from_utc(relationship_utc)
    marriage_jd = _marriage_jd(marriage_utc)
    assert abs(integrated_jd - relationship_jd) <= 1e-9
    assert abs(integrated_jd - marriage_jd) <= 1e-9


def test_antimeridian_longitudes_are_continuous_and_identical_across_western_paths():
    moment = datetime(2024, 2, 4, 8, 26, 53, tzinfo=timezone.utc)
    latitude = 12.0
    jd = _to_jd_ut(moment)
    by_lon = {}

    for longitude in (179.999, -179.999):
        integrated = _compute_houses(moment, latitude, longitude)
        relationship = _angles(jd, latitude, longitude)
        marriage = _marriage_house_data(jd, latitude, longitude)

        assert integrated["house_system"]["used"] == "Placidus"
        assert relationship["house_system"]["used"] == "Placidus"
        assert marriage["house_system"]["used"] == "Placidus"

        _assert_cusps_close(integrated["quadrant_cusps"], relationship["quadrant_cusps"])
        _assert_cusps_close(integrated["quadrant_cusps"], marriage["quadrant_cusps"])
        assert _angular_delta_deg(integrated["asc"], relationship["ASC"]) <= 1e-6
        assert _angular_delta_deg(integrated["asc"], marriage["asc"]) <= 1e-6
        assert _angular_delta_deg(integrated["mc"], relationship["MC"]) <= 1e-6
        assert _angular_delta_deg(integrated["mc"], marriage["mc"]) <= 1e-6
        by_lon[longitude] = integrated

    # +179.999 and -179.999 are only 0.002 degrees apart physically. The house
    # geometry must be continuous across the longitude representation boundary.
    east, west = by_lon[179.999], by_lon[-179.999]
    assert _angular_delta_deg(east["asc"], west["asc"]) < 0.01
    assert _angular_delta_deg(east["mc"], west["mc"]) < 0.01
    for left, right in zip(east["quadrant_cusps"], west["quadrant_cusps"]):
        assert _angular_delta_deg(left, right) < 0.01


def test_integrated_house_cache_pack_preserves_fallback_metadata():
    moment = datetime(2000, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    houses = _compute_houses(moment, 69.6492, 18.9553)
    restored = _unpack_houses(_pack_houses(houses))

    assert restored["house_system"] == houses["house_system"]
    _assert_cusps_close(restored["quadrant_cusps"], houses["quadrant_cusps"])
    _assert_cusps_close(restored["placidus_cusps"], houses["placidus_cusps"])


def test_direct_house_policy_does_not_report_fallback_when_placidus_succeeds():
    moment = datetime(2024, 2, 4, 8, 26, 53, tzinfo=timezone.utc)
    cusps, ascmc, metadata = calculate_quadrant_houses(_to_jd_ut(moment), 37.5665, 126.9780)
    assert len(cusps) == 12
    assert len(ascmc) >= 2
    assert metadata["requested"] == metadata["used"] == "Placidus"
    assert metadata["fallback"] is False
