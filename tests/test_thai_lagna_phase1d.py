# -*- coding: utf-8 -*-
from __future__ import annotations

import math
import unittest
from datetime import date, datetime, time, timedelta

from thai_lagna_v1 import (
    angular_delta_deg,
    build_suriyayat_lagna_research,
    calculate_common_anto_0600,
    calculate_common_anto_actual_sunrise,
    local_mean_time_correction_minutes,
)


class ThaiLagnaPhase1DInvariants(unittest.TestCase):
    """Non-gold-standard invariants for world-coordinate research safety.

    These tests intentionally do not claim independent numeric validation for
    Korea/world Lagna. They verify mathematical and runtime properties while
    the promotion gate remains closed pending an external non-Thailand corpus.
    """

    def test_lmt_zero_on_standard_meridian(self):
        cases = (
            (135.0, 9.0),    # UTC+9 standard meridian
            (105.0, 7.0),    # UTC+7
            (0.0, 0.0),
            (-75.0, -5.0),
            (150.0, 10.0),
        )
        for longitude, utc in cases:
            with self.subTest(longitude=longitude, utc=utc):
                self.assertAlmostEqual(
                    local_mean_time_correction_minutes(longitude, utc),
                    0.0,
                    places=10,
                )

    def test_lmt_one_degree_equals_four_minutes(self):
        # This is the geometric rule documented by MyHora: Earth rotates
        # 15 degrees/hour, therefore 1 degree longitude = 4 civil minutes.
        self.assertAlmostEqual(local_mean_time_correction_minutes(136.0, 9.0), 4.0)
        self.assertAlmostEqual(local_mean_time_correction_minutes(134.0, 9.0), -4.0)

    def test_0600_legal_anchor_matches_suriyayat_sun(self):
        # MyHora documents this as a basic calibration rule for the common
        # 06:00 dial: at 06:00, Lagna should equal the Suriyayat Sun apart from
        # tiny published-table rounding. Our direct arithmetic should be exact.
        cases = (
            (date(1991, 3, 21), 127.6622, 9.0),
            (date(2026, 3, 24), 100.494066, 7.0),
            (date(2026, 4, 20), 139.6503, 9.0),
            (date(2026, 6, 1), -74.0060, -4.0),
        )
        for day, longitude, utc in cases:
            with self.subTest(day=day, longitude=longitude, utc=utc):
                row = calculate_common_anto_0600(
                    birth_date=day,
                    birth_time=time(6, 0),
                    longitude=longitude,
                    utc_offset_hours=utc,
                    adjust_local_mean_time=False,
                )
                self.assertLess(
                    abs(angular_delta_deg(row["longitude_deg"], row["sun_longitude_deg"])),
                    1e-5,
                )

    def test_world_actual_sunrise_candidate_is_finite(self):
        cases = (
            ("Yeosu", 34.7604, 127.6622, 9.0),
            ("Seoul", 37.5665, 126.9780, 9.0),
            ("Tokyo", 35.6762, 139.6503, 9.0),
            ("NewYork", 40.7128, -74.0060, -4.0),
            ("London", 51.5074, -0.1278, 1.0),
            ("Sydney", -33.8688, 151.2093, 10.0),
            ("Santiago", -33.4489, -70.6693, -4.0),
            ("Singapore", 1.3521, 103.8198, 8.0),
        )
        for name, latitude, longitude, utc in cases:
            with self.subTest(name=name):
                result = calculate_common_anto_actual_sunrise(
                    birth_date=date(2026, 3, 24),
                    birth_time=time(14, 26),
                    latitude=latitude,
                    longitude=longitude,
                    utc_offset_hours=utc,
                    adjust_local_mean_time=True,
                )
                self.assertTrue(result["available"], result)
                value = float(result["longitude_deg"])
                self.assertTrue(math.isfinite(value))
                self.assertGreaterEqual(value, 0.0)
                self.assertLess(value, 360.0)
                # Mid-latitude/local cases above must resolve a sunrise on the
                # requested civil date under the supplied fixed UTC offset.
                self.assertTrue(result["sunrise_local"].startswith("2026-03-24T"))

    def test_polar_no_sunrise_is_explicit_not_fabricated(self):
        # Tromso in northern winter has no astronomical sunrise. Research code
        # must expose an unavailable state rather than invent a fallback time.
        result = calculate_common_anto_actual_sunrise(
            birth_date=date(2026, 12, 21),
            birth_time=time(12, 0),
            latitude=69.6492,
            longitude=18.9553,
            utc_offset_hours=1.0,
            adjust_local_mean_time=True,
        )
        self.assertFalse(result["available"], result)
        self.assertIn("No astronomical sunrise", result["reason"])

    def test_0600_dial_is_continuous_through_sign_boundaries(self):
        # Sweep a full day at one-minute resolution. The shortest traditional
        # sign duration is 72 minutes for 30 degrees, so a one-minute forward
        # step should stay below 0.5 degree even when 359->0 or a sign boundary
        # is crossed. angular_delta_deg prevents false 360-degree jumps.
        day = date(2026, 3, 24)
        previous = None
        crossings = 0
        max_step = 0.0
        for minute_index in range(24 * 60):
            dt = datetime.combine(day, time(0, 0)) + timedelta(minutes=minute_index)
            row = calculate_common_anto_0600(
                birth_date=dt.date(),
                birth_time=dt.time(),
                longitude=100.494066,
                utc_offset_hours=7.0,
                adjust_local_mean_time=True,
            )
            value = float(row["longitude_deg"])
            if previous is not None:
                step = abs(angular_delta_deg(value, previous))
                max_step = max(max_step, step)
                self.assertLess(step, 0.5, (dt.isoformat(), step))
                if int(value // 30) != int(previous // 30):
                    crossings += 1
            previous = value
        self.assertGreaterEqual(crossings, 8)
        self.assertLess(max_step, 0.5)

    def test_promotion_stays_blocked_after_world_matrix(self):
        result = build_suriyayat_lagna_research(
            birth_date=date(1991, 3, 21),
            birth_time=time(7, 26),
            latitude=34.7604,
            longitude=127.6622,
            utc_offset_hours=9.0,
        )
        self.assertTrue(result["available"])
        self.assertTrue(result["research_only"])
        self.assertEqual(result["promotion_status"], "research_only_not_for_interpretation")
        self.assertFalse(result["validation"]["global_coordinates_independently_validated"])
        self.assertFalse(result["promotion_gate"]["houses_allowed"])
        self.assertFalse(result["promotion_gate"]["dignities_allowed"])
        self.assertFalse(result["promotion_gate"]["gemini_interpretation_allowed"])


if __name__ == "__main__":
    unittest.main()
