from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pytest

from integrated_fortune_v1 import _month_jie_segments, _planet_lon, _to_jd_ut
from relationship_western_v1 import _planet_positions


# Independent external corpus: Hong Kong Observatory Almanac 2024.
# HKO states its 24-solar-term astronomical data is based on HM Nautical
# Almanac Office (UK) and United States Naval Observatory data, and publishes
# the event times in Hong Kong Time (UTC+8). HKO also defines the terms by
# 15-degree steps of the Sun's ecliptic longitude.
#
# Sources:
# https://www.hko.gov.hk/en/gts/astronomy/Solar_Term.htm
# https://www.hko.gov.hk/en/gts/time/24solarterms.htm
# https://www.weather.gov.hk/en/gts/astron2024/files/HKO_almanac_2024.pdf

HKT = timezone(timedelta(hours=8))

# The 12 Jie (節) boundaries used by the Saju month pillar. HKO publishes
# minute precision, so the boundary tolerance below is deliberately wider
# than one minute while still tight enough to catch civil-date/hour errors.
HKO_2024_JIE = (
    ("Moderate Cold", datetime(2024, 1, 6, 4, 49, tzinfo=HKT), 285.0),
    ("Spring Commences", datetime(2024, 2, 4, 16, 27, tzinfo=HKT), 315.0),
    ("Insects Waken", datetime(2024, 3, 5, 10, 23, tzinfo=HKT), 345.0),
    ("Bright and Clear", datetime(2024, 4, 4, 15, 2, tzinfo=HKT), 15.0),
    ("Summer Commences", datetime(2024, 5, 5, 8, 10, tzinfo=HKT), 45.0),
    ("Corn on Ear", datetime(2024, 6, 5, 12, 10, tzinfo=HKT), 75.0),
    ("Moderate Heat", datetime(2024, 7, 6, 22, 20, tzinfo=HKT), 105.0),
    ("Autumn Commences", datetime(2024, 8, 7, 8, 9, tzinfo=HKT), 135.0),
    ("White Dew", datetime(2024, 9, 7, 11, 11, tzinfo=HKT), 165.0),
    ("Cold Dew", datetime(2024, 10, 8, 3, 0, tzinfo=HKT), 195.0),
    ("Winter Commences", datetime(2024, 11, 7, 6, 20, tzinfo=HKT), 225.0),
    ("Heavy Snow", datetime(2024, 12, 6, 23, 17, tzinfo=HKT), 255.0),
)


def _angular_delta_deg(a: float, b: float) -> float:
    return abs((float(a) - float(b) + 180.0) % 360.0 - 180.0)


def _closest_jie_boundary(expected_absolute: datetime, offset_hours: float) -> datetime:
    tz = timezone(timedelta(hours=float(offset_hours)))
    expected_local = expected_absolute.astimezone(tz)
    local_day = expected_local.date()
    rows = _month_jie_segments(local_day - timedelta(days=1), local_day + timedelta(days=1), offset_hours)
    starts = [datetime.fromisoformat(row["segment_start"]) for row in rows if row.get("segment_start")]
    assert starts, f"no Jie segment starts around {expected_local.isoformat()}"
    return min(starts, key=lambda value: abs((value.astimezone(timezone.utc) - expected_absolute.astimezone(timezone.utc)).total_seconds()))


@pytest.mark.parametrize("name,expected_hkt,expected_sun_lon", HKO_2024_JIE, ids=lambda value: value if isinstance(value, str) else None)
def test_all_2024_jie_boundaries_match_hko_almanac(name, expected_hkt, expected_sun_lon):
    actual = _closest_jie_boundary(expected_hkt, 8.0)
    error_seconds = abs((actual - expected_hkt).total_seconds())
    assert error_seconds <= 120, (
        f"{name}: engine={actual.isoformat()} HKO≈{expected_hkt.isoformat()} Δ={error_seconds:.1f}s"
    )


@pytest.mark.parametrize("name,expected_hkt,expected_sun_lon", HKO_2024_JIE, ids=lambda value: value if isinstance(value, str) else None)
def test_hko_jie_instants_are_external_sun_longitude_goldens(name, expected_hkt, expected_sun_lon):
    utc = expected_hkt.astimezone(timezone.utc)
    jd_ut = _to_jd_ut(utc)

    skyfield_lon = _planet_lon("Sun", utc)
    swiss_lon = float(_planet_positions(jd_ut, include_moon=False)["Sun"]["lon"])

    skyfield_error_arcmin = _angular_delta_deg(skyfield_lon, expected_sun_lon) * 60.0
    swiss_error_arcmin = _angular_delta_deg(swiss_lon, expected_sun_lon) * 60.0

    # The HKO source is minute-rounded and the product engines do not use the
    # exact same apparent/geometric reduction pipeline as HKO. Six arcminutes
    # is still a strict regression guard while accommodating those conventions.
    assert skyfield_error_arcmin <= 6.0, (
        f"{name}: Skyfield Sun={skyfield_lon:.6f}°, expected≈{expected_sun_lon:.3f}°, "
        f"Δ={skyfield_error_arcmin:.3f}′"
    )
    assert swiss_error_arcmin <= 6.0, (
        f"{name}: Swiss Sun={swiss_lon:.6f}°, expected≈{expected_sun_lon:.3f}°, "
        f"Δ={swiss_error_arcmin:.3f}′"
    )


@pytest.mark.parametrize("offset_hours", [8.0, 9.0, 5.75, -3.5])
def test_lichun_absolute_instant_survives_fractional_timezone_conversion(offset_hours):
    expected_hkt = HKO_2024_JIE[1][1]
    actual = _closest_jie_boundary(expected_hkt, offset_hours)
    error_seconds = abs(
        (actual.astimezone(timezone.utc) - expected_hkt.astimezone(timezone.utc)).total_seconds()
    )
    assert error_seconds <= 120, (
        f"UTC{offset_hours:+}: engine={actual.isoformat()} HKO={expected_hkt.isoformat()} Δ={error_seconds:.1f}s"
    )
