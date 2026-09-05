from __future__ import annotations

import inspect
from datetime import date, time

import pytest

import personal_love_forecast_v1 as pl


def exact_profile():
    return {
        "name": "U",
        "birth_date": date(1990, 1, 15),
        "birth_time": time(10, 20),
        "time_known": True,
        "time_source": "official_record",
        "time_confidence": "exact",
        "rectified_window": None,
        "latitude": 37.5,
        "longitude": 127.0,
        "utc_offset_hours": 9.0,
    }


def provisional_profile():
    p = exact_profile()
    p.update({"time_source": "user_estimate", "time_confidence": "low", "latitude": None, "longitude": None})
    return p


def unknown_profile():
    p = exact_profile()
    p.update({"birth_time": None, "time_known": False, "time_source": "unknown", "time_confidence": "unknown", "latitude": None, "longitude": None})
    return p


def test_engine_is_single_person_and_not_relationship_wrapper():
    source = inspect.getsource(pl)
    assert "relationship_western_v1" not in source
    assert pl.ENGINE_VERSION.startswith("personal-love-western-")


def test_exact_time_unlocks_5h_7h_dsc_and_keeps_static_separate():
    result = pl.build_personal_love_forecast(exact_profile(), start_date=date(2026, 9, 1), end_date=date(2026, 9, 5), mode="personal_love_forecast")
    static = result["static_structure"]
    assert static["house_angle_layers_enabled"] is True
    assert static["fifth_house"] is not None
    assert static["seventh_house"] is not None
    assert static["dsc"] is not None
    assert result["counterpart_used"] is False
    assert result["relationship_engine_used"] is False
    assert "timing" not in static
    assert result["interpretation_policy"]["event_probability"] == "not_calculated"


def test_provisional_time_keeps_planetary_timing_but_disables_angles():
    result = pl.build_personal_love_forecast(provisional_profile(), start_date=date(2026, 9, 1), end_date=date(2026, 9, 3), mode="new_relationship")
    static = result["static_structure"]
    assert static["time_reliability"]["status"] == "provisional"
    assert static["house_angle_layers_enabled"] is False
    assert static["fifth_house"] is None
    assert static["seventh_house"] is None
    assert static["dsc"] is None
    assert result["timing"]["transits"]["daily"]
    assert result["timing"]["secondary_progression"]["months"]
    assert result["focus"] == "new_connection"


def test_unknown_time_uses_moon_range_not_exact_moon_or_houses():
    result = pl.build_personal_love_forecast(unknown_profile(), start_date=date(2026, 9, 1), end_date=date(2026, 9, 2), mode="personal_love_forecast")
    static = result["static_structure"]
    assert static["time_reliability"]["status"] == "unknown"
    assert static["moon"] is None
    assert static["moon_uncertainty"]["available"] is True
    assert static["house_angle_layers_enabled"] is False
    for row in result["timing"]["secondary_progression"]["months"]:
        assert all(hit["source"] != "Moon" for hit in row["hits"])


def test_counterpart_fields_are_rejected_by_engine():
    profile = exact_profile()
    profile["counterpart"] = {"present": True}
    with pytest.raises(ValueError, match="does not accept counterpart"):
        pl.build_personal_love_forecast(profile, start_date=date(2026, 9, 1), end_date=date(2026, 9, 2), mode="new_relationship")


def test_transit_and_secondary_are_independent_layers():
    result = pl.build_personal_love_forecast(exact_profile(), start_date=date(2026, 9, 1), end_date=date(2026, 10, 15), mode="personal_love_forecast")
    timing = result["timing"]
    assert set(timing) == {"transits", "secondary_progression", "convergence"}
    assert "overall_score" not in timing
    assert timing["transits"]["new_connection"]["event_probability"] == "not_calculated"
    assert timing["secondary_progression"]["new_connection"]["event_probability"] == "not_calculated"
    for item in timing["convergence"]:
        assert item["layer_count"] == 2
        assert item["independent_layers"] == ["transit", "secondary_progression"]


def test_modes_change_focus_without_known_person_inference():
    base = dict(start_date=date(2026, 9, 1), end_date=date(2026, 9, 2))
    general = pl.build_personal_love_forecast(exact_profile(), mode="personal_love_forecast", **base)
    new = pl.build_personal_love_forecast(exact_profile(), mode="new_relationship", **base)
    assert general["focus"] == "balanced_personal_love"
    assert new["focus"] == "new_connection"
    for result in (general, new):
        policy = result["interpretation_policy"]
        assert policy["counterpart_data_allowed"] is False
        assert policy["reunion_inference_allowed"] is False
        assert policy["static_synastry_used"] is False
