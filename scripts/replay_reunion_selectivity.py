"""Temporary private replay entrypoint for reunion gate/policy sensitivity audit.

Reads REPLAY_REQUESTS_JSON from stdin via the existing Render audit service and emits
aggregate-only sensitivity output. No raw profiles or exact candidate dates are printed.
"""
from __future__ import annotations

import json
import sys

from scripts.reunion_gate_sensitivity_audit import replay


if __name__ == '__main__':
    try:
        requests = json.load(sys.stdin)
        if not isinstance(requests, list) or not requests:
            raise ValueError('expected non-empty request list')
        print(json.dumps(replay(sys.argv[1], requests), ensure_ascii=False, indent=2))
    except Exception:
        print('{"status":"FAILED","detail":"private sensitivity replay failed; raw exception suppressed"}')
        sys.exit(1)
