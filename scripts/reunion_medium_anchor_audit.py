"""Privacy-preserving audit of rebuilding medium-anchor semantics.

This runner replays private reunion requests from scratch while changing only which
already-calculated return families may contribute to the relationship_rebuilding
medium gate. Production policy, thresholds, long-term policy, fast-trigger policy,
aspects, orbs, and peak selection are not changed.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys

TARGET_STAGE = "relationship_rebuilding"
RETURN_TYPES = ("lunar_return", "solar_return", "venus_return")


def medium_anchor_variant_specs():
    return [
        (
            "baseline_lunar_solar",
            {
                "keys": ("lunar_return", "solar_return"),
                "description": "PR #235 rebuilding medium-gate policy: Lunar Return or Solar Return.",
            },
        ),
        (
            "rebuilding_lunar_only",
            {
                "keys": ("lunar_return",),
                "description": "Revert rebuilding only to Lunar Return as a medium-gate source.",
            },
        ),
        (
            "rebuilding_solar_only",
            {
                "keys": ("solar_return",),
                "description": "Use Solar Return only for the rebuilding medium gate.",
            },
        ),
        (
            "rebuilding_venus_only",
            {
                "keys": ("venus_return",),
                "description": "Use Venus Return only as a rebuilding medium-gate counterfactual.",
            },
        ),
        (
            "rebuilding_lunar_venus",
            {
                "keys": ("lunar_return", "venus_return"),
                "description": "Use Lunar Return or Venus Return for rebuilding only.",
            },
        ),
        (
            "rebuilding_solar_venus",
            {
                "keys": ("solar_return", "venus_return"),
                "description": "Use Solar Return or Venus Return for rebuilding only.",
            },
        ),
        (
            "rebuilding_lunar_solar_venus",
            {
                "keys": ("lunar_return", "solar_return", "venus_return"),
                "description": "Admit Lunar, Solar, or Venus Return for rebuilding as an audit-only stress test.",
            },
        ),
    ]


def stage_snapshot(hierarchy: dict):
    values = (hierarchy.get("selectivity") or {}).get(TARGET_STAGE) or {}
    stage_values = (hierarchy.get("stages") or {}).get(TARGET_STAGE) or {}
    return {
        "future_days": int(values.get("future_total_days") or 0),
        "long_pass": int(values.get("future_long_term_pass_days") or 0),
        "mid_pass": int(values.get("future_medium_anchor_pass_days") or 0),
        "numeric_pass": int(values.get("future_raw_numeric_gate_pass_days") or 0),
        "trigger_pass": int(values.get("future_semantic_stage_trigger_pass_days") or 0),
        "hierarchy_pass": int(values.get("future_hierarchy_eligible_days") or 0),
        "peaks": int(values.get("future_local_peak_days") or 0),
        "candidate_count": int(stage_values.get("candidate_count") or 0),
    }


def medium_trace_summary(hierarchy: dict, as_of: str):
    rows = [
        row for row in (hierarchy.get("daily_trace") or [])
        if row.get("stage") == TARGET_STAGE
        and str(row.get("date") or "") >= as_of
        and row.get("medium_anchor_evaluated")
    ]
    mid_scores = [float((row.get("components") or {}).get("mid_term") or 0) for row in rows]
    context_scores = [float((row.get("components") or {}).get("mid_context_score") or 0) for row in rows]
    return_type_days = {key: 0 for key in RETURN_TYPES}
    for row in rows:
        types = {
            evidence.get("return_type")
            for evidence in (row.get("mid_evidence") or [])
            if evidence.get("return_type") in return_type_days
        }
        for key in types:
            return_type_days[key] += 1
    return {
        "evaluated_days": len(rows),
        "positive_mid_score_days": sum(score > 0 for score in mid_scores),
        "medium_pass_days": sum(bool(row.get("medium_anchor_pass")) for row in rows),
        "max_mid_score": round(max(mid_scores, default=0.0), 3),
        "max_mid_context_score": round(max(context_scores, default=0.0), 3),
        "context_exceeds_gate_days": sum(context > mid for context, mid in zip(context_scores, mid_scores)),
        "gate_return_type_days": return_type_days,
    }


def compare_to_baseline(baseline: dict, current: dict):
    return {
        key: int(current.get(key, 0)) - int(baseline.get(key, 0))
        for key in (
            "long_pass", "mid_pass", "numeric_pass", "trigger_pass",
            "hierarchy_pass", "peaks", "candidate_count",
        )
    }


def replay(checkout: str, requests: list[dict]):
    sys.path.insert(0, str(Path(checkout).resolve()))
    from api.main import RelationshipRequest, relationship_western
    import reunion_hierarchy_v2 as engine

    allowed = (
        "user", "counterpart", "start_date", "end_date", "as_of_date",
        "query_utc_offset_hours", "query_timezone_id", "analysis_mode", "relationship_status",
    )
    original_medium_gate_keys = engine._medium_gate_keys
    output = []

    def run(body: dict, rebuilding_keys: tuple[str, ...]):
        def stage_medium_gate_keys(stage: str):
            if stage == TARGET_STAGE:
                return set(rebuilding_keys)
            return original_medium_gate_keys(stage)

        engine._medium_gate_keys = stage_medium_gate_keys
        result = relationship_western(RelationshipRequest(**body))["result"]
        hierarchy = result["reunion_hierarchy"]
        as_of = str(body.get("as_of_date") or body.get("start_date"))
        return hierarchy.get("version"), stage_snapshot(hierarchy), medium_trace_summary(hierarchy, as_of)

    try:
        for index, request in enumerate(requests):
            body = {key: request[key] for key in allowed if key in request}
            variants = {}
            engine_version = None
            baseline = None
            baseline_trace = None
            for name, spec in medium_anchor_variant_specs():
                engine_version, snapshot, trace = run(body, spec["keys"])
                if name == "baseline_lunar_solar":
                    baseline = snapshot
                    baseline_trace = trace
                variants[name] = {
                    "description": spec["description"],
                    "snapshot": snapshot,
                    "medium_trace": trace,
                }
            assert baseline is not None and baseline_trace is not None
            for name, values in variants.items():
                if name != "baseline_lunar_solar":
                    values["delta_vs_baseline"] = compare_to_baseline(baseline, values["snapshot"])

            digest_payload = {
                "engine_version": engine_version,
                "baseline": baseline,
                "baseline_trace": baseline_trace,
                "variants": variants,
            }
            output.append({
                "case_index": index + 1,
                "engine_version": engine_version,
                "baseline": baseline,
                "baseline_medium_trace": baseline_trace,
                "variants": variants,
                "determinism_digest": hashlib.sha256(
                    json.dumps(digest_payload, sort_keys=True, ensure_ascii=False).encode()
                ).hexdigest(),
                "privacy": "aggregate counts and score extrema only; raw profiles, evidence rows, and exact dates omitted",
            })
    finally:
        engine._medium_gate_keys = original_medium_gate_keys
    return output


if __name__ == "__main__":
    try:
        requests = json.load(sys.stdin)
        if not isinstance(requests, list) or not requests:
            raise ValueError("expected a non-empty request list")
        print(json.dumps(replay(sys.argv[1], requests), ensure_ascii=False, indent=2))
    except Exception:
        print('{"status":"FAILED","detail":"private medium-anchor replay failed; raw exception suppressed"}')
        sys.exit(1)
