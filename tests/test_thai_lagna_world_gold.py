# -*- coding: utf-8 -*-
from __future__ import annotations

import unittest
from datetime import date, time

from thai_lagna_v1 import (
    angular_delta_deg,
    calculate_common_anto_0600,
    calculate_common_anto_actual_sunrise,
)


def deg(sign_index: int, degree: int, minute: int) -> float:
    return sign_index * 30.0 + degree + minute / 60.0


def arcmin_error(actual: float, expected: float) -> float:
    return abs(angular_delta_deg(actual, expected)) * 60.0


# Direct MyHora Suriyayat calendar pages, requested with explicit foreign
# latitude/longitude/UTC and 1991-03-21 07:26 local civil time. The returned
# criteria pages echoed the requested coordinates and supplied all four common
# Antoanatee numeric rows. These vectors are independent of this codebase.
MYHORA_WORLD = (
    {
        "name": "Yeosu",
        "latitude": 34.7604,
        "longitude": 127.6622,
        "utc": 9.0,
        "actual": deg(11, 19, 22),
        "actual_lmt": deg(11, 12, 1),
        "fixed": deg(11, 27, 37),
        "fixed_lmt": deg(11, 20, 16),
    },
    {
        "name": "Seoul",
        "latitude": 37.5665,
        "longitude": 126.9780,
        "utc": 9.0,
        "actual": deg(11, 18, 37),
        "actual_lmt": deg(11, 10, 35),
        "fixed": deg(11, 27, 37),
        "fixed_lmt": deg(11, 19, 35),
    },
    {
        "name": "Tokyo",
        "latitude": 35.6762,
        "longitude": 139.6503,
        "utc": 9.0,
        "actual": deg(0, 1, 22),
        "actual_lmt": deg(0, 6, 1),
        "fixed": deg(11, 27, 37),
        "fixed_lmt": deg(0, 2, 16),
    },
    {
        "name": "NewYork",
        "latitude": 40.7128,
        "longitude": -74.0060,
        "utc": -5.0,
        "actual": deg(11, 28, 41),
        "actual_lmt": deg(11, 29, 40),
        "fixed": deg(11, 28, 11),
        "fixed_lmt": deg(11, 29, 10),
    },
)


class ThaiLagnaMyHoraWorldGold(unittest.TestCase):
    def test_fixed_0600_world_reference_corpus(self):
        errors = []
        for row in MYHORA_WORLD:
            with self.subTest(place=row["name"]):
                got = calculate_common_anto_0600(
                    birth_date=date(1991, 3, 21), birth_time=time(7, 26),
                    longitude=row["longitude"], utc_offset_hours=row["utc"],
                    adjust_local_mean_time=False,
                )
                errors.append(arcmin_error(got["longitude_deg"], row["fixed"]))
        # Observed direct match: 0.000 arcmin for all four foreign pages.
        self.assertLessEqual(max(errors), 0.1, errors)

    def test_fixed_0600_lmt_world_reference_corpus(self):
        errors = []
        for row in MYHORA_WORLD:
            with self.subTest(place=row["name"]):
                got = calculate_common_anto_0600(
                    birth_date=date(1991, 3, 21), birth_time=time(7, 26),
                    longitude=row["longitude"], utc_offset_hours=row["utc"],
                    adjust_local_mean_time=True,
                )
                errors.append(arcmin_error(got["longitude_deg"], row["fixed_lmt"]))
        # Observed max 0.732′, mean 0.518′.
        self.assertLessEqual(max(errors), 1.0, errors)
        self.assertLessEqual(sum(errors) / len(errors), 0.75, errors)

    def test_actual_sunrise_world_reference_corpus(self):
        errors = []
        for row in MYHORA_WORLD:
            with self.subTest(place=row["name"]):
                got = calculate_common_anto_actual_sunrise(
                    birth_date=date(1991, 3, 21), birth_time=time(7, 26),
                    latitude=row["latitude"], longitude=row["longitude"],
                    utc_offset_hours=row["utc"], adjust_local_mean_time=False,
                )
                self.assertTrue(got["available"], got)
                errors.append(arcmin_error(got["longitude_deg"], row["actual"]))
        # Observed max 8.500′, mean 4.188′ across the four world coordinates.
        self.assertLessEqual(max(errors), 9.0, errors)
        self.assertLessEqual(sum(errors) / len(errors), 5.0, errors)

    def test_actual_sunrise_lmt_world_reference_corpus(self):
        errors = []
        for row in MYHORA_WORLD:
            with self.subTest(place=row["name"]):
                got = calculate_common_anto_actual_sunrise(
                    birth_date=date(1991, 3, 21), birth_time=time(7, 26),
                    latitude=row["latitude"], longitude=row["longitude"],
                    utc_offset_hours=row["utc"], adjust_local_mean_time=True,
                )
                self.assertTrue(got["available"], got)
                errors.append(arcmin_error(got["longitude_deg"], row["actual_lmt"]))
        # Observed max 7.860′, mean 4.010′.
        self.assertLessEqual(max(errors), 9.0, errors)
        self.assertLessEqual(sum(errors) / len(errors), 5.0, errors)

    def test_tokyo_lmt_crosses_pisces_to_aries_in_independent_world_gold(self):
        row = next(item for item in MYHORA_WORLD if item["name"] == "Tokyo")
        legal = calculate_common_anto_0600(
            birth_date=date(1991, 3, 21), birth_time=time(7, 26),
            longitude=row["longitude"], utc_offset_hours=row["utc"],
            adjust_local_mean_time=False,
        )
        lmt = calculate_common_anto_0600(
            birth_date=date(1991, 3, 21), birth_time=time(7, 26),
            longitude=row["longitude"], utc_offset_hours=row["utc"],
            adjust_local_mean_time=True,
        )
        self.assertEqual(legal["sign_index"], 11, legal)
        self.assertEqual(lmt["sign_index"], 0, lmt)
        self.assertLessEqual(arcmin_error(legal["longitude_deg"], row["fixed"]), 0.1)
        self.assertLessEqual(arcmin_error(lmt["longitude_deg"], row["fixed_lmt"]), 1.0)


if __name__ == "__main__":
    unittest.main()
