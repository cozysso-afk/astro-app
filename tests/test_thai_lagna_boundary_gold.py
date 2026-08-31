# -*- coding: utf-8 -*-
from __future__ import annotations

import unittest
from datetime import date, time

from thai_lagna_v1 import (
    angular_delta_deg,
    calculate_common_anto_0600,
    calculate_common_anto_actual_sunrise,
)


BANGKOK_LAT = 13.752555
BANGKOK_LON = 100.494066
BANGKOK_UTC = 7.0


def deg(sign_index: int, degree: int, minute: int = 0) -> float:
    return sign_index * 30.0 + degree + minute / 60.0


def arcmin_error(actual: float, expected: float) -> float:
    return abs(angular_delta_deg(actual, expected)) * 60.0


class ThaiLagnaMyHoraBoundaryGold(unittest.TestCase):
    """Independent MyHora vectors selected specifically for sign-boundary stress.

    These are Bangkok gold vectors, not evidence that world coordinates have
    independently passed. They permanently verify that Local Mean Time can move
    the traditional common Antoanatee result across a 30-degree sign boundary
    without a wrap/sign-index bug.
    """

    def test_common_0600_lmt_crosses_leo_to_cancer_boundary(self):
        # MyHora, Bangkok, 2026-03-24 14:26 local:
        # common 06:00 legal time = Leo 3°17′
        # common 06:00 + LMT      = Cancer 29°28′
        legal_expected = deg(4, 3, 17)
        lmt_expected = deg(3, 29, 28)
        legal = calculate_common_anto_0600(
            birth_date=date(2026, 3, 24), birth_time=time(14, 26),
            longitude=BANGKOK_LON, utc_offset_hours=BANGKOK_UTC,
            adjust_local_mean_time=False,
        )
        lmt = calculate_common_anto_0600(
            birth_date=date(2026, 3, 24), birth_time=time(14, 26),
            longitude=BANGKOK_LON, utc_offset_hours=BANGKOK_UTC,
            adjust_local_mean_time=True,
        )
        self.assertLessEqual(arcmin_error(legal["longitude_deg"], legal_expected), 18.0, legal)
        self.assertLessEqual(arcmin_error(lmt["longitude_deg"], lmt_expected), 18.0, lmt)
        self.assertEqual(legal["sign_index"], 4, legal)
        self.assertEqual(lmt["sign_index"], 3, lmt)
        self.assertNotEqual(legal["sign_index"], lmt["sign_index"])

    def test_actual_sunrise_lmt_crosses_libra_to_virgo_boundary(self):
        # MyHora, Bangkok, 1793-01-07 00:00 local:
        # common actual sunrise legal time = Libra 2°18′
        # common actual sunrise + LMT      = Virgo 29°05′
        legal_expected = deg(6, 2, 18)
        lmt_expected = deg(5, 29, 5)
        legal = calculate_common_anto_actual_sunrise(
            birth_date=date(1793, 1, 7), birth_time=time(0, 0),
            latitude=BANGKOK_LAT, longitude=BANGKOK_LON,
            utc_offset_hours=BANGKOK_UTC, adjust_local_mean_time=False,
        )
        lmt = calculate_common_anto_actual_sunrise(
            birth_date=date(1793, 1, 7), birth_time=time(0, 0),
            latitude=BANGKOK_LAT, longitude=BANGKOK_LON,
            utc_offset_hours=BANGKOK_UTC, adjust_local_mean_time=True,
        )
        self.assertTrue(legal["available"], legal)
        self.assertTrue(lmt["available"], lmt)
        self.assertLessEqual(arcmin_error(legal["longitude_deg"], legal_expected), 18.0, legal)
        self.assertLessEqual(arcmin_error(lmt["longitude_deg"], lmt_expected), 18.0, lmt)
        self.assertEqual(legal["sign_index"], 6, legal)
        self.assertEqual(lmt["sign_index"], 5, lmt)
        self.assertNotEqual(legal["sign_index"], lmt["sign_index"])


if __name__ == "__main__":
    unittest.main()
