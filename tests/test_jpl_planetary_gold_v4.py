from __future__ import annotations

from datetime import datetime, timezone

import pytest

from integrated_fortune_v1 import PLANET_KEYS, _planet_lon, _to_jd_ut
from personal_marriage_v1 import _positions as _marriage_positions
from relationship_western_v1 import _planet_positions


# External static goldens captured from NASA/JPL Horizons on 2026-09-05.
# Query contract:
#   EPHEM_TYPE='OBSERVER'
#   CENTER='500@399'        # Earth geocenter
#   QUANTITIES='31'         # ObsEcLon / ObsEcLat
#   ANG_FORMAT='DEG'
#   TIME_DIGITS='SECONDS'
#   exact epoch supplied through TLIST as Julian Date
# Horizons quantity 31 is observer-centered apparent ecliptic-of-date longitude,
# including light-time, gravitational deflection and stellar aberration.
# Source docs:
#   https://ssd.jpl.nasa.gov/horizons/manual.html
#   https://ssd-api.jpl.nasa.gov/doc/horizons.html
JPL_HORIZONS_PLANET_GOLD = (
    {
        "name": "J2000",
        "utc": datetime(2000, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
        "longitude": {
            "Sun": 280.368909200,
            "Moon": 223.323786000,
            "Mercury": 271.889269900,
            "Venus": 241.565779400,
            "Mars": 327.963292100,
            "Jupiter": 25.253068500,
            "Saturn": 40.395636600,
            "Uranus": 314.809168000,
            "Neptune": 303.193000700,
            "Pluto": 251.454764400,
        },
    },
    {
        "name": "Lichun 2024",
        "utc": datetime(2024, 2, 4, 8, 26, 53, tzinfo=timezone.utc),
        "longitude": {
            "Sun": 314.999815700,
            "Moon": 241.065459700,
            "Mercury": 298.679428000,
            "Venus": 284.773500000,
            "Mars": 293.180942600,
            "Jupiter": 37.640826300,
            "Saturn": 336.827219000,
            "Uranus": 49.116769900,
            "Neptune": 355.867811300,
            "Pluto": 300.461448800,
        },
    },
)

MAX_ERROR_ARCSEC = 2.0


def _angular_delta_deg(a: float, b: float) -> float:
    return abs((float(a) - float(b) + 180.0) % 360.0 - 180.0)


def _assert_matches_jpl(actual: float, expected: float, *, label: str) -> None:
    error_arcsec = _angular_delta_deg(actual, expected) * 3600.0
    assert error_arcsec <= MAX_ERROR_ARCSEC, (
        f"{label}: actual={actual:.9f}°, JPL={expected:.9f}°, "
        f"delta={error_arcsec:.3f} arcsec > {MAX_ERROR_ARCSEC:.1f} arcsec"
    )


@pytest.mark.parametrize("case", JPL_HORIZONS_PLANET_GOLD, ids=lambda case: case["name"])
def test_integrated_skyfield_planets_match_static_jpl_horizons_gold(case):
    assert set(case["longitude"]) == set(PLANET_KEYS)

    for body in PLANET_KEYS:
        _assert_matches_jpl(
            _planet_lon(body, case["utc"]),
            case["longitude"][body],
            label=f"{case['name']} integrated {body}",
        )


@pytest.mark.parametrize("case", JPL_HORIZONS_PLANET_GOLD, ids=lambda case: case["name"])
def test_relationship_and_personal_marriage_planets_match_static_jpl_horizons_gold(case):
    jd_ut = _to_jd_ut(case["utc"])
    relationship = _planet_positions(jd_ut, include_moon=True)
    marriage = _marriage_positions(jd_ut, include_moon=True)

    for body in PLANET_KEYS:
        expected = case["longitude"][body]
        _assert_matches_jpl(
            relationship[body]["lon"],
            expected,
            label=f"{case['name']} relationship {body}",
        )
        _assert_matches_jpl(
            marriage[body]["longitude"],
            expected,
            label=f"{case['name']} personal-marriage {body}",
        )
