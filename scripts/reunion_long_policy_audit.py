"""Privacy-preserving audit of stage-specific reunion long-term policy bottlenecks.

The production engine is not retuned here. Each saved request is rerun from scratch
under narrowly scoped counterfactual long-term policy variants and only aggregate
future-stage counts are emitted. Raw profiles, evidence rows, and exact dates are
intentionally excluded from output.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys

TARGET_STAGES = ("in_person_meeting", "relationship_rebuilding")


def long_policy_variant_specs():
    """Minimal source/target expansions for diagnosis, not production recommendations."""
    return [
        (
            "meeting_directed_add_mars",
            {
                "changes": {
                    "in_person_meeting": {"directed_planets_add": ("Mars",)},
                },
                "description": (
                    "Add Mars only to the meeting secondary/solar-arc source set. "
                    "All meeting targets, slow planets, thresholds, aspects, and orbs stay unchanged."
                ),
            },
        ),
        (
            "meeting_directed_add_mercury",
            {
                "changes": {
                    "in_person_meeting": {"directed_planets_add": ("Mercury",)},
                },
                "description": (
                    "Add Mercury only to the meeting secondary/solar-arc source set as a logistics/contact stress test."
                ),
            },
        ),
        (
            "rebuilding_directed_add_mercury",
            {
                "changes": {
                    "relationship_rebuilding": {"directed_planets_add": ("Mercury",)},
                },
                "description": (
                    "Add Mercury only to rebuilding secondary/solar-arc sources while keeping existing rebuilding targets."
                ),
            },
        ),
        (
            "rebuilding_target_add_mercury",
            {
                "changes": {
                    "relationship_rebuilding": {"directed_targets_add": ("Mercury",)},
                },
                "description": (
                    "Add Mercury only as a rebuilding directed target while keeping existing source planets unchanged."
                ),
            },
        ),
        (
            "targeted_long_candidate_v1",
            {
                "changes": {
                    "in_person_meeting": {"directed_planets_add": ("Mars",)},
                    "relationship_rebuilding": {
                        "directed_planets_add": ("Mercury",),
                        "directed_targets_add": ("Mercury",),
                    },
                },
                "description": (
                    "Combined narrow candidate: align meeting long-term directed sources with Mars, "
                    "and admit Mercury on both sides of rebuilding directed contacts."
                ),
            },
        ),
    ]


def capture_long_policy(engine):
    return {
        stage: {key: set(values) for key, values in policy.items()}
        for stage, policy in engine.STAGE_LONG_POLICY.items()
    }


def restore_long_policy(engine, baseline):
    for stage, policy in baseline.items():
        for key, values in policy.items():
            target = engine.STAGE_LONG_POLICY[stage][key]
            target.clear()
            target.update(values)


def apply_long_policy_variant(engine, spec):
    for stage, changes in spec.get("changes", {}).items():
        policy = engine.STAGE_LONG_POLICY[stage]
        for key in ("directed_planets", "directed_targets", "slow_planets", "slow_targets"):
            add = changes.get(key + "_add")
            if add:
                policy[key].update(add)
            remove = changes.get(key + "_remove")
            if remove:
                policy[key].difference_update(remove)


def stage_snapshot(hierarchy: dict):
    selectivity = hierarchy.get("selectivity") or {}
    stages = hierarchy.get("stages") or {}
    out = {}
    for stage in TARGET_STAGES:
        values = selectivity.get(stage) or {}
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


def compare_to_baseline(baseline: dict, current: dict):
    out = {}
    for stage in TARGET_STAGES:
        base = baseline.get(stage) or {}
        values = current.get(stage) or {}
        out[stage] = {
            key: int(values.get(key, 0)) - int(base.get(key, 0))
            for key in (
                "long_pass", "mid_pass", "numeric_pass", "trigger_pass",
                "hierarchy_pass", "peaks", "candidate_count",
            )
        }
    return out


def replay(checkout: str, requests: list[dict]):
    sys.path.insert(0, str(Path(checkout).resolve()))
    from api.main import RelationshipRequest, relationship_western
    import reunion_hierarchy_v2 as engine

    allowed = (
        "user", "counterpart", "start_date", "end_date", "as_of_date",
        "query_utc_offset_hours", "query_timezone_id", "analysis_mode", "relationship_status",
    )
    baseline_policy = capture_long_policy(engine)
    output = []

    def run(body):
        result = relationship_western(RelationshipRequest(**body))["result"]
        hierarchy = result["reunion_hierarchy"]
        revision = (hierarchy.get("selection_policy") or {}).get("policy_revision")
        return hierarchy.get("version"), revision, stage_snapshot(hierarchy)

    try:
        for index, request in enumerate(requests):
            body = {key: request[key] for key in allowed if key in request}
            restore_long_policy(engine, baseline_policy)
            engine_version, policy_revision, baseline = run(body)
            variants = {}
            for name, spec in long_policy_variant_specs():
                restore_long_policy(engine, baseline_policy)
                apply_long_policy_variant(engine, spec)
                _, _, current = run(body)
                variants[name] = {
                    "description": spec["description"],
                    "delta_vs_baseline": compare_to_baseline(baseline, current),
                    "snapshot": current,
                }

            digest_payload = {
                "engine_version": engine_version,
                "policy_revision": policy_revision,
                "baseline": baseline,
                "variants": variants,
            }
            output.append({
                "case_index": index + 1,
                "engine_version": engine_version,
                "policy_revision": policy_revision,
                "baseline": baseline,
                "variants": variants,
                "determinism_digest": hashlib.sha256(
                    json.dumps(digest_payload, sort_keys=True, ensure_ascii=False).encode()
                ).hexdigest(),
                "privacy": "aggregate counts only; raw profiles, evidence rows, and exact candidate dates omitted",
            })
    finally:
        restore_long_policy(engine, baseline_policy)
    return output


if __name__ == "__main__":
    try:
        requests = json.load(sys.stdin)
        if not isinstance(requests, list) or not requests:
            raise ValueError("expected a non-empty request list")
        print(json.dumps(replay(sys.argv[1], requests), ensure_ascii=False, indent=2))
    except Exception:
        print('{"status":"FAILED","detail":"private long-policy replay failed; raw exception suppressed"}')
        sys.exit(1)
