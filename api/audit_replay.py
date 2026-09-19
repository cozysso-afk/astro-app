from __future__ import annotations

import base64
import json
import os
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query

from api.main import RelationshipRequest, relationship_western

app = FastAPI(title="PR186 one-time replay audit")


def _decode_payload(case_id: str, ciphertext: str) -> dict:
    try:
        keys = json.loads(os.getenv("AUDIT_KEYS_JSON", "{}"))
        key_b64 = keys.get(case_id)
        if not key_b64:
            raise HTTPException(status_code=404, detail="audit case disabled")
        key = base64.urlsafe_b64decode(key_b64.encode("ascii"))
        data = base64.urlsafe_b64decode(ciphertext.encode("ascii"))
        if len(key) != len(data):
            raise HTTPException(status_code=400, detail="invalid audit payload")
        raw = bytes(a ^ b for a, b in zip(data, key))
        return json.loads(raw.decode("utf-8"))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail="invalid audit payload") from exc


def _compact_window(window: dict | None) -> dict | None:
    if not window:
        return None
    evidence = []
    for row in window.get("fast_evidence", [])[:5]:
        evidence.append({
            "family": row.get("family"),
            "direction": row.get("direction"),
            "a": row.get("a"),
            "b": row.get("b"),
            "aspect": row.get("aspect"),
            "strength": row.get("strength"),
            "orb": row.get("orb"),
        })
    return {
        "start": window.get("start"),
        "end": window.get("end"),
        "date": window.get("date"),
        "stage": window.get("stage"),
        "final": window.get("final"),
        "components": window.get("components"),
        "fast_evidence": evidence,
    }


def _run_case(case_id: str, ciphertext: str) -> dict:
    payload = _decode_payload(case_id, ciphertext)
    started = time.perf_counter()
    response = relationship_western(RelationshipRequest(**payload))
    runtime = time.perf_counter() - started
    result = response["result"]
    hierarchy = result["reunion_hierarchy"]
    trace = hierarchy.get("daily_trace", [])
    public = result.get("reunion_timing_windows", {}).get("windows", [])

    stage_counts = {}
    for stage in hierarchy.get("stages", {}):
        rows = [r for r in trace if r.get("stage") == stage]
        stage_counts[stage] = {
            "total_days": len(rows),
            "gate_pass": sum(bool(r.get("eligible")) for r in rows),
            "stage_trigger_pass": sum(bool(r.get("eligible") and r.get("stage_trigger_ok")) for r in rows),
            "local_peaks": sum(bool(r.get("selection_eligible")) for r in rows),
        }

    return {
        "case": case_id,
        "version": hierarchy.get("version"),
        "runtime_seconds": round(runtime, 3),
        "validation": hierarchy.get("validation", {}).get("status"),
        "selectivity": hierarchy.get("selectivity"),
        "stage_counts": stage_counts,
        "public_count": len(public),
        "nearest": _compact_window(hierarchy.get("nearest_window")),
        "top_periods": [_compact_window(w) for w in hierarchy.get("top_periods", [])[:10]],
        "public": [_compact_window(w) for w in public[:24]],
        "trace_totals": {
            "rows": len(trace),
            "gate_pass": sum(bool(r.get("eligible")) for r in trace),
            "stage_trigger_pass": sum(bool(r.get("eligible") and r.get("stage_trigger_ok")) for r in trace),
            "selected": sum(bool(r.get("selection_eligible")) for r in trace),
        },
    }


def _log_view(result: dict) -> dict:
    return {
        "case": result["case"],
        "version": result["version"],
        "runtime_seconds": result["runtime_seconds"],
        "validation": result["validation"],
        "selectivity": result["selectivity"],
        "stage_counts": result["stage_counts"],
        "public_count": result["public_count"],
        "trace_totals": result["trace_totals"],
        "nearest": result["nearest"],
        "top_periods": result["top_periods"],
        "public_index": [
            {"date": row.get("date"), "stage": row.get("stage"), "final": row.get("final")}
            for row in result["public"]
        ],
    }


@app.on_event("startup")
def startup_replay() -> None:
    if not json.loads(os.getenv("AUDIT_KEYS_JSON", "{}")):
        return
    cipher_path = Path(__file__).with_name("audit_ciphertexts.json")
    if not cipher_path.exists():
        return
    ciphers = json.loads(cipher_path.read_text(encoding="utf-8"))
    for case_id in ("y2026", "y2027a", "y2027b"):
        result = _run_case(case_id, ciphers[case_id])
        print("AUDIT_RESULT " + json.dumps(_log_view(result), ensure_ascii=False, sort_keys=True), flush=True)


@app.get("/health")
def health() -> dict:
    return {"ok": True, "audit": "pr186-v22"}


@app.get("/replay/{case_id}")
def replay(case_id: str, q: str = Query(...)) -> dict:
    return _run_case(case_id, q)
