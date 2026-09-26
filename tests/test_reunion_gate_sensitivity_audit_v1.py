from scripts.reunion_gate_sensitivity_audit import (
    bottleneck,
    compare_to_baseline,
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
            "hierarchy_pass": 20, "peaks": 6, "candidate_count": 6,
        }
    }
    current = {
        "contact_recontact": {
            "long_pass": 97, "mid_pass": 97, "numeric_pass": 97,
            "hierarchy_pass": 24, "peaks": 7, "candidate_count": 7,
        }
    }
    assert compare_to_baseline(baseline, current)["contact_recontact"] == {
        "long_pass": 0,
        "mid_pass": 0,
        "numeric_pass": 0,
        "hierarchy_pass": 4,
        "peaks": 1,
        "candidate_count": 1,
    }
