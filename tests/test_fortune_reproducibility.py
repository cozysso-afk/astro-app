"""Synthetic identical-request regression; no network/provider or stored user data."""
from copy import deepcopy
from datetime import date, time

import pytest
from integrated_fortune_precision_v2 import build_integrated_fortune_precision_v2, build_precision_contract


@pytest.mark.parametrize("exact", [False, True])
def test_identical_single_day_scores(exact):
    request = dict(
        birth_date=date(1990, 6, 15), birth_time=time(12, 0),
        latitude=37.5665, longitude=126.978, utc_offset_hours=9,
        gender="female", start_date=date(2026, 9, 12), end_date=date(2026, 9, 12),
        precision=build_precision_contract(dict(time_available=True, time_exact=exact,
            status="exact" if exact else "provisional",
            time_source="official_record" if exact else "family_memory",
            time_confidence="exact" if exact else "medium")),
    )
    first = build_integrated_fortune_precision_v2(**deepcopy(request))
    second = build_integrated_fortune_precision_v2(**deepcopy(request))
    assert first["ok"] and second["ok"]
    assert first["western"]["overall"] == second["western"]["overall"]
    assert first["western"]["daily_scores"] == second["western"]["daily_scores"]
    assert len(first["western"]["overall"]) >= 15
