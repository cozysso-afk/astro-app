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
    calculate_common_anto_actual_sunrise,
    local_mean_time_correction_minutes,
)


BANGKOK_LAT = 13.752555
BANGKOK_LON = 100.494066
BANGKOK_UTC = 7.0


def deg(sign_index: int, degree: int, minute: int = 0) -> float:
    return sign_index * 30.0 + degree + minute / 60.0


def arcmin_error(actual: float, expected: float) -> float:
    return abs(angular_delta_deg(actual, expected)) * 60.0


# Independent MyHora Bangkok Suriyayat Lagna references captured during
# Phase-1 research. They span 1777..2026 instead of fitting one modern epoch.
# Each row records three distinct MyHora methods:
# - common: common Antoanatee, fixed 06:00 sunrise anchor
# - common_lmt: same common method with local-mean-time correction
# - sidereal: MyHora sidereal-time / latitude-aware reference, used only as a
#   cross-check because our astronomical mapping is not promoted as Thai canon.
MYHORA_BANGKOK = (
    {
        "date": date(1777, 5, 14), "time": time(6, 42),
        "common": deg(1, 16, 19), "common_lmt": deg(1, 10, 41), "sidereal": deg(1, 14, 40),
    },
    {
        "date": date(1862, 3, 6), "time": time(0, 0),
        "common": deg(7, 10, 31), "common_lmt": deg(7, 6, 45), "sidereal": deg(7, 13, 14),
    },
    {
        "date": date(1871, 1, 22), "time": time(23, 41),
        "common": deg(6, 14, 3), "common_lmt": deg(6, 10, 50), "sidereal": deg(6, 0, 4),
    },
    {
        "date": date(1959, 7, 1), "time": time(0, 18),
        "common": deg(11, 7, 21), "common_lmt": deg(11, 2, 51), "sidereal": deg(11, 16, 28),
    },
    {
        "date": date(2026, 1, 7), "time": time(8, 9),
        "common": deg(10, 8, 17), "common_lmt": deg(10, 2, 39), "sidereal": deg(9, 13, 17),
    },
    {
        "date": date(2026, 3, 24), "time": time(14, 15),
        "common": deg(4, 0, 59), "common_lmt": deg(3, 26, 41), "sidereal": deg(3, 9, 25),
    },
    {
        "date": date(2026, 4, 20), "time": time(23, 42),
        "common": deg(8, 14, 5), "common_lmt": deg(8, 9, 35), "sidereal": deg(8, 18, 44),
    },
)


# Independent MyHora references for the actual-local-sunrise common method.
# Two rows occur before that civil date's sunrise (00:00 / 00:18), covering
# the negative-elapsed/wrap path as well as daytime cases.
MYHORA_BANGKOK_ACTUAL_SUNRISE = (
    {"date": date(1777, 5, 14), "time": time(6, 42), "common": deg(1, 19, 8), "common_lmt": deg(1, 13, 30)},
    {"date": date(1862, 3, 6), "time": time(0, 0), "common": deg(7, 3, 51), "common_lmt": deg(7, 0, 5)},
    {"date": date(1999, 3, 9), "time": time(0, 18), "common": deg(7, 8, 22), "common_lmt": deg(7, 4, 37)},
    {"date": date(2026, 3, 24), "time": time(14, 26), "common": deg(3, 28, 58), "common_lmt": deg(3, 24, 28)},
    {"date": date(2026, 4, 20), "time": time(23, 49), "common": deg(8, 15, 9), "common_lmt": deg(8, 10, 37)},
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
        # Seven independent references spanning 249 years: observed max 15.75′,
        # mean 5.791′. Keep the gate slightly above observed values, not fitted
        # to a single row.
        self.assertLessEqual(max(errors), 16.0, errors)
        self.assertLessEqual(sum(errors) / len(errors), 7.0, errors)

    def test_common_anto_lmt_reference_corpus(self):
        errors = []
        for row in MYHORA_BANGKOK:
            actual = calculate_common_anto_0600(
                birth_date=row["date"], birth_time=row["time"],
                longitude=BANGKOK_LON, utc_offset_hours=BANGKOK_UTC,
                adjust_local_mean_time=True,
            )
            errors.append(arcmin_error(actual["longitude_deg"], row["common_lmt"]))
        # Observed max 15.695′, mean 6.030′ across the same 1777..2026 corpus.
        self.assertLessEqual(max(errors), 16.0, errors)
        self.assertLessEqual(sum(errors) / len(errors), 7.0, errors)

    def test_astronomical_crosscheck_reference_corpus(self):
        errors = []
        for row in MYHORA_BANGKOK:
            actual = calculate_astronomical_suriyayat_candidate(
                birth_date=row["date"], birth_time=row["time"],
                latitude=BANGKOK_LAT, longitude=BANGKOK_LON,
                utc_offset_hours=BANGKOK_UTC,
            )
            errors.append(arcmin_error(actual["longitude_deg"], row["sidereal"]))
        # Observed max 33.957′ and mean 16.219′. This looser result is useful
        # evidence that the astronomical frame-mapping should remain a secondary
        # cross-check rather than the selected traditional candidate.
        self.assertLessEqual(max(errors), 36.0, errors)
        self.assertLessEqual(sum(errors) / len(errors), 18.0, errors)


    def test_actual_sunrise_common_reference_corpus(self):
        errors = []
        for row in MYHORA_BANGKOK_ACTUAL_SUNRISE:
            actual = calculate_common_anto_actual_sunrise(
                birth_date=row["date"], birth_time=row["time"],
                latitude=BANGKOK_LAT, longitude=BANGKOK_LON,
                utc_offset_hours=BANGKOK_UTC, adjust_local_mean_time=False,
            )
            self.assertTrue(actual["available"], actual)
            errors.append(arcmin_error(actual["longitude_deg"], row["common"]))
        self.assertLessEqual(max(errors), 18.0, errors)
        self.assertLessEqual(sum(errors) / len(errors), 10.0, errors)

    def test_actual_sunrise_common_lmt_reference_corpus(self):
        errors = []
        for row in MYHORA_BANGKOK_ACTUAL_SUNRISE:
            actual = calculate_common_anto_actual_sunrise(
                birth_date=row["date"], birth_time=row["time"],
                latitude=BANGKOK_LAT, longitude=BANGKOK_LON,
                utc_offset_hours=BANGKOK_UTC, adjust_local_mean_time=True,
            )
            self.assertTrue(actual["available"], actual)
            errors.append(arcmin_error(actual["longitude_deg"], row["common_lmt"]))
        self.assertLessEqual(max(errors), 18.0, errors)
        self.assertLessEqual(sum(errors) / len(errors), 10.0, errors)

    def test_actual_sunrise_definition_matches_bangkok_reference_clock(self):
        actual = calculate_common_anto_actual_sunrise(
            birth_date=date(2026, 3, 24), birth_time=time(14, 26),
            latitude=BANGKOK_LAT, longitude=BANGKOK_LON,
            utc_offset_hours=BANGKOK_UTC, adjust_local_mean_time=False,
        )
        self.assertTrue(actual["sunrise_local"].startswith("2026-03-24T06:19:"), actual["sunrise_local"])
        self.assertEqual(actual["suriyayat_sun_anchor"], "birth_instant")

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
            "common_anto_actual_sunrise_lmt",
            "astronomical_suriyayat_sidereal_crosscheck",
        ):
            value = result[key]["longitude_deg"]
            self.assertTrue(math.isfinite(value))
            self.assertGreaterEqual(value, 0.0)
            self.assertLess(value, 360.0)

    def test_research_metadata_records_reference_quality(self):
        result = build_suriyayat_lagna_research(
            birth_date=date(1991, 3, 21), birth_time=time(7, 26),
            latitude=34.7604, longitude=127.6622, utc_offset_hours=9.0,
        )
        validation = result["validation"]
        self.assertEqual(validation["reference"], "MyHora Bangkok Suriyayat Lagna")
        self.assertEqual(validation["vectors"], 7)
        self.assertEqual(validation["year_span"], "1777-2026")
        self.assertEqual(validation["common_lmt"]["max_error_arcmin"], 15.695)
        self.assertEqual(validation["common_lmt"]["mean_error_arcmin"], 6.03)
        self.assertFalse(validation["global_coordinates_independently_validated"])

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
