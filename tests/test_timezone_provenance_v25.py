from __future__ import annotations

from datetime import date, datetime, time, timezone

import pytest

import relationship_return_v1 as rr
import relationship_saju_v1 as rs
import relationship_western_v1 as rw
from timezone_provenance_v1 import (
    NonexistentLocalTimeError,
    TimezoneResolutionError,
    resolve_local_datetime,
    resolve_profile_birth_datetime,
)


def _profile(**overrides):
    profile = {
        "birth_date": date(1991, 3, 21),
        "birth_time": time(7, 26),
        "time_known": True,
        "time_source": "official_record",
        "time_confidence": "exact",
        "latitude": 37.5665,
        "longitude": 126.978,
        "utc_offset_hours": 9.0,
    }
    profile.update(overrides)
    return profile


def test_valid_iana_timezone_and_modern_seoul_match_fixed_offset():
    iana = resolve_local_datetime(date(2026, 1, 15), time(12), timezone_id="Asia/Seoul", utc_offset_hours=-4)
    fixed = resolve_local_datetime(date(2026, 1, 15), time(12), utc_offset_hours=9)
    assert iana.utc == fixed.utc == datetime(2026, 1, 15, 3, tzinfo=timezone.utc)
    assert iana.timezone_source == "iana"
    assert iana.resolved_utc_offset_hours == 9.0


def test_invalid_explicit_zone_fails_closed_instead_of_using_fixed_offset():
    with pytest.raises(TimezoneResolutionError, match="unknown IANA"):
        resolve_local_datetime(date(2026, 1, 1), time(12), timezone_id="Mars/Olympus", utc_offset_hours=9)


def test_missing_zone_uses_legacy_fixed_offset_and_default_sources():
    fixed = resolve_local_datetime(date(2026, 1, 1), time(12), utc_offset_hours=5.75)
    default = resolve_local_datetime(date(2026, 1, 1), time(12), utc_offset_hours=None)
    assert fixed.timezone_source == "fixed_offset"
    assert fixed.utc.hour == 6 and fixed.utc.minute == 15
    assert default.timezone_source == "legacy_default"
    assert default.resolved_utc_offset_hours == 9.0


def test_historical_korea_dst_comes_from_tzdata_and_differs_from_fixed_plus_nine():
    iana = resolve_local_datetime(date(1988, 8, 1), time(12), timezone_id="Asia/Seoul", utc_offset_hours=9)
    fixed = resolve_local_datetime(date(1988, 8, 1), time(12), utc_offset_hours=9)
    assert iana.resolved_utc_offset_hours == 10.0
    assert iana.utc == datetime(1988, 8, 1, 2, tzinfo=timezone.utc)
    assert iana.utc != fixed.utc


def test_historical_korea_dst_boundary_has_nonexistent_and_ambiguous_policies():
    with pytest.raises(NonexistentLocalTimeError):
        resolve_local_datetime(date(1988, 5, 8), time(2, 30), timezone_id="Asia/Seoul")
    earlier = resolve_local_datetime(date(1988, 10, 9), time(2, 30), timezone_id="Asia/Seoul")
    later = resolve_local_datetime(date(1988, 10, 9), time(2, 30), timezone_id="Asia/Seoul", fold=1)
    assert earlier.local_time_status == "ambiguous"
    assert earlier.fold == 0 and earlier.policy == "deterministic_fold_0"
    assert later.fold == 1 and later.policy == "explicit_fold"
    assert (later.utc - earlier.utc).total_seconds() == 3600


def test_new_york_winter_summer_and_transition_policy():
    winter = resolve_local_datetime(date(2026, 1, 15), time(12), timezone_id="America/New_York")
    summer = resolve_local_datetime(date(2026, 7, 15), time(12), timezone_id="America/New_York")
    assert winter.resolved_utc_offset_hours == -5.0
    assert summer.resolved_utc_offset_hours == -4.0
    with pytest.raises(NonexistentLocalTimeError):
        resolve_local_datetime(date(2026, 3, 8), time(2, 30), timezone_id="America/New_York")


def test_iana_takes_priority_without_double_applying_fixed_offset():
    resolved = resolve_local_datetime(
        date(1988, 8, 1), time(12), timezone_id="Asia/Seoul", utc_offset_hours=-4
    )
    assert resolved.utc == datetime(1988, 8, 1, 2, tzinfo=timezone.utc)
    assert resolved.resolved_utc_offset_hours == 10.0


def test_two_partner_birth_timezones_resolve_independently():
    seoul = resolve_profile_birth_datetime(_profile(timezone_id="Asia/Seoul"))
    new_york = resolve_profile_birth_datetime(
        _profile(timezone_id="America/New_York", utc_offset_hours=9)
    )
    assert seoul.resolved_utc_offset_hours == 9.0
    assert new_york.resolved_utc_offset_hours == -5.0
    assert seoul.utc != new_york.utc


def test_natal_progression_and_return_reuse_the_same_birth_utc():
    profile = _profile(
        birth_date=date(1988, 8, 1), birth_time=time(12),
        timezone_id="Asia/Seoul", utc_offset_hours=9,
    )
    resolved = resolve_profile_birth_datetime(profile)
    natal = rw._profile_chart(profile)
    target = datetime(2026, 9, 20, tzinfo=timezone.utc)
    progressed = rw._secondary_progressed_chart(profile, target)
    expected_jd = rw._jd_from_utc(resolved.utc) + (target - resolved.utc).total_seconds() / 86400 / rw.YEAR_DAYS
    assert abs(natal["jd_ut"] - rw._jd_from_utc(resolved.utc)) < 1e-7
    assert abs(progressed["jd_ut"] - expected_jd) < 1e-6
    assert rr._birth_utc(profile) == resolved.utc


def test_return_local_date_uses_iana_zone_at_event_instant():
    instant = datetime(1988, 8, 1, 14, 30, tzinfo=timezone.utc)
    resolved = resolve_local_datetime(date(1988, 8, 1), time(12), timezone_id="Asia/Seoul")
    assert rr._local_iso_date(instant, resolved.tzinfo) == "1988-08-02"


def test_saju_keeps_local_civil_time_but_receives_historical_legal_offset(monkeypatch):
    captured = {}

    def fake_components(local_date, local_time, offset, longitude):
        captured.update(date=local_date, time=local_time, offset=offset, longitude=longitude)
        return {
            "pillars": {"year": "甲子", "month": "乙丑", "day": "丙寅", "hour": "丁卯"},
            "true_solar_meta": {},
            "boundary_policy": "stub",
        }

    monkeypatch.setattr(rs, "_natal_saju_components", fake_components)
    profile = _profile(
        birth_date=date(1988, 8, 1), birth_time=time(12),
        timezone_id="Asia/Seoul", utc_offset_hours=9,
    )
    rs._pillars(profile)
    assert captured["date"] == date(1988, 8, 1)
    assert captured["time"] == time(12)
    assert captured["offset"] == 10.0
