# -*- coding: utf-8 -*-
"""Shared Western quadrant-house policy.

Primary house system: Placidus.
Fallback: Porphyry only when Swiss Ephemeris reports that Placidus cannot be
calculated for the requested latitude/time (notably polar latitudes).

The caller receives explicit metadata so a Porphyry fallback is never silent.
"""

from __future__ import annotations

import swisseph as swe

REQUESTED_HOUSE_SYSTEM = "Placidus"
FALLBACK_HOUSE_SYSTEM = "Porphyry"


def _call_houses(jd_ut: float, latitude: float, longitude: float, code: bytes, *, extended: bool):
    if extended:
        return swe.houses_ex(float(jd_ut), float(latitude), float(longitude), code, 0)
    return swe.houses(float(jd_ut), float(latitude), float(longitude), code)


def calculate_quadrant_houses(
    jd_ut: float,
    latitude: float,
    longitude: float,
    *,
    extended: bool = False,
):
    """Return cusps, angles and explicit house-system metadata.

    We intentionally let Swiss Ephemeris decide whether Placidus is calculable
    at a given epoch/latitude. If the Placidus call raises ``swe.Error``, retry
    with Porphyry. Any Porphyry error is allowed to propagate, so invalid input
    is not disguised as a successful fallback.
    """

    try:
        cusps, ascmc = _call_houses(jd_ut, latitude, longitude, b"P", extended=extended)
    except swe.Error as exc:
        cusps, ascmc = _call_houses(jd_ut, latitude, longitude, b"O", extended=extended)
        metadata = {
            "requested": REQUESTED_HOUSE_SYSTEM,
            "used": FALLBACK_HOUSE_SYSTEM,
            "fallback": True,
            "fallback_reason": (
                "Swiss Ephemeris could not calculate Placidus for this latitude/time; "
                "Porphyry was used instead."
            ),
            "swiss_error": str(exc),
        }
    else:
        metadata = {
            "requested": REQUESTED_HOUSE_SYSTEM,
            "used": REQUESTED_HOUSE_SYSTEM,
            "fallback": False,
            "fallback_reason": None,
            "swiss_error": None,
        }
    return cusps, ascmc, metadata
