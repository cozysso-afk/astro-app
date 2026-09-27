"""Public synthetic fixture probe for the reunion long-policy audit.

This uses the same artificial/non-user birth fixture already present in regression tests.
It is only a behavior probe and must not be interpreted as calibration or accuracy evidence.
"""
from __future__ import annotations

import json

from reunion_long_policy_audit import replay


FIXTURE = {
    "user": {
        "birth_date": "1988-06-12",
        "birth_time": "09:30",
        "latitude": 37.5665,
        "longitude": 126.978,
        "utc_offset_hours": 9,
        "time_source": "official_record",
        "time_confidence": "exact",
    },
    "counterpart": {
        "birth_date": "1990-11-08",
        "birth_time": "16:20",
        "latitude": 35.1796,
        "longitude": 129.0756,
        "utc_offset_hours": 9,
        "time_source": "user_estimate",
        "time_confidence": "medium",
    },
    "start_date": "2026-09-27",
    "end_date": "2026-12-31",
    "as_of_date": "2026-09-27",
    "query_utc_offset_hours": 9,
    "analysis_mode": "reunion",
}


if __name__ == "__main__":
    print(json.dumps(replay(".", [FIXTURE]), ensure_ascii=False, indent=2))
