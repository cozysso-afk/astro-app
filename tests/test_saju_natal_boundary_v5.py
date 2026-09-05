from __future__ import annotations

from datetime import date, time as dt_time

from integrated_fortune_v1 import _natal_saju_components
from relationship_saju_v1 import _pillars as relationship_pillars


# External provenance used for these fixed expectations:
# - Hong Kong Observatory, Heavenly Stems and Earthly Branches:
#   Zi=23:00-01:00 and the published day-stem -> hour-stem table.
#   https://www.hko.gov.hk/en/gts/time/stemsandbranches.htm
# - NAOJ 2024 calendar: LiChun 2024-02-04 17:27 JST (UTC+9).
#   https://eco.mtk.nao.ac.jp/koyomi/yoko/2024/rekiyou242.html
# - HKO/Beijing second-level LiChun reference already locked by V2:
#   2024-02-04 17:26:53 UTC+9.
# - Independent Japanese calendar pages agree on day pillars:
#   2024-03-31 = 甲午, 2024-04-01 = 乙未.
#   https://nihonkoyomi.com/2024/3/31/
#   https://nihonkoyomi.com/2024/4/1/
# - lunar_python EightChar sect=2 keeps the late-Zi day pillar on the current
#   civil day; its built-in time stem uses the next-day stem at 23:00-23:59.


def _relationship_case(day: date, clock: dt_time, longitude: float | None, offset: float = 9.0) -> dict:
    return relationship_pillars(
        {
            "birth_date": day,
            "birth_time": clock,
            "longitude": longitude,
            "utc_offset_hours": offset,
            "time_known": True,
        }
    )


def test_external_complete_four_pillars_gold_2024_april_1_midday():
    # 2024-04-01 is 甲辰 year / 丁卯 solar month / 乙未 day.
    # At 135E, UTC+9, 12:00 legal time is only shifted by the equation of time
    # and remains safely inside 午時 (11:00-13:00). HKO Table 5 gives 壬午 for
    # an 乙-day 午 hour.
    expected = {"year": "甲辰", "month": "丁卯", "day": "乙未", "hour": "壬午"}

    natal = _natal_saju_components(date(2024, 4, 1), dt_time(12, 0), 9.0, 135.0)
    assert natal["pillars"] == expected

    relationship = _relationship_case(date(2024, 4, 1), dt_time(12, 0), 135.0)
    assert {key: relationship[key] for key in expected} == expected


def test_natal_year_month_switch_at_absolute_lichun_instant_not_true_solar_wall_clock():
    # Seoul 2024 LiChun is 17:26:53 UTC+9. The longitude/EOT correction moves
    # the displayed true-solar clock by tens of minutes, but it must not move
    # the astronomical instant at which the year/month pillars change.
    before = _natal_saju_components(date(2024, 2, 4), dt_time(17, 20), 9.0, 126.9780)
    after = _natal_saju_components(date(2024, 2, 4), dt_time(17, 30), 9.0, 126.9780)

    assert before["pillars"]["year"] == "癸卯"
    assert before["pillars"]["month"] == "乙丑"
    assert after["pillars"]["year"] == "甲辰"
    assert after["pillars"]["month"] == "丙寅"

    rel_before = _relationship_case(date(2024, 2, 4), dt_time(17, 20), 126.9780)
    rel_after = _relationship_case(date(2024, 2, 4), dt_time(17, 30), 126.9780)
    assert (rel_before["year"], rel_before["month"]) == ("癸卯", "乙丑")
    assert (rel_after["year"], rel_after["month"]) == ("甲辰", "丙寅")


def test_year_month_boundary_is_still_absolute_when_longitude_is_missing():
    before = _relationship_case(date(2024, 2, 4), dt_time(17, 20), None)
    after = _relationship_case(date(2024, 2, 4), dt_time(17, 30), None)

    assert before["precision"] == "legal_time_no_longitude"
    assert after["precision"] == "legal_time_no_longitude"
    assert (before["year"], before["month"]) == ("癸卯", "乙丑")
    assert (after["year"], after["month"]) == ("甲辰", "丙寅")


def test_true_solar_correction_can_cross_to_previous_date_for_day_and_hour():
    # UTC+9 at 120E is one mean-solar hour west of the standard meridian.
    # Around 2024-04-01 the EOT adds a few more westward minutes, so 00:30
    # legal time becomes late-Zi on 2024-03-31 apparent solar time.
    natal = _natal_saju_components(date(2024, 4, 1), dt_time(0, 30), 9.0, 120.0)

    assert natal["effective_local"].date() == date(2024, 3, 31)
    assert natal["effective_local"].hour == 23
    assert natal["pillars"]["year"] == "甲辰"
    assert natal["pillars"]["month"] == "丁卯"
    assert natal["pillars"]["day"] == "甲午"
    # sect=2 late-Zi convention in lunar_python: current day pillar, next-day
    # stem for the 23:00-23:59 Zi hour -> 乙-day starts 丙子.
    assert natal["pillars"]["hour"] == "丙子"


def test_sect2_midnight_policy_is_locked_across_late_and_early_zi():
    late_zi = _natal_saju_components(date(2024, 3, 31), dt_time(23, 50), 9.0, 135.0)
    early_zi = _natal_saju_components(date(2024, 4, 1), dt_time(0, 10), 9.0, 135.0)

    assert late_zi["effective_local"].date() == date(2024, 3, 31)
    assert early_zi["effective_local"].date() == date(2024, 4, 1)
    assert late_zi["pillars"]["day"] == "甲午"
    assert early_zi["pillars"]["day"] == "乙未"
    # Both halves are Zi hour under the chosen midnight day-rollover policy.
    assert late_zi["pillars"]["hour"] == "丙子"
    assert early_zi["pillars"]["hour"] == "丙子"
