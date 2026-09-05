from __future__ import annotations

from datetime import date, time as dt_time

import relationship_western_v1 as rw
from reunion_dimension_v1 import (
    DIMENSIONS,
    daily_dimension_scores,
    score_transit_hit,
    secondary_support,
)


def _hit(transit: str, target: str, *, aspect: str = "conjunction", orb: float = 0.0, person: str = "user"):
    return {
        "person": person,
        "transit": transit,
        "target": target,
        "aspect": aspect,
        "orb": orb,
        "score": 50.0,
        "tone": "mixed",
        "orb_grade": "very_tight",
        "time_sensitivity": "robust",
        "evidence_confidence": "high",
        "layer_priority": 4,
        "event_probability": "not_calculated",
    }


def _profile(*, birth_date, birth_time, latitude, longitude, source="official_record", confidence="exact"):
    return {
        "birth_date": birth_date,
        "birth_time": birth_time,
        "time_known": birth_time is not None,
        "time_source": source,
        "time_confidence": confidence,
        "latitude": latitude,
        "longitude": longitude,
        "utc_offset_hours": 9.0,
    }


def test_dimension_policy_has_exactly_three_orthogonal_axes():
    assert DIMENSIONS == ("contact_recontact", "emotional_reactivation", "relationship_rebuilding")


def test_mercury_contact_hit_does_not_automatically_become_rebuilding_strength():
    hit = _hit("Mercury", "Mercury")
    contact = score_transit_hit(hit, "contact_recontact")
    emotional = score_transit_hit(hit, "emotional_reactivation")
    rebuilding = score_transit_hit(hit, "relationship_rebuilding")
    assert contact > emotional
    assert contact > rebuilding * 3


def test_saturn_commitment_hit_can_support_rebuilding_without_becoming_contact_signal():
    hit = _hit("Saturn", "Saturn", person="counterpart")
    contact = score_transit_hit(hit, "contact_recontact")
    rebuilding = score_transit_hit(hit, "relationship_rebuilding")
    assert rebuilding > contact * 5


def test_daily_dimensions_keep_user_counterpart_and_shared_scores_separate():
    user_hits = [_hit("Mercury", "Mercury", person="user")]
    counterpart_hits = [_hit("Saturn", "Saturn", person="counterpart")]
    dimensions = daily_dimension_scores(user_hits, counterpart_hits)

    assert dimensions["contact_recontact"]["user_score"] > dimensions["contact_recontact"]["counterpart_score"]
    assert dimensions["relationship_rebuilding"]["counterpart_score"] > dimensions["relationship_rebuilding"]["user_score"]
    for name in DIMENSIONS:
        assert dimensions[name]["event_probability"] == "not_calculated"
        assert 0 <= dimensions[name]["score"] <= 100
        assert 0 <= dimensions[name]["user_score"] <= 100
        assert 0 <= dimensions[name]["counterpart_score"] <= 100


def test_reunion_transit_builder_exposes_three_axes_without_overwriting_directional_context(monkeypatch):
    def fake_hits(transit_chart, natal_chart, person):
        return [_hit("Mercury", "Mercury", person=person)] if person == "user" else [_hit("Saturn", "Saturn", person=person)]

    monkeypatch.setattr(rw, "_transit_hits", fake_hits)
    out = rw._build_reunion_transits(
        {"positions": {"Mercury": {"lon": 0.0}}, "angles": {}},
        {"positions": {"Saturn": {"lon": 0.0}}, "angles": {}},
        date(2026, 9, 5),
        date(2026, 9, 5),
        9.0,
    )

    assert out["directional_context"]["incoming"] is not None
    assert out["directional_context"]["outgoing"] is not None
    dimensions = out["dimensions"]
    assert dimensions["contact_recontact"]["outgoing"]["average"] > dimensions["contact_recontact"]["incoming"]["average"]
    assert dimensions["relationship_rebuilding"]["incoming"]["average"] > dimensions["relationship_rebuilding"]["outgoing"]["average"]
    assert "overall reunion score" in dimensions["policy"]


def test_secondary_support_is_kept_separate_from_transit_score_and_marks_tertiary():
    secondary_mercury = {
        "a": "Mercury", "aspect": "conjunction", "b": "Sun", "orb": 0.1,
        "orb_grade": "very_tight", "time_sensitivity": "robust", "evidence_confidence": "high", "layer_priority": 2,
    }
    secondary_saturn = {
        "a": "Saturn", "aspect": "trine", "b": "Venus", "orb": 0.2,
        "orb_grade": "very_tight", "time_sensitivity": "robust", "evidence_confidence": "high", "layer_priority": 2,
    }
    tertiary_saturn = {
        "a": "Saturn", "aspect": "conjunction", "b": "Venus", "orb": 0.0,
        "orb_grade": "very_tight", "time_sensitivity": "robust", "evidence_confidence": "high", "layer_priority": 5,
    }
    month = {
        "progressed_synastry": {
            "available": True,
            "user_progressed_to_partner_natal": [secondary_mercury],
            "partner_progressed_to_user_natal": [],
            "progressed_to_progressed": [],
        },
        "progressed_composite": {
            "available": True,
            "to_natal_composite_aspects": [secondary_saturn],
        },
        "marks_tertiary": {
            "available": True,
            "user": {"to_base_marks_aspects": [tertiary_saturn]},
        },
    }
    support = secondary_support(month)
    rebuilding = support["relationship_rebuilding"]
    assert rebuilding["score"] is None
    assert rebuilding["event_probability"] == "not_calculated"
    assert rebuilding["independent_layer_count"] == 2
    assert rebuilding["convergence"] is True
    assert all("marks" not in str(row.get("layer", "")) for row in rebuilding["evidence"])


def test_full_reunion_result_has_dimension_matrix_and_secondary_support_but_no_single_reunion_score():
    user = _profile(
        birth_date=date(1991, 3, 21), birth_time=dt_time(7, 26), latitude=34.7604, longitude=127.6622,
    )
    counterpart = _profile(
        birth_date=date(1992, 2, 29), birth_time=dt_time(19, 0), latitude=35.1595, longitude=126.8526,
        source="user_estimate", confidence="low",
    )
    out = rw.build_relationship_western(
        user,
        counterpart,
        [(date(2026, 9, 1), date(2026, 9, 30))],
        analysis_mode="reunion",
    )
    assert out["ok"] is True
    assert out["engine"] == "relationship-western-v1.11-reunion-dimensions"
    assert set(DIMENSIONS).issubset(out["reunion_dimensions"])
    for dimension in DIMENSIONS:
        axis = out["reunion_dimensions"][dimension]
        assert axis["incoming"] is not None
        assert axis["outgoing"] is not None
        assert axis["reconnection"] is not None
        assert axis["event_probability"] == "not_calculated"
    assert out["reunion_secondary_support"]["event_probability"] == "not_calculated"
    assert "reunion_score" not in out
    assert "reunion_score" not in out["reunion_dimensions"]


def test_compatibility_mode_does_not_emit_reunion_dimension_outputs():
    user = _profile(
        birth_date=date(1991, 3, 21), birth_time=dt_time(7, 26), latitude=34.7604, longitude=127.6622,
    )
    counterpart = _profile(
        birth_date=date(1992, 2, 29), birth_time=dt_time(19, 0), latitude=35.1595, longitude=126.8526,
    )
    out = rw.build_relationship_western(user, counterpart, [], analysis_mode="compatibility")
    assert "reunion_dimensions" not in out
    assert "reunion_secondary_support" not in out
