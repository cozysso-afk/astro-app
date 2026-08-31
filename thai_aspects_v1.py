# -*- coding: utf-8 -*-
"""Research-only Thai sign-relation aspect facts.

This module classifies only the traditional sign relationship documented as:
- กุม: same sign (house-count 1)
- โยค: 3rd/11th sign count, 60-degree sign relation
- ตรีโกณ: 5th/9th sign count, 120-degree sign relation
- เล็ง: 7th sign count, opposition

The classification basis is sign membership, not a Western orb engine. Exact
longitude separation is exposed only as diagnostic data. No strength percent,
good/bad interpretation, event score, or Gemini usage is allowed here.
"""

from __future__ import annotations

import itertools
import math
from typing import Any, Mapping

ENGINE_VERSION = "thai-sign-aspects-research-v1.0"

RELATIONS = {
    0: {"key": "kum", "thai": "กุม", "label": "same-sign conjunction", "house_counts": (1,)},
    2: {"key": "yok", "thai": "โยค", "label": "60-degree sign relation", "house_counts": (3, 11)},
    4: {"key": "trikona", "thai": "ตรีโกณ", "label": "120-degree sign relation", "house_counts": (5, 9)},
    6: {"key": "leng", "thai": "เล็ง", "label": "opposition sign relation", "house_counts": (7,)},
}


def _finite(value: Any, label: str) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{label} must be numeric") from exc
    if not math.isfinite(result):
        raise ValueError(f"{label} must be finite")
    return result


def _resolve_sign(row: Mapping[str, Any]) -> int:
    if row.get("sign_index") is not None:
        idx = int(row["sign_index"])
    elif row.get("longitude_deg") is not None:
        idx = int((_finite(row["longitude_deg"], "longitude_deg") % 360.0) // 30.0)
    else:
        raise ValueError("position requires sign_index or longitude_deg")
    if not 0 <= idx <= 11:
        raise ValueError("sign_index must be within 0..11")
    return idx


def _longitude(row: Mapping[str, Any]) -> float | None:
    if row.get("longitude_deg") is None:
        return None
    return _finite(row["longitude_deg"], "longitude_deg") % 360.0


def _shortest_delta(a: float, b: float) -> float:
    return abs(((float(b) - float(a) + 180.0) % 360.0) - 180.0)


def classify_sign_relation(*, first_sign_index: int, second_sign_index: int) -> dict[str, Any] | None:
    a = int(first_sign_index)
    b = int(second_sign_index)
    if not 0 <= a <= 11 or not 0 <= b <= 11:
        raise ValueError("sign indices must be within 0..11")
    forward_steps = (b - a) % 12
    shortest_steps = min(forward_steps, (a - b) % 12)
    meta = RELATIONS.get(shortest_steps)
    if meta is None:
        return None
    return {
        **meta,
        "first_sign_index": a,
        "second_sign_index": b,
        "forward_sign_steps": forward_steps,
        "shortest_sign_steps": shortest_steps,
        "basis": "whole-sign relation",
    }


def build_aspect_research(planet_positions: Mapping[str, Mapping[str, Any]]) -> dict[str, Any]:
    normalized: dict[str, dict[str, Any]] = {}
    for raw_key, row in planet_positions.items():
        key = str(raw_key)
        if not isinstance(row, Mapping):
            raise ValueError(f"position {key!r} must be a mapping")
        normalized[key] = {"sign_index": _resolve_sign(row), "longitude_deg": _longitude(row)}

    relations: list[dict[str, Any]] = []
    for first_key, second_key in itertools.combinations(normalized, 2):
        first = normalized[first_key]
        second = normalized[second_key]
        relation = classify_sign_relation(
            first_sign_index=first["sign_index"],
            second_sign_index=second["sign_index"],
        )
        if relation is None:
            continue
        exact_delta = None
        if first["longitude_deg"] is not None and second["longitude_deg"] is not None:
            exact_delta = round(_shortest_delta(first["longitude_deg"], second["longitude_deg"]), 6)
        relations.append({
            "first": first_key,
            "second": second_key,
            "relation": relation,
            "exact_longitude_separation_deg": exact_delta,
            "orb_interpretation_applied": False,
        })

    return {
        "available": True,
        "research_only": True,
        "engine": ENGINE_VERSION,
        "basis": "traditional whole-sign relation; no Western orb substitution",
        "relations": relations,
        "promotion_gate": {
            "sign_geometry_rule_documented": True,
            "strength_percent_allowed": False,
            "pair_meaning_allowed": False,
            "event_judgement_allowed": False,
            "gemini_interpretation_allowed": False,
        },
        "policy": "Geometry facts only. Exact degree separation is diagnostic and does not alter the sign-based classification.",
    }
