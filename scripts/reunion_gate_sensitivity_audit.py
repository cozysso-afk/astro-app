"""Privacy-preserving reunion gate and stage-policy sensitivity replay.

Reads private relationship requests from stdin and emits aggregate gate counts only.
The calculation is rerun for each variant so sequentially skipped medium/fast layers
are genuinely recomputed instead of treating stored zeroes as scores.

This is validation infrastructure. It never changes production thresholds or policy.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys

GATES = ("long_term", "mid_term", "event_trigger")
DELTAS = (-10.0, -5.0, 5.0, 10.0)


def threshold_variants(base: dict[str, float]):
    variants = [("baseline", dict(base))]
    for gate in GATES:
        for delta in DELTAS:
            thresholds = dict(base)
            thresholds[gate] = max(0.0, thresholds[gate] + delta)
            sign = "+" if delta > 0 else ""
            variants.append((f"{gate}{sign}{int(delta)}", thresholds))
    return variants


def policy_variant_specs():
    """Counterfactuals only; none of these are production recommendations."""
    return [
        (
            "meeting_trigger_mars_or_venus",
            {
                "meeting_primary_planets": ("Mars", "Venus"),
                "description": (
                    "Keep meeting long/mid gates and targets unchanged, but allow Venus "
                    "or Mars to be the stage-defining exact trigger."
                ),
            },
        ),
        (
            "medium_gate_add_solar_return",
            {
                "mid_gate_return_keys": ("lunar_return", "solar_return"),
                "description": (
                    "Add Solar Return to the medium gate. In the current stage-context map "
                    "Solar Return is present only for relationship_rebuilding, so this is an "
                    "effectively rebuilding-specific counterfactual."
                ),
            },
        ),
        (
            "medium_gate_add_venus_return",
            {
                "mid_gate_return_keys": ("lunar_return", "venus_return"),
                "description": (
                    "Add Venus Return to the medium gate as a broad stress test. Current context "
                    "maps expose it to emotional, meeting, and rebuilding stages, so this variant "
                    "must not be read as a stage-specific production proposal."
                ),
            },
        ),
        (
            "targeted_candidate_v1",
            {
                "meeting_primary_planets": ("Mars", "Venus"),
                "mid_gate_return_keys": ("lunar_return", "solar_return"),
                "description": (
                    "Combined narrow candidate: allow Mars-or-Venus as the meeting exact trigger "
                    "and let Solar Return join Lunar Return as a medium gate only where Solar Return "
                    "already exists in the stage context (currently relationship_rebuilding). "
                    "Thresholds, targets, aspects, orbs, long-term policy, and peak selection stay unchanged."
                ),
            },
        ),
    ]


def stage_snapshot(hierarchy: dict):
    out = {}
    selectivity = hierarchy.get("selectivity") or {}
    stages = hierarchy.get("stages") or {}
    for stage, values in selectivity.items():
        stage_values = stages.get(stage) or {}
        out[stage] = {
            "future_days": int(values.get("future_total_days") or 0),
            "long_pass": int(values.get("future_long_term_pass_days") or 0),
            "mid_pass": int(values.get("future_medium_anchor_pass_days") or 0),
            "numeric_pass": int(values.get("future_raw_numeric_gate_pass_days") or 0),
            "trigger_pass": int(values.get("future_semantic_stage_trigger_pass_days") or 0),
            "hierarchy_pass": int(values.get("future_hierarchy_eligible_days") or 0),
            "peaks": int(values.get("future_local_peak_days") or 0),
            "candidate_count": int(stage_values.get("candidate_count") or 0),
        }
    return out


def bottleneck(snapshot: dict):
    total = snapshot.get("future_days", 0)
    long_pass = snapshot.get("long_pass", 0)
    mid_pass = snapshot.get("mid_pass", 0)
    hierarchy_pass = snapshot.get("hierarchy_pass", 0)
    peaks = snapshot.get("peaks", 0)
    drops = {
        "long_term": max(0, total - long_pass),
        "mid_term": max(0, long_pass - mid_pass),
        "semantic_trigger": max(0, mid_pass - hierarchy_pass),
        "local_peak": max(0, hierarchy_pass - peaks),
    }
    return max(drops, key=lambda key: (drops[key], key)), drops


def compare_to_baseline(baseline: dict, current: dict):
    out = {}
    for stage, values in current.items():
        base = baseline.get(stage) or {}
        out[stage] = {
            key: int(values.get(key, 0)) - int(base.get(key, 0))
            for key in (
                "long_pass", "mid_pass", "numeric_pass", "trigger_pass",
                "hierarchy_pass", "peaks", "candidate_count",
            )
        }
    return out


def _reset_policy(engine, base_meeting_primary, base_mid_gate_keys):
    meeting = engine.STAGE_TRIGGER_POLICY["in_person_meeting"]["primary_planets"]
    meeting.clear()
    meeting.update(base_meeting_primary)
    engine.MID_GATE_RETURN_KEYS.clear()
    engine.MID_GATE_RETURN_KEYS.update(base_mid_gate_keys)


def apply_policy_variant(engine, spec):
    if "meeting_primary_planets" in spec:
        meeting = engine.STAGE_TRIGGER_POLICY["in_person_meeting"]["primary_planets"]
        meeting.clear()
        meeting.update(spec["meeting_primary_planets"])
    if "mid_gate_return_keys" in spec:
        engine.MID_GATE_RETURN_KEYS.clear()
        engine.MID_GATE_RETURN_KEYS.update(spec["mid_gate_return_keys"])


def replay(checkout: str, requests: list[dict]):
    sys.path.insert(0, str(Path(checkout).resolve()))
    from api.main import RelationshipRequest, relationship_western
    import reunion_hierarchy_v2 as hierarchy_engine

    allowed = (
        "user", "counterpart", "start_date", "end_date", "as_of_date",
        "query_utc_offset_hours", "query_timezone_id", "analysis_mode", "relationship_status",
    )
    base_thresholds = dict(hierarchy_engine.THRESHOLDS)
    base_meeting_primary = set(
        hierarchy_engine.STAGE_TRIGGER_POLICY["in_person_meeting"]["primary_planets"]
    )
    base_mid_gate_keys = set(hierarchy_engine.MID_GATE_RETURN_KEYS)
    threshold_specs = threshold_variants(base_thresholds)
    policy_specs = policy_variant_specs()
    output = []

    def run(body):
        result = relationship_western(RelationshipRequest(**body))["result"]
        hierarchy = result["reunion_hierarchy"]
        return hierarchy.get("version"), stage_snapshot(hierarchy)

    try:
        for index, request in enumerate(requests):
            body = {key: request[key] for key in allowed if key in request}
            threshold_rows = {}
            engine_version = None

            for name, thresholds in threshold_specs:
                _reset_policy(hierarchy_engine, base_meeting_primary, base_mid_gate_keys)
                hierarchy_engine.THRESHOLDS.clear()
                hierarchy_engine.THRESHOLDS.update(thresholds)
                engine_version, threshold_rows[name] = run(body)

            baseline = threshold_rows["baseline"]
            baseline_bottlenecks = {}
            for stage, values in baseline.items():
                primary, drops = bottleneck(values)
                baseline_bottlenecks[stage] = {"primary": primary, "drops": drops}

            sensitivity = {
                name: {
                    "thresholds": thresholds,
                    "delta_vs_baseline": compare_to_baseline(baseline, threshold_rows[name]),
                }
                for name, thresholds in threshold_specs
                if name != "baseline"
            }

            policy_counterfactuals = {}
            for name, spec in policy_specs:
                hierarchy_engine.THRESHOLDS.clear()
                hierarchy_engine.THRESHOLDS.update(base_thresholds)
                _reset_policy(hierarchy_engine, base_meeting_primary, base_mid_gate_keys)
                apply_policy_variant(hierarchy_engine, spec)
                _, current = run(body)
                policy_counterfactuals[name] = {
                    "description": spec["description"],
                    "delta_vs_baseline": compare_to_baseline(baseline, current),
                }

            digest_payload = {
                "engine_version": engine_version,
                "base_thresholds": base_thresholds,
                "baseline": baseline,
                "sensitivity": sensitivity,
                "policy_counterfactuals": policy_counterfactuals,
            }
            output.append({
                "case_index": index + 1,
                "engine_version": engine_version,
                "base_thresholds": base_thresholds,
                "baseline": baseline,
                "baseline_bottlenecks": baseline_bottlenecks,
                "sensitivity": sensitivity,
                "policy_counterfactuals": policy_counterfactuals,
                "determinism_digest": hashlib.sha256(
                    json.dumps(digest_payload, sort_keys=True, ensure_ascii=False).encode()
                ).hexdigest(),
                "privacy": "aggregate counts only; raw profiles and exact candidate dates omitted",
            })
    finally:
        hierarchy_engine.THRESHOLDS.clear()
        hierarchy_engine.THRESHOLDS.update(base_thresholds)
        _reset_policy(hierarchy_engine, base_meeting_primary, base_mid_gate_keys)
    return output


if __name__ == "__main__":
    try:
        requests = json.load(sys.stdin)
        if not isinstance(requests, list) or not requests:
            raise ValueError("expected a non-empty request list")
        print(json.dumps(replay(sys.argv[1], requests), ensure_ascii=False, indent=2))
    except Exception:
        print('{"status":"FAILED","detail":"private sensitivity replay failed; raw exception suppressed"}')
        sys.exit(1)
