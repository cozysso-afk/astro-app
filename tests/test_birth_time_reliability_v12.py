from __future__ import annotations

from datetime import date, time as dt_time

from api.main import RelationshipProfile
from birth_time_reliability_v1 import resolve_birth_time_reliability
from relationship_saju_v1 import _pillars
from relationship_western_v1 import _profile_chart, build_relationship_western


def _profile(
    *,
    birth_time=dt_time(19, 0),
    time_known=True,
    time_source="official_record",
    time_confidence="exact",
    latitude=34.7604,
    longitude=127.6622,
):
    return {
        "name": "test",
        "birth_date": date(1992, 2, 29),
        "birth_time": birth_time,
        "time_known": time_known,
        "time_source": time_source,
        "time_confidence": time_confidence,
        "latitude": latitude,
        "longitude": longitude,
        "utc_offset_hours": 9.0,
    }


def test_legacy_entered_time_is_preserved_but_not_silently_promoted_to_exact():
    legacy = {
        "birth_date": date(1992, 2, 29),
        "birth_time": dt_time(19, 0),
        "time_known": True,
        "latitude": 34.7604,
        "longitude": 127.6622,
        "utc_offset_hours": 9.0,
    }
    reliability = resolve_birth_time_reliability(legacy)
    assert reliability["time_available"] is True
    assert reliability["time_exact"] is False
    assert reliability["status"] == "provisional"
    assert reliability["time_source"] == "unknown"
    assert reliability["time_confidence"] == "unknown"

    chart = _profile_chart(legacy, allow_unknown_time=True)
    assert chart is not None
    assert chart["utc"].startswith("1992-02-29T10:00:00")  # entered 19:00 KST, not noon proxy
    assert "Moon" in chart["positions"]
    assert chart["angles"] == {}
    assert chart["time_reliability"]["time_exact"] is False


def test_exact_requires_both_exact_confidence_and_supported_provenance():
    official = resolve_birth_time_reliability(_profile())
    assert official["time_exact"] is True

    family = resolve_birth_time_reliability(_profile(time_source="family_memory", time_confidence="exact"))
    assert family["time_available"] is True
    assert family["time_exact"] is False

    estimated = resolve_birth_time_reliability(_profile(time_source="user_estimate", time_confidence="high"))
    assert estimated["time_exact"] is False

    rectified = resolve_birth_time_reliability(_profile(time_source="rectified", time_confidence="exact"))
    assert rectified["time_exact"] is True


def test_unknown_time_uses_noon_proxy_without_moon_or_angles():
    profile = _profile(birth_time=None, time_known=False, time_source="unknown", time_confidence="unknown")
    reliability = resolve_birth_time_reliability(profile)
    assert reliability["time_available"] is False
    assert reliability["time_exact"] is False
    chart = _profile_chart(profile, allow_unknown_time=True)
    assert chart is not None
    assert chart["utc"].startswith("1992-02-29T03:00:00")
    assert "Moon" not in chart["positions"]
    assert chart["angles"] == {}


def test_relationship_builder_keeps_provisional_planet_layers_but_disables_exact_time_layers():
    user = _profile(
        birth_time=dt_time(7, 26),
        time_source="official_record",
        time_confidence="exact",
    )
    counterpart = _profile(
        birth_time=dt_time(19, 0),
        time_source="user_estimate",
        time_confidence="low",
        latitude=35.1595,
        longitude=126.8526,
    )
    out = build_relationship_western(
        user,
        counterpart,
        [(date(2026, 9, 1), date(2026, 9, 30))],
        analysis_mode="reunion",
    )
    assert out["ok"] is True
    assert out["birth_time_reliability"]["counterpart"]["time_available"] is True
    assert out["birth_time_reliability"]["counterpart"]["time_exact"] is False
    assert out["natal_synastry"]["partner_time_available"] is True
    assert out["natal_synastry"]["partner_time_exact"] is False
    assert out["house_overlays"]["available"] is False
    assert out["davison"]["available"] is False
    assert out["marks"]["available"] is False
    month = out["months"][0]
    assert month["progressed_synastry"]["available"] is True
    assert month["progressed_synastry"]["precision"] == "provisional"
    assert month["progressed_composite"]["available"] is True
    assert month["progressed_composite"]["precision"] == "provisional"
    assert month["marks_tertiary"]["available"] is False


def test_verified_exact_profiles_still_unlock_exact_layers():
    user = _profile(birth_time=dt_time(7, 26))
    counterpart = _profile(birth_time=dt_time(19, 0), latitude=35.1595, longitude=126.8526)
    out = build_relationship_western(
        user,
        counterpart,
        [(date(2026, 9, 1), date(2026, 9, 30))],
    )
    assert out["natal_synastry"]["partner_time_exact"] is True
    assert out["house_overlays"]["available"] is True
    assert out["davison"]["available"] is True
    assert out["marks"]["available"] is True
    assert out["months"][0]["progressed_synastry"]["precision"] == "exact"


def test_relationship_saju_marks_entered_unverified_time_as_provisional_not_exact():
    p = _pillars(_profile(time_source="arbitrary_input", time_confidence="low"))
    assert p["hour"] is not None
    assert p["precision"] == "provisional_true_solar"
    assert p["time_reliability"]["time_available"] is True
    assert p["time_reliability"]["time_exact"] is False


def test_api_profile_engine_payload_preserves_clock_value_and_provenance():
    profile = RelationshipProfile(
        birth_date=date(1992, 2, 29),
        birth_time=dt_time(19, 0),
        time_known=True,
        time_source="user_estimate",
        time_confidence="low",
        latitude=35.1595,
        longitude=126.8526,
        utc_offset_hours=9.0,
    )
    payload = profile.engine_payload()
    assert payload["birth_time"] == dt_time(19, 0)
    assert payload["time_known"] is True
    assert payload["time_source"] == "user_estimate"
    assert payload["time_confidence"] == "low"
    assert payload["time_reliability"]["time_available"] is True
    assert payload["time_reliability"]["time_exact"] is False
