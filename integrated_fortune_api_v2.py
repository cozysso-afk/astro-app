# -*- coding: utf-8 -*-
"""API-facing integrated fortune wrapper with selective key-date evidence."""

from __future__ import annotations

from typing import Any

from integrated_fortune_v1 import ENGINE_VERSION as BASE_ENGINE_VERSION
from integrated_fortune_v1 import build_integrated_fortune as _build_integrated_fortune
from key_date_evidence_v2 import KEY_DATE_EVIDENCE_VERSION, enrich_integrated_key_dates

ENGINE_VERSION = f"{BASE_ENGINE_VERSION}+{KEY_DATE_EVIDENCE_VERSION}"


def build_integrated_fortune(**kwargs: Any) -> dict[str, Any]:
    result = _build_integrated_fortune(**kwargs)
    return enrich_integrated_key_dates(
        result,
        birth_date=kwargs["birth_date"],
        birth_time=kwargs["birth_time"],
        latitude=kwargs["latitude"],
        longitude=kwargs["longitude"],
        utc_offset_hours=kwargs["utc_offset_hours"],
    )
