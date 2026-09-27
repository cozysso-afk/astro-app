from datetime import datetime, timezone

import reunion_hierarchy_v2 as h


def _hit(planet, target, *, strength=60.0, orb=0.2):
    return {
        "event_id": f"synthetic:{planet}:{target}",
        "a": planet,
        "b": target,
        "family": "natal_trigger",
        "aspect": "conjunction",
        "strength": strength,
        "orb": orb,
    }


def test_targeted_candidate_keeps_global_thresholds_unchanged():
    assert h.THRESHOLDS == {
        "long_term": 35.0,
        "mid_term": 25.0,
        "event_trigger": 12.0,
    }
    assert h.POLICY_REVISION == "reunion-policy-targeted-candidate-v1"


def test_meeting_accepts_mars_or_venus_exact_trigger_on_existing_targets():
    mars = h._stage_policy_evaluation("in_person_meeting", [_hit("Mars", "DSC")])
    venus = h._stage_policy_evaluation("in_person_meeting", [_hit("Venus", "DSC")])
    assert mars["primary"] is not None
    assert venus["primary"] is not None
    assert mars["primary"]["a"] == "Mars"
    assert venus["primary"]["a"] == "Venus"


def test_meeting_venus_does_not_bypass_existing_target_policy():
    evaluated = h._stage_policy_evaluation("in_person_meeting", [_hit("Venus", "Moon")])
    assert evaluated["primary"] is None
    assert evaluated["rejection_counts"].get("target_mismatch") == 1


def test_rebuilding_alone_adds_solar_return_to_medium_gate():
    assert h._medium_gate_keys("relationship_rebuilding") == {
        "lunar_return",
        "solar_return",
    }
    for stage in ("emotional_reactivation", "contact_recontact", "in_person_meeting"):
        assert h._medium_gate_keys(stage) == {"lunar_return"}


def test_rebuilding_solar_return_is_admitted_through_real_return_evidence_path():
    event = {
        "exact_utc": "2026-01-01T00:00:00+00:00",
        "next_exact_utc": "2026-02-01T00:00:00+00:00",
        "precision": "exact",
        "positions": {"Sun": 0.0, "Venus": 10.0},
        "angles": {},
        "house_activations": [],
    }
    support = {
        "solar_return": {
            "user": {"events": [event]},
            "counterpart": {"events": []},
        }
    }
    natal = {
        "user": {"Venus": 10.0},
        "counterpart": {"Venus": 20.0},
    }
    rows, active = h._return_evidence(
        support,
        datetime(2026, 1, 15, tzinfo=timezone.utc),
        "relationship_rebuilding",
        natal,
    )
    gate = h._mid_gate_evidence(rows)
    assert gate
    assert all(row["return_type"] == "solar_return" and row["mid_gate"] for row in gate)
    assert h._ranked_score(gate)[0] >= h.THRESHOLDS["mid_term"]
    assert active and active[0][0] == "solar_return"


def test_mid_gate_filter_uses_stage_admission_flag_not_global_return_name():
    rows = [
        {"event_id": "lunar", "return_type": "lunar_return", "mid_gate": True, "strength": 30.0},
        {"event_id": "solar", "return_type": "solar_return", "mid_gate": True, "strength": 40.0},
        {"event_id": "venus", "return_type": "venus_return", "mid_gate": False, "strength": 100.0},
    ]
    gate = h._mid_gate_evidence(rows)
    assert [row["event_id"] for row in gate] == ["lunar", "solar"]
    assert h._ranked_score(gate)[0] == 47.5


def test_global_lunar_anchor_constant_remains_for_compatibility():
    assert h.MID_GATE_RETURN_KEYS == {"lunar_return"}
    assert h.REBUILDING_MID_GATE_EXTRA_KEYS == {"solar_return"}
