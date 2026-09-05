from __future__ import annotations

import inspect
from datetime import date, datetime, time, timedelta, timezone

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
    result = pl.build_personal_love_forecast(
        exact_profile(), start_date=date(2026, 9, 1), end_date=date(2026, 9, 5), mode="personal_love_forecast"
    )
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
    result = pl.build_personal_love_forecast(
        provisional_profile(), start_date=date(2026, 9, 1), end_date=date(2026, 9, 3), mode="new_relationship"
    )
    static = result["static_structure"]
    assert static["time_reliability"]["status"] == "provisional"
    assert static["house_angle_layers_enabled"] is False
    assert static["fifth_house"] is None
    assert static["seventh_house"] is None
    assert static["dsc"] is None
    assert result["timing"]["major_transits"]["daily_samples"]
    assert result["timing"]["daily_transits"]["daily"]
    assert result["timing"]["secondary_progression"]["months"]
    assert result["timing"]["secondary_progression"]["daily_samples"]
    assert result["focus"] == "new_connection"


def test_unknown_time_uses_moon_range_not_exact_moon_or_houses():
    result = pl.build_personal_love_forecast(
        unknown_profile(), start_date=date(2026, 9, 1), end_date=date(2026, 9, 2), mode="personal_love_forecast"
    )
    static = result["static_structure"]
    assert static["time_reliability"]["status"] == "unknown"
    assert static["moon"] is None
    assert static["moon_uncertainty"]["available"] is True
    assert static["house_angle_layers_enabled"] is False
    for row in result["timing"]["secondary_progression"]["daily_samples"]:
        assert all(hit["source"] != "Moon" for hit in row["hits"])
    for row in result["timing"]["secondary_progression"]["months"]:
        assert all(hit["source"] != "Moon" for hit in row["hits"])


def test_counterpart_fields_are_rejected_by_engine():
    profile = exact_profile()
    profile["counterpart"] = {"present": True}
    with pytest.raises(ValueError, match="does not accept counterpart"):
        pl.build_personal_love_forecast(
            profile, start_date=date(2026, 9, 1), end_date=date(2026, 9, 2), mode="new_relationship"
        )


def test_same_physical_natal_body_is_scored_once_across_multiple_roles():
    targets = {
        "Venus": {
            "longitude": 0.0,
            "source": "natal_planet",
            "physical_key": "planet:Venus",
            "birth_time_sensitive": False,
        },
        "5th_ruler": {
            "longitude": 0.0,
            "source": "Venus",
            "physical_key": "planet:Venus",
            "birth_time_sensitive": True,
        },
        "7th_ruler": {
            "longitude": 0.0,
            "source": "Venus",
            "physical_key": "planet:Venus",
            "birth_time_sensitive": True,
        },
    }
    rows = pl._contact_rows(
        {"Venus": {"longitude": 0.0}},
        targets,
        source_layer="daily_transit",
        source_weights=pl.TRANSIT_PLANET_WEIGHTS,
        source_exact=True,
        target_exact=True,
    )
    assert len(rows) == 1
    hit = rows[0]
    assert set(hit["target_roles"]) == {"Venus", "5th_ruler", "7th_ruler"}
    assert hit["target_physical_key"] == "planet:Venus"
    assert hit["target_weight_policy"] == "max_role_weight_no_duplicate_sum"
    assert hit["target_weights"] == {"new_connection": 1.0, "partnership": 1.0}
    assert hit["new_connection_score"] == 100.0
    assert hit["partnership_score"] == 90.0
    assert pl._dimension_score(rows, "new_connection_score") == 42.6


def test_physical_target_dedup_uses_max_role_weight_not_sum():
    grouped = pl._coalesce_targets(
        {
            "Venus": {
                "longitude": 12.5,
                "source": "natal_planet",
                "physical_key": "planet:Venus",
                "birth_time_sensitive": False,
            },
            "5th_ruler": {
                "longitude": 12.5,
                "source": "Venus",
                "physical_key": "planet:Venus",
                "birth_time_sensitive": True,
            },
            "7th_ruler": {
                "longitude": 12.5,
                "source": "Venus",
                "physical_key": "planet:Venus",
                "birth_time_sensitive": True,
            },
        }
    )
    assert set(grouped) == {"planet:Venus"}
    target = grouped["planet:Venus"]
    assert target["target_weights"]["new_connection"] == 1.0
    assert target["target_weights"]["partnership"] == 1.0
    assert target["birth_time_sensitive"] is True
    assert target["role_birth_time_sensitive"] == {
        "Venus": False,
        "5th_ruler": True,
        "7th_ruler": True,
    }


def test_same_longitude_different_physical_bodies_are_not_collapsed():
    targets = {
        "Venus": {
            "longitude": 0.0,
            "source": "natal_planet",
            "physical_key": "planet:Venus",
            "birth_time_sensitive": False,
        },
        "5th_ruler": {
            "longitude": 0.0,
            "source": "Mercury",
            "physical_key": "planet:Mercury",
            "birth_time_sensitive": True,
        },
    }
    rows = pl._contact_rows(
        {"Venus": {"longitude": 0.0}},
        targets,
        source_layer="daily_transit",
        source_weights=pl.TRANSIT_PLANET_WEIGHTS,
        source_exact=True,
        target_exact=True,
    )
    assert len(rows) == 2
    assert {row["target_physical_key"] for row in rows} == {"planet:Venus", "planet:Mercury"}


def test_secondary_progression_uses_mean_day_for_year_mapping(monkeypatch):
    natal_utc = datetime(2000, 1, 1, tzinfo=timezone.utc)
    natal = {
        "natal_utc": natal_utc,
        "natal_jd": 1000.0,
        "time_reliability": {"time_available": True},
    }
    captured = {}
    monkeypatch.setattr(
        pl,
        "_local_noon_utc",
        lambda target_date, utc_offset_hours: natal_utc + timedelta(days=pl.YEAR_DAYS * 10.0),
    )

    def fake_positions(jd, include_moon=True):
        captured["jd"] = jd
        return {
            "Sun": {"longitude": 1.0},
            "Moon": {"longitude": 2.0},
            "Venus": {"longitude": 3.0},
        }

    monkeypatch.setattr(pl, "_positions", fake_positions)
    result = pl._progressed_positions(natal, date(2010, 1, 1), 9.0)
    assert captured["jd"] == pytest.approx(1010.0)
    assert set(result) == {"Sun", "Moon", "Venus"}


def test_secondary_progression_scans_daily_and_keeps_real_monthly_peak(monkeypatch):
    natal = {
        "targets": {
            "Venus": {
                "longitude": 0.0,
                "source": "natal_planet",
                "physical_key": "planet:Venus",
                "birth_time_sensitive": False,
            }
        },
        "time_reliability": {"time_available": True, "time_exact": True},
    }

    def fake_progressed_positions(natal_arg, target_date, utc_offset_hours):
        # Exact conjunction is deliberately on March 3, far from the old mid-month proxy.
        return {"Moon": {"longitude": (target_date.day - 3) * 0.1}}

    monkeypatch.setattr(pl, "_progressed_positions", fake_progressed_positions)
    daily_rows = pl._progression_rows(date(2026, 3, 1), date(2026, 3, 31), 9.0, natal)
    months = pl._progression_months(daily_rows)
    assert len(daily_rows) == 31
    assert len(months) == 1
    month = months[0]
    assert month["sampling"] == "daily_peak_within_calendar_month"
    assert month["new_connection_peak_date"] == "2026-03-03"
    midpoint = next(row for row in daily_rows if row["date"] == "2026-03-16")
    assert month["new_connection_activation"] > midpoint["new_connection_activation"]
    summary = pl._progression_summary(months, "new_connection")
    assert summary["top_dates"][0]["date"] == "2026-03-03"


def test_major_daily_and_secondary_are_independent_layers():
    result = pl.build_personal_love_forecast(
        exact_profile(), start_date=date(2026, 9, 1), end_date=date(2026, 10, 15), mode="personal_love_forecast"
    )
    timing = result["timing"]
    assert set(timing) == {"major_transits", "daily_transits", "secondary_progression", "convergence"}
    assert "overall_score" not in timing
    assert timing["major_transits"]["new_connection"]["event_probability"] == "not_calculated"
    assert timing["daily_transits"]["new_connection"]["event_probability"] == "not_calculated"
    assert timing["secondary_progression"]["new_connection"]["event_probability"] == "not_calculated"
    assert set(timing["major_transits"]["planets"]) == pl.MAJOR_TRANSIT_PLANETS
    assert set(timing["daily_transits"]["planets"]) == pl.DAILY_TRANSIT_PLANETS
    assert timing["secondary_progression"]["progression_key"] == {
        "method": "mean_day_for_year",
        "year_days": pl.YEAR_DAYS,
    }
    assert len(timing["secondary_progression"]["daily_samples"]) == 45
    for row in timing["major_transits"]["daily_samples"]:
        assert all(hit["layer"] == "major_transit" for hit in row["hits"])
        assert all(hit["source"] in pl.MAJOR_TRANSIT_PLANETS for hit in row["hits"])
    for row in timing["daily_transits"]["daily"]:
        assert all(hit["layer"] == "daily_transit" for hit in row["hits"])
        assert all(hit["source"] in pl.DAILY_TRANSIT_PLANETS for hit in row["hits"])
    for row in timing["secondary_progression"]["daily_samples"]:
        assert all(hit["layer"] == "secondary" for hit in row["hits"])
        assert all(hit["source"] in pl.PROGRESSED_PLANET_WEIGHTS["new_connection"] for hit in row["hits"])
    for item in timing["convergence"]:
        assert item["layer_count"] == 2
        assert item["independent_layers"] == ["major_transit", "secondary_progression"]
        assert set(item["daily_transit_support"]).issubset(set(item["dimensions"]))


def test_fast_daily_layer_cannot_create_convergence_by_itself():
    daily = [{"calendar_month": "2026-09", "new_connection_activation": 99.0, "partnership_activation": 99.0}]
    major = [{"calendar_month": "2026-09", "new_connection_activation": 0.0, "partnership_activation": 0.0}]
    secondary = [{"calendar_month": "2026-09", "new_connection_activation": 99.0, "partnership_activation": 99.0}]
    assert pl._convergence(major, secondary, daily) == []


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
        assert policy["layer_mixing"].startswith("forbidden")
        assert "maximum applicable role weight" in policy["physical_target_deduplication"]
        assert "scanned daily" in policy["secondary_progression_sampling"]
