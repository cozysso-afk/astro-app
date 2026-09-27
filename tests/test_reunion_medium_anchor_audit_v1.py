import reunion_hierarchy_v2 as h

from scripts.reunion_medium_anchor_audit import (
    compare_to_baseline,
    medium_anchor_variant_specs,
)


def test_medium_anchor_variants_are_rebuilding_specific_and_threshold_neutral():
    specs = dict(medium_anchor_variant_specs())
    assert set(specs) == {
        "baseline_lunar_solar",
        "rebuilding_lunar_only",
        "rebuilding_solar_only",
        "rebuilding_venus_only",
        "rebuilding_lunar_venus",
        "rebuilding_solar_venus",
        "rebuilding_lunar_solar_venus",
    }
    assert specs["baseline_lunar_solar"]["keys"] == ("lunar_return", "solar_return")
    assert specs["rebuilding_lunar_only"]["keys"] == ("lunar_return",)
    assert specs["rebuilding_solar_only"]["keys"] == ("solar_return",)
    assert specs["rebuilding_venus_only"]["keys"] == ("venus_return",)
    assert specs["rebuilding_lunar_solar_venus"]["keys"] == (
        "lunar_return", "solar_return", "venus_return"
    )


def test_pr235_production_medium_policy_is_unchanged_by_audit_module():
    assert h.MID_GATE_RETURN_KEYS == {"lunar_return"}
    assert h.REBUILDING_MID_GATE_EXTRA_KEYS == {"solar_return"}
    assert h._medium_gate_keys("relationship_rebuilding") == {"lunar_return", "solar_return"}
    assert h.THRESHOLDS["mid_term"] == 25.0


def test_venus_return_is_already_calculated_as_rebuilding_context():
    assert "venus_return" in h.MID_CONTEXT_RETURN_KEYS_BY_STAGE["relationship_rebuilding"]
    assert "venus_return" not in h._medium_gate_keys("relationship_rebuilding")


def test_compare_to_baseline_reports_only_stage_count_deltas():
    baseline = {
        "long_pass": 6,
        "mid_pass": 0,
        "numeric_pass": 0,
        "trigger_pass": 0,
        "hierarchy_pass": 0,
        "peaks": 0,
        "candidate_count": 0,
    }
    current = {
        "long_pass": 6,
        "mid_pass": 2,
        "numeric_pass": 2,
        "trigger_pass": 1,
        "hierarchy_pass": 1,
        "peaks": 1,
        "candidate_count": 1,
    }
    assert compare_to_baseline(baseline, current) == {
        "long_pass": 0,
        "mid_pass": 2,
        "numeric_pass": 2,
        "trigger_pass": 1,
        "hierarchy_pass": 1,
        "peaks": 1,
        "candidate_count": 1,
    }
