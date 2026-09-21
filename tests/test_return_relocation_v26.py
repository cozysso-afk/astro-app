from __future__ import annotations

from datetime import date, datetime, time, timezone

import pytest
from pydantic import ValidationError

from api.main import RelationshipProfile
import relationship_return_v1 as rr
from timezone_provenance_v1 import TimezoneResolutionError, resolve_profile_birth_datetime


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
        "timezone_id": "Asia/Seoul",
    }
    profile.update(overrides)
    return profile


def test_api_forecast_location_is_optional_additive_and_preserved():
    model = RelationshipProfile(
        **_profile(),
        forecast_location={
            "place_id": "synthetic-nyc",
            "latitude": 40.7128,
            "longitude": -74.006,
            "timezone_id": "America/New_York",
        },
    )
    payload = model.engine_payload()
    assert payload["forecast_location"]["timezone_id"] == "America/New_York"
    assert payload["forecast_location"]["latitude"] == 40.7128


def test_api_forecast_location_rejects_invalid_zone():
    with pytest.raises((ValidationError, TimezoneResolutionError)):
        RelationshipProfile(
            **_profile(),
            forecast_location={
                "latitude": 40.7128,
                "longitude": -74.006,
                "timezone_id": "Mars/Olympus",
            },
        )


def test_missing_forecast_location_never_reuses_birthplace_for_return_angles():
    profile = _profile()
    birth = resolve_profile_birth_datetime(profile)
    location = rr._resolve_return_location(profile, birth)
    assert location["source"] == "unavailable"
    assert location["latitude"] is None and location["longitude"] is None

    event = {"exact_utc": "2026-09-20T00:00:00+00:00"}
    reliability = {"time_exact": True}
    rr._attach_return_geometry(event, profile, reliability, location)
    assert event["angles"] == {}
    assert event["house_activations"] == []
    assert event["location_basis"].startswith("unavailable")
    assert event["return_location_provenance"]["angles_admitted"] is False


def test_explicit_forecast_location_drives_angles_and_houses():
    profile = _profile(
        forecast_location={
            "place_id": "synthetic-nyc",
            "latitude": 40.7128,
            "longitude": -74.006,
            "timezone_id": "America/New_York",
        }
    )
    birth = resolve_profile_birth_datetime(profile)
    location = rr._resolve_return_location(profile, birth)
    event = {"exact_utc": "2026-09-20T00:00:00+00:00"}
    rr._attach_return_geometry(event, profile, {"time_exact": True}, location)
    assert location["source"] == "forecast_location"
    assert event["angles"].get("ASC") is not None
    assert len(event["house_activations"]) == 4
    assert event["return_location_provenance"]["angles_admitted"] is True
    assert "latitude" not in event["return_location_provenance"]
    assert "longitude" not in event["return_location_provenance"]


def test_forecast_location_changes_geometry_not_planetary_positions():
    birth_profile = _profile()
    ny_profile = _profile(
        forecast_location={
            "latitude": 40.7128,
            "longitude": -74.006,
            "timezone_id": "America/New_York",
        }
    )
    birth = resolve_profile_birth_datetime(birth_profile)
    no_location = rr._resolve_return_location(birth_profile, birth)
    ny_location = rr._resolve_return_location(ny_profile, birth)
    base = {"exact_utc": "2026-09-20T00:00:00+00:00"}
    a, b = dict(base), dict(base)
    rr._attach_return_geometry(a, birth_profile, {"time_exact": True}, no_location)
    rr._attach_return_geometry(b, ny_profile, {"time_exact": True}, ny_location)
    assert a["positions"] == b["positions"]
    assert a["angles"] == {}
    assert b["angles"]


def test_forecast_timezone_controls_return_local_calendar_date():
    profile = _profile(
        forecast_location={
            "latitude": 40.7128,
            "longitude": -74.006,
            "timezone_id": "America/New_York",
        }
    )
    birth = resolve_profile_birth_datetime(profile)
    location = rr._resolve_return_location(profile, birth)
    instant = datetime(2026, 1, 1, 2, 0, tzinfo=timezone.utc)
    assert rr._local_iso_date(instant, location["tzinfo"]) == "2025-12-31"


def test_forecast_location_angles_still_require_exact_birth_time():
    profile = _profile(
        forecast_location={
            "latitude": 40.7128,
            "longitude": -74.006,
            "timezone_id": "America/New_York",
        }
    )
    birth = resolve_profile_birth_datetime(profile)
    location = rr._resolve_return_location(profile, birth)
    event = {"exact_utc": "2026-09-20T00:00:00+00:00"}
    rr._attach_return_geometry(event, profile, {"time_exact": False}, location)
    assert event["angles"] == {}
    assert event["house_activations"] == []
    assert event["return_location_provenance"]["angle_reason"] == "birth_time_not_exact"
