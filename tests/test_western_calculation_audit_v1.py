from __future__ import annotations

from datetime import date, time as dt_time, timezone

import pytest

from integrated_fortune_v1 import PLANET_KEYS, _aware_local, _compute_houses, _planet_lon, _to_jd_ut
from relationship_western_v1 import _angles, _jd_from_utc, _planet_positions


def _angular_delta_deg(a: float, b: float) -> float:
    return abs((float(a) - float(b) + 180.0) % 360.0 - 180.0)


WESTERN_AUDIT_CASES = (
    {
        "name": "Greenwich J2000",
        "birth_date": date(2000, 1, 1),
        "birth_time": dt_time(12, 0),
        "latitude": 51.4779,
        "longitude": 0.0,
        "utc_offset_hours": 0.0,
    },
    {
        "name": "Seoul",
        "birth_date": date(2024, 2, 4),
        "birth_time": dt_time(17, 26, 53),
        "latitude": 37.5665,
        "longitude": 126.9780,
        "utc_offset_hours": 9.0,
    },
    {
        "name": "New York winter",
        "birth_date": date(2024, 1, 15),
        "birth_time": dt_time(12, 0),
        "latitude": 40.7128,
        "longitude": -74.0060,
        "utc_offset_hours": -5.0,
    },
    {
        "name": "Sydney winter",
        "birth_date": date(2024, 6, 15),
        "birth_time": dt_time(12, 0),
        "latitude": -33.8688,
        "longitude": 151.2093,
        "utc_offset_hours": 10.0,
    },
)


@pytest.mark.parametrize("case", WESTERN_AUDIT_CASES, ids=lambda case: case["name"])
def test_julian_day_path_is_identical_between_integrated_and_relationship_engines(case):
    local = _aware_local(case["birth_date"], case["birth_time"], case["utc_offset_hours"])
    utc = local.astimezone(timezone.utc)
    assert abs(_to_jd_ut(utc) - _jd_from_utc(utc)) <= 1e-9


@pytest.mark.parametrize("case", WESTERN_AUDIT_CASES, ids=lambda case: case["name"])
def test_skyfield_and_swiss_ephemeris_planet_longitudes_stay_within_six_arcminutes(case):
    local = _aware_local(case["birth_date"], case["birth_time"], case["utc_offset_hours"])
    utc = local.astimezone(timezone.utc)
    jd_ut = _to_jd_ut(utc)
    swiss = _planet_positions(jd_ut, include_moon=True)

    errors_arcmin = {}
    for body in PLANET_KEYS:
        skyfield_lon = _planet_lon(body, utc)
        swiss_lon = float(swiss[body]["lon"])
        error_arcmin = _angular_delta_deg(skyfield_lon, swiss_lon) * 60.0
        errors_arcmin[body] = error_arcmin
        assert error_arcmin <= 6.0, (
            f"{case['name']} {body}: Skyfield={skyfield_lon:.6f}°, "
            f"Swiss={swiss_lon:.6f}°, Δ={error_arcmin:.3f}′"
        )

    assert max(errors_arcmin.values()) <= 6.0


@pytest.mark.parametrize("case", WESTERN_AUDIT_CASES, ids=lambda case: case["name"])
def test_house_axes_and_placidus_cusps_are_identical_across_product_paths(case):
    local = _aware_local(case["birth_date"], case["birth_time"], case["utc_offset_hours"])
    utc = local.astimezone(timezone.utc)
    jd_ut = _to_jd_ut(utc)

    integrated = _compute_houses(utc, case["latitude"], case["longitude"])
    relationship = _angles(jd_ut, case["latitude"], case["longitude"])

    assert _angular_delta_deg(integrated["asc"], relationship["ASC"]) <= 1e-5
    assert _angular_delta_deg(integrated["mc"], relationship["MC"]) <= 1e-5
    assert len(integrated["placidus_cusps"]) == len(relationship["placidus_cusps"]) == 12
    for index, (left, right) in enumerate(zip(integrated["placidus_cusps"], relationship["placidus_cusps"]), start=1):
        assert _angular_delta_deg(left, right) <= 1e-5, f"{case['name']} cusp {index}: {left} vs {right}"
