"""Privacy-preserving reunion gate and stage-policy sensitivity replay."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys

GATES = ("long_term", "mid_term", "event_trigger")
DELTAS = (-10.0, -5.0, 5.0, 10.0)


def threshold_variants(base):
    variants = [("baseline", dict(base))]
    for gate in GATES:
        for delta in DELTAS:
            thresholds = dict(base)
            thresholds[gate] = max(0.0, thresholds[gate] + delta)
            sign = "+" if delta > 0 else ""
            variants.append((f"{gate}{sign}{int(delta)}", thresholds))
    return variants


def policy_variant_specs():
    return [
        ("meeting_trigger_mars_or_venus", {"meeting_primary_planets": ("Mars", "Venus"), "description": "meeting exact trigger Mars-only -> Mars-or-Venus"}),
        ("medium_gate_add_solar_return", {"mid_gate_return_keys": ("lunar_return", "solar_return"), "description": "add Solar Return to medium gate; current context makes this rebuilding-specific"}),
        ("medium_gate_add_venus_return", {"mid_gate_return_keys": ("lunar_return", "venus_return"), "description": "add Venus Return to medium gate as broad stress test"}),
    ]


def stage_snapshot(hierarchy):
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


def bottleneck(snapshot):
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


def compare_to_baseline(baseline, current):
    out = {}
    for stage, values in current.items():
        base = baseline.get(stage) or {}
        out[stage] = {
            key: int(values.get(key, 0)) - int(base.get(key, 0))
            for key in ("long_pass", "mid_pass", "numeric_pass", "trigger_pass", "hierarchy_pass", "peaks", "candidate_count")
        }
    return out


def _reset_policy(engine, base_meeting_primary, base_mid_gate_keys):
    meeting = engine.STAGE_TRIGGER_POLICY["in_person_meeting"]["primary_planets"]
    meeting.clear(); meeting.update(base_meeting_primary)
    engine.MID_GATE_RETURN_KEYS.clear(); engine.MID_GATE_RETURN_KEYS.update(base_mid_gate_keys)


def apply_policy_variant(engine, spec):
    if "meeting_primary_planets" in spec:
        meeting = engine.STAGE_TRIGGER_POLICY["in_person_meeting"]["primary_planets"]
        meeting.clear(); meeting.update(spec["meeting_primary_planets"])
    if "mid_gate_return_keys" in spec:
        engine.MID_GATE_RETURN_KEYS.clear(); engine.MID_GATE_RETURN_KEYS.update(spec["mid_gate_return_keys"])


def _phase(name, fn):
    try:
        return fn()
    except Exception as exc:
        raise RuntimeError(f"audit_phase={name};error_type={type(exc).__name__}") from None


def replay(checkout, requests):
    sys.path.insert(0, str(Path(checkout).resolve()))
    from api.main import RelationshipRequest, relationship_western
    import reunion_hierarchy_v2 as hierarchy_engine

    allowed = ("user", "counterpart", "start_date", "end_date", "as_of_date", "query_utc_offset_hours", "analysis_mode", "relationship_status")
    base_thresholds = dict(hierarchy_engine.THRESHOLDS)
    base_meeting_primary = set(hierarchy_engine.STAGE_TRIGGER_POLICY["in_person_meeting"]["primary_planets"])
    base_mid_gate_keys = set(hierarchy_engine.MID_GATE_RETURN_KEYS)
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
            threshold_specs = threshold_variants(base_thresholds)
            for name, thresholds in threshold_specs:
                _reset_policy(hierarchy_engine, base_meeting_primary, base_mid_gate_keys)
                hierarchy_engine.THRESHOLDS.clear(); hierarchy_engine.THRESHOLDS.update(thresholds)
                engine_version, threshold_rows[name] = _phase(f"case{index+1}:threshold:{name}", lambda: run(body))
            baseline = threshold_rows["baseline"]
            baseline_bottlenecks = {}
            for stage, values in baseline.items():
                primary, drops = bottleneck(values)
                baseline_bottlenecks[stage] = {"primary": primary, "drops": drops}
            sensitivity = {
                name: {"thresholds": thresholds, "delta_vs_baseline": compare_to_baseline(baseline, threshold_rows[name])}
                for name, thresholds in threshold_specs if name != "baseline"
            }
            policy_counterfactuals = {}
            for name, spec in policy_variant_specs():
                hierarchy_engine.THRESHOLDS.clear(); hierarchy_engine.THRESHOLDS.update(base_thresholds)
                _reset_policy(hierarchy_engine, base_meeting_primary, base_mid_gate_keys)
                apply_policy_variant(hierarchy_engine, spec)
                _, current = _phase(f"case{index+1}:policy:{name}", lambda: run(body))
                policy_counterfactuals[name] = {"description": spec["description"], "delta_vs_baseline": compare_to_baseline(baseline, current)}
            digest_payload = {"engine_version": engine_version, "base_thresholds": base_thresholds, "baseline": baseline, "sensitivity": sensitivity, "policy_counterfactuals": policy_counterfactuals}
            output.append({
                "case_index": index + 1,
                "engine_version": engine_version,
                "base_thresholds": base_thresholds,
                "baseline": baseline,
                "baseline_bottlenecks": baseline_bottlenecks,
                "sensitivity": sensitivity,
                "policy_counterfactuals": policy_counterfactuals,
                "determinism_digest": hashlib.sha256(json.dumps(digest_payload, sort_keys=True, ensure_ascii=False).encode()).hexdigest(),
                "privacy": "aggregate counts only; raw profiles and exact candidate dates omitted",
            })
    finally:
        hierarchy_engine.THRESHOLDS.clear(); hierarchy_engine.THRESHOLDS.update(base_thresholds)
        _reset_policy(hierarchy_engine, base_meeting_primary, base_mid_gate_keys)
    return output
