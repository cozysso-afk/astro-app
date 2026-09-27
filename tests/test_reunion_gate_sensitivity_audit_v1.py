from types import SimpleNamespace

import reunion_hierarchy_v2 as hierarchy_engine
from scripts.reunion_gate_sensitivity_audit import (
    _reset_policy,
    apply_policy_variant,
    bottleneck,
    compare_to_baseline,
    policy_variant_specs,
    stage_snapshot,
    threshold_variants,
)


def test_threshold_variants_shift_one_gate_at_a_time():
    base = {"long_term": 35.0, "mid_term": 25.0, "event_trigger": 12.0}
    variants = dict(threshold_variants(base))
    assert len(variants) == 13
    assert variants["baseline"] == base
    assert variants["long_term-10"] == {"long_term": 25.0, "mid_term": 25.0, "event_trigger": 12.0}
    assert variants["mid_term+5"] == {"long_term": 35.0, "mid_term": 30.0, "event_trigger": 12.0}
    assert variants["event_trigger+10"] == {"long_term": 35.0, "mid_term": 25.0, "event_trigger": 22.0}
    assert base == {"long_term": 35.0, "mid_term": 25.0, "event_trigger": 12.0}


def test_policy_variants_target_meeting_trigger_and_medium_return_bottlenecks():
    specs = dict(policy_variant_specs())
    assert set(specs) == {
        "meeting_trigger_mars_or_venus",
        "medium_gate_add_solar_return",
        "medium_gate_add_venus_return",
        "targeted_candidate_v1",
    }
    assert specs["meeting_trigger_mars_or_venus"]["meeting_primary_planets"] == ("Mars", "Venus")
    assert specs["medium_gate_add_solar_return"]["mid_gate_return_keys"] == (
        "lunar_return", "solar_return",
    )
    assert specs["medium_gate_add_venus_return"]["mid_gate_return_keys"] == (
        "lunar_return", "venus_return",
    )
    assert specs["targeted_candidate_v1"]["meeting_primary_planets"] == ("Mars", "Venus")
    assert specs["targeted_candidate_v1"]["mid_gate_return_keys"] == (
        "lunar_return", "solar_return",
    )


def test_policy_variant_mutation_is_reversible():
    engine = SimpleNamespace(
        STAGE_TRIGGER_POLICY={"in_person_meeting": {"primary_planets": {"Mars"}}},
        MID_GATE_RETURN_KEYS={"lunar_return"},
    )
    specs = dict(policy_variant_specs())
    apply_policy_variant(engine, specs["meeting_trigger_mars_or_venus"])
    assert engine.STAGE_TRIGGER_POLICY["in_person_meeting"]["primary_planets"] == {"Mars", "Venus"}
    _reset_policy(engine, {"Mars"}, {"lunar_return"})
    assert engine.STAGE_TRIGGER_POLICY["in_person_meeting"]["primary_planets"] == {"Mars"}
    apply_policy_variant(engine, specs["medium_gate_add_solar_return"])
    assert engine.MID_GATE_RETURN_KEYS == {"lunar_return", "solar_return"}
    _reset_policy(engine, {"Mars"}, {"lunar_return"})
    assert engine.MID_GATE_RETURN_KEYS == {"lunar_return"}

    apply_policy_variant(engine, specs["targeted_candidate_v1"])
    assert engine.STAGE_TRIGGER_POLICY["in_person_meeting"]["primary_planets"] == {"Mars", "Venus"}
    assert engine.MID_GATE_RETURN_KEYS == {"lunar_return", "solar_return"}
    _reset_policy(engine, {"Mars"}, {"lunar_return"})
    assert engine.STAGE_TRIGGER_POLICY["in_person_meeting"]["primary_planets"] == {"Mars"}
    assert engine.MID_GATE_RETURN_KEYS == {"lunar_return"}


def test_meeting_venus_exact_hit_is_rejected_now_but_admitted_by_counterfactual():
    base_meeting = set(hierarchy_engine.STAGE_TRIGGER_POLICY["in_person_meeting"]["primary_planets"])
    base_mid = set(hierarchy_engine.MID_GATE_RETURN_KEYS)
    specs = dict(policy_variant_specs())
    evidence = [{
        "event_id": "synthetic:venus:meeting",
        "a": "Venus",
        "b": "DSC",
        "family": "natal_trigger",
        "aspect": "conjunction",
        "strength": 80.0,
        "orb": 0.2,
    }]
    try:
        current = hierarchy_engine._stage_policy_evaluation("in_person_meeting", evidence)
        assert current["primary"] is None
        assert current["rejection_counts"].get("primary_planet_mismatch") == 1

        apply_policy_variant(hierarchy_engine, specs["meeting_trigger_mars_or_venus"])
        counterfactual = hierarchy_engine._stage_policy_evaluation("in_person_meeting", evidence)
        assert counterfactual["primary"] is not None
        assert counterfactual["primary"]["a"] == "Venus"
    finally:
        _reset_policy(hierarchy_engine, base_meeting, base_mid)


def test_solar_return_medium_evidence_is_excluded_now_but_admitted_by_counterfactual():
    base_meeting = set(hierarchy_engine.STAGE_TRIGGER_POLICY["in_person_meeting"]["primary_planets"])
    base_mid = set(hierarchy_engine.MID_GATE_RETURN_KEYS)
    specs = dict(policy_variant_specs())
    rows = [{
        "event_id": "synthetic:solar:return",
        "return_type": "solar_return",
        "mid_gate": True,
        "strength": 60.0,
    }]
    try:
        assert hierarchy_engine._mid_gate_evidence(rows) == []
        apply_policy_variant(hierarchy_engine, specs["medium_gate_add_solar_return"])
        assert hierarchy_engine._mid_gate_evidence(rows) == rows
    finally:
        _reset_policy(hierarchy_engine, base_meeting, base_mid)


def test_combined_targeted_candidate_changes_both_policy_seams_without_threshold_changes():
    base_meeting = set(hierarchy_engine.STAGE_TRIGGER_POLICY["in_person_meeting"]["primary_planets"])
    base_mid = set(hierarchy_engine.MID_GATE_RETURN_KEYS)
    base_thresholds = dict(hierarchy_engine.THRESHOLDS)
    specs = dict(policy_variant_specs())
    venus_meeting = [{
        "event_id": "synthetic:venus:meeting:combined",
        "a": "Venus",
        "b": "DSC",
        "family": "natal_trigger",
        "aspect": "conjunction",
        "strength": 80.0,
        "orb": 0.2,
    }]
    solar_rows = [{
        "event_id": "synthetic:solar:return:combined",
        "return_type": "solar_return",
        "mid_gate": True,
        "strength": 60.0,
    }]
    try:
        apply_policy_variant(hierarchy_engine, specs["targeted_candidate_v1"])
        assert hierarchy_engine._stage_policy_evaluation("in_person_meeting", venus_meeting)["primary"] is not None
        assert hierarchy_engine._mid_gate_evidence(solar_rows) == solar_rows
        assert hierarchy_engine.THRESHOLDS == base_thresholds
    finally:
        _reset_policy(hierarchy_engine, base_meeting, base_mid)


def test_stage_snapshot_uses_future_sequential_gate_counts_only():
    hierarchy = {
        "stages": {"in_person_meeting": {"candidate_count": 0}},
        "selectivity": {
            "in_person_meeting": {
                "future_total_days": 97,
                "future_long_term_pass_days": 2,
                "future_medium_anchor_pass_days": 2,
                "future_raw_numeric_gate_pass_days": 2,
                "future_semantic_stage_trigger_pass_days": 0,
                "future_hierarchy_eligible_days": 0,
                "future_local_peak_days": 0,
            }
        },
    }
    assert stage_snapshot(hierarchy)["in_person_meeting"] == {
        "future_days": 97,
        "long_pass": 2,
        "mid_pass": 2,
        "numeric_pass": 2,
        "trigger_pass": 0,
        "hierarchy_pass": 0,
        "peaks": 0,
        "candidate_count": 0,
    }


def test_bottleneck_distinguishes_long_mid_and_semantic_trigger_losses():
    meeting = {
        "future_days": 97, "long_pass": 2, "mid_pass": 2,
        "hierarchy_pass": 0, "peaks": 0,
    }
    rebuilding = {
        "future_days": 97, "long_pass": 6, "mid_pass": 0,
        "hierarchy_pass": 0, "peaks": 0,
    }
    assert bottleneck(meeting)[0] == "long_term"
    assert bottleneck(meeting)[1] == {
        "long_term": 95, "mid_term": 0, "semantic_trigger": 2, "local_peak": 0,
    }
    assert bottleneck(rebuilding)[0] == "long_term"
    assert bottleneck(rebuilding)[1]["mid_term"] == 6


def test_compare_to_baseline_reports_count_deltas_without_dates_or_profiles():
    baseline = {
        "contact_recontact": {
            "long_pass": 97, "mid_pass": 97, "numeric_pass": 97,
            "trigger_pass": 20, "hierarchy_pass": 20, "peaks": 6, "candidate_count": 6,
        }
    }
    current = {
        "contact_recontact": {
            "long_pass": 97, "mid_pass": 97, "numeric_pass": 97,
            "trigger_pass": 24, "hierarchy_pass": 24, "peaks": 7, "candidate_count": 7,
        }
    }
    assert compare_to_baseline(baseline, current)["contact_recontact"] == {
        "long_pass": 0,
        "mid_pass": 0,
        "numeric_pass": 0,
        "trigger_pass": 4,
        "hierarchy_pass": 4,
        "peaks": 1,
        "candidate_count": 1,
    }
