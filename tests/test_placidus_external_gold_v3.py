from __future__ import annotations

from datetime import date, time as dt_time, timezone

import pytest

from integrated_fortune_v1 import _aware_local, _compute_houses
from personal_marriage_v1 import (
    _house_data as _marriage_house_data,
    _jd as _marriage_jd,
    _utc_datetime as _marriage_utc_datetime,
)
from relationship_western_v1 import _angles, _jd_from_utc


ARCSECOND_DEG = 1.0 / 3600.0


def _dms(base: float, degree: int, minute: int, second: float) -> float:
    return float(base) + float(degree) + float(minute) / 60.0 + float(second) / 3600.0


def _angular_delta_deg(a: float, b: float) -> float:
    return abs((float(a) - float(b) + 180.0) % 360.0 - 180.0)


# Independent hand-calculated Placidus worked examples.
# Source: "Placidus House Cusps Calculation - Worked Example" (Hermetic Astrology,
# mirrored on Scribd). The article publishes the complete 12-cusp results to
# thousandths of an arcsecond and shows the iterative Placidus arithmetic.
#
# A separate Astrotheme Botswana chart independently corroborates the southern
# example to the nearest arcminute, including ASC, MC, and all 12 house cusps.
PLACIDUS_EXTERNAL_GOLD = (
    {
        "name": "Germany reunification, Berlin",
        "birth_date": date(1990, 10, 3),
        "birth_time": dt_time(0, 0, 0),
        "utc_offset_hours": 1.0,
        "latitude": 52.51627778,
        "longitude": 13.37772222,
        "cusps": (
            _dms(120, 4, 23, 28.760),
            _dms(120, 20, 37, 57.564),
            _dms(150, 11, 31, 24.546),
            _dms(180, 10, 38, 13.266),
            _dms(210, 20, 30, 28.766),
            _dms(270, 2, 28, 46.095),
            _dms(300, 4, 23, 28.760),
            _dms(300, 20, 37, 57.564),
            _dms(330, 11, 31, 24.546),
            _dms(0, 10, 38, 13.266),
            _dms(30, 20, 30, 28.766),
            _dms(90, 2, 28, 46.095),
        ),
    },
    {
        "name": "Botswana independence, Gaborone",
        "birth_date": date(1966, 9, 30),
        "birth_time": dt_time(0, 0, 0),
        "utc_offset_hours": 2.0,
        "latitude": -24.65805556,
        "longitude": 25.91083333,
        "cusps": (
            _dms(60, 23, 19, 29.389),
            _dms(90, 25, 21, 57.870),
            _dms(150, 0, 16, 31.134),
            _dms(180, 4, 29, 22.690),
            _dms(210, 4, 21, 30.362),
            _dms(210, 29, 51, 10.020),
            _dms(240, 23, 19, 29.389),
            _dms(270, 25, 21, 57.870),
            _dms(330, 0, 16, 31.134),
            _dms(0, 4, 29, 22.690),
            _dms(30, 4, 21, 30.362),
            _dms(30, 29, 51, 10.020),
        ),
    },
)


def _engine_house_sets(case):
    integrated_local = _aware_local(case["birth_date"], case["birth_time"], case["utc_offset_hours"])
    integrated_utc = integrated_local.astimezone(timezone.utc)
    integrated = _compute_houses(integrated_utc, case["latitude"], case["longitude"])

    relationship_jd = _jd_from_utc(integrated_utc)
    relationship = _angles(relationship_jd, case["latitude"], case["longitude"])

    marriage_utc = _marriage_utc_datetime(
        case["birth_date"], case["birth_time"], case["utc_offset_hours"]
    )
    marriage = _marriage_house_data(
        _marriage_jd(marriage_utc), case["latitude"], case["longitude"]
    )

    return {
        "integrated": (
            float(integrated["asc"]),
            float(integrated["mc"]),
            tuple(float(x) for x in integrated["placidus_cusps"]),
        ),
        "relationship": (
            float(relationship["ASC"]),
            float(relationship["MC"]),
            tuple(float(x) for x in relationship["placidus_cusps"]),
        ),
        "marriage": (
            float(marriage["asc"]),
            float(marriage["mc"]),
            tuple(float(x) for x in marriage["placidus_cusps"]),
        ),
    }


@pytest.mark.parametrize("case", PLACIDUS_EXTERNAL_GOLD, ids=lambda case: case["name"])
def test_three_western_product_paths_match_external_hand_calculated_placidus_gold(case):
    expected = case["cusps"]
    engine_sets = _engine_house_sets(case)

    for engine_name, (asc, mc, cusps) in engine_sets.items():
        assert len(cusps) == 12
        assert _angular_delta_deg(asc, expected[0]) <= ARCSECOND_DEG, (
            f"{case['name']} {engine_name} ASC: actual={asc:.9f} expected={expected[0]:.9f}"
        )
        assert _angular_delta_deg(mc, expected[9]) <= ARCSECOND_DEG, (
            f"{case['name']} {engine_name} MC: actual={mc:.9f} expected={expected[9]:.9f}"
        )
        for house_number, (actual, gold) in enumerate(zip(cusps, expected), start=1):
            assert _angular_delta_deg(actual, gold) <= ARCSECOND_DEG, (
                f"{case['name']} {engine_name} H{house_number}: "
                f"actual={actual:.9f} expected={gold:.9f}"
            )


@pytest.mark.parametrize("case", PLACIDUS_EXTERNAL_GOLD, ids=lambda case: case["name"])
def test_external_gold_preserves_opposite_cusp_geometry(case):
    cusps = case["cusps"]
    for index in range(6):
        assert _angular_delta_deg(cusps[index] + 180.0, cusps[index + 6]) <= 1e-10
