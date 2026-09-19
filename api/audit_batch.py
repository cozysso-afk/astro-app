from __future__ import annotations

import json
import os

from api.audit_replay import replay


def main() -> None:
    ciphers = json.loads(os.getenv("AUDIT_CIPHERS_JSON", "{}"))
    if not ciphers:
        raise RuntimeError("AUDIT_CIPHERS_JSON is empty")
    for case_id in ("y2026", "y2027a", "y2027b"):
        ciphertext = ciphers.get(case_id)
        if not ciphertext:
            raise RuntimeError(f"missing ciphertext for {case_id}")
        result = replay(case_id, ciphertext)
        print("AUDIT_RESULT " + json.dumps(result, ensure_ascii=False, sort_keys=True), flush=True)


if __name__ == "__main__":
    main()
