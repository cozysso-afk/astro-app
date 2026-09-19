from datetime import date, time as dt_time

import relationship_return_v1 as rr


def _profile(*, birth_date, birth_time, confidence="exact", source="official_record"):
    return {
        "birth_date": birth_date,
        "birth_time": birth_time,
        "time_known": birth_time is not None,
        "time_source": source,
        "time_confidence": confidence,
        "rectified_window": None,
        "latitude": 34.7604,
        "longitude": 127.6622,
        "utc_offset_hours": 9.0,
    }


def test_solar_and_lunar_returns_are_separate_background_layers():
    user = _profile(birth_date=date(1991, 3, 21), birth_time=dt_time(7, 26))
    counterpart = _profile(birth_date=date(1992, 2, 29), birth_time=dt_time(19, 55), confidence="medium", source="user_estimate")
    result = {
        "reunion_dimensions": {
            "emotional_reactivation": {"top_evidence": []},
            "contact_recontact": {"top_evidence": [{"date": "2026-10-21", "score": 72.0}]},
            "in_person_meeting": {"top_evidence": [{"date": "2026-11-01", "score": 64.0}]},
            "relationship_rebuilding": {"top_evidence": [{"date": "2027-01-21", "score": 68.0}]},
        },
        "reunion_transits": {"top_days": [{"date": "2026-10-21", "score": 75.0}]},
    }

    out = rr.augment_relationship_with_returns(result, user, counterpart, date(2026, 9, 19), date(2027, 3, 27))
    support = out["reunion_return_support"]

    assert support["engine"] == rr.ENGINE_VERSION
    assert support["solar_return"]["role"] == "annual_background"
    assert support["lunar_return"]["role"] == "monthly_emotional_background"
    assert support["solar_return"]["user"]["events"]
    assert support["lunar_return"]["user"]["events"]
    assert support["candidate_dates"]
    assert all(row["exact_date_basis"] == "fast_transit_trigger" for row in support["candidate_dates"])
    assert all(row["independent_bonus_eligible"] is False for row in support["candidate_dates"])
    assert all(row["event_probability"] == "not_calculated" for row in support["candidate_dates"])

    # The return layer annotates but never rewrites the fast-trigger stage score.
    contact = out["reunion_dimensions"]["contact_recontact"]["top_evidence"][0]
    assert contact["score"] == 72.0
    assert contact["return_context"]["event_probability"] == "not_calculated"


def test_lunar_return_requires_an_entered_birth_time_but_solar_can_use_noon_proxy():
    user = _profile(birth_date=date(1991, 3, 21), birth_time=dt_time(7, 26))
    counterpart = _profile(birth_date=date(1997, 4, 3), birth_time=None, confidence="unknown", source="unknown")
    result = {"reunion_dimensions": {}, "reunion_transits": {"top_days": []}}

    out = rr.augment_relationship_with_returns(result, user, counterpart, date(2026, 9, 19), date(2026, 12, 31))
    support = out["reunion_return_support"]

    cp_solar = support["solar_return"]["counterpart"]
    cp_lunar = support["lunar_return"]["counterpart"]
    assert cp_solar["available"] is True
    assert any(event["precision"] == "date_noon_proxy" for event in cp_solar["events"])
    assert cp_lunar["available"] is False
    assert cp_lunar["reason"] == "birth_time_unavailable_for_natal_moon_return"


def test_provisional_time_never_becomes_exact_return_precision():
    profile = _profile(
        birth_date=date(1992, 2, 29),
        birth_time=dt_time(19, 55),
        confidence="medium",
        source="user_estimate",
    )
    ctx = rr._person_return_context(profile, date(2026, 9, 19), date(2027, 3, 27), "counterpart")
    assert ctx["solar_return"]["events"]
    assert ctx["lunar_return"]["events"]
    assert all(event["precision"] == "provisional" for event in ctx["solar_return"]["events"])
    assert all(event["precision"] == "provisional" for event in ctx["lunar_return"]["events"])
