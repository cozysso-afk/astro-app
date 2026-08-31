# -*- coding: utf-8 -*-
from __future__ import annotations

import math
import unittest
from datetime import date, time

from thai_astrology_v2 import build_thai_fortune
from thai_lagna_v1 import (
    angular_delta_deg,
    build_suriyayat_lagna_research,
    calculate_astronomical_suriyayat_candidate,
    calculate_common_anto_0600,
    local_mean_time_correction_minutes,
)


BANGKOK_LAT = 13.752555
BANGKOK_LON = 100.494066
BANGKOK_UTC = 7.0


def deg(sign_index: int, degree: int, minute: int = 0) -> float:
    return sign_index * 30.0 + degree + minute / 60.0


def arcmin_error(actual: float, expected: float) -> float:
    return abs(angular_delta_deg(actual, expected)) * 60.0


# Independent MyHora reference pages captured during Phase-1 research.
# These are three different dates/times and deliberately include different signs.
MYHORA_BANGKOK = (
    {
        "date": date(2026, 1, 7),
        "time": time(8, 9),
        "common": deg(10, 8, 17),       # Aquarius 8°17′
        "common_lmt": deg(10, 2, 39),   # Aquarius 2°39′
        "sidereal": deg(9, 13, 17),     # Capricorn 13°17′
    },
    {
        "date": date(2026, 3, 24),
        "time": time(14, 15),
        "common": deg(4, 0, 59),        # Leo 0°59′
        "common_lmt": deg(3, 26, 41),   # Cancer 26°41′
        "sidereal": deg(3, 9, 25),      # Cancer 9°25′
    },
    {
        "date": date(2026, 4, 20),
        "time": time(23, 42),
        "common": deg(8, 14, 5),        # Sagittarius 14°05′
        "common_lmt": deg(8, 9, 35),    # Sagittarius 9°35′
        "sidereal": deg(8, 18, 44),     # Sagittarius 18°44′
    },
)


class ThaiLagnaPhase1Tests(unittest.TestCase):
    def test_bangkok_lmt_correction(self):
        # Standard meridian for UTC+7 = 105°E. Bangkok is west of it.
        correction = local_mean_time_correction_minutes(BANGKOK_LON, BANGKOK_UTC)
        self.assertAlmostEqual(correction, -18.023736, places=5)

    def test_common_anto_reference_corpus(self):
        errors = []
        for row in MYHORA_BANGKOK:
            actual = calculate_common_anto_0600(
                birth_date=row["date"], birth_time=row["time"],
                longitude=BANGKOK_LON, utc_offset_hours=BANGKOK_UTC,
                adjust_local_mean_time=False,
            )
            errors.append(arcmin_error(actual["longitude_deg"], row["common"]))
        # Current port tracks the published common-dial references closely.
        self.assertLessEqual(max(errors), 16.0, errors)
        self.assertLessEqual(sum(errors) / len(errors), 10.0, errors)

    def test_common_anto_lmt_reference_corpus(self):
        errors = []
        for row in MYHORA_BANGKOK:
            actual = calculate_common_anto_0600(
                birth_date=row["date"], birth_time=row["time"],
                longitude=BANGKOK_LON, utc_offset_hours=BANGKOK_UTC,
                adjust_local_mean_time=True,
            )
            errors.append(arcmin_error(actual["longitude_deg"], row["common_lmt"]))
        self.assertLessEqual(max(errors), 16.0, errors)
        self.assertLessEqual(sum(errors) / len(errors), 11.0, errors)

    def test_astronomical_crosscheck_reference_corpus(self):
        errors = []
        for row in MYHORA_BANGKOK:
            actual = calculate_astronomical_suriyayat_candidate(
                birth_date=row["date"], birth_time=row["time"],
                latitude=BANGKOK_LAT, longitude=BANGKOK_LON,
                utc_offset_hours=BANGKOK_UTC,
            )
            errors.append(arcmin_error(actual["longitude_deg"], row["sidereal"]))
        # This is intentionally a cross-check, not the promoted rule. Jan has
        # a larger offset, which is exactly why Phase 1 keeps it research-only.
        self.assertLessEqual(max(errors), 36.0, errors)
        self.assertLessEqual(sum(errors) / len(errors), 18.0, errors)

    def test_world_coordinates_are_supported_but_not_promoted(self):
        # Yeosu, Korea. This verifies global coordinates/timezones do not depend
        # on the Thailand province lookup used by the upstream MIT library.
        result = build_suriyayat_lagna_research(
            birth_date=date(1991, 3, 21), birth_time=time(7, 26),
            latitude=34.7604, longitude=127.6622, utc_offset_hours=9.0,
        )
        self.assertTrue(result["available"])
        self.assertTrue(result["research_only"])
        self.assertEqual(result["promotion_status"], "research_only_not_for_interpretation")
        self.assertFalse(result["promotion_gate"]["houses_allowed"])
        self.assertFalse(result["promotion_gate"]["dignities_allowed"])
        self.assertFalse(result["promotion_gate"]["gemini_interpretation_allowed"])
        for key in (
            "common_anto_0600_lmt",
            "astronomical_suriyayat_sidereal_crosscheck",
        ):
            value = result[key]["longitude_deg"]
            self.assertTrue(math.isfinite(value))
            self.assertGreaterEqual(value, 0.0)
            self.assertLess(value, 360.0)

    def test_product_layer_keeps_lagna_unavailable(self):
        result = build_thai_fortune(
            birth_date=date(1991, 3, 21), birth_time=time(7, 26),
            start_date=date(2026, 8, 31), end_date=date(2026, 8, 31),
            utc_offset_hours=9.0,
            latitude=34.7604, longitude=127.6622,
        )
        suri = result["suriyayat"]
        self.assertFalse(suri["lagna"]["available"])
        self.assertTrue(suri["lagna_research"]["research_only"])
        self.assertEqual(
            suri["lagna_research"]["promotion_status"],
            "research_only_not_for_interpretation",
        )
        self.assertFalse(suri["lagna_research"]["promotion_gate"]["gemini_interpretation_allowed"])

    def test_common_method_marks_latitude_as_unused(self):
        result = calculate_common_anto_0600(
            birth_date=date(2026, 3, 24), birth_time=time(14, 15),
            longitude=BANGKOK_LON, utc_offset_hours=BANGKOK_UTC,
            adjust_local_mean_time=True,
        )
        self.assertFalse(result["latitude_used"])
        self.assertTrue(result["longitude_used"])
        self.assertEqual(result["method"], "common_anto_0600_lmt")


if __name__ == "__main__":
    unittest.main()
