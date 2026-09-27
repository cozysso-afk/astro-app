from types import SimpleNamespace

import reunion_hierarchy_v2 as h
from scripts.reunion_long_policy_audit import (
    apply_long_policy_variant,
    capture_long_policy,
    compare_to_baseline,
    long_policy_variant_specs,
    restore_long_policy,
    stage_snapshot,
)


def test_long_policy_variants_are_narrow_and_stage_specific():
    specs = dict(long_policy_variant_specs())
    assert set(specs) == {
        "meeting_directed_add_mars",
        "meeting_directed_add_mercury",
        "rebuilding_directed_add_mercury",
        "rebuilding_core_targets_only",
        "rebuilding_mercury_core_targets",
        "rebuilding_mercury_pair_targets",
        "rebuilding_mercury_without_moon_target",
        "rebuilding_mercury_without_sun_target",
        "rebuilding_mercury_moon_target_only",
        "rebuilding_mercury_sun_target_only",
        "rebuilding_target_add_mercury",
        "targeted_long_candidate_v1",
    }
    assert specs["meeting_directed_add_mars"]["changes"] == {
        "in_person_meeting": {"directed_planets_add": ("Mars",)},
    }
    assert specs["rebuilding_directed_add_mercury"]["changes"] == {
        "relationship_rebuilding": {"directed_planets_add": ("Mercury",)},
    }
    assert specs["rebuilding_mercury_core_targets"]["changes"] == {
        "relationship_rebuilding": {
            "directed_planets_add": ("Mercury",),
            "directed_targets_remove": ("Moon", "Sun"),
        },
    }
    assert specs["rebuilding_mercury_pair_targets"]["changes"] == {
        "relationship_rebuilding": {
            "directed_planets_add": ("Mercury",),
            "directed_targets_remove": ("Moon", "Sun", "Saturn"),
        },
    }
    assert specs["rebuilding_mercury_without_moon_target"]["changes"] == {
        "relationship_rebuilding": {
            "directed_planets_add": ("Mercury",),
            "directed_targets_remove": ("Moon",),
        },
    }
    assert specs["rebuilding_mercury_without_sun_target"]["changes"] == {
        "relationship_rebuilding": {
            "directed_planets_add": ("Mercury",),
            "directed_targets_remove": ("Sun",),
        },
    }


def test_long_policy_mutation_is_reversible():
    engine = SimpleNamespace(STAGE_LONG_POLICY={
        "in_person_meeting": {
            "directed_planets": {"Moon", "Venus", "Sun"},
            "directed_targets": {"ASC", "DSC", "Venus", "Mars"},
            "slow_planets": {"Jupiter", "Saturn", "Uranus"},
            "slow_targets": {"ASC", "DSC", "Venus", "Mars"},
        },
        "relationship_rebuilding": {
            "directed_planets": {"Venus", "Sun"},
            "directed_targets": {"Moon", "Venus", "Sun", "DSC", "Saturn"},
            "slow_planets": {"Jupiter", "Saturn"},
            "slow_targets": {"Moon", "Venus", "Sun", "DSC", "Saturn"},
        },
    })
    baseline = capture_long_policy(engine)
    spec = dict(long_policy_variant_specs())["targeted_long_candidate_v1"]
    apply_long_policy_variant(engine, spec)
    assert "Mars" in engine.STAGE_LONG_POLICY["in_person_meeting"]["directed_planets"]
    assert "Mercury" in engine.STAGE_LONG_POLICY["relationship_rebuilding"]["directed_planets"]
    assert "Mercury" in engine.STAGE_LONG_POLICY["relationship_rebuilding"]["directed_targets"]
    restore_long_policy(engine, baseline)
    assert capture_long_policy(engine) == baseline


def test_narrow_rebuilding_target_variants_remove_only_requested_targets():
    engine = SimpleNamespace(STAGE_LONG_POLICY={
        "relationship_rebuilding": {
            "directed_planets": {"Venus", "Sun"},
            "directed_targets": {"Moon", "Venus", "Sun", "DSC", "Saturn"},
            "slow_planets": {"Jupiter", "Saturn"},
            "slow_targets": {"Moon", "Venus", "Sun", "DSC", "Saturn"},
        },
    })
    baseline = capture_long_policy(engine)
    specs = dict(long_policy_variant_specs())

    apply_long_policy_variant(engine, specs["rebuilding_mercury_core_targets"])
    assert engine.STAGE_LONG_POLICY["relationship_rebuilding"]["directed_planets"] == {"Venus", "Sun", "Mercury"}
    assert engine.STAGE_LONG_POLICY["relationship_rebuilding"]["directed_targets"] == {"Venus", "DSC", "Saturn"}

    restore_long_policy(engine, baseline)
    apply_long_policy_variant(engine, specs["rebuilding_mercury_pair_targets"])
    assert engine.STAGE_LONG_POLICY["relationship_rebuilding"]["directed_targets"] == {"Venus", "DSC"}

    restore_long_policy(engine, baseline)
    apply_long_policy_variant(engine, specs["rebuilding_mercury_without_moon_target"])
    assert engine.STAGE_LONG_POLICY["relationship_rebuilding"]["directed_targets"] == {"Venus", "Sun", "DSC", "Saturn"}

    restore_long_policy(engine, baseline)
    apply_long_policy_variant(engine, specs["rebuilding_mercury_without_sun_target"])
    assert engine.STAGE_LONG_POLICY["relationship_rebuilding"]["directed_targets"] == {"Moon", "Venus", "DSC", "Saturn"}

    restore_long_policy(engine, baseline)
    apply_long_policy_variant(engine, specs["rebuilding_mercury_moon_target_only"])
    assert engine.STAGE_LONG_POLICY["relationship_rebuilding"]["directed_targets"] == {"Moon"}

    restore_long_policy(engine, baseline)
    apply_long_policy_variant(engine, specs["rebuilding_mercury_sun_target_only"])
    assert engine.STAGE_LONG_POLICY["relationship_rebuilding"]["directed_targets"] == {"Sun"}

    restore_long_policy(engine, baseline)
    assert capture_long_policy(engine) == baseline


def test_meeting_mars_is_currently_excluded_from_long_directed_sources_but_counterfactual_admits_it():
    policy = h.STAGE_LONG_POLICY["in_person_meeting"]
    source = {"Mars": 10.0}
    target = {"DSC": 10.0}
    baseline = h._contacts(
        source, target, "in_person_meeting", "secondary", "user->counterpart",
        sources=policy["directed_planets"], targets=policy["directed_targets"], limit=1.5,
    )
    expanded = h._contacts(
        source, target, "in_person_meeting", "secondary", "user->counterpart",
        sources=policy["directed_planets"] | {"Mars"}, targets=policy["directed_targets"], limit=1.5,
    )
    assert baseline == []
    assert expanded and expanded[0]["a"] == "Mars" and expanded[0]["b"] == "DSC"


def test_rebuilding_mercury_source_and_target_counterfactuals_are_independent():
    policy = h.STAGE_LONG_POLICY["relationship_rebuilding"]
    source_only = h._contacts(
        {"Mercury": 10.0}, {"DSC": 10.0}, "relationship_rebuilding", "secondary", "user->counterpart",
        sources=policy["directed_planets"] | {"Mercury"}, targets=policy["directed_targets"], limit=1.5,
    )
    target_only = h._contacts(
        {"Venus": 10.0}, {"Mercury": 10.0}, "relationship_rebuilding", "secondary", "user->counterpart",
        sources=policy["directed_planets"], targets=policy["directed_targets"] | {"Mercury"}, limit=1.5,
    )
    assert source_only and source_only[0]["a"] == "Mercury" and source_only[0]["b"] == "DSC"
    assert target_only and target_only[0]["a"] == "Venus" and target_only[0]["b"] == "Mercury"


def test_rebuilding_mercury_target_attribution_variants_keep_source_change_constant():
    specs = dict(long_policy_variant_specs())
    names = (
        "rebuilding_mercury_without_moon_target",
        "rebuilding_mercury_without_sun_target",
        "rebuilding_mercury_moon_target_only",
        "rebuilding_mercury_sun_target_only",
    )
    for name in names:
        changes = specs[name]["changes"]["relationship_rebuilding"]
        assert changes["directed_planets_add"] == ("Mercury",)
        assert "directed_targets_add" not in changes
        assert "slow_planets_add" not in changes
        assert "slow_targets_add" not in changes


def test_production_long_policy_is_not_changed_by_audit_files():
    assert h.STAGE_LONG_POLICY["in_person_meeting"]["directed_planets"] == {"Moon", "Venus", "Sun"}
    assert h.STAGE_LONG_POLICY["relationship_rebuilding"]["directed_planets"] == {"Venus", "Sun"}
    assert "Mercury" not in h.STAGE_LONG_POLICY["relationship_rebuilding"]["directed_targets"]


def test_stage_snapshot_uses_future_sequential_counts_only():
    hierarchy = {
        "stages": {
            "in_person_meeting": {"candidate_count": 1},
            "relationship_rebuilding": {"candidate_count": 2},
        },
        "selectivity": {
            "in_person_meeting": {
                "future_total_days": 97,
                "future_long_term_pass_days": 5,
                "future_medium_anchor_pass_days": 3,
                "future_raw_numeric_gate_pass_days": 2,
                "future_semantic_stage_trigger_pass_days": 1,
                "future_hierarchy_eligible_days": 1,
                "future_local_peak_days": 1,
            },
            "relationship_rebuilding": {
                "future_total_days": 97,
                "future_long_term_pass_days": 8,
                "future_medium_anchor_pass_days": 4,
                "future_raw_numeric_gate_pass_days": 3,
                "future_semantic_stage_trigger_pass_days": 2,
                "future_hierarchy_eligible_days": 2,
                "future_local_peak_days": 2,
            },
        },
    }
    snap = stage_snapshot(hierarchy)
    assert snap["in_person_meeting"]["long_pass"] == 5
    assert snap["in_person_meeting"]["peaks"] == 1
    assert snap["relationship_rebuilding"]["candidate_count"] == 2


def test_compare_to_baseline_reports_only_count_deltas():
    baseline = {
        "in_person_meeting": {"long_pass": 2, "mid_pass": 2, "numeric_pass": 2, "trigger_pass": 0, "hierarchy_pass": 0, "peaks": 0, "candidate_count": 0},
        "relationship_rebuilding": {"long_pass": 6, "mid_pass": 0, "numeric_pass": 0, "trigger_pass": 0, "hierarchy_pass": 0, "peaks": 0, "candidate_count": 0},
    }
    current = {
        "in_person_meeting": {"long_pass": 5, "mid_pass": 4, "numeric_pass": 3, "trigger_pass": 2, "hierarchy_pass": 2, "peaks": 1, "candidate_count": 1},
        "relationship_rebuilding": {"long_pass": 9, "mid_pass": 4, "numeric_pass": 3, "trigger_pass": 2, "hierarchy_pass": 2, "peaks": 2, "candidate_count": 2},
    }
    delta = compare_to_baseline(baseline, current)
    assert delta["in_person_meeting"] == {
        "long_pass": 3, "mid_pass": 2, "numeric_pass": 1, "trigger_pass": 2,
        "hierarchy_pass": 2, "peaks": 1, "candidate_count": 1,
    }
    assert delta["relationship_rebuilding"]["long_pass"] == 3
