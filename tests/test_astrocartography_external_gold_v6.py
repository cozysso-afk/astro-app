from __future__ import annotations

from datetime import datetime, timezone

import pytest
import swisseph as swe

from astrocartography_v1 import BODIES, _astrocartography_lines, _planet_equatorial


def _angular_delta_deg(a: float, b: float) -> float:
    return abs((float(a) - float(b) + 180.0) % 360.0 - 180.0)


def _jd(moment: datetime) -> float:
    hour = moment.hour + moment.minute / 60.0 + moment.second / 3600.0
    return swe.julday(moment.year, moment.month, moment.day, hour, swe.GREG_CAL)


# Static external gold captured once from authoritative services, then frozen so
# normal CI never depends on network availability.
#
# JPL Horizons:
#   CENTER='500@399', QUANTITIES='2' (apparent RA & DEC), degrees.
# USNO Astronomical Applications:
#   /api/siderealtime, Greenwich apparent sidereal time (GAST), UT1 input.
EXTERNAL_CASES = (
    {
        "name": "J2000",
        "moment": datetime(2000, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
        "gast_hours": 18.697138167,
        "bodies": {
            "Sun": (281.278380000, -23.032430000),
            "Moon": (222.452200000, -10.900650000),
            "Mercury": (272.074640000, -24.418900000),
            "Venus": (239.892760000, -18.448920000),
            "Mars": (330.516800000, -13.182480000),
            "Jupiter": (23.867840000, 8.594260000),
            "Saturn": (38.765390000, 12.614760000),
            "Uranus": (317.474810000, -17.020330000),
            "Neptune": (305.432830000, -19.213240000),
            "Pluto": (251.419170000, -11.394270000),
        },
        "mc_ic": {
            "Sun": (0.821307500, -179.178692500),
            "Moon": (-58.004872500, 121.995127500),
            "Mercury": (-8.382432500, 171.617567500),
            "Venus": (-40.564312500, 139.435687500),
            "Mars": (50.059727500, -129.940272500),
            "Jupiter": (103.410767500, -76.589232500),
            "Saturn": (118.308317500, -61.691682500),
            "Uranus": (37.017737500, -142.982262500),
            "Neptune": (24.975757500, -155.024242500),
            "Pluto": (-29.037902500, 150.962097500),
        },
        "horizon": {
            ("Sun", "ASC", -60): -136.601733289,
            ("Sun", "ASC", 0): -89.178692505,
            ("Sun", "DC", 60): 43.398266711,
            ("Moon", "ASC", -30): -154.388613927,
            ("Moon", "DC", 30): 25.611386073,
            ("Jupiter", "ASC", 60): -1.764379996,
            ("Jupiter", "DC", -60): 178.235620004,
        },
    },
    {
        "name": "Lichun 2024",
        "moment": datetime(2024, 2, 4, 8, 26, 53, tzinfo=timezone.utc),
        "gast_hours": 17.382085833,
        "bodies": {
            "Sun": (317.463860000, -16.335720000),
            "Moon": (238.147160000, -23.785840000),
            "Mercury": (301.104550000, -21.765860000),
            "Venus": (285.980470000, -22.151070000),
            "Mars": (295.176890000, -22.302260000),
            "Jupiter": (35.622560000, 13.096130000),
            "Saturn": (339.165730000, -10.501370000),
            "Uranus": (46.746690000, 17.219680000),
            "Neptune": (356.693060000, -2.763520000),
            "Pluto": (303.315950000, -22.797520000),
        },
        "mc_ic": {
            "Sun": (56.732572500, -123.267427500),
            "Moon": (-22.584127500, 157.415872500),
            "Mercury": (40.373262500, -139.626737500),
            "Venus": (25.249182500, -154.750817500),
            "Mars": (34.445602500, -145.554397500),
            "Jupiter": (134.891272500, -45.108727500),
            "Saturn": (78.434442500, -101.565557500),
            "Uranus": (146.015402500, -33.984597500),
            "Neptune": (95.961772500, -84.038227500),
            "Pluto": (42.584662500, -137.415337500),
        },
        "horizon": {
            ("Sun", "ASC", -60): -63.775480740,
            ("Sun", "ASC", 0): -33.267427495,
            ("Sun", "DC", 60): 116.224519260,
            ("Moon", "ASC", -30): -127.326392069,
            ("Moon", "DC", 30): 52.673607931,
            ("Jupiter", "ASC", 60): 21.129326222,
            ("Jupiter", "DC", -60): -158.870673778,
        },
    },
)


def _line_map(lines):
    return {(row["planet"], row["angle"]): row for row in lines}


def _point_at_lat(line: dict, latitude: int) -> dict:
    for segment in line["segments"]:
        for point in segment:
            if abs(float(point["latitude"]) - float(latitude)) <= 1e-9:
                return point
    raise AssertionError(f"latitude {latitude} missing from {line['planet']} {line['angle']}")


@pytest.mark.parametrize("case", EXTERNAL_CASES, ids=lambda case: case["name"])
def test_astrocartography_equatorial_positions_match_jpl_apparent_ra_dec(case):
    jd = _jd(case["moment"])
    actual = _planet_equatorial(jd)
    assert set(actual) == set(BODIES) == set(case["bodies"])

    for body, (gold_ra, gold_dec) in case["bodies"].items():
        actual_ra, actual_dec = actual[body]
        ra_error_arcsec = _angular_delta_deg(actual_ra, gold_ra) * 3600.0
        dec_error_arcsec = abs(float(actual_dec) - gold_dec) * 3600.0
        assert ra_error_arcsec <= 1.5, (
            f"{case['name']} {body} RA: actual={actual_ra:.9f} gold={gold_ra:.9f} "
            f"Δ={ra_error_arcsec:.3f}″"
        )
        assert dec_error_arcsec <= 1.5, (
            f"{case['name']} {body} DEC: actual={actual_dec:.9f} gold={gold_dec:.9f} "
            f"Δ={dec_error_arcsec:.3f}″"
        )


@pytest.mark.parametrize("case", EXTERNAL_CASES, ids=lambda case: case["name"])
def test_astrocartography_sidereal_time_matches_usno_gast(case):
    actual_gast_deg = float(swe.sidtime(_jd(case["moment"]))) * 15.0
    gold_gast_deg = float(case["gast_hours"]) * 15.0
    error_arcsec = _angular_delta_deg(actual_gast_deg, gold_gast_deg) * 3600.0
    assert error_arcsec <= 1.5, (
        f"{case['name']}: Swiss={actual_gast_deg / 15.0:.9f}h "
        f"USNO={case['gast_hours']:.9f}h Δ={error_arcsec:.3f}″"
    )


@pytest.mark.parametrize("case", EXTERNAL_CASES, ids=lambda case: case["name"])
def test_mc_ic_world_lines_match_jpl_ra_plus_usno_gast_gold(case):
    jd = _jd(case["moment"])
    lines = _line_map(_astrocartography_lines(jd, _planet_equatorial(jd)))
    assert len(lines) == len(BODIES) * 4 == 40

    for body, (gold_mc, gold_ic) in case["mc_ic"].items():
        actual_mc = float(lines[(body, "MC")]["segments"][0][0]["longitude"])
        actual_ic = float(lines[(body, "IC")]["segments"][0][0]["longitude"])
        assert _angular_delta_deg(actual_mc, gold_mc) <= 0.0005, (
            f"{case['name']} {body} MC: actual={actual_mc} gold={gold_mc}"
        )
        assert _angular_delta_deg(actual_ic, gold_ic) <= 0.0005, (
            f"{case['name']} {body} IC: actual={actual_ic} gold={gold_ic}"
        )


@pytest.mark.parametrize("case", EXTERNAL_CASES, ids=lambda case: case["name"])
def test_selected_asc_dc_world_line_points_match_external_geometry_gold(case):
    jd = _jd(case["moment"])
    lines = _line_map(_astrocartography_lines(jd, _planet_equatorial(jd)))

    for (body, angle, latitude), gold_lon in case["horizon"].items():
        point = _point_at_lat(lines[(body, angle)], latitude)
        actual_lon = float(point["longitude"])
        # Horizon longitude is more sensitive to declination near high latitude;
        # 0.002 degrees is 7.2 arcsec and still far below map-pixel resolution.
        assert _angular_delta_deg(actual_lon, gold_lon) <= 0.002, (
            f"{case['name']} {body}-{angle} lat={latitude}: "
            f"actual={actual_lon} gold={gold_lon}"
        )


@pytest.mark.parametrize("case", EXTERNAL_CASES, ids=lambda case: case["name"])
def test_world_line_segments_never_draw_across_antimeridian(case):
    jd = _jd(case["moment"])
    lines = _astrocartography_lines(jd, _planet_equatorial(jd))

    for line in lines:
        for segment in line["segments"]:
            assert len(segment) >= 2
            for left, right in zip(segment, segment[1:]):
                jump = abs(float(right["longitude"]) - float(left["longitude"]))
                assert jump <= 180.0, f"{case['name']} {line['planet']}-{line['angle']} jump={jump}"
