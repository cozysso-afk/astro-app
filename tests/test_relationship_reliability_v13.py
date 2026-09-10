from __future__ import annotations

from datetime import date, time as dt_time

import relationship_western_v1 as rw
from relationship_reliability_v1 import classify_scan_ratio, decorate_aspect, orb_grade


def _profile(
    *,
    birth_date=date(1991, 3, 21),
    birth_time=dt_time(7, 26),
    latitude=34.7604,
    longitude=127.6622,
    utc_offset_hours=9.0,
    time_source="official_record",
    time_confidence="exact",
):
    return {
        "birth_date": birth_date,
        "birth_time": birth_time,
        "time_known": birth_time is not None,
        "time_source": time_source,
        "time_confidence": time_confidence,
        "latitude": latitude,
        "longitude": longitude,
        "utc_offset_hours": utc_offset_hours,
    }


def test_orb_grade_contract_is_layer_specific():
    assert orb_grade("natal", 0.99, 6.0) == "very_tight"
    assert orb_grade("natal", 2.99, 6.0) == "strong"
    assert orb_grade("natal", 3.01, 6.0) == "background"
    assert orb_grade("secondary", 0.24, 1.5) == "very_tight"
    assert orb_grade("secondary", 0.74, 1.5) == "strong"
    assert orb_grade("secondary", 0.80, 1.5) == "background"
    assert orb_grade("tertiary", 0.14, 1.0) == "very_tight"
    assert orb_grade("tertiary", 0.49, 1.0) == "strong"
    assert orb_grade("tertiary", 0.60, 1.0) == "supplementary"
    assert orb_grade("daily_transit", 0.20, 1.0) == "very_tight"
    assert orb_grade("daily_transit", 0.55, 1.0) == "strong"
    assert orb_grade("major_transit", 1.0, 1.4) == "background"


def test_birth_time_dependency_is_scoped_to_the_uncertain_side():
    stable = decorate_aspect(
        {"a": "ASC", "aspect": "trine", "b": "Venus", "orb": 0.2},
        mode="natal",
        chart_a_exact=True,
        chart_b_exact=False,
        orb_limit=3.0,
    )
    assert stable["time_sensitivity"] == "fragile"
    assert stable["birth_time_dependency"] is False
    assert stable["evidence_confidence"] == "moderate-high"

    fragile = decorate_aspect(
        {"a": "Venus", "aspect": "conjunction", "b": "ASC", "orb": 0.05},
        mode="natal",
        chart_a_exact=True,
        chart_b_exact=False,
        orb_limit=3.0,
    )
    assert fragile["time_sensitivity"] == "fragile"
    assert fragile["birth_time_dependency"] is True
    assert fragile["evidence_confidence"] == "low"

    moon = decorate_aspect(
        {"a": "Sun", "aspect": "trine", "b": "Moon", "orb": 0.2},
        mode="natal",
        chart_a_exact=True,
        chart_b_exact=False,
        orb_limit=6.0,
    )
    assert moon["time_sensitivity"] == "sensitive"
    assert moon["birth_time_dependency"] is True
    assert moon["evidence_confidence"] == "low-moderate"


def test_scan_ratio_contract_prefers_repeatability_over_single_exact_hit():
    assert classify_scan_ratio(1.0) == "robust"
    assert classify_scan_ratio(0.8) == "robust"
    assert classify_scan_ratio(0.6) == "sensitive"
    assert classify_scan_ratio(0.2) == "fragile"


def test_provisional_partner_gets_five_point_sensitivity_scan_without_unlocking_exact_layers():
    user = _profile()
    counterpart = _profile(
        birth_date=date(1992, 2, 29),
        birth_time=dt_time(19, 0),
        latitude=35.1595,
        longitude=126.8526,
        time_source="user_estimate",
        time_confidence="low",
    )
    out = rw.build_relationship_western(
        user,
        counterpart,
        [(date(2026, 9, 1), date(2026, 9, 30))],
        analysis_mode="reunion",
    )
    assert out["ok"] is True
    assert out["engine"] == rw.ENGINE_VERSION

    scan = out["sensitivity_scan"]["counterpart"]
    assert scan["available"] is True
    assert scan["window_minutes"] == 60
    assert scan["step_minutes"] == 30
    assert scan["sample_count"] == 5
    center = next(row for row in scan["samples"] if row["shift_minutes"] == 0)
    assert center["candidate_local"].endswith("T19:00")
    assert scan["event_probability"] == "not_calculated"
    assert scan["angle_variation_deg"]["ASC"] > 0

    assert out["natal_synastry"]["partner_time_exact"] is False
    assert out["house_overlays"]["available"] is False
    assert out["davison"]["available"] is False
    assert out["marks"]["available"] is False
    assert out["months"][0]["progressed_synastry"]["precision"] == "provisional"


def test_natal_aspects_expose_robust_time_sensitive_and_evidence_metadata():
    user = _profile()
    counterpart = _profile(
        birth_date=date(1992, 2, 29),
        birth_time=dt_time(19, 0),
        latitude=35.1595,
        longitude=126.8526,
        time_source="user_estimate",
        time_confidence="medium",
    )
    out = rw.build_relationship_western(user, counterpart, [], analysis_mode="compatibility")
    natal = out["natal_synastry"]
    assert isinstance(natal["robust_aspects"], list)
    assert isinstance(natal["conditional_aspects"], list)
    assert isinstance(natal["time_sensitive_aspects"], list)
    assert natal["aspects"]
    for aspect in natal["aspects"]:
        assert aspect["orb_grade"] in {"very_tight", "strong", "background"}
        assert aspect["time_sensitivity"] in {"robust", "medium", "sensitive", "fragile"}
        assert aspect["evidence_confidence"] in {"high", "moderate-high", "moderate", "low-moderate", "low"}
        assert aspect["event_probability"] == "not_calculated"
        assert aspect["layer_priority"] == 1


def test_verified_exact_time_skips_sensitivity_scan():
    user = _profile()
    counterpart = _profile(
        birth_date=date(1992, 2, 29),
        birth_time=dt_time(19, 0),
        latitude=35.1595,
        longitude=126.8526,
        time_source="official_record",
        time_confidence="exact",
    )
    out = rw.build_relationship_western(user, counterpart, [], analysis_mode="compatibility")
    scan = out["sensitivity_scan"]["counterpart"]
    assert scan["available"] is False
    assert "not required" in scan["reason"]


def test_transit_hits_report_layer_class_orb_grade_and_non_probability_contract():
    transit = {"positions": {"Mercury": {"lon": 10.0}, "Jupiter": {"lon": 10.0}}, "angles": {}}
    natal = {
        "positions": {"Sun": {"lon": 10.0}},
        "angles": {"DSC": 10.0},
        "time_reliability": {"time_exact": True},
    }
    hits = rw._transit_hits(transit, natal, "user")
    assert hits
    by_transit = {row["transit"]: row for row in hits if row["target"] == "Sun" and row["aspect"] == "conjunction"}
    assert by_transit["Mercury"]["layer_class"] == "daily_transit"
    assert by_transit["Mercury"]["layer_priority"] == 4
    assert by_transit["Jupiter"]["layer_class"] == "major_transit"
    assert by_transit["Jupiter"]["layer_priority"] == 3
    assert by_transit["Mercury"]["orb_grade"] == "very_tight"
    assert by_transit["Mercury"]["event_probability"] == "not_calculated"
