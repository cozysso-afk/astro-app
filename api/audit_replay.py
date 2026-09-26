from __future__ import annotations

import base64
import json
import os
import threading
from pathlib import Path

from fastapi import FastAPI

from scripts.reunion_gate_sensitivity_audit import replay

app = FastAPI(title="Reunion gate/policy counterfactual audit")


def _decode_payload(case_id: str, ciphertext: str) -> dict:
    keys = json.loads(os.getenv("AUDIT_KEYS_JSON", "{}"))
    key_b64 = keys.get(case_id)
    if not key_b64:
        raise RuntimeError(f"decode:{case_id}:missing_key")
    key = base64.urlsafe_b64decode(key_b64.encode("ascii"))
    data = base64.urlsafe_b64decode(ciphertext.encode("ascii"))
    if len(key) != len(data):
        raise RuntimeError(f"decode:{case_id}:length_mismatch")
    raw = bytes(a ^ b for a, b in zip(data, key))
    try:
        return json.loads(raw.decode("utf-8"))
    except Exception:
        raise RuntimeError(f"decode:{case_id}:json_error") from None


def _worker() -> None:
    try:
        cipher_path = Path(__file__).with_name("audit_ciphertexts.json")
        ciphers = json.loads(cipher_path.read_text(encoding="utf-8"))
        keys = json.loads(os.getenv("AUDIT_KEYS_JSON", "{}"))
        print("SENSITIVITY_INPUT " + json.dumps({"key_count": len(keys), "cipher_count": len(ciphers)}), flush=True)
        payloads = [_decode_payload(case_id, ciphers[case_id]) for case_id in ("y2026", "y2027a", "y2027b")]
        print("SENSITIVITY_DECODED " + json.dumps({"case_count": len(payloads)}), flush=True)
        results = replay(".", payloads)
        print("SENSITIVITY_RESULT " + json.dumps(results, ensure_ascii=False, sort_keys=True), flush=True)
        print("SENSITIVITY_COMPLETE", flush=True)
    except Exception as exc:
        safe_phase = str(exc) if isinstance(exc, RuntimeError) else ""
        print("SENSITIVITY_ERROR " + json.dumps({"error_type": type(exc).__name__, "phase": safe_phase}), flush=True)


@app.on_event("startup")
def startup() -> None:
    threading.Thread(target=_worker, name="reunion-sensitivity", daemon=True).start()


@app.get("/health")
def health() -> dict:
    return {"ok": True, "audit": "reunion-gate-policy-sensitivity-v1"}
