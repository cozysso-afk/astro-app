from __future__ import annotations

from datetime import date, datetime, time as dt_time, timedelta, timezone

import pytest

from integrated_fortune_v1 import (
    _annual_lichun_segments,
    _lichun_for_year,
    _month_jie_segments,
    _saju_payload,
    _true_solar_datetime,
)
from relationship_saju_v1 import _pillars


KST = timezone(timedelta(hours=9))

# Independent astronomical references for the 2024 solar terms.
# Hong Kong Observatory Almanac 2024 gives Hong Kong Time (UTC+8):
#   Spring Commences / 立春  2024-02-04 16:27
# Beijing Municipal Cultural Heritage Bureau publishes second precision:
#   立春 2024-02-04 16:26:53, 惊蛰 2024-03-05 10:22:31 (UTC+8).
# Product calculations convert these boundaries to the profile's fixed UTC offset.
LICHUN_2024_KST = datetime(2024, 2, 4, 17, 26, 53, tzinfo=KST)
JINGZHE_2024_KST = datetime(2024, 3, 5, 11, 22, 31, tzinfo=KST)


def test_2024_lichun_boundary_matches_independent_astronomical_reference():
    actual = _lichun_for_year(2024, 9.0)
    error_seconds = abs((actual - LICHUN_2024_KST).total_seconds())
    assert error_seconds <= 90, f"actual={actual.isoformat()} expected≈{LICHUN_2024_KST.isoformat()}"


def test_ganzhi_year_switches_at_exact_lichun_boundary():
    rows = _annual_lichun_segments(date(2024, 2, 4), date(2024, 2, 5), 9.0)
    assert len(rows) >= 2
    assert rows[0]["ganzhi"] == "癸卯"
    assert rows[1]["ganzhi"] == "甲辰"

    boundary = datetime.fromisoformat(rows[1]["segment_start"])
    assert abs((boundary - LICHUN_2024_KST).total_seconds()) <= 90
    assert datetime.fromisoformat(rows[0]["segment_end_exclusive"]) == boundary


def test_2024_jingzhe_boundary_and_month_ganzhi_switch_match_reference():
    rows = _month_jie_segments(date(2024, 3, 5), date(2024, 3, 6), 9.0)
    assert len(rows) >= 2
    assert rows[0]["ganzhi"] == "丙寅"
    assert rows[1]["ganzhi"] == "丁卯"
    assert rows[1]["jie_name"] in {"惊蛰", "驚蟄"}

    boundary = datetime.fromisoformat(rows[1]["segment_start"])
    assert abs((boundary - JINGZHE_2024_KST).total_seconds()) <= 90
    assert datetime.fromisoformat(rows[0]["segment_end_exclusive"]) == boundary


def test_true_solar_longitude_correction_is_four_minutes_per_degree():
    birth_date = date(2024, 4, 1)
    birth_time = dt_time(12, 0)
    at_standard, standard_meta = _true_solar_datetime(birth_date, birth_time, 135.0, 9.0)
    fifteen_degrees_west, west_meta = _true_solar_datetime(birth_date, birth_time, 120.0, 9.0)

    assert standard_meta["standard_meridian_east"] == 135.0
    assert standard_meta["longitude_correction_minutes"] == 0.0
    assert west_meta["longitude_correction_minutes"] == -60.0
    assert pytest.approx((at_standard - fifteen_degrees_west).total_seconds() / 60.0, abs=1e-6) == 60.0
    assert pytest.approx(
        standard_meta["total_correction_minutes"] - west_meta["total_correction_minutes"], abs=1e-4
    ) == 60.0


def test_relationship_and_integrated_saju_share_identical_true_solar_pillars():
    profile = {
        "birth_date": date(2000, 1, 1),
        "birth_time": dt_time(12, 0),
        "time_known": True,
        "time_source": "official_record",
        "time_confidence": "exact",
        "longitude": 120.0,
        "utc_offset_hours": 8.0,
    }
    relationship = _pillars(profile)
    integrated = _saju_payload(
        birth_date=profile["birth_date"],
        birth_time=profile["birth_time"],
        longitude=profile["longitude"],
        utc_offset_hours=profile["utc_offset_hours"],
        gender="female",
        start_date=date(2024, 2, 4),
        end_date=date(2024, 2, 5),
    )

    assert integrated["ok"] is True, integrated
    assert integrated["pillars"] == {
        "year": relationship["year"],
        "month": relationship["month"],
        "day": relationship["day"],
        "hour": relationship["hour"],
    }
    assert relationship["precision"] == "exact_true_solar"
