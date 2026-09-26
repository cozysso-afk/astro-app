from __future__ import annotations

from datetime import date, datetime, time, timezone

import pytest
from pydantic import ValidationError

from api.main import RelationshipProfile
import relationship_return_v1 as rr
from timezone_provenance_v1 import resolve_profile_birth_datetime


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


def _interval(start, end, zone="America/New_York", lat=40.7128, lon=-74.006):
    return {
        "start_utc": start,
        "end_utc": end,
        "latitude": lat,
        "longitude": lon,
        "timezone_id": zone,
    }


def test_api_timeline_is_additive_normalized_and_preserved():
    model = RelationshipProfile(
        **_profile(),
        forecast_location_timeline=[_interval(
            "2026-09-20T09:00:00+09:00",
            "2026-09-21T09:00:00+09:00",
        )],
    )
    payload = model.engine_payload()
    row = payload["forecast_location_timeline"][0]
    assert row["start_utc"] == datetime(2026, 9, 20, 0, 0, tzinfo=timezone.utc)
    assert row["end_utc"] == datetime(2026, 9, 21, 0, 0, tzinfo=timezone.utc)


def test_api_timeline_rejects_naive_and_reversed_intervals():
    with pytest.raises(ValidationError):
        RelationshipProfile(
            **_profile(),
            forecast_location_timeline=[_interval(
                datetime(2026, 9, 20, 0, 0),
                datetime(2026, 9, 21, 0, 0, tzinfo=timezone.utc),
            )],
        )
    with pytest.raises(ValidationError):
        RelationshipProfile(
            **_profile(),
            forecast_location_timeline=[_interval(
                "2026-09-21T00:00:00+00:00",
                "2026-09-20T00:00:00+00:00",
            )],
        )


def test_api_timeline_rejects_overlap_but_allows_adjacent():
    with pytest.raises(ValidationError):
        RelationshipProfile(
            **_profile(),
            forecast_location_timeline=[
                _interval("2026-09-20T00:00:00+00:00", "2026-09-22T00:00:00+00:00"),
                _interval("2026-09-21T00:00:00+00:00", "2026-09-23T00:00:00+00:00"),
            ],
        )
    model = RelationshipProfile(
        **_profile(),
        forecast_location_timeline=[
            _interval("2026-09-20T00:00:00+00:00", "2026-09-21T00:00:00+00:00"),
            _interval(
                "2026-09-21T00:00:00+00:00", "2026-09-22T00:00:00+00:00",
                zone="Asia/Tokyo", lat=35.6762, lon=139.6503,
            ),
        ],
    )
    assert len(model.forecast_location_timeline) == 2


def test_timeline_match_overrides_static_and_end_is_half_open():
    profile = _profile(
        forecast_location={
            "latitude": 51.5074, "longitude": -0.1278, "timezone_id": "Europe/London"
        },
        forecast_location_timeline=[_interval(
            "2026-09-20T00:00:00+00:00", "2026-09-21T00:00:00+00:00"
        )],
    )
    birth = resolve_profile_birth_datetime(profile)
    timeline = rr._normalize_forecast_timeline(profile)
    inside = rr._resolve_return_location(
        profile, birth, instant="2026-09-20T12:00:00+00:00", timeline=timeline
    )
    at_end = rr._resolve_return_location(
        profile, birth, instant="2026-09-21T00:00:00+00:00", timeline=timeline
    )
    assert inside["source"] == "forecast_location_timeline"
    assert inside["provenance"]["timeline_index"] == 0
    assert inside["provenance"]["timezone_id"] == "America/New_York"
    assert at_end["source"] == "forecast_location"
    assert at_end["provenance"]["timezone_id"] == "Europe/London"


def test_outside_timeline_without_static_omits_angles_and_houses():
    profile = _profile(
        forecast_location_timeline=[_interval(
            "2026-09-20T00:00:00+00:00", "2026-09-21T00:00:00+00:00"
        )]
    )
    birth = resolve_profile_birth_datetime(profile)
    timeline = rr._normalize_forecast_timeline(profile)
    location = rr._resolve_return_location(
        profile, birth, instant="2026-09-22T00:00:00+00:00", timeline=timeline
    )
    event = {"exact_utc": "2026-09-22T00:00:00+00:00"}
    rr._attach_return_geometry(event, profile, {"time_exact": True}, location)
    assert location["source"] == "unavailable"
    assert event["angles"] == {}
    assert event["house_activations"] == []


def test_timeline_timezone_controls_event_calendar_date():
    profile = _profile(
        forecast_location_timeline=[_interval(
            "2026-01-01T00:00:00+00:00", "2026-01-02T00:00:00+00:00"
        )]
    )
    birth = resolve_profile_birth_datetime(profile)
    timeline = rr._normalize_forecast_timeline(profile)
    instant = datetime(2026, 1, 1, 2, 0, tzinfo=timezone.utc)
    location = rr._resolve_return_location(profile, birth, instant=instant, timeline=timeline)
    assert rr._local_iso_date(instant, location["tzinfo"]) == "2025-12-31"


def test_timeline_location_changes_geometry_not_planetary_positions_and_hides_coordinates():
    profile = _profile()
    birth = resolve_profile_birth_datetime(profile)
    instant = "2026-09-20T12:00:00+00:00"
    ny = rr._build_return_location(
        {"latitude": 40.7128, "longitude": -74.006, "timezone_id": "America/New_York"},
        birth, source="forecast_location_timeline", timeline_index=0,
    )
    tokyo = rr._build_return_location(
        {"latitude": 35.6762, "longitude": 139.6503, "timezone_id": "Asia/Tokyo"},
        birth, source="forecast_location_timeline", timeline_index=1,
    )
    a = {"exact_utc": instant}
    b = {"exact_utc": instant}
    rr._attach_return_geometry(a, profile, {"time_exact": True}, ny)
    rr._attach_return_geometry(b, profile, {"time_exact": True}, tokyo)
    assert a["positions"] == b["positions"]
    assert a["angles"]["ASC"] != b["angles"]["ASC"]
    for event in (a, b):
        provenance = event["return_location_provenance"]
        assert provenance["source"] == "forecast_location_timeline"
        assert "latitude" not in provenance and "longitude" not in provenance


def test_top_level_timeline_provenance_is_policy_only():
    profile = _profile(
        forecast_location_timeline=[_interval(
            "2026-09-20T00:00:00+00:00", "2026-09-21T00:00:00+00:00"
        )]
    )
    birth = resolve_profile_birth_datetime(profile)
    timeline = rr._normalize_forecast_timeline(profile)
    provenance = rr._return_location_policy_provenance(profile, birth, timeline)
    assert provenance["source"] == "forecast_location_timeline"
    assert provenance["timeline_interval_count"] == 1
    assert "latitude" not in provenance and "longitude" not in provenance
